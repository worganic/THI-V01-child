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
  | { kind: 'text'; key: string; text: string; fileId?: string | null; folderId?: string | null }
  | { kind: 'image'; key: string; image: FileNode };

interface DocSection {
  folderId: string;
  folderName: string;
  textContent: string; // full text with {{IMG:id}} markers
  blocks: DocBlock[];
  images: FileNode[];
  mainFileId: string | null;
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
  private highlightedSectionIds = new Set<string>();
  private highlightPositions = new Map<string, 'only' | 'first' | 'middle' | 'last'>();
  private fileBlockPositions = new Map<string, 'only' | 'first' | 'middle' | 'last'>();
  private lastFocusedTextareaEl: HTMLTextAreaElement | null = null;
  private lastCursorPos = 0;

  unifiedContent = '';
  private hasLoaded = false;
  private lastSavedContent = '';
  private saveTimeout: any;
  private lastStructureKey: string | null = null;

  // ── Lifecycle ──────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges) {
    if (changes['files'] && this.files.length > 0) {
      const currentStructure = this.getFileStructureKey(this.files);
      const hasStructuralChange = this.lastStructureKey !== null && this.lastStructureKey !== currentStructure;
      this.lastStructureKey = currentStructure;

      const newSections = this.buildDocSections(this.files, 1);
      const newContent = this.reconstructContentFromSections(newSections);

      if (!this.hasLoaded || hasStructuralChange) {
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
          return { ...s, textContent: preservedText, blocks: this.buildBlocks(preservedText, s.images, s.folderId, s.mainFileId) };
        });
        this.unifiedContent = this.reconstructUnifiedContent();
        setTimeout(() => this.autoResizeAllSectionTextareas(), 50);
      }
      this.hasLoaded = true;
      this.highlightedSectionIds = this.computeHighlightedIds(this.activeNodeId);
      this.rebuildHighlightPositions();
    }
    if (changes['activeNodeId']) {
      this.focusedSectionId = null;
      this.highlightedSectionIds = this.computeHighlightedIds(this.activeNodeId);
      this.rebuildHighlightPositions();
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
        blocks: this.buildBlocks(textContent, images, node.id, mainFile?.id || null),
        images,
        mainFileId: mainFile?.id || null,
      });
      result.push(...this.buildDocSections(node.children || [], depth + 1));
    }
    return result;
  }

  private buildBlocks(fullText: string, imageNodes: FileNode[], folderId: string, mainFileId: string | null = null): DocBlock[] {
    const markerRe = /\n\{\{IMG:([a-f0-9-]+)\}\}\n/g;
    const blocks: DocBlock[] = [];
    let lastIndex = 0;
    let textIdx = 0;
    const referencedIds = new Set<string>();
    let m: RegExpExecArray | null;

    while ((m = markerRe.exec(fullText)) !== null) {
      const text = fullText.substring(lastIndex, m.index);
      this.pushTextBlocks(blocks, text, folderId, mainFileId, textIdx);
      textIdx += 2;
      const imgId = m[1];
      const imgNode = imageNodes.find(n => n.id === imgId);
      if (imgNode) {
        blocks.push({ kind: 'image', key: `${folderId}-i${imgId}`, image: imgNode });
        referencedIds.add(imgId);
      }
      lastIndex = m.index + m[0].length;
    }
    const finalEx = fullText.substring(lastIndex);
    this.pushTextBlocks(blocks, finalEx, folderId, mainFileId, textIdx);

    // Images without marker → append at end (backward compat)
    for (const img of imageNodes) {
      if (!referencedIds.has(img.id)) {
        blocks.push({ kind: 'image', key: `${folderId}-i${img.id}`, image: img });
      }
    }
    return blocks;
  }

  private pushTextBlocks(blocks: DocBlock[], text: string, folderId: string, mainFileId: string | null, startIndex: number) {
    if (!text) return;
    let currentText = text;
    let localIdx = startIndex;

    // 1. Heading extraction
    const trimmed = currentText.trimStart();
    if (trimmed.startsWith('#')) {
      const firstNL = currentText.indexOf('\n');
      const heading = (firstNL !== -1) ? currentText.substring(0, firstNL + 1) : currentText + '\n';
      blocks.push({ 
        kind: 'text', 
        key: `${folderId}-t${localIdx++}`, 
        text: heading,
        folderId: folderId
      });
      currentText = (firstNL !== -1) ? currentText.substring(firstNL + 1) : '';
    }

    if (!currentText) return;

    // 2. Split between main content and additional files using manual scan
    let lastPos = 0;
    const delimiters = ["'", "`", "^"];
    
    while (lastPos < currentText.length) {
      let foundStart = -1;
      let usedDelim = "";
      
      for (const d of delimiters) {
        const idx = currentText.indexOf(d, lastPos);
        if (idx !== -1 && (foundStart === -1 || idx < foundStart)) {
          // Block must be at start of text or after a newline
          if (idx === 0 || currentText[idx-1] === '\n') {
            foundStart = idx;
            usedDelim = d;
          }
        }
      }

      if (foundStart === -1) {
        const remaining = currentText.substring(lastPos);
        if (remaining.trim() || !blocks.some(b => b.kind === 'text' && b.fileId === mainFileId)) {
          blocks.push({ kind: 'text', key: `${folderId}-t${localIdx++}`, text: remaining, fileId: mainFileId });
        }
        break;
      }

      const nextNL = currentText.indexOf('\n', foundStart + 1);
      const closingDelim = (nextNL !== -1) ? currentText.indexOf('\n' + usedDelim, nextNL) : -1;

      if (nextNL === -1 || closingDelim === -1) {
        // Not a complete block, treat the rest as normal text
        blocks.push({ kind: 'text', key: `${folderId}-t${localIdx++}`, text: currentText.substring(lastPos), fileId: mainFileId });
        break;
      }

      // Found a valid block
      const before = currentText.substring(lastPos, foundStart);
      if (before.trim()) {
        blocks.push({ kind: 'text', key: `${folderId}-t${localIdx++}`, text: before, fileId: mainFileId });
      }

      const blockEnd = closingDelim + usedDelim.length + 1;
      const fileBlockText = currentText.substring(foundStart, blockEnd);
      const fileName = currentText.substring(foundStart + 1, nextNL).trim();
      const fileNode = this.findNodeBySlug(fileName, 'file');

      blocks.push({
        kind: 'text',
        key: `${folderId}-t${localIdx++}`,
        text: fileBlockText,
        fileId: fileNode?.id || null
      });

      lastPos = blockEnd;
    }
  }

  private guessFileId(text: string, mainFileId: string | null): string | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    
    // Check for additional file block
    const blockRegex = /^(['`^])([^\n]+)\n/m;
    const m = blockRegex.exec(trimmed);
    if (m) {
      const name = m[2].trim();
      const node = this.findNodeBySlug(name, 'file');
      if (node) return node.id;
    }
    
    return mainFileId;
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
    // Suppression du saveTimeout pour privilégier le changement de ligne ou le blur
  }

  onSectionBlur(folderId: string) {
    this.focusedSectionId = null;
    const newFullText = this.reconstructSectionFullText(folderId);
    this.sectionTextMap.set(folderId, newFullText);
    this.unifiedContent = this.reconstructUnifiedContent();
    this.saveAll(); // Sauvegarde immédiate au défocus
  }

  private lastLineNumber = -1;

  onSectionCursorMove(folderId: string, event: Event) {
    const ta = event.target as HTMLTextAreaElement;
    this.lastFocusedTextareaEl = ta;
    
    // Détection du changement de ligne pour déclencher la sauvegarde
    const currentPos = ta.selectionStart;
    const textBefore = ta.value.substring(0, currentPos);
    const currentLineNumber = textBefore.split('\n').length;

    if (this.lastLineNumber !== -1 && currentLineNumber !== this.lastLineNumber) {
      this.saveAll(); // Sauvegarde car on a changé de ligne
    }
    this.lastLineNumber = currentLineNumber;

    this.lastCursorPos = currentPos;
    const pos = currentPos;
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

  private getFileStructureKey(nodes: FileNode[], parentId: string = 'root'): string {
    let key = '';
    for (const node of nodes) {
      if (node.type === 'file') {
        key += `|f:${node.id}-p:${parentId}`;
      } else if (node.children) {
        key += this.getFileStructureKey(node.children, node.id);
      }
    }
    return key;
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

  getSectionClasses(folderId: string): string {
    const pos = this.highlightPositions.get(folderId);
    // On garde un padding constant pour l'alignement
    const basePadding = 'px-6 py-2';

    if (!pos) return `mb-1 rounded-lg ${basePadding} transition-all`;

    // Couleur BLEUE pour toute la zone de menu
    const borderColor = 'border-blue-500/30';
    const bgColor = 'bg-blue-500/5';
    const base = `mb-0 ${basePadding} transition-all border-l border-r ${borderColor} ${bgColor}`;

    switch (pos) {
      case 'only':   return `mb-1 rounded-lg border ${borderColor} ${bgColor} transition-all ${basePadding}`;
      case 'first':  return `${base} rounded-t-lg border-t`;
      case 'middle': return `${base} border-t-0 border-b-0`;
      case 'last':   return `mb-1 ${base} rounded-b-lg border-b`;
      default:       return `mb-1 rounded-lg ${basePadding} transition-all`;
    }
  }

  private rebuildHighlightPositions() {
    this.highlightPositions.clear();
    this.fileBlockPositions.clear();

    // Section-level (folder) positions — bleu
    const ordered = this.docSections
      .map((s, idx) => ({ folderId: s.folderId, idx }))
      .filter(item => this.highlightedSectionIds.has(item.folderId));
    for (let i = 0; i < ordered.length; i++) {
      const { folderId, idx } = ordered[i];
      const prevConsec = i > 0 && ordered[i - 1].idx === idx - 1;
      const nextConsec = i < ordered.length - 1 && ordered[i + 1].idx === idx + 1;
      if (!prevConsec && !nextConsec) this.highlightPositions.set(folderId, 'only');
      else if (!prevConsec)           this.highlightPositions.set(folderId, 'first');
      else if (!nextConsec)           this.highlightPositions.set(folderId, 'last');
      else                            this.highlightPositions.set(folderId, 'middle');
    }

    // Block-level (file) positions — vert
    if (this.activeNodeId) {
      const node = this.findNode(this.activeNodeId, this.files);
      if (node?.type === 'file' && !this.isImageFile(node.name)) {
        for (const section of this.docSections) {
          const matching = section.blocks
            .map((b, i) => ({ b, i }))
            .filter(item => (item.b as any).fileId === this.activeNodeId);
          for (let j = 0; j < matching.length; j++) {
            const { b, i } = matching[j];
            const prevConsec = j > 0 && matching[j - 1].i === i - 1;
            const nextConsec = j < matching.length - 1 && matching[j + 1].i === i + 1;
            if (!prevConsec && !nextConsec) this.fileBlockPositions.set(b.key, 'only');
            else if (!prevConsec)           this.fileBlockPositions.set(b.key, 'first');
            else if (!nextConsec)           this.fileBlockPositions.set(b.key, 'last');
            else                            this.fileBlockPositions.set(b.key, 'middle');
          }
        }
      }
    }
  }

  getFileBlockClasses(block: DocBlock): string {
    const pos = this.fileBlockPositions.get(block.key);
    if (!pos) return '';
    const border = 'border-green-500/40';
    const bg = 'bg-green-500/5';
    switch (pos) {
      case 'only':   return `rounded-lg border ${border} ${bg}`;
      case 'first':  return `rounded-t-lg border-t border-l border-r ${border} ${bg}`;
      case 'middle': return `border-l border-r ${border} ${bg}`;
      case 'last':   return `rounded-b-lg border-b border-l border-r ${border} ${bg}`;
    }
  }

  private computeHighlightedIds(nodeId: string | null): Set<string> {
    const result = new Set<string>();
    if (!nodeId) return result;
    const node = this.findNode(nodeId, this.files);
    if (node?.type === 'folder') {
      this.addAllDescendantFolders(node, result);
    }
    return result;
  }

  getTextareaClasses(block: any): string {
    const base = "section-textarea w-full bg-transparent text-light-text dark:text-white font-mono text-sm outline-none focus:outline-none focus:ring-0 resize-none block leading-relaxed transition-all p-0 border-0 overflow-hidden";
    
    // Si l'ID actif est celui du fichier lié à ce bloc -> VERT
    if (block.kind === 'text' && block.fileId && block.fileId === this.activeNodeId) {
      return base.replace('p-0 border-0', 'border border-green-500/40 bg-green-500/10 rounded-lg px-4 py-2 my-1 shadow-[0_0_10px_rgba(34,197,94,0.1)]');
    }

    return base;
  }

  private collectFolderAndDescendants(nodeId: string, nodes: FileNode[], result: Set<string>): boolean {
    for (const n of nodes) {
      if (n.type === 'folder') {
        if (n.id === nodeId) {
          this.addAllDescendantFolders(n, result);
          return true;
        }
        if (this.collectFolderAndDescendants(nodeId, n.children || [], result)) return true;
      }
    }
    return false;
  }

  private addAllDescendantFolders(node: FileNode, result: Set<string>) {
    result.add(node.id);
    for (const child of node.children || []) {
      if (child.type === 'folder') this.addAllDescendantFolders(child, result);
    }
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
