import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileNode } from '../../../../../core/services/project-files.service';

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

@Component({
  selector: 'app-projet-editor-zone',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projet-editor-zone.component.html',
  host: { class: 'flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden' },
})
export class ProjetEditorZoneComponent implements OnChanges {
  @Input() files: FileNode[] = [];
  @Input() scrollToNodeId: string | null = null;
  @Input() saveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  @Output() fileSave = new EventEmitter<FileSaveEvent>();
  @Output() sectionsChange = new EventEmitter<SectionInfo[]>();
  @Output() nodeActive = new EventEmitter<string>();

  @ViewChild('unifiedTextarea') textareaRef!: ElementRef<HTMLTextAreaElement>;

  unifiedContent = '';
  private hasLoaded = false;
  private lastSavedContent = '';
  private previousCursorLine = -1;
  private saveTimeout: any;

  highlightStart = -1;
  highlightEnd = -1;
  highlightType: 'folder' | 'file' = 'folder';

  get beforeHighlight() {
    if (this.highlightStart < 0) return this.unifiedContent;
    return this.unifiedContent.substring(0, this.highlightStart);
  }
  
  get highlightText() {
    if (this.highlightStart < 0) return '';
    return this.unifiedContent.substring(this.highlightStart, this.highlightEnd);
  }
  
  get afterHighlight() {
    if (this.highlightStart < 0) return '';
    return this.unifiedContent.substring(this.highlightEnd);
  }

  clearHighlight() {
    this.highlightStart = -1;
    this.highlightEnd = -1;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['files'] && this.files.length > 0) {
      const newContent = this.buildUnifiedContent(this.files, 1);
      // On ne met à jour que si le contenu physique a réellement changé (ex: suppression/ajout externe)
      // Cela évite de perdre le focus ou le curseur pendant qu'on tape et que la sauvegarde auto tourne
      if (!this.hasLoaded || newContent !== this.unifiedContent) {
        this.unifiedContent = newContent;
        this.lastSavedContent = this.unifiedContent;
        setTimeout(() => {
          this.autoResizeTextarea();
          const ta = this.textareaRef?.nativeElement;
          if (ta) this.syncActiveNode(ta.selectionStart);
        }, 50);
      }
      this.hasLoaded = true;
    }
    if (changes['scrollToNodeId'] && this.scrollToNodeId) {
      setTimeout(() => this.scrollToNodeById(this.scrollToNodeId!), 150);
    }
  }

  buildUnifiedContent(nodes: FileNode[], depth: number): string {
    const parts: string[] = [];
    // Tri par ordre si disponible
    const sortedNodes = [...nodes].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    for (const node of sortedNodes) {
      if (node.type === 'folder') {
        const heading = '#'.repeat(depth) + ' ' + node.name;
        
        // Fichier principal : contenu.md
        const mainFile = (node.children || []).find(c => c.type === 'file' && c.name === 'contenu.md') 
                      || (node.children || []).find(c => c.type === 'file'); // Fallback
        
        const mainContent = mainFile?.content ?? '';
        
        // Fichiers additionnels (délimités par ')
        const additionalFiles = (node.children || [])
          .filter(c => c.type === 'file' && c !== mainFile)
          .map(c => `'${c.name.replace(/\.md$/, '')}\n${c.content}\n'`)
          .join('\n\n');

        let section = heading + '\n';
        if (mainContent.trim()) section += mainContent.trimEnd() + '\n';
        if (additionalFiles.trim()) section += '\n' + additionalFiles.trim() + '\n';

        const subFolders = (node.children || []).filter(c => c.type === 'folder');
        const subContent = this.buildUnifiedContent(subFolders, depth + 1);
        if (subContent.trim()) {
          section = section.trimEnd() + '\n\n' + subContent;
        }

        parts.push(section.trimEnd());
      }
    }
    return parts.join('\n\n') + (parts.length > 0 ? '\n' : '');
  }

  private slugify(text: string): string {
    return text.toString().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
      matches.push({
        level: m[1].length,
        name: m[2].trim(),
        index: m.index,
        contentStart: m.index + m[0].length + 1
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const contentEnd = i + 1 < matches.length ? matches[i + 1].index : text.length;
      let rawContent = text.substring(current.contentStart, contentEnd).trimEnd();

      // Extraction des fichiers additionnels délimités par ' ou `
      const additionalFiles: AdditionalFile[] = [];
      // Regex plus flexible : supporte ' ou ` en début de ligne, titre, puis contenu optionnel
      const blockRegex = /^(['`^])([^\n]+)(?:\n([\s\S]*?))?\n?\1/gm;
      
      const mainContent = rawContent.replace(blockRegex, (match, delimiter, title, content) => {
        additionalFiles.push({
          name: title.trim(),
          content: (content || '').trimEnd(),
          fileId: null
        });
        return '';
      }).trim();

      // Build parent path
      const parentPath: string[] = [];
      let targetLevel = current.level - 1;
      for (let k = i - 1; k >= 0 && targetLevel > 0; k--) {
        if (matches[k].level === targetLevel) {
          parentPath.unshift(matches[k].name);
          targetLevel--;
        }
      }

      const fullPath = [...parentPath.map(p => this.slugify(p)), this.slugify(current.name)].join('/');
      const parentKey = parentPath.map(p => this.slugify(p)).join('/');

      const info = folderMap.get(fullPath);
      const parentInfo = parentKey ? folderMap.get(parentKey) : null;

      // Résolution des fileId pour contenu.md et additionnels
      const mainFile = info?.files.find(f => f.name === 'contenu.md') || info?.files[0];
      additionalFiles.forEach(af => {
        const found = info?.files.find(f => this.slugify(f.name.replace(/\.md$/, '')) === this.slugify(af.name));
        if (found) af.fileId = found.id;
      });

      sections.push({
        level: current.level,
        folderName: current.name,
        parentPath,
        folderId: info?.folder.id ?? null,
        parentFolderId: parentInfo?.folder.id ?? null,
        fileId: mainFile?.id ?? null,
        content: mainContent,
        additionalFiles
      });
    }

    return sections;
  }



  onInput(event: Event) {
    this.clearHighlight();
    this.unifiedContent = (event.target as HTMLTextAreaElement).value;
    this.autoResizeTextarea();
    
    // Sauvegarde automatique après 2 secondes d'inactivité
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveAll(), 2000);
  }

  onEnter() {
    this.clearHighlight();
    clearTimeout(this.saveTimeout);
    // Timeout 0 pour laisser le navigateur insérer le saut de ligne avant de sauvegarder
    setTimeout(() => this.saveAll(), 0);
  }

  onCursorMove() {
    this.clearHighlight();
    const ta = this.textareaRef?.nativeElement;
    if (!ta) return;

    // Calcul de la ligne actuelle en comptant les retours à la ligne avant le curseur
    const textBeforeCursor = ta.value.substring(0, ta.selectionStart);
    const currentLine = (textBeforeCursor.match(/\n/g) || []).length;

    // saveAll uniquement si on change de ligne (évite les sauvegardes excessives)
    if (this.previousCursorLine !== currentLine) {
      clearTimeout(this.saveTimeout);
      this.saveAll();
    }
    // syncActiveNode toujours : la sidebar peut avoir changé activeNodeId depuis le dernier clic
    this.syncActiveNode(ta.selectionStart);
    this.previousCursorLine = currentLine;
  }

  private syncActiveNode(pos: number) {
    const text = this.unifiedContent;
    
    // 1. Détection de si on est dans un bloc additionnel '...' ou `...`
    // On utilise une regex qui ne matche que les délimiteurs ' ou ` en début de ligne
    const blockRegex = /^(['`^])([^\n]+)\n([\s\S]*?)\n\1/gm;
    let blockMatch: RegExpExecArray | null;
    let foundBlock = false;

    while ((blockMatch = blockRegex.exec(text)) !== null) {
      const start = blockMatch.index;
      const end = blockMatch.index + blockMatch[0].length;
      if (pos >= start && pos <= end) {
        const name = blockMatch[2].trim();
        const node = this.findNodeBySlug(name, 'file');
        if (node) {
          console.log('[EDITOR-ZONE] Found active file block:', name, node.id);
          this.nodeActive.emit(node.id);
          foundBlock = true;
          break;
        }
      }
    }
    if (foundBlock) return;

    // 2. Sinon, titre le plus proche au-dessus
    let endOfLine = text.indexOf('\n', pos);
    if (endOfLine === -1) endOfLine = text.length;
    const textBefore = text.substring(0, endOfLine);

    // Regex plus flexible pour les titres : supporte 1 à 6 # et tolère les espaces
    const headingMatches = [...textBefore.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)];
    const lastHeading = headingMatches.pop();
    if (lastHeading) {
      const folderName = lastHeading[2].trim();
      const folder = this.findNodeBySlug(folderName, 'folder');
      if (folder) {
        console.log('[EDITOR-ZONE] Found active folder heading:', folderName, folder.id);
        this.nodeActive.emit(folder.id);
      } else {
        console.warn('[EDITOR-ZONE] Folder heading found but node not found in tree:', folderName);
      }
    }
  }

  private findNodeBySlug(name: string, type: 'file' | 'folder', nodes: FileNode[] = this.files): FileNode | null {
    if (!name) return null;
    const slugSearch = this.slugify(name);
    const lowerSearch = name.trim().toLowerCase();
    
    for (const n of nodes) {
      const nodeSlug = this.slugify(n.name);
      const nodeLower = n.name.trim().toLowerCase();

      if (n.type === 'folder') {
        // Match exact ou par slug
        if (type === 'folder' && (nodeSlug === slugSearch || nodeLower === lowerSearch)) return n;
        if (n.children) {
          const found = this.findNodeBySlug(name, type, n.children);
          if (found) return found;
        }
      } else if (n.type === 'file' && type === 'file') {
        const fileNameNoExt = n.name.replace(/\.md$/, '').trim().toLowerCase();
        // Pour les fichiers additionnels, on compare le nom sans extension
        if (n.name !== 'contenu.md' && (this.slugify(fileNameNoExt) === slugSearch || fileNameNoExt === lowerSearch)) return n;
      }
    }
    return null;
  }

  private findAdditionalFileByName(name: string, nodes: FileNode[] = this.files): FileNode | null {
    return this.findNodeBySlug(name, 'file', nodes);
  }

  private findFolderByName(name: string, nodes: FileNode[] = this.files): FileNode | null {
    return this.findNodeBySlug(name, 'folder', nodes);
  }

  onBlur() {
    clearTimeout(this.saveTimeout);
    this.saveAll();
  }

  private saveAll() {
    if (this.unifiedContent === this.lastSavedContent) return; // Ne sauvegarde que si le contenu a changé
    this.lastSavedContent = this.unifiedContent;
    const sections = this.parseContent();
    this.sectionsChange.emit(sections);
  }


  appendSection(folderName: string, level = 1) {
    const heading = '#'.repeat(Math.min(level, 4)) + ' ' + folderName;
    this.unifiedContent = this.unifiedContent.trimEnd() + `\n\n${heading}\n`;
    setTimeout(() => {
      this.autoResizeTextarea();
      const ta = this.textareaRef?.nativeElement;
      if (ta) ta.scrollTop = ta.scrollHeight;
    }, 50);
  }

  insertSectionInParent(parentName: string, parentDepth: number, sectionName: string) {
    const text = this.unifiedContent;
    const escapedParent = parentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hashes = '#'.repeat(Math.min(parentDepth, 4));
    const parentRegex = new RegExp('^' + hashes.replace(/#/g, '\\#') + ' ' + escapedParent + '$', 'm');
    const parentMatch = parentRegex.exec(text);

    if (!parentMatch) {
      this.appendSection(sectionName, parentDepth + 1);
      return;
    }

    // Find where the parent section ends (next heading at same level or higher)
    const searchFrom = parentMatch.index + parentMatch[0].length;
    const restText = text.substring(searchFrom);
    const endRegex = new RegExp('^#{1,' + Math.min(parentDepth, 4) + '} ', 'm');
    const endMatch = endRegex.exec(restText);
    const insertAt = endMatch ? searchFrom + endMatch.index : text.length;

    const childHeading = '#'.repeat(Math.min(parentDepth + 1, 4)) + ' ' + sectionName;
    const before = text.substring(0, insertAt).trimEnd();
    const after = text.substring(insertAt);
    this.unifiedContent = before + '\n\n' + childHeading + '\n' + (after.trimStart() ? '\n' + after.trimStart() : '');
    setTimeout(() => this.autoResizeTextarea(), 50);
  }

  scrollToNodeById(id: string) {
    const node = this.findNode(id, this.files);
    if (!node) return;
    const ta = this.textareaRef?.nativeElement;
    if (!ta) return;

    let startPos = -1;
    let endPos = -1;

    if (node.type === 'folder' || node.name === 'contenu.md') {
      this.highlightType = 'folder';
      const targetName = node.type === 'folder' ? node.name : this.findParentFolder(node.id, this.files)?.name;
      if (!targetName) return;

      const escapedName = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('^#{1,4} ' + escapedName + '$', 'm');
      const match = regex.exec(ta.value);
      if (!match || match.index == null) return;

      startPos = match.index;
      const currentHashes = match[0].split(' ')[0];
      const currentLevel = currentHashes.length;
      const nextSectionRegex = new RegExp('^#{1,' + currentLevel + '} ', 'gm');
      nextSectionRegex.lastIndex = startPos + match[0].length;
      const nextMatch = nextSectionRegex.exec(ta.value);
      endPos = nextMatch ? nextMatch.index : ta.value.length;
    } else {
      this.highlightType = 'file';
      const targetName = node.name.replace(/\.md$/, '');
      const escapedName = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp("^(['`^` `])" + escapedName + "$", 'm');
      const match = regex.exec(ta.value);
      if (!match || match.index == null) return;

      startPos = match.index;
      const delimiter = match[1];
      const endRegex = new RegExp('^' + delimiter + '$', 'gm');
      endRegex.lastIndex = startPos + match[0].length;
      const endMatch = endRegex.exec(ta.value);
      endPos = endMatch ? endMatch.index + endMatch[0].length : ta.value.length;
    }

    if (startPos >= 0) {
      const linesBefore = (ta.value.substring(0, startPos).match(/\n/g) || []).length;
      ta.scrollTop = Math.max(0, linesBefore * 22 - 40);
      this.highlightStart = startPos;
      this.highlightEnd = endPos;
      ta.focus();
    }
  }

  private findNode(id: string, nodes: FileNode[]): FileNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = this.findNode(id, n.children);
        if (found) return found;
      }
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

  private findFolderNode(id: string, nodes: FileNode[]): FileNode | null {
    return this.findNode(id, nodes);
  }

  insertAt(before: string, after = '') {
    const ta = this.textareaRef?.nativeElement;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);
    const newVal = ta.value.substring(0, start) + before + selected + after + ta.value.substring(end);
    ta.value = newVal;
    this.unifiedContent = newVal;
    this.saveAll();
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  private autoResizeTextarea() {
    const ta = this.textareaRef?.nativeElement;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }
}
