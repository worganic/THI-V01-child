import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileNode, ProjectFilesService } from '../../../../../core/services/project-files.service';

export interface FileSaveEvent {
  fileId: string;
  content: string;
}

export interface AdditionalFile {
  name: string;
  content: string;
  fileId: string | null;
}

export interface SectionInfo {
  level: number;
  folderName: string;
  parentPath: string[];
  folderId: string | null;
  parentFolderId: string | null;
  fileId: string | null;
  content: string;
  additionalFiles: AdditionalFile[];
}

type DocBlock =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'image'; key: string; image: FileNode };

interface DocSection {
  folderId: string;
  folderName: string;
  textContent: string; // full text with {{IMG:id}} markers
  blocks: DocBlock[];
  images: FileNode[];
}

@Component({
  selector: 'app-projet-editor-zone',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './projet-editor-zone.component.html',
  host: { class: 'flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden' },
})
export class ProjetEditorZoneComponent implements OnChanges {
  @Input() files: FileNode[] = [];
  @Input() scrollToNodeId: string | null = null;
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  @Input() projectName = '';
  @Input() activeNodeId: string | null = null;
  @Output() fileSave = new EventEmitter<FileSaveEvent>();
  @Output() sectionsChange = new EventEmitter<SectionInfo[]>();
  @Output() nodeActive = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();

  @ViewChild('imageInput') imageInputRef!: ElementRef<HTMLInputElement>;

  imageUploadError = '';
  selectedImageId: string | null = null;
  renamingImageId: string | null = null;
  renameImageValue = '';
  showMoveForImageId: string | null = null;
  deleteConfirmImageId: string | null = null;

  constructor(private svc: ProjectFilesService) {}

  docSections: DocSection[] = [];
  private sectionTextMap = new Map<string, string>();
  focusedSectionId: string | null = null;
  private lastFocusedTextareaEl: HTMLTextAreaElement | null = null;
  private lastCursorPos = 0;

  unifiedContent = '';
  private hasLoaded = false;
  private lastSavedContent = '';
  private saveTimeout: any;

  // ── Lifecycle ──────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges) {
    if (changes['files'] && this.files.length > 0) {
      const newSections = this.buildDocSections(this.files, 1);
      const newContent = this.reconstructContentFromSections(newSections);

      if (!this.hasLoaded) {
        this.docSections = newSections;
        this.sectionTextMap.clear();
        this.docSections.forEach(s => this.sectionTextMap.set(s.folderId, s.textContent));
        this.unifiedContent = newContent;
        this.lastSavedContent = newContent;
        setTimeout(() => this.autoResizeAllSectionTextareas(), 50);
      } else {
        // Fresh images from server, text preserved from sectionTextMap
        this.docSections = newSections.map(s => {
          const preservedText = this.sectionTextMap.get(s.folderId) ?? s.textContent;
          return { ...s, textContent: preservedText, blocks: this.buildBlocks(preservedText, s.images, s.folderId) };
        });
        this.unifiedContent = this.reconstructUnifiedContent();
        setTimeout(() => this.autoResizeAllSectionTextareas(), 50);
      }
      this.hasLoaded = true;
    }
    if (changes['scrollToNodeId'] && this.scrollToNodeId) {
      setTimeout(() => this.scrollToNodeById(this.scrollToNodeId!), 150);
    }
  }

  // ── Section building ───────────────────────────────────────

  private buildDocSections(nodes: FileNode[], depth: number): DocSection[] {
    const sorted = [...nodes].sort((a, b) => (a.order || 0) - (b.order || 0));
    const result: DocSection[] = [];
    for (const node of sorted) {
      if (node.type !== 'folder') continue;
      const heading = '#'.repeat(Math.min(depth, 4)) + ' ' + node.name;
      const mainFile = (node.children || []).find(c => c.type === 'file' && c.name === 'contenu.md')
                    || (node.children || []).find(c => c.type === 'file' && !this.isImageFile(c.name));
      const mainContent = mainFile?.content ?? '';
      const additionalFiles = (node.children || [])
        .filter(c => c.type === 'file' && c !== mainFile && !this.isImageFile(c.name));
      let textContent = heading + '\n';
      if (mainContent.trim()) textContent += mainContent.trimEnd() + '\n';
      if (additionalFiles.length > 0) {
        const blocks = additionalFiles.map(c => `'${c.name.replace(/\.md$/, '')}\n${c.content}\n'`).join('\n\n');
        textContent += '\n' + blocks + '\n';
      }
      textContent = textContent.trimEnd();
      const images = (node.children || []).filter(c => c.type === 'file' && this.isImageFile(c.name));
      result.push({
        folderId: node.id,
        folderName: node.name,
        textContent,
        blocks: this.buildBlocks(textContent, images, node.id),
        images,
      });
      result.push(...this.buildDocSections(node.children || [], depth + 1));
    }
    return result;
  }

  private buildBlocks(fullText: string, imageNodes: FileNode[], folderId: string): DocBlock[] {
    const markerRe = /\n\{\{IMG:([a-f0-9-]+)\}\}\n/g;
    const blocks: DocBlock[] = [];
    let lastIndex = 0;
    let textIdx = 0;
    const referencedIds = new Set<string>();
    let m: RegExpExecArray | null;

    while ((m = markerRe.exec(fullText)) !== null) {
      blocks.push({ kind: 'text', key: `${folderId}-t${textIdx++}`, text: fullText.substring(lastIndex, m.index) });
      const imgId = m[1];
      const imgNode = imageNodes.find(n => n.id === imgId);
      if (imgNode) {
        blocks.push({ kind: 'image', key: `${folderId}-i${imgId}`, image: imgNode });
        referencedIds.add(imgId);
      }
      lastIndex = m.index + m[0].length;
    }
    blocks.push({ kind: 'text', key: `${folderId}-t${textIdx}`, text: fullText.substring(lastIndex) });

    // Images without marker → append at end (backward compat)
    for (const img of imageNodes) {
      if (!referencedIds.has(img.id)) {
        blocks.push({ kind: 'image', key: `${folderId}-i${img.id}`, image: img });
      }
    }
    return blocks;
  }

  private reconstructContentFromSections(sections: DocSection[]): string {
    const texts = sections.map(s => s.textContent).filter(t => t.trim());
    return texts.join('\n\n') + (texts.length > 0 ? '\n' : '');
  }

  private reconstructUnifiedContent(): string {
    const texts = this.docSections
      .map(s => this.sectionTextMap.get(s.folderId) ?? s.textContent)
      .filter(t => t.trim());
    return texts.join('\n\n') + (texts.length > 0 ? '\n' : '');
  }

  private reconstructSectionFullText(folderId: string): string {
    const section = this.docSections.find(s => s.folderId === folderId);
    if (!section) return this.sectionTextMap.get(folderId) ?? '';
    const sectionEl = document.getElementById('section-' + folderId);
    const taByKey = new Map<string, string>();
    if (sectionEl) {
      sectionEl.querySelectorAll<HTMLTextAreaElement>('.section-textarea').forEach(ta => {
        const key = ta.getAttribute('data-block-key');
        if (key) taByKey.set(key, ta.value);
      });
    }
    let result = '';
    for (const block of section.blocks) {
      if (block.kind === 'text') {
        result += taByKey.has(block.key) ? taByKey.get(block.key)! : block.text;
      } else {
        result += '\n{{IMG:' + block.image.id + '}}\n';
      }
    }
    return result;
  }

  private getInsertPositionInFullText(folderId: string): number {
    const section = this.docSections.find(s => s.folderId === folderId);
    if (!section || !this.lastFocusedTextareaEl) {
      return (this.sectionTextMap.get(folderId) ?? '').length;
    }
    const blockKey = this.lastFocusedTextareaEl.getAttribute('data-block-key');
    if (!blockKey) return (this.sectionTextMap.get(folderId) ?? '').length;

    const sectionEl = document.getElementById('section-' + folderId);
    const taByKey = new Map<string, string>();
    if (sectionEl) {
      sectionEl.querySelectorAll<HTMLTextAreaElement>('.section-textarea').forEach(ta => {
        const key = ta.getAttribute('data-block-key');
        if (key) taByKey.set(key, ta.value);
      });
    }
    let pos = 0;
    for (const block of section.blocks) {
      if (block.kind === 'text') {
        if (block.key === blockKey) return pos + this.lastCursorPos;
        pos += (taByKey.get(block.key) ?? block.text).length;
      } else {
        pos += `\n{{IMG:${block.image.id}}}\n`.length;
      }
    }
    return pos;
  }

  // ── Content parsing / saving ───────────────────────────────

  private slugify(text: string): string {
    return text.toString().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
      .replace(/-+/g, '-').trim();
  }

  private buildFolderMap(nodes: FileNode[], prefix: string[] = []): Map<string, { folder: FileNode; files: FileNode[] }> {
    const map = new Map<string, { folder: FileNode; files: FileNode[] }>();
    for (const node of nodes) {
      if (node.type === 'folder') {
        const pathParts = [...prefix, this.slugify(node.name)];
        const key = pathParts.join('/');
        const files = (node.children || []).filter(c => c.type === 'file');
        map.set(key, { folder: node, files });
        const submap = this.buildFolderMap(node.children || [], pathParts);
        submap.forEach((v, k) => map.set(k, v));
      }
    }
    return map;
  }

  parseContent(): SectionInfo[] {
    const text = this.unifiedContent;
    const folderMap = this.buildFolderMap(this.files);
    const sections: SectionInfo[] = [];
    const regex = /^(#{1,4}) (.+)$/gm;
    const matches: { level: number; name: string; index: number; contentStart: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ level: m[1].length, name: m[2].trim(), index: m.index, contentStart: m.index + m[0].length + 1 });
    }
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const contentEnd = i + 1 < matches.length ? matches[i + 1].index : text.length;
      let rawContent = text.substring(current.contentStart, contentEnd).trimEnd();
      const additionalFiles: AdditionalFile[] = [];
      const blockRegex = /^(['`^])([^\n]+)(?:\n([\s\S]*?))?\n?\1/gm;
      const mainContent = rawContent.replace(blockRegex, (match, delimiter, title, content) => {
        additionalFiles.push({ name: title.trim(), content: (content || '').trimEnd(), fileId: null });
        return '';
      }).trim();
      const parentPath: string[] = [];
      let targetLevel = current.level - 1;
      for (let k = i - 1; k >= 0 && targetLevel > 0; k--) {
        if (matches[k].level === targetLevel) { parentPath.unshift(matches[k].name); targetLevel--; }
      }
      const fullPath = [...parentPath.map(p => this.slugify(p)), this.slugify(current.name)].join('/');
      const parentKey = parentPath.map(p => this.slugify(p)).join('/');
      const info = folderMap.get(fullPath);
      const parentInfo = parentKey ? folderMap.get(parentKey) : null;
      const mainFile = info?.files.find(f => f.name === 'contenu.md') || info?.files.find(f => !this.isImageFile(f.name));
      additionalFiles.forEach(af => {
        const found = info?.files.find(f => this.slugify(f.name.replace(/\.md$/, '')) === this.slugify(af.name));
        if (found) af.fileId = found.id;
      });
      sections.push({
        level: current.level, folderName: current.name, parentPath,
        folderId: info?.folder.id ?? null, parentFolderId: parentInfo?.folder.id ?? null,
        fileId: mainFile?.id ?? null, content: mainContent, additionalFiles
      });
    }
    return sections;
  }

  private saveAll() {
    if (this.unifiedContent === this.lastSavedContent) return;
    this.lastSavedContent = this.unifiedContent;
    const sections = this.parseContent();
    this.sectionsChange.emit(sections);
  }

  // ── Section events ─────────────────────────────────────────

  onSectionFocus(folderId: string, event: FocusEvent) {
    this.focusedSectionId = folderId;
    this.lastFocusedTextareaEl = event.target as HTMLTextAreaElement;
    this.clearImageSelection();
  }

  onBlockInput(folderId: string, event: Event) {
    const ta = event.target as HTMLTextAreaElement;
    this.autoResizeSectionTextarea(ta);
    const newFullText = this.reconstructSectionFullText(folderId);
    this.sectionTextMap.set(folderId, newFullText);
    this.unifiedContent = this.reconstructUnifiedContent();
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveAll(), 2000);
  }

  onSectionBlur(folderId: string) {
    clearTimeout(this.saveTimeout);
    const newFullText = this.reconstructSectionFullText(folderId);
    this.sectionTextMap.set(folderId, newFullText);
    this.unifiedContent = this.reconstructUnifiedContent();
    this.saveAll();
  }

  onSectionCursorMove(folderId: string, event: Event) {
    const ta = event.target as HTMLTextAreaElement;
    this.lastFocusedTextareaEl = ta;
    this.lastCursorPos = ta.selectionStart;
    const pos = ta.selectionStart;
    const sectionText = ta.value;
    const blockRegex = /^(['`^])([^\n]+)\n([\s\S]*?)\n\1/gm;
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = blockRegex.exec(sectionText)) !== null) {
      if (pos >= blockMatch.index && pos <= blockMatch.index + blockMatch[0].length) {
        const name = blockMatch[2].trim();
        const node = this.findNodeBySlug(name, 'file');
        if (node) { this.nodeActive.emit(node.id); return; }
      }
    }
    this.nodeActive.emit(folderId);
  }

  // ── Toolbar actions ────────────────────────────────────────

  insertAt(before: string, after = '') {
    const ta = this.lastFocusedTextareaEl;
    const folderId = this.focusedSectionId;
    if (!ta || !folderId) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);
    const newVal = ta.value.substring(0, start) + before + selected + after + ta.value.substring(end);
    ta.value = newVal;
    const newFullText = this.reconstructSectionFullText(folderId);
    this.sectionTextMap.set(folderId, newFullText);
    this.unifiedContent = this.reconstructUnifiedContent();
    this.saveAll();
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  // ── Called from parent (no-op: sections rebuilt via ngOnChanges) ───

  appendSection(folderName: string, level = 1) {}

  insertSectionInParent(parentName: string, parentDepth: number, sectionName: string) {}

  // ── Scroll / navigation ────────────────────────────────────

  scrollToNodeById(id: string) {
    const node = this.findNode(id, this.files);
    if (!node) return;
    if (node.type === 'file' && this.isImageFile(node.name)) {
      setTimeout(() => {
        document.getElementById('img-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }
    if (node.type === 'folder') {
      setTimeout(() => {
        document.getElementById('section-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return;
    }
    const parent = this.findParentFolder(id, this.files);
    if (parent) {
      setTimeout(() => {
        document.getElementById('section-' + parent.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  // ── DOM helpers ────────────────────────────────────────────

  private autoResizeAllSectionTextareas() {
    document.querySelectorAll<HTMLTextAreaElement>('.section-textarea')
      .forEach(ta => this.autoResizeSectionTextarea(ta));
  }

  private autoResizeSectionTextarea(ta: HTMLTextAreaElement) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  // ── Tree helpers ───────────────────────────────────────────

  private findNode(id: string, nodes: FileNode[]): FileNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) { const f = this.findNode(id, n.children); if (f) return f; }
    }
    return null;
  }

  private findParentFolder(id: string, nodes: FileNode[]): FileNode | null {
    for (const node of nodes) {
      if (node.type === 'folder') {
        if ((node.children || []).some(c => c.id === id)) return node;
        const found = this.findParentFolder(id, node.children || []);
        if (found) return found;
      }
    }
    return null;
  }

  private findNodeBySlug(name: string, type: 'file' | 'folder', nodes: FileNode[] = this.files): FileNode | null {
    if (!name) return null;
    const slugSearch = this.slugify(name);
    const lowerSearch = name.trim().toLowerCase();
    for (const n of nodes) {
      const nodeSlug = this.slugify(n.name);
      const nodeLower = n.name.trim().toLowerCase();
      if (n.type === 'folder') {
        if (type === 'folder' && (nodeSlug === slugSearch || nodeLower === lowerSearch)) return n;
        if (n.children) { const found = this.findNodeBySlug(name, type, n.children); if (found) return found; }
      } else if (n.type === 'file' && type === 'file') {
        const fileNameNoExt = n.name.replace(/\.md$/, '').trim().toLowerCase();
        if (n.name !== 'contenu.md' && (this.slugify(fileNameNoExt) === slugSearch || fileNameNoExt === lowerSearch)) return n;
      }
    }
    return null;
  }

  // ── Image helpers ──────────────────────────────────────────

  isImageFile(name: string): boolean {
    return this.svc.isImageFile(name);
  }

  get activeImage(): FileNode | null {
    if (!this.activeNodeId) return null;
    const node = this.findNode(this.activeNodeId, this.files);
    return (node?.type === 'file' && this.isImageFile(node.name)) ? node : null;
  }

  getImageCardClasses(img: FileNode): string {
    const base = 'transition-all rounded-lg p-1 cursor-pointer';
    if (this.selectedImageId === img.id || this.activeImage?.id === img.id)
      return base + ' outline outline-2 outline-light-primary dark:outline-primary';
    return base + ' hover:outline hover:outline-1 hover:outline-light-border dark:hover:outline-white/20';
  }

  getAllFolders(nodes: FileNode[] = this.files, result: FileNode[] = []): FileNode[] {
    for (const n of nodes) {
      if (n.type === 'folder') {
        result.push(n);
        this.getAllFolders(n.children || [], result);
      }
    }
    return result;
  }

  selectImage(img: FileNode, event: Event) {
    event.stopPropagation();
    if (this.selectedImageId === img.id) {
      this.clearImageSelection();
    } else {
      this.selectedImageId = img.id;
      this.renamingImageId = null;
      this.showMoveForImageId = null;
      this.deleteConfirmImageId = null;
      this.nodeActive.emit(img.id);
    }
  }

  clearImageSelection() {
    this.selectedImageId = null;
    this.renamingImageId = null;
    this.showMoveForImageId = null;
    this.deleteConfirmImageId = null;
  }

  startRenameImage(img: FileNode) {
    this.renamingImageId = img.id;
    this.renameImageValue = img.name.replace(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i, '');
    this.showMoveForImageId = null;
    this.deleteConfirmImageId = null;
  }

  async confirmRenameImage(img: FileNode) {
    const newName = this.renameImageValue.trim();
    if (!newName || newName === img.name) { this.cancelRenameImage(); return; }
    try {
      await this.svc.renameFile(this.projectName, img.id, newName);
      this.clearImageSelection();
      this.refresh.emit();
    } catch (e: any) {
      console.error('[Zone4] Rename image failed:', e);
    }
  }

  cancelRenameImage() {
    this.renamingImageId = null;
    this.renameImageValue = '';
  }

  askDeleteImage(img: FileNode) {
    this.deleteConfirmImageId = img.id;
    this.showMoveForImageId = null;
  }

  async confirmDeleteImage(img: FileNode) {
    try {
      await this.svc.deleteFile(this.projectName, img.id);
      this.clearImageSelection();
      // Remove position marker from section text
      const sourceSection = this.docSections.find(s => s.images.some(i => i.id === img.id));
      if (sourceSection) {
        const markerRe = new RegExp(`\\n\\{\\{IMG:${img.id}\\}\\}\\n`, 'g');
        const currentText = this.sectionTextMap.get(sourceSection.folderId) ?? sourceSection.textContent;
        const newText = currentText.replace(markerRe, '\n');
        this.sectionTextMap.set(sourceSection.folderId, newText);
        this.unifiedContent = this.reconstructUnifiedContent();
        this.saveAll();
      }
      this.refresh.emit();
    } catch (e: any) {
      console.error('[Zone4] Delete image failed:', e);
    }
  }

  cancelDeleteImage() {
    this.deleteConfirmImageId = null;
  }

  toggleMoveImage(img: FileNode) {
    this.showMoveForImageId = this.showMoveForImageId === img.id ? null : img.id;
    this.deleteConfirmImageId = null;
  }

  async moveImageToFolder(img: FileNode, targetFolderId: string | null) {
    try {
      // Remove marker from source section
      const sourceSection = this.docSections.find(s => s.images.some(i => i.id === img.id));
      if (sourceSection) {
        const markerRe = new RegExp(`\\n\\{\\{IMG:${img.id}\\}\\}\\n`, 'g');
        const currentText = this.sectionTextMap.get(sourceSection.folderId) ?? sourceSection.textContent;
        const newText = currentText.replace(markerRe, '\n');
        this.sectionTextMap.set(sourceSection.folderId, newText);
        this.unifiedContent = this.reconstructUnifiedContent();
        this.saveAll();
      }
      await this.svc.moveFile(this.projectName, img.id, targetFolderId);
      this.clearImageSelection();
      this.nodeActive.emit(img.id);
      this.refresh.emit();
    } catch (e: any) {
      console.error('[Zone4] Move image failed:', e);
    }
  }

  getImageUrl(imagePath: string): string {
    return this.svc.getImageUrl(this.projectName, imagePath);
  }

  triggerImageUpload() {
    this.imageUploadError = '';
    this.imageInputRef?.nativeElement.click();
  }

  async onImageFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
    if (!allowed.includes(file.type)) {
      this.imageUploadError = 'Type non autorisé (jpg, png, gif, webp, svg).';
      return;
    }
    if (file.size > 1024 * 1024) {
      this.imageUploadError = `Fichier trop grand (${(file.size / 1024 / 1024).toFixed(1)} Mo). Max 1 Mo.`;
      return;
    }
    const folderId = this.focusedSectionId || this.getActiveFolderId();
    try {
      const node = await this.svc.uploadImage(this.projectName, file, folderId);
      this.imageUploadError = '';

      if (folderId) {
        // Insert marker at cursor position in section full text
        const insertPos = this.getInsertPositionInFullText(folderId);
        const currentFullText = this.reconstructSectionFullText(folderId);
        const before = currentFullText.substring(0, insertPos);
        const after = currentFullText.substring(insertPos);
        // Ensure exactly one newline on each side of the marker
        const prefix = before.endsWith('\n') ? '' : '\n';
        const suffix = after.startsWith('\n') ? '' : '\n';
        const newFullText = before + prefix + '{{IMG:' + node.id + '}}' + suffix + after;

        this.sectionTextMap.set(folderId, newFullText);

        // Immediately rebuild blocks
        const currentSection = this.docSections.find(s => s.folderId === folderId);
        const allImages = [...(currentSection?.images ?? []), node];
        this.docSections = this.docSections.map(s => {
          if (s.folderId !== folderId) return s;
          return { ...s, textContent: newFullText, images: allImages, blocks: this.buildBlocks(newFullText, allImages, folderId) };
        });

        this.unifiedContent = this.reconstructUnifiedContent();
        this.saveAll();
      }

      this.refresh.emit();
    } catch (e: any) {
      this.imageUploadError = e?.error?.error || 'Erreur lors de l\'upload.';
    }
  }

  private getActiveFolderId(): string | null {
    if (!this.activeNodeId) return null;
    const node = this.findNode(this.activeNodeId, this.files);
    if (node?.type === 'folder') return node.id;
    return this.findParentFolder(this.activeNodeId, this.files)?.id || null;
  }
}
