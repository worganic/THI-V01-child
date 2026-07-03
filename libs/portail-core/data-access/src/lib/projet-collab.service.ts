import { Injectable, signal, inject, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { API_DATA_URL } from './tokens';
import { FtpNodeSyncStatus } from './project-files.service';

export interface LockInfo {
  nodeId: string;
  projetId: string;
  lockedById: string;
  lockedByName: string;
  lockedAt: string;
}

export interface CollabHistoryEntry {
  id: string;
  timestamp: string;
  section: string;
  actionType: string;
  label: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  userId: string | null;
  username: string;
  undone: boolean;
  undoable?: boolean;
  beforeState?: { content?: string } | null;
  afterState?: { content?: string } | null;
  context?: Record<string, any>;
}

export interface PendingHistoryEntry {
  entityId: string;
  label: string;
  username: string;
  timestamp: string;
  state: 'editing' | 'saving';
}

export interface ContentUpdateEvent {
  nodeId: string;
  folderId: string | null;
  content: string;
  updatedBy: string;
  updatedByName: string;
  timestamp: string;
}

export interface StructureUpdateEvent {
  operation: 'create_folder' | 'rename_folder' | 'delete_folder' | 'rename_file' | 'delete_file' | 'reorder';
  payload: any;
  updatedBy: string;
}

export interface SectionPublishedEvent {
  nodeId: string;
  folderId: string | null;
  sectionName: string;
  publishedBy: { userId: string; username: string };
  commitHash: string | null;
  timestamp: string;
}

export interface ProjectSyncedEvent {
  pulledBy: { userId: string; username: string };
  newCommits: number;
  changedFiles: string[];
  timestamp: string;
}

export interface VersionSavedEvent {
  nodeId: string;
  folderId: string | null;
  versionId: string;
  authorId: string;
  authorName: string;
  timestamp: string;
  origin: string;
}

export interface SyncStatus {
  isRepo: boolean;
  hasRemote?: boolean;
  ahead?: number;
  behind?: number;
}

@Injectable({ providedIn: 'root' })
export class ProjetCollabService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private zone = inject(NgZone);
  private apiUrl = inject(API_DATA_URL);

  readonly history = signal<CollabHistoryEntry[]>([]);
  readonly pending = signal<PendingHistoryEntry[]>([]);
  // Présence multi-utilisateurs : plusieurs éditeurs peuvent être présents simultanément
  // sur le même nœud (chacun avec son propre brouillon local).
  readonly locks = signal<Map<string, LockInfo[]>>(new Map());
  readonly connected = signal(false);

  // Sections avec modifications locales non encore partagées (publish)
  // Persiste à travers les navigations entre sections via le menu zone 3
  readonly localPendingSections = signal<Set<string>>(new Set());

  // Sections partagées par d'autres users en attente de pull local
  // Keyed par nodeId ; remplace l'entrée précédente si même section repartagée
  readonly pendingUpdates = signal<Map<string, SectionPublishedEvent>>(new Map());

  readonly isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  addLocalPending(sectionId: string): void {
    if (this.localPendingSections().has(sectionId)) return;
    const next = new Set(this.localPendingSections());
    next.add(sectionId);
    this.localPendingSections.set(next);
  }

  removeLocalPending(sectionId: string): void {
    if (!this.localPendingSections().has(sectionId)) return;
    const next = new Set(this.localPendingSections());
    next.delete(sectionId);
    this.localPendingSections.set(next);
  }

  isLocalPending(sectionId: string): boolean {
    return this.localPendingSections().has(sectionId);
  }

  readonly contentUpdate$ = new Subject<ContentUpdateEvent>();
  // Checkpoint BDD créé par un AUTRE utilisateur (autosave throttlé ou publish) —
  // sert à afficher le bouton "Synchro" sans attendre un conflit 409.
  readonly versionSaved$ = new Subject<VersionSavedEvent>();
  // Déclenché par les opérations d'annulation (undo) — sans filtre d'auteur
  readonly fileRestored$ = new Subject<ContentUpdateEvent>();
  readonly structureUpdate$ = new Subject<StructureUpdateEvent>();
  readonly sectionPublished$ = new Subject<SectionPublishedEvent>();
  readonly projectSynced$ = new Subject<ProjectSyncedEvent>();
  readonly ftpSyncStart$ = new Subject<{ totalFolders: number; totalFiles: number }>();
  readonly ftpFolderSynced$ = new Subject<{ folderId: string; status: FtpNodeSyncStatus; downloaded: number; checked: number; totalChecked: number; totalFiles: number; errors: any[] }>();
  readonly ftpSyncComplete$ = new Subject<{ status: 'done' | 'error'; downloaded: number; errors: any[] }>();
  // Mega-outils Trello : mutation d'une instance ou de ses cartes par un autre user
  readonly trelloUpdate$ = new Subject<{ instanceId: string | null; projectId: string; action: string }>();
  // Mega-outils Mockup : mutation d'une instance par un autre user
  readonly mockupUpdate$ = new Subject<{ instanceId: string | null; projectId: string; action: string }>();
  // Mega-outils Array : mutation d'une grille par un autre user
  readonly arrayUpdate$ = new Subject<{ instanceId: string | null; projectId: string; action: string }>();
  // Mega-outils Prompt : exécution ou historique mis à jour par un autre user
  readonly promptUpdate$ = new Subject<{ instanceId: string | null; projectId: string; action: string }>();

  // Demandes Partager / Annuler d'une section depuis le menu contextuel de la sidebar.
  // La zone d'édition (seule à connaître le contenu/les snapshots) écoute ces flux.
  readonly publishSectionRequest$ = new Subject<string>();
  readonly cancelSectionRequest$ = new Subject<string>();

  requestPublishSection(sectionId: string): void {
    this.publishSectionRequest$.next(sectionId);
  }

  requestCancelSection(sectionId: string): void {
    this.cancelSectionRequest$.next(sectionId);
  }

  // Demande de création d'un méga-outil (Trello / Tableau) dans une section,
  // depuis le menu contextuel de la sidebar. La zone d'édition crée l'instance.
  readonly createMegaOutilRequest$ = new Subject<{ type: 'trello' | 'array' | 'prompt'; folderId: string }>();

  requestCreateMegaOutil(type: 'trello' | 'array' | 'prompt', folderId: string): void {
    this.createMegaOutilRequest$.next({ type, folderId });
  }

  private eventSource: EventSource | null = null;
  private currentProjetId: string | null = null;

  connect(projetId: string): void {
    if (this.currentProjetId === projetId) return;
    this.disconnect();
    this.currentProjetId = projetId;
    this.loadHistory(projetId);
    this.loadLocks(projetId);
    this.openSSE(projetId);
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.currentProjetId = null;
    this.connected.set(false);
    this.history.set([]);
    this.pending.set([]);
    this.locks.set(new Map());
    this.localPendingSections.set(new Set());
    this.pendingUpdates.set(new Map());
    for (const handle of this.lockHeartbeats.values()) clearInterval(handle);
    this.lockHeartbeats.clear();
  }

  upsertPending(entry: PendingHistoryEntry): void {
    this.pending.update(list => {
      const idx = list.findIndex(e => e.entityId === entry.entityId);
      if (idx >= 0) {
        const next = list.slice();
        next[idx] = { ...next[idx], timestamp: entry.timestamp, label: entry.label, state: entry.state };
        return next;
      }
      return [entry, ...list];
    });
  }

  clearPending(entityId: string | number): void {
    const idStr = String(entityId).trim();
    this.pending.update(list => list.filter(e => String(e.entityId).trim() !== idStr));
  }

  clearAllPending(): void {
    this.pending.set([]);
  }

  // Bascule toutes les entrées en cours d'édition vers l'état "en cours de sauvegarde"
  markAllPendingSaving(): void {
    this.pending.update(list => list.map(e =>
      e.state === 'editing' ? { ...e, state: 'saving' as const } : e
    ));
  }

  async loadHistory(projetId: string): Promise<void> {
    try {
      const entries = await firstValueFrom(
        this.http.get<CollabHistoryEntry[]>(`${this.apiUrl}/api/collab/${projetId}/history?limit=200`)
      );
      this.history.set(entries);
    } catch (e) {
      console.warn('[Collab] loadHistory error:', e);
    }
  }

  async loadLocks(projetId: string): Promise<void> {
    try {
      const locks = await firstValueFrom(
        this.http.get<LockInfo[]>(`${this.apiUrl}/api/collab/${projetId}/locks`)
      );
      const map = new Map<string, LockInfo[]>();
      for (const lock of locks) {
        const arr = map.get(lock.nodeId) ?? [];
        arr.push(lock);
        map.set(lock.nodeId, arr);
      }
      this.locks.set(map);
    } catch (e) {
      console.warn('[Collab] loadLocks error:', e);
    }
  }

  private openSSE(projetId: string): void {
    try {
      this.eventSource = new EventSource(`${this.apiUrl}/api/collab/${projetId}/stream`);

      this.eventSource.addEventListener('connected', () => {
        this.connected.set(true);
      });

      this.eventSource.addEventListener('history', (e: MessageEvent) => {
        try {
          const entry: CollabHistoryEntry = JSON.parse(e.data);
          console.log('[Collab] SSE History event received:', entry);
          this.history.update(list => [entry, ...list.slice(0, 199)]);
          if (entry.entityId) {
            this.clearPending(entry.entityId);
          }
        } catch (err) {
          console.warn('[Collab] SSE history parse error:', err);
        }
      });

      this.eventSource.addEventListener('entries_undone', (e: MessageEvent) => {
        try {
          const { ids } = JSON.parse(e.data) as { ids: string[] };
          if (!ids?.length) return;
          const set = new Set(ids);
          this.history.update(list => list.map(en => set.has(en.id) ? { ...en, undone: true } : en));
        } catch (err) {
          console.warn('[Collab] SSE entries_undone parse error:', err);
        }
      });

      this.eventSource.addEventListener('lock', (e: MessageEvent) => {
        const lock: LockInfo = JSON.parse(e.data);
        this.zone.run(() => {
          this.locks.update(map => {
            const m = new Map(map);
            const arr = (m.get(lock.nodeId) ?? []).filter(l => l.lockedById !== lock.lockedById);
            arr.push(lock);
            m.set(lock.nodeId, arr);
            return m;
          });
        });
      });

      this.eventSource.addEventListener('unlock', (e: MessageEvent) => {
        const { nodeId, userId } = JSON.parse(e.data);
        this.zone.run(() => {
          this.locks.update(map => {
            const m = new Map(map);
            const arr = (m.get(nodeId) ?? []).filter(l => l.lockedById !== userId);
            if (arr.length) m.set(nodeId, arr); else m.delete(nodeId);
            return m;
          });
        });
      });

      // État complet des présences sur un nœud — rediffusé par le serveur à chaque
      // (dé)verrouillage ou balayage TTL, remplace la liste locale (source de vérité).
      this.eventSource.addEventListener('presence', (e: MessageEvent) => {
        try {
          const evt: { nodeId: string; projetId: string; users: LockInfo[] } = JSON.parse(e.data);
          this.zone.run(() => {
            this.locks.update(map => {
              const m = new Map(map);
              if (evt.users.length) m.set(evt.nodeId, evt.users); else m.delete(evt.nodeId);
              return m;
            });
          });
        } catch (err) {
          console.warn('[Collab] SSE presence parse error:', err);
        }
      });

      this.eventSource.addEventListener('content_update', (e: MessageEvent) => {
        try {
          const update: ContentUpdateEvent = JSON.parse(e.data);
          const me = this.auth.currentUser();
          if (update.updatedBy !== me?.id) this.contentUpdate$.next(update);
        } catch (err) {
          console.warn('[Collab] SSE content_update parse error:', err);
        }
      });

      this.eventSource.addEventListener('version_saved', (e: MessageEvent) => {
        try {
          const evt: VersionSavedEvent = JSON.parse(e.data);
          const me = this.auth.currentUser();
          if (evt.authorId !== me?.id) this.zone.run(() => this.versionSaved$.next(evt));
        } catch (err) {
          console.warn('[Collab] SSE version_saved parse error:', err);
        }
      });

      this.eventSource.addEventListener('file_restored', (e: MessageEvent) => {
        try {
          const update: ContentUpdateEvent = JSON.parse(e.data);
          // Pas de filtre d'auteur : un undo doit toujours rafraîchir l'éditeur
          this.fileRestored$.next(update);
        } catch (err) {
          console.warn('[Collab] SSE file_restored parse error:', err);
        }
      });

      this.eventSource.addEventListener('trello_update', (e: MessageEvent) => {
        try {
          const update = JSON.parse(e.data) as { instanceId: string | null; projectId: string; action: string };
          this.zone.run(() => this.trelloUpdate$.next(update));
        } catch (err) {
          console.warn('[Collab] SSE trello_update parse error:', err);
        }
      });

      this.eventSource.addEventListener('mockup_update', (e: MessageEvent) => {
        try {
          const update = JSON.parse(e.data) as { instanceId: string | null; projectId: string; action: string };
          this.zone.run(() => this.mockupUpdate$.next(update));
        } catch (err) {
          console.warn('[Collab] SSE mockup_update parse error:', err);
        }
      });

      this.eventSource.addEventListener('array_update', (e: MessageEvent) => {
        try {
          const update = JSON.parse(e.data) as { instanceId: string | null; projectId: string; action: string };
          this.zone.run(() => this.arrayUpdate$.next(update));
        } catch (err) {
          console.warn('[Collab] SSE array_update parse error:', err);
        }
      });

      this.eventSource.addEventListener('prompt_update', (e: MessageEvent) => {
        try {
          const update = JSON.parse(e.data) as { instanceId: string | null; projectId: string; action: string };
          this.zone.run(() => this.promptUpdate$.next(update));
        } catch (err) {
          console.warn('[Collab] SSE prompt_update parse error:', err);
        }
      });

      this.eventSource.addEventListener('structure_update', (e: MessageEvent) => {
        try {
          const update: StructureUpdateEvent = JSON.parse(e.data);
          const me = this.auth.currentUser();
          if (update.updatedBy !== me?.id) this.structureUpdate$.next(update);
        } catch (err) {
          console.warn('[Collab] SSE structure_update parse error:', err);
        }
      });

      this.eventSource.addEventListener('section_published', (e: MessageEvent) => {
        try {
          const evt: SectionPublishedEvent = JSON.parse(e.data);
          const me = this.auth.currentUser();
          // Notification destinée aux AUTRES users du projet
          if (evt.publishedBy.userId !== me?.id) {
            this.zone.run(() => {
              this.pendingUpdates.update(map => {
                const m = new Map(map);
                m.set(evt.nodeId, evt);
                return m;
              });
              this.sectionPublished$.next(evt);
            });
          }
        } catch (err) {
          console.warn('[Collab] SSE section_published parse error:', err);
        }
      });

      this.eventSource.addEventListener('project_synced', (e: MessageEvent) => {
        try {
          const evt: ProjectSyncedEvent = JSON.parse(e.data);
          this.zone.run(() => this.projectSynced$.next(evt));
        } catch (err) {
          console.warn('[Collab] SSE project_synced parse error:', err);
        }
      });

      this.eventSource.addEventListener('ftp_sync_start', (e: MessageEvent) => {
        try {
          const evt = JSON.parse(e.data);
          this.zone.run(() => this.ftpSyncStart$.next(evt));
        } catch (err) {
          console.warn('[Collab] SSE ftp_sync_start parse error:', err);
        }
      });

      this.eventSource.addEventListener('ftp_folder_synced', (e: MessageEvent) => {
        try {
          const evt = JSON.parse(e.data);
          this.zone.run(() => this.ftpFolderSynced$.next(evt));
        } catch (err) {
          console.warn('[Collab] SSE ftp_folder_synced parse error:', err);
        }
      });

      this.eventSource.addEventListener('ftp_sync_complete', (e: MessageEvent) => {
        try {
          const evt = JSON.parse(e.data);
          this.zone.run(() => this.ftpSyncComplete$.next(evt));
        } catch (err) {
          console.warn('[Collab] SSE ftp_sync_complete parse error:', err);
        }
      });

      this.eventSource.onerror = () => {
        this.connected.set(false);
        this.eventSource?.close();
        this.eventSource = null;
        setTimeout(() => {
          if (this.currentProjetId === projetId) this.openSSE(projetId);
        }, 5000);
      };
    } catch (e) {
      console.warn('[Collab] SSE init error:', e);
    }
  }

  // Heartbeats de présence actifs, keyés par `${projetId}:${nodeId}` — tant que la
  // section reste "verrouillée" (= en cours d'édition par l'utilisateur courant),
  // on répète l'appel de lock pour que la présence ne soit jamais nettoyée par le
  // balayage TTL serveur (5 min) pendant une session d'édition longue.
  private lockHeartbeats = new Map<string, ReturnType<typeof setInterval>>();
  private static readonly HEARTBEAT_INTERVAL_MS = 20000;

  async lockNode(projetId: string, nodeId: string): Promise<LockInfo> {
    const user = this.auth.currentUser();
    const key = `${projetId}:${nodeId}`;
    const doLock = () => firstValueFrom(
      this.http.post<LockInfo>(`${this.apiUrl}/api/collab/${projetId}/nodes/${nodeId}/lock`, {
        userId: user?.id || 'anonymous',
        userName: user?.username || 'Utilisateur'
      })
    );
    const lock = await doLock();
    if (!this.lockHeartbeats.has(key)) {
      this.lockHeartbeats.set(key, setInterval(() => {
        doLock().catch(() => {});
      }, ProjetCollabService.HEARTBEAT_INTERVAL_MS));
    }
    return lock;
  }

  async unlockNode(projetId: string, nodeId: string): Promise<void> {
    const user = this.auth.currentUser();
    const key = `${projetId}:${nodeId}`;
    const handle = this.lockHeartbeats.get(key);
    if (handle) {
      clearInterval(handle);
      this.lockHeartbeats.delete(key);
    }
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/api/collab/${projetId}/nodes/${nodeId}/lock?userId=${user?.id || ''}`)
    );
  }

  async fetchEntry(entryId: string): Promise<CollabHistoryEntry> {
    return firstValueFrom(
      this.http.get<CollabHistoryEntry>(`${this.apiUrl}/api/wo-action-history/${entryId}`)
    );
  }

  async clearHistory(projetId: string, opts: { entityIds?: string[]; scope?: 'mine' | 'all' } = {}): Promise<number> {
    const params: string[] = [];
    if (opts.scope) params.push(`scope=${encodeURIComponent(opts.scope)}`);
    if (opts.entityIds && opts.entityIds.length > 0) {
      params.push(`entityIds=${encodeURIComponent(opts.entityIds.join(','))}`);
    }
    const qs = params.length ? `?${params.join('&')}` : '';
    const res = await firstValueFrom(
      this.http.delete<{ success: boolean; deleted: number }>(
        `${this.apiUrl}/api/collab/${projetId}/history${qs}`,
        { headers: this.auth.getAuthHeaders() }
      )
    );
    // Retire localement les entrées concernées (le SSE n'émet pas pour les deletes)
    const ids = opts.entityIds && opts.entityIds.length > 0 ? new Set(opts.entityIds) : null;
    const me = this.auth.currentUser();
    this.history.update(list => list.filter(e => {
      const matchEntity = !ids || (e.entityId && ids.has(e.entityId));
      const matchScope = opts.scope === 'all' || (e.userId === (me?.id || ''));
      // garder l'entrée si elle ne tombe PAS dans la suppression
      return !(matchEntity && matchScope);
    }));
    return res.deleted;
  }

  isLockedByMe(nodeId: string): boolean {
    const user = this.auth.currentUser();
    return this.getPresences(nodeId).some(l => l.lockedById === (user?.id || ''));
  }

  isLockedByOther(nodeId: string): boolean {
    const user = this.auth.currentUser();
    return this.getPresences(nodeId).some(l => l.lockedById !== (user?.id || ''));
  }

  /** Toutes les présences actives sur un nœud (moi inclus le cas échéant). */
  getPresences(nodeId: string): LockInfo[] {
    return this.locks().get(nodeId) ?? [];
  }

  /** Présences d'autres utilisateurs sur un nœud (moi exclu) — pour les badges/tooltips. */
  getOtherEditors(nodeId: string): LockInfo[] {
    const user = this.auth.currentUser();
    return this.getPresences(nodeId).filter(l => l.lockedById !== (user?.id || ''));
  }

  /** @deprecated conservé pour compat — retourne la première présence connue sur ce nœud. */
  getLock(nodeId: string): LockInfo | undefined {
    return this.getPresences(nodeId)[0];
  }

  hasPendingUpdate(nodeId: string): boolean {
    return this.pendingUpdates().has(nodeId);
  }

  getPendingUpdate(nodeId: string): SectionPublishedEvent | undefined {
    return this.pendingUpdates().get(nodeId);
  }

  dismissPendingUpdate(nodeId: string): void {
    if (!this.pendingUpdates().has(nodeId)) return;
    const m = new Map(this.pendingUpdates());
    m.delete(nodeId);
    this.pendingUpdates.set(m);
  }

  clearAllPendingUpdates(): void {
    if (this.pendingUpdates().size === 0) return;
    this.pendingUpdates.set(new Map());
  }

  async pullProject(projectName: string): Promise<{ newCommits: number; changedFiles: string[] }> {
    const res = await firstValueFrom(
      this.http.post<{ success: boolean; newCommits?: number; changedFiles?: string[] }>(
        `${this.apiUrl}/api/file-projects/${encodeURIComponent(projectName)}/pull`,
        {}
      )
    );
    // Une fois le pull réussi, on vide les notifs en attente (le contenu local est à jour)
    this.clearAllPendingUpdates();
    return { newCommits: res.newCommits || 0, changedFiles: res.changedFiles || [] };
  }

  async pushProject(projectName: string): Promise<{ success: boolean }> {
    const res = await firstValueFrom(
      this.http.post<{ success: boolean }>(
        `${this.apiUrl}/api/file-projects/${encodeURIComponent(projectName)}/push`,
        {}
      )
    );
    return res;
  }

  async getSyncStatus(projectName: string): Promise<SyncStatus> {
    try {
      return await firstValueFrom(
        this.http.get<SyncStatus>(`${this.apiUrl}/api/file-projects/${encodeURIComponent(projectName)}/sync-status`)
      );
    } catch {
      return { isRepo: false };
    }
  }

  private listenOnlineStatus(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.zone.run(() => this.isOnline.set(true)));
    window.addEventListener('offline', () => this.zone.run(() => this.isOnline.set(false)));
  }

  constructor() {
    this.listenOnlineStatus();
  }
}
