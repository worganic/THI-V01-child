import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjetCollabService, CollabHistoryEntry } from '@portail/core-data-access';
import { AuthService, WoActionHistoryService, WoRestoredContent } from '@portail/core-data-access';
import { ProjectFilesService, ContentVersionMeta, TrashEntry } from '@portail/core-data-access';

export interface DisplayHistoryEntry extends CollabHistoryEntry {
  pendingState?: 'editing' | 'saving';
}

interface HistoryGroup {
  date: string;
  entries: DisplayHistoryEntry[];
  isToday: boolean;
}

@Component({
  selector: 'app-projet-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projet-history.component.html',
  host: { class: 'flex flex-col min-h-0 flex-1 overflow-hidden' },
})
export class ProjetHistoryComponent implements OnChanges {
  @Input() projetId: string | null = null;
  @Input() activeIds: Set<string> | null = null;
  // Fichier de contenu principal (contenu.md) de la section active — alimente le groupe
  // "Versions de cette section" (navigation des checkpoints BDD immuables).
  @Input() activeFileId: string | null = null;
  @Output() entryClick = new EventEmitter<CollabHistoryEntry>();
  // Émis après une annulation réussie → le parent recharge l'éditeur avec le contenu restauré
  @Output() restored = new EventEmitter<WoRestoredContent>();
  // Émis après une restauration depuis la corbeille → le parent recharge l'arbre de fichiers
  // (structure, pas juste du contenu — le noeud réapparaît dans la sidebar).
  @Output() structureRestored = new EventEmitter<void>();

  readonly collab = inject(ProjetCollabService);
  readonly auth = inject(AuthService);
  readonly woHistory = inject(WoActionHistoryService);
  private readonly projectFilesService = inject(ProjectFilesService);
  loadingEntryId: string | null = null;

  // ── Versions de contenu (checkpoints BDD immuables) ─────────────────────
  readonly versions = signal<ContentVersionMeta[]>([]);
  readonly versionsLoading = signal(false);
  readonly versionsExpanded = signal(false);
  readonly restoringVersionId = signal<string | null>(null);

  private static readonly ORIGIN_LABELS: Record<string, string> = {
    checkpoint: 'Sauvegarde', publish: 'Publication', restore: 'Restauration',
    merge: 'Fusion de conflit', 'conflict-mine': 'Tentative en conflit',
    'migration-bootstrap': 'Version initiale', pull: 'Synchronisation Git'
  };

  originLabel(origin: string): string {
    return ProjetHistoryComponent.ORIGIN_LABELS[origin] || origin;
  }

  async loadVersions() {
    if (!this.projetId || !this.activeFileId) { this.versions.set([]); return; }
    this.versionsLoading.set(true);
    try {
      const res = await this.projectFilesService.getVersions(this.projetId, this.activeFileId, 30, 0);
      this.versions.set(res.versions);
    } catch (e) {
      console.warn('[History] loadVersions error:', e);
      this.versions.set([]);
    } finally {
      this.versionsLoading.set(false);
    }
  }

  async onVersionClick(v: ContentVersionMeta) {
    if (!this.projetId || !this.activeFileId) return;
    this.loadingEntryId = v.version_id;
    try {
      const full = await this.projectFilesService.getVersionContent(this.projetId, this.activeFileId, v.version_id);
      let beforeContent: string | undefined;
      if (v.base_version_id) {
        try {
          const base = await this.projectFilesService.getVersionContent(this.projetId, this.activeFileId, v.base_version_id);
          beforeContent = base.content;
        } catch { /* version de base indisponible (ex: migration-bootstrap) */ }
      }
      const entry: CollabHistoryEntry = {
        id: `version-${v.version_id}`, timestamp: v.created_at, section: 'projets/contenu',
        actionType: 'update', label: this.originLabel(v.origin), entityType: 'content',
        entityId: this.activeFileId, entityLabel: '', userId: v.author_id, username: v.author_name,
        undone: false, undoable: false,
        beforeState: { content: beforeContent },
        afterState: { content: full.content }
      };
      this.entryClick.emit(entry);
    } catch (e) {
      console.warn('[History] onVersionClick error:', e);
    } finally {
      this.loadingEntryId = null;
    }
  }

  async restoreVersionClick(v: ContentVersionMeta, event: Event) {
    event.stopPropagation();
    if (!this.projetId || !this.activeFileId || this.restoringVersionId()) return;
    this.restoringVersionId.set(v.version_id);
    try {
      const res = await this.projectFilesService.restoreVersion(this.projetId, this.activeFileId, v.version_id);
      this.restored.emit({ nodeId: this.activeFileId, folderId: null, content: res.content });
      await this.loadVersions();
    } catch (e) {
      console.warn('[History] restoreVersionClick error:', e);
    } finally {
      this.restoringVersionId.set(null);
    }
  }

  // ── Corbeille (fichiers/dossiers supprimés, réversibles pendant 30 jours) ───
  readonly trashEntries = signal<TrashEntry[]>([]);
  readonly trashLoading = signal(false);
  readonly trashExpanded = signal(false);
  readonly restoringTrashId = signal<string | null>(null);
  readonly trashActionError = signal<string | null>(null);

  async loadTrash() {
    if (!this.projetId) { this.trashEntries.set([]); return; }
    this.trashLoading.set(true);
    try {
      const entries = await this.projectFilesService.getTrash(this.projetId);
      this.trashEntries.set(entries);
    } catch (e) {
      console.warn('[History] loadTrash error:', e);
      this.trashEntries.set([]);
    } finally {
      this.trashLoading.set(false);
    }
  }

  async restoreTrashEntry(entry: TrashEntry, event: Event) {
    event.stopPropagation();
    if (!this.projetId || this.restoringTrashId()) return;
    this.restoringTrashId.set(entry.trashId);
    this.trashActionError.set(null);
    try {
      const res = await this.projectFilesService.restoreFromTrash(this.projetId, entry.trashId);
      this.trashEntries.update(list => list.filter(e => e.trashId !== entry.trashId));
      this.structureRestored.emit();
      if (res.warning) this.trashActionError.set(res.warning);
    } catch (e: any) {
      console.warn('[History] restoreTrashEntry error:', e);
      this.trashActionError.set(e?.error?.error || "Échec de la restauration");
    } finally {
      this.restoringTrashId.set(null);
    }
  }

  async purgeTrashEntry(entry: TrashEntry, event: Event) {
    event.stopPropagation();
    if (!this.projetId || this.restoringTrashId()) return;
    this.restoringTrashId.set(entry.trashId);
    try {
      await this.projectFilesService.purgeTrashEntry(this.projetId, entry.trashId);
      this.trashEntries.update(list => list.filter(e => e.trashId !== entry.trashId));
    } catch (e) {
      console.warn('[History] purgeTrashEntry error:', e);
    } finally {
      this.restoringTrashId.set(null);
    }
  }

  // Undo
  readonly undoingId = signal<string | null>(null);
  readonly cascadeConfirmId = signal<string | null>(null);
  // IDs marqués localement comme annulés (optimistic update, en attente du SSE)
  readonly localUndoneIds = signal<Set<string>>(new Set());

  private readonly _activeIds = signal<Set<string> | null>(null);

  // Jours dépliés explicitement par l'utilisateur (les autres restent repliés sauf le jour courant)
  readonly expandedDays = signal<Set<string>>(new Set());
  // Jours explicitement repliés (pour pouvoir replier le jour courant qui est déplié par défaut)
  readonly collapsedDays = signal<Set<string>>(new Set());

  // Modale de confirmation d'effacement
  readonly clearOpen = signal(false);
  readonly clearScope = signal<'mine' | 'all'>('mine');
  readonly clearLoading = signal(false);

  readonly currentUserId = computed(() => this.auth.currentUser()?.id || '');
  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  // Toutes les entrées (pending + sauvegardées) après filtre par entité active
  readonly filteredEntries = computed<DisplayHistoryEntry[]>(() => {
    const ids = this._activeIds();
    const saved = this.collab.history();
    const pending = this.collab.pending();
    const me = this.auth.currentUser();
    const undoneIds = this.localUndoneIds();
    const pendingDisplay: DisplayHistoryEntry[] = pending.map(p => ({
      id: `pending-${p.entityId}`,
      timestamp: p.timestamp,
      section: 'projets/contenu',
      actionType: 'update',
      label: p.label,
      entityType: 'content',
      entityId: p.entityId,
      entityLabel: '',
      userId: me?.id || null,
      username: p.username,
      undone: false,
      pendingState: p.state,
    }));
    let entries: DisplayHistoryEntry[] = [
      ...pendingDisplay,
      ...saved.map(e => undoneIds.has(e.id) ? { ...e, undone: true } : e)
    ];
    if (ids && ids.size > 0) entries = entries.filter(e => !!e.entityId && ids.has(e.entityId));
    return entries;
  });

  readonly groups = computed<HistoryGroup[]>(() => {
    const todayKey = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const map = new Map<string, DisplayHistoryEntry[]>();
    for (const e of this.filteredEntries()) {
      const day = new Date(e.timestamp).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries()).map(([date, ents]) => ({ date, entries: ents, isToday: date === todayKey }));
  });

  isDayExpanded(date: string, isToday: boolean): boolean {
    if (this.expandedDays().has(date)) return true;
    if (this.collapsedDays().has(date)) return false;
    return isToday;
  }

  toggleDay(date: string, isToday: boolean) {
    const expanded = this.isDayExpanded(date, isToday);
    if (expanded) {
      // replier
      this.expandedDays.update(s => { const n = new Set(s); n.delete(date); return n; });
      this.collapsedDays.update(s => { const n = new Set(s); n.add(date); return n; });
    } else {
      // déplier
      this.collapsedDays.update(s => { const n = new Set(s); n.delete(date); return n; });
      this.expandedDays.update(s => { const n = new Set(s); n.add(date); return n; });
    }
  }

  // Compteur d'entrées concernées par l'effacement (selon scope choisi)
  readonly clearTargetCount = computed(() => {
    const scope = this.clearScope();
    const meId = this.currentUserId();
    return this.filteredEntries().filter(e => !e.pendingState && (scope === 'all' || e.userId === meId)).length;
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projetId'] && this.projetId) {
      this.collab.connect(this.projetId);
      this.loadTrash();
    }
    if (changes['activeIds']) {
      this._activeIds.set(this.activeIds);
    }
    if (changes['activeFileId'] || (changes['projetId'] && this.projetId)) {
      this.loadVersions();
    }
  }

  reload() {
    if (this.projetId) {
      this.collab.loadHistory(this.projetId);
      this.loadTrash();
    }
  }

  isMine(entry: DisplayHistoryEntry): boolean {
    return !!entry.userId && entry.userId === this.currentUserId();
  }

  isClickable(entry: DisplayHistoryEntry): boolean {
    if (entry.pendingState) return false;
    // Toute entrée avec contenu (before ou after) dans projets/contenu est ouvrable en diff
    return entry.section === 'projets/contenu';
  }

  openClear() {
    this.clearScope.set(this.isAdmin() ? 'all' : 'mine');
    this.clearOpen.set(true);
  }

  cancelClear() {
    if (this.clearLoading()) return;
    this.clearOpen.set(false);
  }

  setScope(scope: 'mine' | 'all') {
    if (scope === 'all' && !this.isAdmin()) return;
    this.clearScope.set(scope);
  }

  async confirmClear() {
    if (!this.projetId || this.clearLoading()) return;
    this.clearLoading.set(true);
    try {
      const ids = this._activeIds();
      const entityIds = ids && ids.size > 0 ? Array.from(ids) : undefined;
      await this.collab.clearHistory(this.projetId, { entityIds, scope: this.clearScope() });
      this.clearOpen.set(false);
    } catch (e) {
      console.warn('[History] clear error:', e);
    } finally {
      this.clearLoading.set(false);
    }
  }

  isUndoable(entry: DisplayHistoryEntry): boolean {
    return !entry.pendingState && !!entry.undoable && !entry.undone;
  }

  async undoEntry(entry: DisplayHistoryEntry) {
    if (this.undoingId() || entry.pendingState) return;
    this.undoingId.set(entry.id);
    try {
      const { restored } = await this.woHistory.undo(entry.id);
      this.localUndoneIds.update(s => new Set([...s, entry.id]));
      if (restored) this.restored.emit(restored);
    } catch (e) {
      console.warn('[History] undoEntry error:', e);
    } finally {
      this.undoingId.set(null);
    }
  }

  requestCascade(entry: DisplayHistoryEntry) {
    this.cascadeConfirmId.set(entry.id);
  }

  cancelCascade() {
    this.cascadeConfirmId.set(null);
  }

  async confirmCascade(entry: DisplayHistoryEntry) {
    if (this.undoingId() || entry.pendingState) return;
    this.cascadeConfirmId.set(null);
    this.undoingId.set(entry.id);
    try {
      const { undoneIds, restored } = await this.woHistory.undoCascade(entry.id);
      this.localUndoneIds.update(s => new Set([...s, ...undoneIds]));
      if (restored) this.restored.emit(restored);
    } catch (e) {
      console.warn('[History] undoCascade error:', e);
    } finally {
      this.undoingId.set(null);
    }
  }

  async onEntryClick(entry: DisplayHistoryEntry) {
    if (!this.isClickable(entry)) return;
    const hasLoaded = (
      (entry.beforeState != null && typeof entry.beforeState === 'object' && 'content' in entry.beforeState) ||
      (entry.afterState  != null && typeof entry.afterState  === 'object' && 'content' in entry.afterState)
    );
    if (hasLoaded) {
      this.entryClick.emit(entry);
      return;
    }
    this.loadingEntryId = entry.id;
    try {
      const full = await this.collab.fetchEntry(entry.id);
      this.entryClick.emit(full);
    } catch (e) {
      console.warn('[History] fetchEntry error:', e);
      this.entryClick.emit(entry);
    } finally {
      this.loadingEntryId = null;
    }
  }

  getActionIcon(entry: CollabHistoryEntry): string {
    const { actionType, section } = entry;
    if (actionType === 'ai-update') return 'auto_awesome';
    if (actionType === 'create') return section.includes('sections') ? 'create_new_folder' : 'note_add';
    if (actionType === 'delete') return 'delete';
    if (actionType === 'upload') return 'image';
    if (actionType === 'update' && section.includes('contenu')) return 'edit_document';
    if (actionType === 'update') return 'edit';
    if (actionType === 'undo') return 'undo';
    if (actionType === 'redo') return 'redo';
    return 'history';
  }

  getIconBgColor(entry: CollabHistoryEntry): string {
    const { actionType } = entry;
    if (actionType === 'ai-update') return 'bg-violet-500/20';
    if (actionType === 'create') return 'bg-green-500/20';
    if (actionType === 'delete') return 'bg-red-500/20';
    if (actionType === 'upload') return 'bg-blue-500/20';
    if (actionType === 'update') return 'bg-yellow-500/20';
    if (actionType === 'undo' || actionType === 'redo') return 'bg-purple-500/20';
    return 'bg-white/8';
  }

  getIconColor(entry: CollabHistoryEntry): string {
    const { actionType } = entry;
    if (actionType === 'ai-update') return 'text-violet-400';
    if (actionType === 'create') return 'text-green-400';
    if (actionType === 'delete') return 'text-red-400';
    if (actionType === 'upload') return 'text-blue-400';
    if (actionType === 'update') return 'text-yellow-400';
    if (actionType === 'undo' || actionType === 'redo') return 'text-purple-400';
    return 'text-white/40';
  }

  formatTime(ts: string): string {
    try {
      return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}
