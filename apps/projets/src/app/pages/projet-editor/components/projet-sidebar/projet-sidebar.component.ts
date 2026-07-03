import { Component, Input, Output, EventEmitter, signal, OnChanges, SimpleChanges, HostListener, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FileNode, ProjectFilesService, FtpNodeSyncStatus, Outil } from '@worganic/portail-core/data-access';
import { ConversationService } from '@worganic/portail-core/data-access';
import { WoActionHistoryService } from '@worganic/portail-core/data-access';
import { ProjetCollabService, LockInfo } from '@worganic/portail-core/data-access';
import { AgendaOutilService, AgendaEvent } from '@worganic/portail-core/data-access';

interface ContextMenu { x: number; y: number; node: FileNode | null; }
interface InlineInput { type: 'rename' | 'new-file' | 'new-folder'; nodeId: string | null; parentId: string | null; }

export interface DragDropEvent {
  draggedNode: FileNode;
  draggedParentId: string | null;
  targetNode: FileNode;
  targetParentId: string | null;
  position: 'before' | 'after' | 'inside';
  targetSiblings: FileNode[];
}

@Component({
  selector: 'app-projet-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './projet-sidebar.component.html',
  host: { class: 'flex min-h-0 bg-light-surface dark:bg-[#0f0f17] border-r border-light-border dark:border-white/10' },
})
export class ProjetSidebarComponent implements OnChanges {
  @Input() projectName = '';
  @Input() projectTitle = '';
  @Input() files: FileNode[] = [];
  @Input() activeFileId: string | null = null;
  @Input() projetId = '';
  @Input() nestedImagesMap: Record<string, string[]> = {};
  @Input() nodeSyncStatus: Map<string, FtpNodeSyncStatus> = new Map();
  @Input() hasFtpBackup = false;
  @Input() outils: Outil[] = [];
  @Input() activeOutilId: string | null = null;
  @Input() trelloCount = 0;
  @Output() trelloListClick = new EventEmitter<void>();
  @Input() mockupCount = 0;
  @Output() mockupListClick = new EventEmitter<void>();
  @Output() fileSelect = new EventEmitter<FileNode>();
  @Output() folderCreated = new EventEmitter<{ name: string; parentId: string | null }>();
  @Output() nodeLevelChange = new EventEmitter<{ folderId: string; delta: number }>();
  @Output() titleMerge = new EventEmitter<{ folderId: string }>();
  @Output() refresh = new EventEmitter<void>();
  @Output() projectSelect = new EventEmitter<void>();
  @Output() outilSelect = new EventEmitter<string>();
  @Output() outilCreate = new EventEmitter<{ type: string; name: string }>();
  /** Clic sur un événement de l'agenda dans la sidebar → ouvrir l'agenda à sa date + popup. */
  @Output() agendaEventSelect = new EventEmitter<{ outilId: string; event: AgendaEvent }>();

  // Événements de l'agenda (chargés indépendamment : l'outil agenda n'est monté que s'il est actif).
  agendaEvents = signal<AgendaEvent[]>([]);
  private agendaSvc = inject(AgendaOutilService);

  expanded = signal<Set<string>>(new Set(['root']));
  outilExpanded = signal<Set<string>>(new Set());
  showAddOutilPopup = signal(false);
  @ViewChild('addOutilPopup') addOutilPopupRef?: ElementRef<HTMLElement>;
  @ViewChild('contextMenuEl') contextMenuRef?: ElementRef<HTMLElement>;
  contextMenu = signal<ContextMenu | null>(null);
  inlineInput = signal<InlineInput | null>(null);
  inlineValue = '';
  deleteConfirm = signal<FileNode | null>(null);
  
  conversationIds = signal<Set<string>>(new Set());

  draggedNode = signal<FileNode | null>(null);
  draggedParentId = signal<string | null>(null);
  dragOverNodeId = signal<string | null>(null);
  dragPos = signal<'before' | 'after' | 'inside'>('before');

  @Output() dragDrop = new EventEmitter<DragDropEvent>();

  private convSvc = inject(ConversationService);
  private woHistory = inject(WoActionHistoryService);
  readonly collab = inject(ProjetCollabService);

  // ── Redimensionnement de l'arbre du projet (glisser-déposer sur la poignée) ──────────────
  private static readonly TREE_WIDTH_KEY = 'wo-sidebar-tree-width';
  private static readonly TREE_WIDTH_MIN = 180;
  private static readonly TREE_WIDTH_MAX = 480;
  treeWidth = signal<number>(this.loadTreeWidth());
  private treeResize: { startWidth: number; startX: number } | null = null;

  private loadTreeWidth(): number {
    try {
      const raw = localStorage.getItem(ProjetSidebarComponent.TREE_WIDTH_KEY);
      const n = raw ? parseInt(raw, 10) : NaN;
      if (!isNaN(n)) return Math.min(Math.max(n, ProjetSidebarComponent.TREE_WIDTH_MIN), ProjetSidebarComponent.TREE_WIDTH_MAX);
    } catch { /* localStorage indisponible (navigation privée…) */ }
    return 224; // équivalent Tailwind w-56
  }

  startTreeResize(ev: MouseEvent) {
    ev.preventDefault();
    this.treeResize = { startWidth: this.treeWidth(), startX: ev.clientX };
  }

  @HostListener('document:mousemove', ['$event'])
  onTreeResizeMove(ev: MouseEvent) {
    if (!this.treeResize) return;
    const delta = ev.clientX - this.treeResize.startX;
    const next = Math.min(Math.max(this.treeResize.startWidth + delta, ProjetSidebarComponent.TREE_WIDTH_MIN), ProjetSidebarComponent.TREE_WIDTH_MAX);
    this.treeWidth.set(next);
  }

  @HostListener('document:mouseup')
  onTreeResizeEnd() {
    if (!this.treeResize) return;
    this.treeResize = null;
    try { localStorage.setItem(ProjetSidebarComponent.TREE_WIDTH_KEY, String(this.treeWidth())); } catch { /* ignore */ }
  }

  constructor(private svc: ProjectFilesService, private elRef: ElementRef, private router: Router) {}

  onProjectSelect(): void {
    this.projectSelect.emit();
  }

  /** Libellé d'affichage d'un nœud : fichier MO (trello/array/prompt) → "TL:/AR:/PR: NOM". */
  nodeDisplayName(node: FileNode): string {
    if (node.type !== 'file') return node.name;
    const base = node.name.replace(/\.md$/, '');
    if (/^trello-/i.test(base)) return 'TL: ' + base.replace(/^trello-/i, '');
    if (/^trello$/i.test(base)) return 'TL: Trello';
    if (/^TL:\s*/i.test(base)) return base;
    if (/^array-/i.test(base)) return 'AR: ' + base.replace(/^array-/i, '');
    if (/^array$/i.test(base)) return 'AR: Tableau';
    if (/^prompt-/i.test(base)) return 'PR: ' + base.replace(/^prompt-/i, '');
    if (/^prompt$/i.test(base)) return 'PR: Prompt';
    if (/^PR:\s*/i.test(base)) return base;
    return base;
  }

  // ── Présence collaborative (jamais un verrou : purement informatif) ────────

  isLockedByOther(nodeId: string): boolean { return this.collab.isLockedByOther(nodeId); }
  isLocalPending(nodeId: string): boolean { return this.collab.isLocalPending(nodeId); }

  // Partager / Annuler les modifications d'une section depuis le menu contextuel.
  // Déléguée à la zone d'édition via le bus du service collab.
  publishSection(node: FileNode) {
    this.closeContextMenu();
    this.collab.requestPublishSection(node.id);
  }

  cancelSection(node: FileNode) {
    this.closeContextMenu();
    this.collab.requestCancelSection(node.id);
  }

  // Ajout d'un méga-outil (Trello / Tableau) dans une section depuis le menu contextuel.
  // Navigue vers la section (focus) puis demande à la zone d'ouvrir le popup de création.
  addMegaOutil(node: FileNode, type: 'trello' | 'array' | 'prompt') {
    this.closeContextMenu();
    this.fileSelect.emit(node);
    this.collab.requestCreateMegaOutil(type, node.id);
  }
  getLockInfo(nodeId: string): LockInfo | undefined { return this.collab.getLock(nodeId); }

  otherEditorsCount(nodeId: string): number {
    return this.collab.getOtherEditors(nodeId).length;
  }

  getLockTooltip(nodeId: string): string {
    return this.collab.getOtherEditors(nodeId)
      .map(l => `${l.lockedByName} depuis ${new Date(l.lockedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`)
      .join(', ');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['files']) {
      this.loadConversations();
    }

    if (changes['files'] && this.files.length > 0) {
      const s = new Set(this.expanded());
      s.add('root');
      this.expanded.set(s);

      // Forcer l'expansion vers le node actif si les fichiers viennent d'être chargés
      if (this.activeFileId) {
        setTimeout(() => this.expandToNode(this.activeFileId!), 50);
      }
    }
    if (changes['activeFileId'] && this.activeFileId) {
      this.expandToNode(this.activeFileId);
    }
    // Auto-expand le premier outil quand la liste change
    if (changes['outils'] && this.outils.length > 0) {
      const s = new Set(this.outilExpanded());
      s.add(this.outils[0].id);
      this.outilExpanded.set(s);
    }
    if (changes['activeOutilId'] && this.activeOutilId) {
      const s = new Set(this.outilExpanded());
      s.add(this.activeOutilId);
      this.outilExpanded.set(s);
    }
    // Charger les événements de l'agenda dès qu'un outil agenda existe (pour les lister dans le menu).
    if (changes['outils'] || changes['projectName']) {
      this.reloadAgendaEvents();
    }
  }

  // ── Agenda (liste d'événements dans la sidebar) ────────────────
  isAgendaOutil(outil: Outil): boolean { return outil.type === 'agenda'; }

  /** Recharge la liste d'événements (appelé par le parent après une modif dans l'agenda). */
  reloadAgendaEvents(): void {
    if (!this.projectName) return;
    if (!this.outils.some(o => o.type === 'agenda')) return;
    this.agendaSvc.getEvents(this.projectName)
      .then(list => this.agendaEvents.set(list))
      .catch(() => {});
  }

  /** Événements triés par date de début croissante. */
  sortedAgendaEvents(): AgendaEvent[] {
    return [...this.agendaEvents()].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }

  /** Libellé date court d'un événement : « 29 juin 2026 · 10:00 » (ou sans heure si allDay). */
  formatAgendaEventDate(ev: AgendaEvent): string {
    const d = new Date(ev.startDate);
    const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    if (ev.allDay) return date;
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  }

  onAgendaEventClick(outil: Outil, ev: AgendaEvent): void {
    this.agendaEventSelect.emit({ outilId: outil.id, event: ev });
  }

  loadConversations() {
    this.convSvc.getConversationsList().subscribe({
      next: (list) => {
        this.conversationIds.set(new Set(list));
      },
      error: (err) => console.error('Error loading conversations list:', err)
    });
  }

  hasConversation(id: string): boolean {
    return this.conversationIds().has(id);
  }

  private expandToNode(nodeId: string) {
    const path = this.findPathToNode(nodeId, this.files);
    const s = new Set(this.expanded());
    
    // On ajoute tous les parents au Set des éléments étendus
    if (path.length > 0) {
      path.forEach(id => s.add(id));
    }
    
    // Si le noeud lui-même est un dossier, on l'étend aussi pour montrer ses fichiers
    const node = this.findNode(nodeId);
    if (node?.type === 'folder') {
      s.add(node.id);
    }
    
    this.expanded.set(s);
  }

  private findPathToNode(id: string, nodes: FileNode[] | undefined, currentPath: string[] = []): string[] {
    if (!nodes) return [];
    for (const n of nodes) {
      if (n.id === id) return currentPath;
      if (n.children && n.children.length > 0) {
        const found = this.findPathToNode(id, n.children, [...currentPath, n.id]);
        if (found.length > 0) return found;
        if (n.children.some(c => c.id === id)) return [...currentPath, n.id];
      }
    }
    return [];
  }

  isExpanded(id: string) { return this.expanded().has(id); }

  toggle(id: string) {
    const s = new Set(this.expanded());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expanded.set(s);
  }

  selectFile(node: FileNode) {
    this.fileSelect.emit(node);
    if (node.type === 'folder') this.toggle(node.id);
  }

  onContextMenu(event: MouseEvent, node: FileNode | null) {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, node });
    this.inlineInput.set(null);
  }

  closeContextMenu() { this.contextMenu.set(null); }

  // ── Changement de niveau hiérarchique d'une section ────────────────────────
  // Contexte d'un nœud dans l'arbre : parent, frères, profondeur (racine = 1).
  private getNodeContext(id: string): { parent: FileNode | null; siblings: FileNode[]; depth: number } | null {
    const walk = (nodes: FileNode[], parent: FileNode | null, depth: number): { parent: FileNode | null; siblings: FileNode[]; depth: number } | null => {
      for (const n of nodes) {
        if (n.id === id) return { parent, siblings: nodes, depth };
        if (n.children) { const r = walk(n.children, n, depth + 1); if (r) return r; }
      }
      return null;
    };
    return walk(this.files, null, 1);
  }

  private subtreeMaxDepth(node: FileNode, depth: number): number {
    let max = depth;
    for (const c of node.children || []) {
      if (c.type === 'folder') max = Math.max(max, this.subtreeMaxDepth(c, depth + 1));
    }
    return max;
  }

  /** Monter (−1) : possible si la section n'est pas déjà au niveau racine. */
  canPromoteNode(node: FileNode): boolean {
    if (node.type !== 'folder') return false;
    const ctx = this.getNodeContext(node.id);
    return !!ctx && ctx.depth > 1;
  }

  /** Descendre (+1) : possible s'il existe un dossier frère précédent ET profondeur max ≤ 4. */
  canDemoteNode(node: FileNode): boolean {
    if (node.type !== 'folder') return false;
    const ctx = this.getNodeContext(node.id);
    if (!ctx) return false;
    if (this.subtreeMaxDepth(node, ctx.depth) >= 6) return false;
    const folderSiblings = ctx.siblings.filter(n => n.type === 'folder');
    const idx = folderSiblings.findIndex(n => n.id === node.id);
    return idx > 0;
  }

  changeNodeLevel(node: FileNode, delta: number) {
    this.closeContextMenu();
    if (node.type !== 'folder') return;
    if (delta < 0 && !this.canPromoteNode(node)) return;
    if (delta > 0 && !this.canDemoteNode(node)) return;
    this.nodeLevelChange.emit({ folderId: node.id, delta });
  }

  /** Fusion possible si une section existe au-dessus : un parent, ou un dossier frère précédent. */
  canMergeTitle(node: FileNode): boolean {
    if (node.type !== 'folder') return false;
    const ctx = this.getNodeContext(node.id);
    if (!ctx) return false;
    if (ctx.depth > 1) return true; // fusion dans le parent
    const folderSiblings = ctx.siblings.filter(n => n.type === 'folder');
    return folderSiblings.findIndex(n => n.id === node.id) > 0; // fusion dans le frère précédent
  }

  /** Supprime le titre en gardant le texte : le contenu est fusionné dans la section du dessus. */
  mergeTitle(node: FileNode) {
    this.closeContextMenu();
    if (!this.canMergeTitle(node)) return;
    this.titleMerge.emit({ folderId: node.id });
  }

  startNewFolder(parentId: string | null) {
    this.closeContextMenu();
    this.inlineValue = '';
    this.inlineInput.set({ type: 'new-folder', nodeId: null, parentId });
  }

  startNewFile(parentId: string | null) {
    this.closeContextMenu();
    this.inlineValue = '';
    this.inlineInput.set({ type: 'new-file', nodeId: null, parentId });
  }

  startRename(node: FileNode) {
    this.closeContextMenu();
    this.inlineValue = node.type === 'file' ? node.name.replace(/\.md$/, '') : node.name;
    this.inlineInput.set({ type: 'rename', nodeId: node.id, parentId: null });
  }

  cancelInput() { this.inlineInput.set(null); this.inlineValue = ''; }

  async confirmInput() {
    const inp = this.inlineInput();
    if (!inp || !this.inlineValue.trim()) { this.inlineInput.set(null); this.inlineValue = ''; return; }
    const val = this.inlineValue.trim();
    try {
      if (inp.type === 'new-folder') {
        const activeOutil = !inp.parentId ? this.outils.find(o => o.id === this.activeOutilId) : undefined;
        const folder = await this.svc.createFolder(this.projectName, { name: val, parentId: inp.parentId || undefined, outilSlug: activeOutil?.type });
        this.woHistory.track({
          section: 'projets/sections',
          actionType: 'create',
          label: `Création de menu «${val}»`,
          entityType: 'section',
          entityId: folder.id,
          entityLabel: val,
          afterState: { folderName: val, parentId: inp.parentId || null },
          context: { projectId: this.projectName, projectTitle: this.projectTitle },
          undoable: true,
          undoAction: {
            endpoint: `/api/file-projects/${this.projectName}/folders/${folder.id}`,
            method: 'DELETE'
          }
        }).catch(() => {});
        if (inp.parentId) this.expandNode(inp.parentId);
        this.folderCreated.emit({ name: val, parentId: inp.parentId || null });
      } else if (inp.type === 'new-file') {
        const activeOutil = !inp.parentId ? this.outils.find(o => o.id === this.activeOutilId) : undefined;
        const created = await this.svc.createFile(this.projectName, { name: val, parentId: inp.parentId || undefined, outilSlug: activeOutil?.type });
        this.woHistory.track({
          section: 'projets/fichiers',
          actionType: 'create',
          label: `Création de document «${val}»`,
          entityType: 'file',
          entityId: created.id,
          entityLabel: val,
          afterState: { fileName: val, parentId: inp.parentId || null },
          context: { projectId: this.projectName, projectTitle: this.projectTitle },
          undoable: true,
          undoAction: {
            endpoint: `/api/file-projects/${this.projectName}/files/${created.id}`,
            method: 'DELETE'
          }
        }).catch(() => {});
        if (inp.parentId) this.expandNode(inp.parentId);
        this.fileSelect.emit(created);
      } else if (inp.type === 'rename' && inp.nodeId) {
        const node = this.findNode(inp.nodeId);
        const oldName = node?.type === 'file' ? node.name.replace(/\.md$/, '') : node?.name;
        if (node?.type === 'file') {
          await this.svc.renameFile(this.projectName, inp.nodeId, val);
          this.woHistory.track({
            section: 'projets/fichiers',
            actionType: 'update',
            label: `Renommage de document «${oldName}» → «${val}»`,
            entityType: 'file',
            entityId: inp.nodeId,
            entityLabel: val,
            beforeState: oldName ? { fileName: oldName } : undefined,
            afterState: { fileName: val },
            context: { projectId: this.projectName, projectTitle: this.projectTitle },
            undoable: !!oldName,
            undoAction: oldName ? {
              endpoint: `/api/file-projects/${this.projectName}/files/${inp.nodeId}`,
              method: 'PATCH',
              payload: { name: oldName }
            } : undefined
          }).catch(() => {});
        } else if (node?.type === 'folder') {
          await this.svc.renameFolder(this.projectName, inp.nodeId, val);
          // Folder renames are also tracked in processSectionsChange via the editor
        }
      }
      this.refresh.emit();
    } catch (e) { console.error(e); }
    this.inlineInput.set(null);
    this.inlineValue = '';
  }

  askDelete(node: FileNode) { this.closeContextMenu(); this.deleteConfirm.set(node); }
  cancelDelete() { this.deleteConfirm.set(null); }

  async confirmDelete() {
    const node = this.deleteConfirm();
    if (!node) return;
    try {
      if (node.type === 'file') {
        await this.svc.deleteFile(this.projectName, node.id);
        this.woHistory.track({
          section: 'projets/fichiers',
          actionType: 'delete',
          label: `Suppression de document «${node.name.replace(/\.md$/, '')}»`,
          entityType: 'file',
          entityId: node.id,
          entityLabel: node.name.replace(/\.md$/, ''),
          beforeState: { fileName: node.name.replace(/\.md$/, '') },
          context: { projectId: this.projectName, projectTitle: this.projectTitle },
          undoable: false
        }).catch(() => {});
      } else {
        await this.svc.deleteFolder(this.projectName, node.id);
        // Folder deletions are also tracked in processSectionsChange via the editor
      }
      this.refresh.emit();
    } catch (e) { console.error(e); }
    this.deleteConfirm.set(null);
  }

  findNode(id: string, nodes: FileNode[] = this.files): FileNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) { const f = this.findNode(id, n.children); if (f) return f; }
    }
    return null;
  }

  expandNode(id: string) {
    const s = new Set(this.expanded());
    s.add(id);
    this.expanded.set(s);
  }

  inlineInputIsFor(type: string, parentId: string | null): boolean {
    const inp = this.inlineInput();
    return !!inp && inp.type === type && inp.parentId === parentId;
  }

  isRenaming(nodeId: string): boolean {
    const inp = this.inlineInput();
    return !!inp && inp.type === 'rename' && inp.nodeId === nodeId;
  }

  onDragStart(event: DragEvent, node: FileNode, parentId: string | null) {
    this.draggedNode.set(node);
    this.draggedParentId.set(parentId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', node.id);
    }
  }

  onDragOver(event: DragEvent, node: FileNode) {
    const dragged = this.draggedNode();
    if (!dragged || dragged.id === node.id) return;
    // Folder drag cannot drop on a file
    if (dragged.type === 'folder' && node.type === 'file') return;

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const relY = event.clientY - rect.top;
    this.dragOverNodeId.set(node.id);

    if (node.type === 'folder') {
      if (dragged.type === 'file') {
        this.dragPos.set('inside');
      } else {
        if (relY < rect.height * 0.3) this.dragPos.set('before');
        else if (relY > rect.height * 0.7) this.dragPos.set('after');
        else this.dragPos.set('inside');
      }
    } else {
      this.dragPos.set(relY < rect.height / 2 ? 'before' : 'after');
    }
  }

  onDrop(event: DragEvent, targetNode: FileNode, siblings: FileNode[], parentId: string | null) {
    event.preventDefault();
    const dragged = this.draggedNode();
    if (!dragged || dragged.id === targetNode.id) { this.resetDrag(); return; }
    if (dragged.type === 'folder' && targetNode.type === 'file') { this.resetDrag(); return; }

    this.dragDrop.emit({
      draggedNode: dragged,
      draggedParentId: this.draggedParentId(),
      targetNode,
      targetParentId: parentId,
      position: this.dragPos(),
      targetSiblings: siblings,
    });
    this.resetDrag();
  }

  onDragEnd() { this.resetDrag(); }

  private resetDrag() {
    this.draggedNode.set(null);
    this.draggedParentId.set(null);
    this.dragOverNodeId.set(null);
  }

  isDragging(nodeId: string): boolean { return this.draggedNode()?.id === nodeId; }
  isDragOver(nodeId: string): boolean { return this.dragOverNodeId() === nodeId; }
  isDragInside(nodeId: string): boolean { return this.dragOverNodeId() === nodeId && this.dragPos() === 'inside'; }

  getNodeClasses(node: FileNode): string {
    const active = this.activeFileId === node.id;
    const inside = this.isDragInside(node.id) && node.type === 'folder';
    let cls: string;
    if (active) {
      cls = node.type === 'folder'
        ? 'bg-light-primary/15 dark:bg-primary/15'
        : 'bg-green-500/15 dark:bg-green-500/15';
    } else {
      cls = 'hover:bg-light-surface dark:hover:bg-white/5';
    }
    if (inside) cls += ' outline outline-1 outline-light-primary dark:outline-primary';
    return cls;
  }

  getNodeIconClasses(node: FileNode): string {
    if (this.activeFileId !== node.id) return 'text-light-text-muted dark:text-white/40';
    return node.type === 'folder' ? 'text-light-primary dark:text-primary' : 'text-green-500 dark:text-green-400';
  }

  getNodeLabelClasses(node: FileNode): string {
    if (this.activeFileId !== node.id) return 'text-light-text dark:text-white/70';
    return node.type === 'folder'
      ? 'text-light-primary dark:text-primary font-semibold'
      : 'text-green-500 dark:text-green-400 font-semibold';
  }

  isImageFile(name: string): boolean {
    return this.svc.isImageFile(name);
  }

  // Trie les enfants : fichiers (par order) avant sous-dossiers (par order)
  // Exclut les images imbriquées dans un doc (elles sont affichées sous leur doc parent)
  sortedChildren(nodes: FileNode[]): FileNode[] {
    const nestedImageIds = new Set(Object.values(this.nestedImagesMap).flat());
    const files = nodes.filter(n => n.type === 'file' && !nestedImageIds.has(n.id)).sort((a, b) => (a.order || 0) - (b.order || 0));
    const folders = nodes.filter(n => n.type === 'folder').sort((a, b) => (a.order || 0) - (b.order || 0));
    return [...files, ...folders];
  }

  // Retourne les FileNode images imbriquées dans un bloc document (via nestedImagesMap)
  getNestedImages(fileId: string): FileNode[] {
    const ids = this.nestedImagesMap[fileId];
    if (!ids || ids.length === 0) return [];
    return ids.map(id => this.findNode(id)).filter((n): n is FileNode => n !== null);
  }

  // ── Outils ────────────────────────────────────────────────────

  isOutilExpanded(id: string): boolean { return this.outilExpanded().has(id); }

  toggleOutil(id: string): void {
    const s = new Set(this.outilExpanded());
    s.has(id) ? s.delete(id) : s.add(id);
    this.outilExpanded.set(s);
  }

  onOutilClick(outil: Outil): void {
    this.outilSelect.emit(outil.id);
    const s = new Set(this.outilExpanded());
    s.add(outil.id);
    this.outilExpanded.set(s);
  }

  onAddOutil(type: string): void {
    this.showAddOutilPopup.set(false);
    const names: Record<string, string> = { edition: 'Edition', tests: 'Tests' };
    const name = names[type] ?? type;
    this.outilCreate.emit({ type, name });
  }

  getFolderById(id: string): FileNode | null {
    return this.files.find(f => f.id === id) ?? null;
  }

  getOutilIconClass(outil: Outil): string {
    return this.activeOutilId === outil.id
      ? 'text-light-primary dark:text-primary'
      : 'text-light-text-muted dark:text-white/40';
  }

  getOutilIcon(outil: Outil): string {
    const icons: Record<string, string> = { edition: 'edit_note', tests: 'science' };
    return icons[outil.type] ?? 'folder_special';
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const target = e.target as Node;
    // Ferme le menu contextuel dès qu'on clique en dehors de lui
    if (this.contextMenu() && !this.contextMenuRef?.nativeElement.contains(target)) {
      this.closeContextMenu();
    }
    // Ferme le popup "Ajouter un outil" dès qu'on clique en dehors de lui
    // (le bouton d'ouverture et le contenu du popup stoppent la propagation)
    if (this.showAddOutilPopup() && !this.addOutilPopupRef?.nativeElement.contains(target)) {
      this.showAddOutilPopup.set(false);
    }
  }
}
