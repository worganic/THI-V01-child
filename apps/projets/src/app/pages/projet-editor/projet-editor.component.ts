import { Component, OnInit, OnDestroy, signal, computed, ViewChild, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { runtimeEnv } from '../../runtime-env';
import { Subscription } from 'rxjs';
import { ProjectService, Project } from '@worganic/portail-core/data-access';
import { ProjectFilesService, FileNode, FtpNodeSyncStatus, Outil, AgendaEvent } from '@worganic/portail-core/data-access';
import { MegaOutilsService, MegaOutilInstance } from '@worganic/portail-core/data-access';
import { ConfigService } from '@worganic/portail-core/data-access';
import { AuthService } from '@worganic/portail-core/data-access';
import { LayoutService } from '@worganic/portail-core/data-access';
import { WoActionHistoryService, WoRestoredContent } from '@worganic/portail-core/data-access';
import { ProjetCollabService, CollabHistoryEntry, VersionSavedEvent } from '@worganic/portail-core/data-access';
import { PromptLaunchContext, MaterializedMoPreview } from '@worganic/portail-core/data-access';
import { ConversationService } from '@worganic/portail-core/data-access';

import { WorgMiniHeaderComponent } from '@worganic/shared/ui';
import { ProjetToolbarComponent } from './components/projet-toolbar/projet-toolbar.component';
import { ProjetSidebarComponent, DragDropEvent } from './components/projet-sidebar/projet-sidebar.component';
import { ProjetEditorZoneComponent, FileSaveEvent, SectionInfo } from './components/projet-editor-zone/projet-editor-zone.component';
import { EditionOutilComponent } from './outils/edition/edition-outil.component';
import { stripStyleMarkdown, normalizeStyledMarkdown, cssTwinName, isCssTwinName } from './content-style.util';
import { TestsOutilComponent } from './outils/tests/tests-outil.component';
import { AgendaOutilComponent } from './outils/agenda/agenda-outil.component';
import { ProjetConversationComponent } from './components/projet-conversation/projet-conversation.component';
import { ProjetStatusbarComponent } from './components/projet-statusbar/projet-statusbar.component';
import { ProjetHistoryComponent } from './components/projet-history/projet-history.component';
import { ProjetDiffComponent } from './components/projet-diff/projet-diff.component';
import { ProjetAiDiffComponent } from './components/projet-ai-diff/projet-ai-diff.component';
import { ProjetUpdateBannerComponent } from './components/projet-update-banner/projet-update-banner.component';
import { CommentsDrawerComponent } from './components/comments-drawer/comments-drawer.component';
import { ProjectCommentsService } from './services/project-comments.service';
import { ProjetAiEditService } from './services/projet-ai-edit.service';
import { ProjetIncomingChangeService } from './services/projet-incoming-change.service';

@Component({
  selector: 'app-projet-editor',
  standalone: true,
  imports: [
    CommonModule,
    WorgMiniHeaderComponent,
    ProjetToolbarComponent,
    ProjetSidebarComponent,
    EditionOutilComponent,
    TestsOutilComponent,
    AgendaOutilComponent,
    ProjetConversationComponent,
    ProjetStatusbarComponent,
    ProjetHistoryComponent,
    ProjetDiffComponent,
    ProjetAiDiffComponent,
    ProjetUpdateBannerComponent,
    CommentsDrawerComponent,
  ],
  templateUrl: './projet-editor.component.html',
  styleUrl: './projet-editor.component.scss'
})
export class ProjetEditorComponent implements OnInit, OnDestroy {
  @ViewChild(EditionOutilComponent) editionOutil?: EditionOutilComponent;
  @ViewChild(ProjetSidebarComponent) sidebar?: ProjetSidebarComponent;
  @ViewChild(ProjetConversationComponent) conversationPanel?: ProjetConversationComponent;

  readonly portailUrl = runtimeEnv.portailUrl;

  project = signal<Project | null>(null);
  files = signal<FileNode[]>([]);
  loading = signal(true);
  localUnavailable = signal<string | null>(null);
  initMessage = signal<string | null>(null);
  saveStatus = signal<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  nodeSyncStatus = signal<Map<string, FtpNodeSyncStatus>>(new Map());
  ftpSyncGlobalStatus = signal<'idle' | 'syncing' | 'done' | 'error'>('idle');
  ftpSyncProgress = signal<{ checked: number; total: number }>({ checked: 0, total: 0 });
  private wasCreatedLocal = false;
  activeNodeId = signal<string | null>(null);
  highlightNodeId = signal<string | null>(null);
  scrollToNodeId = signal<string | null>(null);
  // Demande de bascule de mode de l'éditeur (token = re-déclenchement même mode identique).
  editorModeRequest = signal<{ mode: 'edit' | 'visu' | 'structure'; token: number } | null>(null);
  // Demande d'ouverture d'un événement dans l'agenda (depuis la sidebar).
  agendaEventToOpen = signal<{ event: AgendaEvent; token: number } | null>(null);
  zone5Tab = signal<'conversation' | 'history'>('conversation');
  zone5Collapsed = signal(false);

  // ── Redimensionnement du volet Conversation/Historique (glisser-déposer sur la poignée) ──
  private static readonly ZONE5_WIDTH_KEY = 'wo-zone5-width';
  private static readonly ZONE5_WIDTH_MIN = 240;
  private static readonly ZONE5_WIDTH_MAX = 640;
  zone5Width = signal<number>(ProjetEditorComponent.loadZone5Width());
  private zone5Resize: { startWidth: number; startX: number } | null = null;

  private static loadZone5Width(): number {
    try {
      const raw = localStorage.getItem(ProjetEditorComponent.ZONE5_WIDTH_KEY);
      const n = raw ? parseInt(raw, 10) : NaN;
      if (!isNaN(n)) return Math.min(Math.max(n, ProjetEditorComponent.ZONE5_WIDTH_MIN), ProjetEditorComponent.ZONE5_WIDTH_MAX);
    } catch { /* localStorage indisponible (navigation privée…) */ }
    return 320; // équivalent Tailwind w-80
  }

  startZone5Resize(ev: MouseEvent) {
    ev.preventDefault();
    this.zone5Resize = { startWidth: this.zone5Width(), startX: ev.clientX };
  }

  @HostListener('document:mousemove', ['$event'])
  onZone5ResizeMove(ev: MouseEvent) {
    if (!this.zone5Resize) return;
    // Poignée à gauche du volet : glisser vers la gauche agrandit le volet.
    const delta = this.zone5Resize.startX - ev.clientX;
    const next = Math.min(Math.max(this.zone5Resize.startWidth + delta, ProjetEditorComponent.ZONE5_WIDTH_MIN), ProjetEditorComponent.ZONE5_WIDTH_MAX);
    this.zone5Width.set(next);
  }

  @HostListener('document:mouseup')
  onZone5ResizeEnd() {
    if (!this.zone5Resize) return;
    this.zone5Resize = null;
    try { localStorage.setItem(ProjetEditorComponent.ZONE5_WIDTH_KEY, String(this.zone5Width())); } catch { /* ignore */ }
  }
  // F6 — Drawer des commentaires de section
  commentsDrawer = signal<{ visible: boolean; folderId: string | null; folderName: string }>({
    visible: false, folderId: null, folderName: ''
  });
  commentCounts = signal<Record<string, number>>({});
  // Map fileId -> imageIds[] pour les images imbriquées dans un bloc document
  nestedImagesMap = signal<Record<string, string[]>>({});
  diffEntry = signal<CollabHistoryEntry | null>(null);

  outils = signal<Outil[]>([]);
  activeOutilId = signal<string | null>(null);

  megaOutilInstances = signal<MegaOutilInstance[]>([]);
  activeMegaOutil    = signal<MegaOutilInstance | null>(null);
  showTrelloList     = signal(false);
  showMockupList     = signal(false);
  showPromptListView = signal(false);

  readonly trelloInstanceCount = computed(() => this.megaOutilInstances().filter(i => i.type === 'trello').length);
  readonly mockupInstanceCount = computed(() => this.megaOutilInstances().filter(i => i.type === 'mockup').length);

  readonly activeOutil = computed(() =>
    this.outils().find(o => o.id === this.activeOutilId()) ?? this.outils()[0] ?? null
  );

  readonly activeOutilFiles = computed<FileNode[]>(() => {
    const outil = this.activeOutil();
    if (!outil) return this.files();
    if (!outil.rootFolderIds.length) return this.files();
    const filtered = this.files().filter(f => outil.rootFolderIds.includes(f.id));
    return filtered.length > 0 ? filtered : this.files();
  });

  restoreToken = signal(0);
  pendingEditSource = 'user-editing';
  onEditSource(source: string) { this.pendingEditSource = source; }
  dragDropError = signal<string | null>(null);
  private dragDropErrorTimer: ReturnType<typeof setTimeout> | null = null;
  conflictState = signal<{
    fileId: string; folderId?: string;
    baseVersionId: string | null;
    mineContent: string;
    serverContent: string; serverAuthorName: string; serverCreatedAt: string;
    // true = conflit LIVE ouvert depuis la carte flottante "Voir le diff complet" (aucune
    // tentative de publication n'a encore eu lieu) : la résolution ne doit PAS passer par la
    // route serveur resolve-conflict (qui ne déclenche jamais de publish git/FTP) — juste une
    // fusion locale, le prochain "Enregistrer et partager" normal publiera avec le bon
    // baseVersionId. Absent/false = conflit réactif classique (409 ou bouton Synchro).
    isLiveConflict?: boolean;
    liveVersionId?: string;
  } | null>(null);

  // Conflit live : signal "changement entrant en attente" par fileId (voir
  // ProjetIncomingChangeService) — alimenté par contentUpdate$/versionSaved$ filtré sur les
  // fichiers avec brouillon local divergent (isLocalPending), jamais vidé automatiquement.
  incomingChangeService = inject(ProjetIncomingChangeService);

  // Checkpoints BDD créés par d'AUTRES utilisateurs, en attente de synchro manuelle
  // (bouton "Synchro" — ouvre le même écran de fusion qu'un conflit, sans attendre un 409).
  newerVersions = signal<Map<string, VersionSavedEvent>>(new Map());

  readonly activeSectionNewerVersion = computed<VersionSavedEvent | null>(() => {
    const activeId = this.activeNodeId();
    if (!activeId) return null;
    for (const evt of this.newerVersions().values()) {
      if (evt.folderId === activeId || evt.nodeId === activeId) return evt;
    }
    return null;
  });

  async onSyncClick(): Promise<void> {
    const evt = this.activeSectionNewerVersion();
    if (!evt) return;
    const fileNode = this.findFileById(evt.nodeId, this.files());
    if (!fileNode) return;
    try {
      const versionData = await this.projectFilesService.getVersionContent(this.projectFolderName, evt.nodeId, evt.versionId);
      this.conflictState.set({
        fileId: evt.nodeId,
        folderId: evt.folderId ?? undefined,
        baseVersionId: fileNode.fileVersion ?? null,
        mineContent: fileNode.content ?? '',
        serverContent: versionData.content,
        serverAuthorName: versionData.author_name,
        serverCreatedAt: versionData.created_at
      });
      this.newerVersions.update(m => { const n = new Map(m); n.delete(evt.nodeId); return n; });
    } catch (e) {
      console.error('[Synchro] Récupération de la version échouée:', e);
    }
  }

  // ── Conflit live (carte flottante) ──────────────────────────────────────────
  // "Insérer" (fusion automatique du bloc de B) est géré directement dans la zone
  // d'édition (ProjetEditorZoneComponent.insertIncomingChange) car elle seule peut
  // spliced `unifiedContent` sans démonter le composant — voir bridge onIncomingChangeMerged
  // ci-dessous pour la synchro de fileVersion côté parent. "Voir le diff complet" et
  // "Rejeter" n'ont pas besoin de toucher `unifiedContent` (le premier remplace
  // temporairement la zone via conflictState, le second ne change aucun contenu) et sont
  // donc gérés ici directement.

  /** "Voir le diff complet" sur une carte de conflit live — réutilise l'écran de fusion
   *  existant (<app-projet-diff>/conflictState), sans passer par la route resolve-conflict. */
  openIncomingChangeDiff(fileId: string): void {
    const change = this.incomingChangeService.get(fileId);
    const fileNode = this.findFileById(fileId, this.files());
    if (!change || !fileNode) return;
    // Capturer le texte réellement affiché à l'écran (heading + corps, y compris la frappe en
    // cours de A) AVANT de démonter <app-edition-outil> (conflictState le remplace dans le
    // template, cf. @else if plus bas) — même contrainte que onHistoryEntryClick.
    // fileNode.content seul est stale (jamais mis à jour par la frappe live, seul le brouillon
    // serveur l'est) et sans le heading — alors que change.content (contenu brut publié) l'inclut
    // en 1ère ligne, ce qui dupliquait le titre une fois réappliqué.
    const rendered = (change.folderId && this.editionOutil?.getEntityText(change.folderId)) || fileNode.content || '';
    this.conflictState.set({
      fileId,
      folderId: change.folderId ?? undefined,
      baseVersionId: fileNode.fileVersion ?? null,
      mineContent: rendered,
      serverContent: change.content,
      serverAuthorName: change.authorName,
      serverCreatedAt: change.timestamp,
      isLiveConflict: true,
      liveVersionId: change.versionId
    });
    this.incomingChangeService.resolve(fileId);
  }

  /** "Rejeter" sur une carte de conflit live : A garde son texte tel quel, on aligne juste
   *  fileVersion sur celui de B (décision explicite et informée, pas un écrasement silencieux)
   *  pour que le prochain "Enregistrer et partager" ne déclenche pas un faux 409. */
  rejectIncomingChange(fileId: string): void {
    const change = this.incomingChangeService.get(fileId);
    if (!change) return;
    this.patchFileVersionOnly(fileId, change.versionId);
    this.incomingChangeService.resolve(fileId);
  }

  /** Bridge depuis la zone d'édition après un "Insérer" réussi (splice local de
   *  unifiedContent déjà fait côté zone) : patche `files()` avec le MÊME contenu fusionné
   *  (pas seulement fileVersion) — sinon un changement de mode Code/Visu, qui reconstruit le
   *  buffer depuis `files()`, écraserait silencieusement la fusion avec l'ancien contenu. */
  onIncomingChangeMerged(evt: { fileId: string; content: string; versionId: string }): void {
    this.patchFileContent(evt.fileId, evt.content, evt.versionId);
  }

  /** Met à jour uniquement `fileVersion` d'un noeud, en relisant `files()` au moment de
   *  l'appel (jamais un `content` capturé plus tôt) — évite toute course avec un patch de
   *  contenu concurrent (ex: sauvegarde de brouillon en cours après un "Insérer"). */
  private patchFileVersionOnly(fileId: string, versionId: string) {
    const patch = (nodes: FileNode[]): { changed: boolean; nodes: FileNode[] } => {
      let changed = false;
      const out = nodes.map(n => {
        if (n.id === fileId && n.type === 'file') { changed = true; return { ...n, fileVersion: versionId }; }
        if (n.children) {
          const sub = patch(n.children);
          if (sub.changed) { changed = true; return { ...n, children: sub.nodes }; }
        }
        return n;
      });
      return { changed, nodes: out };
    };
    const result = patch(this.files());
    if (result.changed) this.files.set(result.nodes);
  }

  // Objet "entrée d'historique" synthétique pour réutiliser <app-projet-diff> (3 panneaux
  // Actuel/Avant/Après + cherry-pick ligne à ligne) sur un conflit de sauvegarde multi-user.
  readonly conflictDiffEntry = computed<CollabHistoryEntry | null>(() => {
    const c = this.conflictState();
    if (!c) return null;
    return {
      id: 'conflict', timestamp: c.serverCreatedAt, section: '', actionType: 'conflict',
      label: 'Conflit de sauvegarde', entityType: 'file', entityId: c.fileId, entityLabel: '',
      userId: null, username: c.serverAuthorName, undone: false,
      beforeState: { content: c.serverContent }, afterState: { content: c.mineContent }
    };
  });
  aiEditService = inject(ProjetAiEditService);
  private megaOutilsService = inject(MegaOutilsService);
  private conversationService = inject(ConversationService);
  // Confirmation inline avant suppression de toute la conversation de la section active.
  confirmDeleteConversation = signal(false);
  hasPendingEdit = computed(() => !!this.aiEditService.pendingEdit());
  hasFtpBackup = computed(() => this.project()?.backupType === 'ftp');

  // Contenu actuel de l'entité (section ou fichier) concernée par l'entrée d'historique
  // ouverte dans le diff. Capturé en snapshot au clic (voir onHistoryEntryClick) plutôt
  // que recalculé en computed() : <app-edition-outil> (qui seul peut résoudre le texte
  // "rendu" d'une section via getEntityText) et <app-projet-diff> sont mutuellement
  // exclusifs dans le template (@else if (diffEntry())), donc son ViewChild n'est déjà
  // plus disponible au moment où le diff s'affiche.
  readonly diffCurrentContent = signal<string | null>(null);

  // Nom + icône du noeud actuellement sélectionné, affichés sous les onglets de la zone 5b
  readonly activeNodeInfo = computed<{ name: string; icon: string } | null>(() => {
    const id = this.activeNodeId();
    if (!id) return null;
    // ID virtuel de bloc inline (format: folderId##kind##index)
    if (id.includes('##')) {
      const kind = id.split('##')[1] ?? '';
      const blockLabels: Record<string, string> = {
        'block-table': 'Tableau', 'block-quote': 'Citation',
        'block-fence': 'Bloc de code', 'block-list': 'Liste',
      };
      return { name: blockLabels[kind] || 'Bloc', icon: 'widgets' };
    }
    const folder = this.findFolderById(id, this.files());
    if (folder) return { name: folder.name, icon: 'folder' };
    const file = this.findFileById(id, this.files());
    if (!file) return null;
    if (this.projectFilesService.isImageFile(file.name)) return { name: file.name, icon: 'image' };
    return { name: file.name, icon: 'description' };
  });

  // Set d'entityIds à afficher dans l'historique selon la sélection courante.
  // - ID virtuel de bloc (contient ##) → uniquement ce bloc
  // - Dossier sélectionné → folder + descendants + blocs inline appartenant à ces folders
  // - contenu.md sélectionné → traité comme le dossier parent
  // - Fichier additionnel → uniquement lui-même
  // Fichier de contenu principal (contenu.md) de la section active — pour la zone
  // Historique, groupe "Versions de cette section".
  readonly activeContentFileId = computed<string | null>(() => {
    const id = this.activeNodeId();
    if (!id || id.includes('##')) return null;
    const folder = this.findFolderById(id, this.files());
    if (folder) {
      const contentFile = (folder.children || []).find(c => c.type === 'file' && c.name === 'contenu.md');
      return contentFile?.id ?? null;
    }
    return this.findFileById(id, this.files())?.id ?? null;
  });

  readonly activeHistoryIds = computed<Set<string> | null>(() => {
    const id = this.activeNodeId();
    if (!id) return null;
    // ID virtuel de bloc inline → filtre uniquement ce bloc
    if (id.includes('##')) return new Set<string>([id]);
    const folder = this.findFolderById(id, this.files());
    if (folder) {
      const baseSet = this.collectDescendantIds(folder);
      // Inclure les blocs inline dont le parentFolderId est dans cet arbre
      for (const entry of this.history.entries()) {
        const eid = String(entry.entityId ?? '');
        if (eid.includes('##')) {
          const parentId = eid.split('##')[0];
          if (baseSet.has(parentId)) baseSet.add(eid);
        }
      }
      return baseSet;
    }
    const fileNode = this.findFileById(id, this.files());
    if (fileNode?.name === 'contenu.md') {
      const parent = this.findParentFolder(id, this.files());
      if (parent) {
        const baseSet = this.collectDescendantIds(parent);
        for (const entry of this.history.entries()) {
          const eid = String(entry.entityId ?? '');
          if (eid.includes('##')) {
            const parentId = eid.split('##')[0];
            if (baseSet.has(parentId)) baseSet.add(eid);
          }
        }
        return baseSet;
      }
    }
    return new Set<string>([id]);
  });

  private collectDescendantIds(node: FileNode): Set<string> {
    const ids = new Set<string>();
    const walk = (n: FileNode) => {
      ids.add(n.id);
      for (const c of (n.children || [])) walk(c);
    };
    walk(node);
    return ids;
  }

  // Met à jour le contenu d'un fichier dans le signal `files` sans recharger depuis le serveur.
  // Cela garde le signal synchronisé avec ce qui est sur disque, pour que si l'éditeur est
  // démonté/remonté (ex: ouverture du diff), il reconstruise depuis le contenu à jour.
  private patchFileContent(fileId: string, content: string, versionId?: string) {
    const patch = (nodes: FileNode[]): { changed: boolean; nodes: FileNode[] } => {
      let changed = false;
      const out = nodes.map(n => {
        if (n.id === fileId && n.type === 'file') {
          changed = true;
          return { ...n, content, ...(versionId ? { fileVersion: versionId } : {}) };
        }
        if (n.children) {
          const sub = patch(n.children);
          if (sub.changed) {
            changed = true;
            return { ...n, children: sub.nodes };
          }
        }
        return n;
      });
      return { changed, nodes: out };
    };
    const result = patch(this.files());
    if (result.changed) this.files.set(result.nodes);
  }

  // Résout {{IMG:id}} → ![alt](nom-fichier) pour le Markdown propre (contenu.md)
  private cleanImgResolver = (id: string): { alt: string; path: string } | null => {
    const find = (nodes: FileNode[]): FileNode | null => {
      for (const n of nodes) {
        if (n.id === id && n.type === 'file') return n;
        if (n.children) { const f = find(n.children); if (f) return f; }
      }
      return null;
    };
    const n = find(this.files());
    if (!n) return null;
    return { alt: n.name.replace(/\.[^.]+$/, ''), path: n.name };
  };

  /**
   * Écrit/crée le jumeau stylisé `<main>-css.md` d'une section avec le contenu stylisé,
   * dans le même dossier que le fichier principal. Réutilisé par le système double fichier.
   */
  private async saveCssTwin(folderId: string | null, mainFileId: string, styled: string): Promise<void> {
    if (!folderId || !this.projectFolderName) return;
    const folder = this.findFolderById(folderId, this.files());
    if (!folder) return;
    const children = folder.children || [];
    const mainNode = children.find(c => c.id === mainFileId);
    const twinName = cssTwinName(mainNode?.name ?? 'contenu.md');
    const twin = children.find(c => c.type === 'file' && c.name === twinName);
    try {
      if (twin) {
        if ((twin.content ?? '') !== styled) {
          await this.projectFilesService.updateFile(this.projectFolderName, twin.id, styled, folderId);
          this.patchFileContent(twin.id, styled);
        }
      } else {
        const baseName = twinName.replace(/\.md$/i, '');
        const created = await this.projectFilesService.createFile(this.projectFolderName, { name: baseName, parentId: folderId, content: styled });
        this.patchFileContent(created.id, styled);
      }
    } catch (e) {
      console.warn('[ProjetEditor] saveCssTwin échoué :', e);
    }
  }

  private findFileById(id: string, nodes: FileNode[]): FileNode | null {
    for (const node of nodes) {
      if (node.type === 'file' && node.id === id) return node;
      if (node.children) {
        const f = this.findFileById(id, node.children);
        if (f) return f;
      }
    }
    return null;
  }

  private projectFolderName = '';
  private savedStatusTimer: any;
  private pendingFolders = new Set<string>();
  private pendingFolderNames = new Set<string>(); // noms de dossiers en cours de création (protection anti-suppression)
  private isSaving = false;
  private pendingSections: SectionInfo[] | null = null;
  private pendingSSEPatches: Array<{ nodeId: string; content: string }> = [];
  private history = inject(WoActionHistoryService);
  private collab = inject(ProjetCollabService);
  private commentsService = inject(ProjectCommentsService);
  private collabSubs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private projectFilesService: ProjectFilesService,
    private configService: ConfigService,
    private layoutService: LayoutService,
    public auth: AuthService
  ) {}

  async ngOnInit() {
    this.layoutService.editorMode.set(true);
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/projets']); return; }
    try {
      const proj = await this.projectService.getProject(id);
      this.project.set(proj);
      this.configService.setCurrentProjectId(proj.id);
      this.projectFolderName = id;
    } catch {
      this.router.navigate(['/projets']);
      return;
    }

    // Phase 1 — Affichage immédiat : structure locale sans FTP
    try {
      const fast = await this.projectFilesService.ensureFast(this.projectFolderName);
      this.wasCreatedLocal = fast.status === 'created-local';
    } catch (e: any) {
      // Fallback sur ensure-local si ensure-fast échoue (projet manquant en BDD, config.json absent…)
      // Pour les projets FTP on reste sur le fast-path pour ne pas déclencher la sync bloquante
      console.warn('ensureFast error, fallback ensureLocal:', e);
      if (this.project()?.backupType !== 'ftp') {
        try {
          const fallback = await this.projectFilesService.ensureLocal(this.projectFolderName);
          if (fallback.status === 'no-remote') {
            this.localUnavailable.set(fallback.message || 'Projet non disponible localement.');
            this.loading.set(false);
            return;
          }
        } catch (e2) {
          console.warn('ensureLocal fallback error:', e2);
        }
      }
    }
    await this.loadFiles();
    this.loading.set(false);

    // Connexion collaboration + abonnements (inclut les événements FTP SSE)
    this.collab.connect(this.projectFolderName);
    this.subscribeToCollabEvents();

    // Phase 2 — Sync FTP en arrière-plan (non-bloquant)
    if (this.hasFtpBackup()) {
      this.initAllFoldersSyncStatus('unknown');
      this.ftpSyncGlobalStatus.set('syncing');
      const total = this.countFileNodes(this.files());
      this.ftpSyncProgress.set({ checked: 0, total });
      // Attendre que le SSE soit connecté avant de démarrer la sync
      // (évite de rater les événements ftp_folder_synced broadcastés avant la connexion)
      this.waitForSseConnect().then(() => {
        this.projectFilesService.startFtpSyncBackground(this.projectFolderName).catch(() => {
          this.ftpSyncGlobalStatus.set('error');
        });
      });
    } else {
      // Git : auto-sync non-bloquant
      this.autoSyncProject(this.projectFolderName);
    }

    // F4 — Scroll vers une section si fournie en queryParam (depuis la recherche)
    const sectionFromSearch = this.route.snapshot.queryParamMap.get('section');
    if (sectionFromSearch) {
      // Sélectionne + déplie l'arbre jusqu'à la section (la sidebar étend via activeNodeId)
      this.activeNodeId.set(sectionFromSearch);
      this.highlightNodeId.set(sectionFromSearch);
      setTimeout(() => this.scrollToNodeId.set(sectionFromSearch), 200);
    }
    // Sélection du menu (outil) si fourni en queryParam (depuis admin méga-outils)
    const outilFromQuery = this.route.snapshot.queryParamMap.get('outil');
    if (outilFromQuery) this.activeOutilId.set(outilFromQuery);
    // F6 — Charger les compteurs de commentaires par section
    this.loadCommentCounts();
  }

  private waitForSseConnect(timeoutMs = 3000): Promise<void> {
    return new Promise(resolve => {
      if (this.collab.connected()) { resolve(); return; }
      let done = false;
      const poll = setInterval(() => {
        if (this.collab.connected()) {
          done = true;
          clearInterval(poll);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        if (!done) { clearInterval(poll); resolve(); }
      }, timeoutMs);
    });
  }

  private countFileNodes(nodes: FileNode[]): number {
    let count = 0;
    for (const n of nodes) {
      if (n.type === 'file') count++;
      if (n.children) count += this.countFileNodes(n.children);
    }
    return count;
  }

  private initAllFoldersSyncStatus(status: FtpNodeSyncStatus): void {
    const map = new Map<string, FtpNodeSyncStatus>();
    const walk = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          map.set(n.id, status);
          if (n.children) walk(n.children);
        }
      }
    };
    walk(this.files());
    this.nodeSyncStatus.set(map);
  }

  // F6 — Commentaires inline
  onCommentRequest(evt: { folderId: string; folderName: string }) {
    this.commentsDrawer.set({ visible: true, folderId: evt.folderId, folderName: evt.folderName });
  }

  closeCommentsDrawer() {
    this.commentsDrawer.update(d => ({ ...d, visible: false }));
  }

  onCommentCountsChange(counts: Record<string, number>) {
    this.commentCounts.set(counts);
  }

  private async loadCommentCounts() {
    const projectId = this.project()?.id;
    if (!projectId) return;
    try {
      const counts = await this.commentsService.counts(projectId);
      this.commentCounts.set(counts);
    } catch { /* silent */ }
  }

  ngOnDestroy() {
    this.layoutService.editorMode.set(false);
    this.configService.setCurrentProjectId(null);
    clearTimeout(this.savedStatusTimer);
    this.collab.disconnect();
    this.collabSubs.forEach(s => s.unsubscribe());
  }

  private subscribeToCollabEvents(): void {
    this.collabSubs.push(
      this.collab.contentUpdate$.subscribe(event => {
        // Brouillon local divergent sur ce fichier : ne pas écraser silencieusement `files`
        // avec la version publiée par l'autre utilisateur — ProjetIncomingChangeService a
        // déjà capté ce même événement et le met en attente (carte flottante à résoudre
        // explicitement : Insérer / Voir le diff complet / Rejeter, voir writeSectionStyled
        // pour le blocage à la publication tant que non résolu).
        if (this.collab.isLocalPending(event.folderId ?? event.nodeId)) {
          // no-op ici
        } else if (this.isSaving) {
          // Mettre en queue : ne pas écraser le buffer utilisateur pendant un cycle de sauvegarde
          const existing = this.pendingSSEPatches.findIndex(p => p.nodeId === event.nodeId);
          if (existing >= 0) this.pendingSSEPatches[existing].content = event.content;
          else this.pendingSSEPatches.push({ nodeId: event.nodeId, content: event.content });
        } else {
          this.files.update(nodes => this.patchNodeContent(nodes, event.nodeId, event.content));
        }
        this.projectFilesService.logEditionEvent({
          event: 'SYNC-RECEIVE',
          project: this.projectFolderName,
          source: 'sse-content-update',
          fileId: event.nodeId,
          newSize: event.content?.length ?? 0,
          note: this.isSaving ? 'SSE content_update reçu (mis en queue — save en cours)' : 'SSE content_update reçu'
        });
      }),
      this.collab.fileRestored$.subscribe(event => {
        this.files.update(nodes => this.patchNodeContent(nodes, event.nodeId, event.content));
        this.restoreToken.update(n => n + 1);
      }),
      this.collab.structureUpdate$.subscribe(() => {
        this.autoPullAndRefresh();
      }),
      // Trello temps réel : recharge la liste d'instances quand un trello est créé/renommé/supprimé ailleurs
      this.collab.trelloUpdate$.subscribe(evt => {
        if (evt.action?.startsWith('instance_')) this.loadMegaOutilInstances();
      }),
      // Mockup temps réel : recharge les instances si création/suppression ailleurs
      this.collab.mockupUpdate$.subscribe(evt => {
        if (evt.action?.startsWith('instance_')) this.loadMegaOutilInstances();
      }),
      this.collab.sectionPublished$.subscribe(() => {
        this.autoPullAndRefresh();
      }),
      // Un autre user a checkpointé une nouvelle version — mémorise-la pour proposer
      // le bouton "Synchro" sans attendre un conflit 409 au prochain enregistrement.
      this.collab.versionSaved$.subscribe(evt => {
        this.newerVersions.update(m => { const n = new Map(m); n.set(evt.nodeId, evt); return n; });
      }),
      // Connexion réseau retrouvée après une coupure : retente les brouillons restés en échec.
      this.collab.onlineRestored$.subscribe(() => this.retryUnsavedDrafts()),
      this.collab.ftpFolderSynced$.subscribe(({ folderId, status, totalChecked, totalFiles }) => {
        this.nodeSyncStatus.update(m => new Map(m).set(folderId, status));
        this.ftpSyncProgress.set({ checked: totalChecked, total: totalFiles || this.ftpSyncProgress().total });
      }),
      this.collab.ftpSyncComplete$.subscribe(async ({ status, downloaded }) => {
        this.ftpSyncGlobalStatus.set(status === 'error' ? 'error' : 'done');
        const t = this.ftpSyncProgress().total;
        this.ftpSyncProgress.set({ checked: t, total: t });
        // Marquer tous les dossiers encore à 'unknown' comme 'in-sync'
        // (les sous-dossiers ne reçoivent pas d'événement ftp_folder_synced individuel)
        this.nodeSyncStatus.update(m => {
          const next = new Map(m);
          for (const [id, s] of next) {
            if (s === 'unknown') next.set(id, 'in-sync');
          }
          return next;
        });
        // Si le projet venait d'être créé localement, recharger les fichiers maintenant téléchargés
        if (this.wasCreatedLocal && downloaded > 0) {
          this.wasCreatedLocal = false;
          await this.loadFiles();
        }
      })
    );
  }

  // Réseau retrouvé après coupure : retente les brouillons dont la dernière tentative avait
  // échoué, avec le contenu le plus récent connu localement (déjà patché de façon optimiste
  // dans `files` même en cas d'échec réseau — voir processSectionsChange).
  private async retryUnsavedDrafts(): Promise<void> {
    const fileIds = [...this.collab.unsavedSince().keys()];
    for (const fileId of fileIds) {
      const node = this.findFileById(fileId, this.files());
      if (!node) { this.collab.markSaveSucceeded(fileId); continue; }
      const parentFolder = this.findParentFolder(fileId, this.files());
      await this.projectFilesService.saveDraft(this.projectFolderName, fileId, node.content ?? '', parentFolder?.id ?? null, node.fileVersion ?? null)
        .then(() => this.collab.markSaveSucceeded(fileId))
        .catch(e => console.warn('[EDITOR] retry sauvegarde brouillon toujours en échec:', fileId, e.message));
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.collab.hasUnsavedWork()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private async autoPullAndRefresh(): Promise<void> {
    if (!this.projectFolderName) return;
    try {
      await this.collab.pullProject(this.projectFolderName);
    } catch { /* pull fail-safe — on recharge quand même */ }
    await this.onRefresh();
  }

  private patchNodeContent(nodes: FileNode[], nodeId: string, content: string): FileNode[] {
    return nodes.map(node => {
      if (node.id === nodeId) return { ...node, content };
      if (node.children?.length) return { ...node, children: this.patchNodeContent(node.children, nodeId, content) };
      return node;
    });
  }

  private async autoSyncProject(name: string): Promise<void> {
    try {
      const result = await this.projectFilesService.autoSync(name);
      if (result.status === 'pulled' && (result.newCommits ?? 0) > 0) {
        await this.onRefresh();
      }
    } catch { /* silencieux — pas bloquant */ }
  }


  async loadFiles() {
    try {
      const res = await this.projectFilesService.getFiles(this.projectFolderName);
      const sorted = this.sortNodesByOrder(res.files || []);
      // Réinjecte les brouillons locaux non partagés de l'utilisateur courant PAR-DESSUS le
      // contenu BDD, AVANT de publier le signal `files` — jamais après coup : un `this.files.set()`
      // intermédiaire ne contenant que le contenu BDD (sans le brouillon) serait capté par la zone
      // d'édition (ngOnChanges) dès qu'un changement structurel est en cours (ex: ajout d'un titre
      // pendant la frappe) et effacerait visuellement le texte non encore validé.
      await this.mergeLocalDraftsIntoTree(sorted);
      this.files.set(sorted);
      // Calcule la map des images imbriquées dès le chargement (sinon la sidebar
      // affiche les images au top level tant que sectionsChange n'a pas été émis)
      this.nestedImagesMap.set(this.computeNestedImagesMap(sorted));
    } catch (e) {
      console.warn('loadFiles error:', e);
      this.files.set([]);
    }
    // Charger les outils (migration auto côté serveur si absent)
    try {
      const outilsRes = await this.projectFilesService.getOutils(this.projectFolderName);
      this.outils.set(outilsRes.outils || []);
      if (!this.activeOutilId() && outilsRes.outils.length > 0) {
        this.activeOutilId.set(outilsRes.outils[0].id);
      }
    } catch (e) {
      console.warn('loadOutils error:', e);
    }
    // Charger les mega-outils instances
    await this.loadMegaOutilInstances();
  }

  /** Patche `nodes` (mutation en place) avec le contenu des brouillons locaux de l'utilisateur
   *  courant sur ce projet, et marque les sections concernées comme "modification locale non
   *  partagée" (badge). Appelé avant chaque publication du signal `files` pour rester atomique. */
  private async mergeLocalDraftsIntoTree(nodes: FileNode[]): Promise<void> {
    try {
      const drafts = await this.projectFilesService.listDrafts(this.projectFolderName);
      if (!drafts.length) return;
      for (const d of drafts) {
        try {
          const full = await this.projectFilesService.getDraft(this.projectFolderName, d.nodeId);
          if (!full.exists) continue;
          const node = this.findFileById(d.nodeId, nodes);
          if (node) {
            node.content = full.content ?? '';
            // Préserve le vrai `baseVersionId` du brouillon comme référence de conflit — un
            // rechargement (loadFiles/autoPullAndRefresh) ne doit jamais aligner silencieusement
            // fileVersion sur la dernière version BDD tant que ce brouillon divergent existe,
            // sinon la détection de conflit à la publication (comparaison baseVersionId côté
            // serveur) est désactivée sans qu'aucun conflit n'ait été vu ni résolu par l'utilisateur.
            node.fileVersion = full.baseVersionId ?? node.fileVersion;
          }
          this.collab.addLocalPending(d.folderId ?? d.nodeId);
        } catch (e) {
          console.warn('[EDITOR] Chargement brouillon échoué pour', d.nodeId, e);
        }
      }
    } catch (e) {
      console.warn('[EDITOR] listDrafts error:', e);
    }
  }

  private computeNestedImagesMap(nodes: FileNode[]): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    const walk = (ns: FileNode[]) => {
      for (const n of ns) {
        if (n.type === 'file' && !this.projectFilesService.isImageFile(n.name) && n.content) {
          const ids: string[] = [];
          const re = /\{\{IMG:([a-zA-Z0-9._-]+)(?:\|[^}]*)?\}\}/gi;
          let m;
          while ((m = re.exec(n.content)) !== null) ids.push(m[1]);
          if (ids.length > 0) map[n.id] = ids;
        }
        if (n.children?.length) walk(n.children);
      }
    };
    walk(nodes);
    return map;
  }

  private sortNodesByOrder(nodes: FileNode[]): FileNode[] {
    return [...nodes]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(n => n.children ? { ...n, children: this.sortNodesByOrder(n.children) } : n);
  }

  onNodeSelect(node: FileNode) {
    const ownerOutilId = this.findOutilForNode(node.id);
    if (ownerOutilId && ownerOutilId !== this.activeOutilId()) {
      this.activeOutilId.set(ownerOutilId);
    }
    this.showTrelloList.set(false);
    this.showMockupList.set(false);
    this.showPromptListView.set(false);
    this.activeNodeId.set(node.id);
    this.highlightNodeId.set(node.id);
    this.scrollToNodeId.set(null);
    setTimeout(() => this.scrollToNodeId.set(node.id), 0);
  }

  onProjectRootSelect(): void {
    this.showTrelloList.set(false);
    this.showMockupList.set(false);
    this.showPromptListView.set(false);
    this.activeNodeId.set(null);
    this.highlightNodeId.set(null);
    this.scrollToNodeId.set(null);
  }

  onNodeActive(nodeId: string) {
    // Zone 4 : ne jamais changer activeNodeId — la sélection reste réservée à la zone 3
    this.highlightNodeId.set(nodeId);
  }

  onTrelloListClick() {
    this.showMockupList.set(false);
    this.showPromptListView.set(false);
    this.showTrelloList.set(true);
  }

  onMockupListClick() {
    this.showTrelloList.set(false);
    this.showPromptListView.set(false);
    this.showMockupList.set(true);
  }

  onPromptListClick() {
    this.showTrelloList.set(false);
    this.showMockupList.set(false);
    this.showPromptListView.set(true);
  }

  /** Navigation depuis la "Liste des trellos" : sélectionne la section et ferme la liste. */
  onTrelloNavigate(folderId: string) {
    this.showTrelloList.set(false);
    this.activeNodeId.set(folderId);
    this.highlightNodeId.set(folderId);
    this.scrollToNodeId.set(null);
    setTimeout(() => this.scrollToNodeId.set(folderId), 0);
  }

  /** Navigation depuis la "Liste des mockups" : sélectionne la section et ferme la liste. */
  onMockupNavigate(folderId: string) {
    this.showMockupList.set(false);
    this.activeNodeId.set(folderId);
    this.highlightNodeId.set(folderId);
    this.scrollToNodeId.set(null);
    setTimeout(() => this.scrollToNodeId.set(folderId), 0);
  }

  // Exécution d'un MO Prompt (bouton "Exécuter") : bascule vers l'onglet Conversation et y
  // lance la conversation — plus de popup, quel que soit le mode (Normal/Guidé/Tchat/Tchat libre).
  promptLaunchRequest = signal<PromptLaunchContext | null>(null);
  onLaunchPromptConversation(ctx: PromptLaunchContext) {
    if (ctx.folderId && ctx.folderId !== this.activeNodeId()) {
      this.activeNodeId.set(ctx.folderId);
      this.highlightNodeId.set(ctx.folderId);
      this.scrollToNodeId.set(null);
      setTimeout(() => this.scrollToNodeId.set(ctx.folderId), 0);
    }
    this.zone5Tab.set('conversation');
    this.zone5Collapsed.set(false);
    this.promptLaunchRequest.set(ctx);
  }

  /** Relayé depuis ProjetConversationComponent : matérialise les MegaOutils cochés d'une
   *  conversation Prompt (mode Guidé/Tchat) via la zone d'édition (seule à connaître unifiedContent).
   *  Une fois terminé, rappelle le panneau conversation pour marquer ces MO "déjà ajoutés"
   *  (bouton "Déjà ajouté" + navigation vers la section résultat), sans les retirer de la carte.
   *  Deux cas : `promptInstanceId` (conversation MO Prompt, sous-section "PR-Res", inchangé) ou
   *  `sectionId` (chat IA classique — matérialisation directe dans la section active). */
  async onMaterializeRequested(payload: { promptInstanceId?: string; sectionId?: string; deliverable: string; selectedMos: MaterializedMoPreview[]; transcript?: string; messageKey: string; skipMaterializedMark?: boolean }) {
    let sectionId: string | null = null;
    if (payload.promptInstanceId) {
      sectionId = (await this.editionOutil?.materializeFromConversation(payload.promptInstanceId, payload.deliverable, payload.selectedMos, payload.transcript)) ?? null;
    } else if (payload.sectionId) {
      // La bannière "Modification IA proposée" (diff en attente, sendAiEdit) démonte
      // <app-edition-outil> (cf. template : @else if (!hasPendingEdit())) — sans quoi
      // `this.editionOutil` est undefined et la matérialisation échoue silencieusement
      // (aucune erreur, mais aucune instance créée). Choisir "Ajouter au projet" signifie
      // que l'utilisateur ne veut PAS appliquer le diff texte brut, donc on l'annule
      // d'abord pour laisser le composant se remonter avant d'y accéder.
      if (this.hasPendingEdit()) {
        this.aiEditService.cancelEdit();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      await this.editionOutil?.materializeMoIntoSection(payload.sectionId, payload.selectedMos);
      sectionId = payload.sectionId;
    }
    // skipMaterializedMark ("Copier vers...", répétable) : ne pas marquer le MO source "déjà
    // ajouté" — sinon le raccourci 1-clic "Ajouter au projet" basculerait vers "Déjà ajouté"
    // pointant sur une section différente de celle réellement visée par ce raccourci.
    if (!payload.skipMaterializedMark) {
      this.conversationPanel?.markMosMaterialized(payload.messageKey, payload.selectedMos, sectionId);
    }
  }

  /** Relayé depuis ProjetConversationComponent : "Copier vers l'édition" sur un message IA
   *  d'une conversation Prompt → ouvre le popup d'import (pastePreview) via la zone d'édition. */
  onCopyToEditionRequested(payload: { text: string; sectionId: string }) {
    this.editionOutil?.insertTextIntoEdition(payload.text, payload.sectionId);
  }

  /** Relayé depuis ProjetEditorZoneComponent (via app-edition-outil) : clic droit sur une
   *  sélection de texte (Code ou Édition) → "Envoyer au prompt" — ouvre l'onglet Conversation
   *  et colle le texte au-dessus de la saisie, en activant le mode IA (voir CLAUDE.md).
   *  Active aussi la section contenant la sélection : sans quoi la conversation (liée à
   *  activeNodeId) resterait indisponible en "vue assemblée" (aucune section cliquée dans la
   *  sidebar — cf. onNodeActive() qui ne touche jamais activeNodeId depuis la zone d'édition). */
  onSendSelectionToPrompt(payload: { text: string; sectionId: string | null }) {
    if (payload.sectionId && payload.sectionId !== this.activeNodeId()) {
      this.activeNodeId.set(payload.sectionId);
      this.highlightNodeId.set(payload.sectionId);
      this.scrollToNodeId.set(null);
      setTimeout(() => this.scrollToNodeId.set(payload.sectionId), 0);
    }
    this.zone5Tab.set('conversation');
    this.zone5Collapsed.set(false);
    setTimeout(() => this.conversationPanel?.attachContextText(payload.text), 0);
  }

  /** Relayé depuis ProjetConversationComponent : clic sur "Déjà ajouté" d'un MO matérialisé —
   *  navigue vers sa section résultat (même mécanisme que `onTrelloNavigate`). */
  onNavigateToSection(folderId: string) {
    this.activeNodeId.set(folderId);
    this.highlightNodeId.set(folderId);
    this.scrollToNodeId.set(null);
    setTimeout(() => this.scrollToNodeId.set(folderId), 0);
  }

  /** Supprime toute la conversation (chat général + MO Prompt confondus) de la section active. */
  deleteConversation() {
    const id = this.activeNodeId();
    if (!id) return;
    this.conversationService.deleteConversation(id).subscribe({
      next: () => {
        this.conversationPanel?.clearConversationLocal();
        this.confirmDeleteConversation.set(false);
        this.sidebar?.loadConversations();
      },
      error: () => this.confirmDeleteConversation.set(false),
    });
  }

  onOpenMockupDiagram() {
    window.open(this.portailUrl + '/mockup', '_blank');
  }

  private isDescendantInTree(nodeId: string, ancestorId: string): boolean {
    const ancestor = this.findFolderById(ancestorId, this.files());
    if (!ancestor) return false;
    const walk = (nodes: FileNode[]): boolean => {
      for (const n of nodes) {
        if (n.id === nodeId) return true;
        if (n.children && walk(n.children)) return true;
      }
      return false;
    };
    return walk(ancestor.children || []);
  }

  onDirtyChange(dirty: boolean) {
    if (dirty) {
      // ne pas écraser un état actif (saving/error)
      const s = this.saveStatus();
      if (s === 'idle' || s === 'saved') this.saveStatus.set('dirty');
    } else {
      // Reset vers idle/saved sera géré par processSectionsChange après save serveur
      // Mais si pas de changement réel, on revient à idle.
      if (this.saveStatus() === 'dirty') this.saveStatus.set('idle');
    }
  }

  // Affiche immédiatement 'Sauvegarde…' dès que la zone éditeur déclenche un save
  // (avant l'analyse asynchrone de processSectionsChange).
  onSaveStarting() {
    clearTimeout(this.savedStatusTimer);
    this.saveStatus.set('saving');
  }

  async onFolderCreated(info: { name: string; parentId: string | null }) {
    // Protège le nouveau dossier contre une suppression accidentelle par processSectionsChange
    // (réconciliation texte↔structure qui supprime tout dossier dont elle ne retrouve plus le
    // titre correspondant dans le texte). `appendSection`/`insertSectionInParent` ci-dessous sont
    // des stubs vides (aucun titre n'est réellement inséré dans le texte à la création) : un
    // dossier vide ne sera donc jamais "confirmé" tant que l'utilisateur n'a pas lui-même tapé du
    // contenu dedans. La protection ne doit donc PAS expirer après un délai fixe (incident du
    // 2026-07-05 : un minuteur de 5s expirait juste avant le cycle de sauvegarde suivant,
    // supprimant des dossiers Prompt fraîchement créés — ex. « Pr - Questions », « Pr - Tchat »).
    // Elle reste active indéfiniment jusqu'à confirmation réelle : `processSectionsChange` la
    // lève lui-même dès qu'une section est retrouvée liée à ce dossier (`matchedFolderIds`).
    this.pendingFolderNames.add(info.name);
    let waited = 0;
    while (this.isSaving && waited < 5000) {
      await new Promise(r => setTimeout(r, 50));
      waited += 50;
    }
    await this.loadFiles();
    if (!info.parentId) {
      this.editionOutil?.appendSection(info.name, 1);
    } else {
      const parent = this.findFolderById(info.parentId, this.files());
      if (parent) {
        const depth = this.getFolderDepth(info.parentId, this.files());
        this.editionOutil?.insertSectionInParent(parent.name, depth, info.name);
      }
    }
  }

  onOutilSelect(outilId: string): void {
    this.activeOutilId.set(outilId);
    this.activeNodeId.set(null);
    this.highlightNodeId.set(null);
    // Sélection d'un outil par son en-tête : ne pas rouvrir un événement agenda (requête périmée).
    this.agendaEventToOpen.set(null);
  }

  /** Clic sur un événement dans la sidebar : activer l'agenda et ouvrir l'événement (date + popup). */
  onAgendaEventSelect(payload: { outilId: string; event: AgendaEvent }): void {
    this.activeOutilId.set(payload.outilId);
    this.activeNodeId.set(null);
    this.highlightNodeId.set(null);
    this.agendaEventToOpen.set({ event: payload.event, token: Date.now() });
  }

  /** L'agenda a modifié ses événements → rafraîchir la liste affichée dans la sidebar. */
  onAgendaEventsChanged(): void {
    this.sidebar?.reloadAgendaEvents();
  }

  /** Navigation depuis l'agenda : ouvre le dossier de la séance liée à l'événement. */
  onAgendaNavigateToSection(ev: AgendaEvent): void {
    const folder = this.findFolderByTitleLike(ev.title, this.files());
    if (!folder) return;
    // Basculer sur l'outil propriétaire du dossier (via son ancêtre de premier niveau)
    const rootId = this.findTopLevelAncestorId(folder.id, this.files());
    const owner = this.outils().find(o => rootId && o.rootFolderIds?.includes(rootId))
               ?? this.outils().find(o => o.type === 'edition')
               ?? this.outils().find(o => !o.rootFolderIds?.length);
    if (owner) this.activeOutilId.set(owner.id);
    this.activeNodeId.set(folder.id);
    this.highlightNodeId.set(folder.id);
    // Ouvrir la séance toujours en mode Edition (visu), pas en Code.
    this.editorModeRequest.set({ mode: 'visu', token: Date.now() });
    this.scrollToNodeId.set(null);
    setTimeout(() => this.scrollToNodeId.set(folder.id), 50);
  }

  /** Numéro de séance extrait d'un libellé (« Séance 3 — … » → « 3 »). */
  private seanceKey(s: string): string | null {
    const m = s.match(/s[ée]ance\s*(\d+)/i);
    return m ? m[1] : null;
  }

  private collectFolders(nodes: FileNode[], acc: FileNode[] = []): FileNode[] {
    for (const n of nodes) {
      if (n.type === 'folder') { acc.push(n); this.collectFolders(n.children || [], acc); }
    }
    return acc;
  }

  /** Trouve le dossier dont le nom correspond au titre d'un événement séance. */
  private findFolderByTitleLike(title: string, nodes: FileNode[]): FileNode | null {
    const folders = this.collectFolders(nodes);
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const target = norm(title);
    // 1. Correspondance exacte / préfixe
    const exact = folders.find(f => {
      const n = norm(f.name);
      return n === target || n.startsWith(target) || target.startsWith(n);
    });
    if (exact) return exact;
    // 2. Par numéro de séance
    const key = this.seanceKey(title);
    if (key) {
      const byNum = folders.find(f => this.seanceKey(f.name) === key && /s[ée]ance/i.test(f.name));
      if (byNum) return byNum;
    }
    return null;
  }

  /** Id du nœud de premier niveau (dans this.files()) contenant le dossier donné. */
  private findTopLevelAncestorId(folderId: string, nodes: FileNode[]): string | null {
    const contains = (node: FileNode): boolean =>
      node.id === folderId || (node.children || []).some(c => c.type === 'folder' && contains(c));
    for (const n of nodes) {
      if (n.type === 'folder' && contains(n)) return n.id;
    }
    return null;
  }

  async onOutilCreate(data: { type: string; name: string }): Promise<void> {
    const projectName = this.project()?.id;
    if (!projectName) return;
    try {
      const newOutil = await this.projectFilesService.createOutil(projectName, {
        type: data.type,
        name: data.name,
        rootFolderIds: []
      });
      this.outils.update(list => [...list, newOutil]);
      this.activeOutilId.set(newOutil.id);
    } catch (e) {
      console.error('[ProjetEditor] createOutil failed:', e);
    }
  }

  // ── Mega-outils ────────────────────────────────────────────────

  async loadMegaOutilInstances(): Promise<void> {
    const projectId = this.project()?.id;
    if (!projectId) return;
    try {
      const instances = await this.megaOutilsService.getInstances(projectId);
      this.megaOutilInstances.set(instances);
    } catch (e) { console.warn('[ProjetEditor] loadMegaOutilInstances failed:', e); }
  }

  onMegaOutilSelect(inst: MegaOutilInstance): void {
    // La navigation vers la section du trello est gérée par trelloNavigate (onTrelloNavigate).
    this.activeMegaOutil.set(inst);
  }

  onMegaOutilCreated(inst: MegaOutilInstance): void {
    // L'instance est créée par la zone éditeur. On met à jour la liste locale et on l'active.
    this.megaOutilInstances.update(list => [...list, inst]);
    this.activeMegaOutil.set(inst);
  }

  onMegaOutilDeleted(id: string): void {
    this.megaOutilInstances.update(list => list.filter(i => i.id !== id));
    if (this.activeMegaOutil()?.id === id) this.activeMegaOutil.set(null);
  }

  // Émission normale de l'éditeur (toute frappe) : n'alimente jamais projet_content_version,
  // seulement le brouillon local de l'utilisateur courant. Voir writeSectionStyled (zone
  // d'édition) pour le seul chemin qui crée une vraie version BDD (bouton "Enregistrer et partager").
  async onSectionsChange(sections: SectionInfo[]) {
    // Recalculer la map des images imbriquées dans des blocs documents
    const newMap: Record<string, string[]> = {};
    for (const s of sections) {
      for (const af of s.additionalFiles || []) {
        if (af.fileId && af.orderedChildIds && af.orderedChildIds.length > 0) {
          newMap[af.fileId] = af.orderedChildIds;
        }
      }
    }
    this.nestedImagesMap.set(newMap);

    if (this.isSaving) {
      this.pendingSections = sections;
      return;
    }
    this.isSaving = true;
    this.pendingSections = null;

    this.pendingEditSource = 'user-editing';

    try {
      await this.processSectionsChange(sections);
    } finally {
      this.isSaving = false;
      // Appliquer les patches SSE reçus pendant le cycle de sauvegarde
      if (this.pendingSSEPatches.length > 0) {
        const patches = this.pendingSSEPatches.splice(0);
        for (const p of patches) {
          this.files.update(nodes => this.patchNodeContent(nodes, p.nodeId, p.content));
        }
      }
      if (this.pendingSections) {
        const next = this.pendingSections;
        this.pendingSections = null;
        this.onSectionsChange(next);
      }
    }
  }

  private slugify(text: string): string {
    return text.toString().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
      .replace(/-+/g, '-').trim();
  }

  // ── Tracking helpers ───────────────────────────────────────
  private buildOldContentMap(nodes: FileNode[]): Map<string, string> {
    const map = new Map<string, string>();
    const walk = (ns: FileNode[]) => {
      for (const n of ns) {
        if (n.type === 'file' && !this.projectFilesService.isImageFile(n.name)) {
          map.set(n.id, n.content || '');
        }
        if (n.children) walk(n.children);
      }
    };
    walk(nodes);
    return map;
  }

  private trackContext() {
    return {
      projectId: this.projectFolderName,
      projectName: this.project()?.title || this.projectFolderName,
    };
  }

  private async trackContentUpdate(file: FileNode, folderName: string, oldContent: string, newContent: string) {
    if (oldContent === newContent) return;
    try {
      await this.history.track({
        section: 'projets',
        subsection: folderName,
        actionType: 'update',
        label: `Modification de "${folderName}"`,
        entityType: 'file',
        entityId: file.id,
        entityLabel: file.name,
        beforeState: { content: oldContent, name: file.name },
        afterState: { content: newContent, name: file.name },
        context: this.trackContext(),
        undoable: true,
        undoAction: {
          endpoint: `/api/file-projects/${this.projectFolderName}/files/${file.id}`,
          method: 'PUT',
          payload: { content: oldContent }
        },
        redoAction: {
          endpoint: `/api/file-projects/${this.projectFolderName}/files/${file.id}`,
          method: 'PUT',
          payload: { content: newContent }
        }
      });
    } catch (e) { console.warn('[Editor] track content update failed:', e); }
  }

  private async trackFolderRename(folderId: string, oldName: string, newName: string) {
    try {
      await this.history.track({
        section: 'projets',
        subsection: newName,
        actionType: 'update',
        label: `Renommage de section "${oldName}" → "${newName}"`,
        entityType: 'folder',
        entityId: folderId,
        entityLabel: newName,
        beforeState: { name: oldName },
        afterState: { name: newName },
        context: this.trackContext(),
        undoable: true,
        undoAction: {
          endpoint: `/api/file-projects/${this.projectFolderName}/folders/${folderId}`,
          method: 'PATCH',
          payload: { name: oldName }
        },
        redoAction: {
          endpoint: `/api/file-projects/${this.projectFolderName}/folders/${folderId}`,
          method: 'PATCH',
          payload: { name: newName }
        }
      });
    } catch (e) { console.warn('[Editor] track rename failed:', e); }
  }

  private async trackFolderCreate(folder: FileNode) {
    try {
      await this.history.track({
        section: 'projets',
        subsection: folder.name,
        actionType: 'create',
        label: `Création de section "${folder.name}"`,
        entityType: 'folder',
        entityId: folder.id,
        entityLabel: folder.name,
        afterState: { name: folder.name },
        context: this.trackContext(),
        undoable: true,
        undoAction: {
          endpoint: `/api/file-projects/${this.projectFolderName}/folders/${folder.id}`,
          method: 'DELETE'
        }
      });
    } catch (e) { console.warn('[Editor] track create failed:', e); }
  }

  /** Trace la suppression automatique d'un fichier additionnel orphelin (nettoyage silencieux
   * jusqu'ici) : passe par la même route DELETE que la suppression manuelle, donc protégé par
   * la corbeille serveur — on rend cette suppression visible et annulable dans l'historique. */
  private async trackAdditionalFileDelete(file: FileNode, trashId: string) {
    try {
      await this.history.track({
        section: 'projets/fichiers',
        subsection: file.name,
        actionType: 'delete',
        label: `Suppression automatique de fichier orphelin «${file.name.replace(/\.md$/, '')}»`,
        entityType: 'file',
        entityId: file.id,
        entityLabel: file.name.replace(/\.md$/, ''),
        beforeState: { fileName: file.name.replace(/\.md$/, '') },
        context: this.trackContext(),
        undoable: true,
        undoAction: { endpoint: `/api/file-projects/${this.projectFolderName}/trash/${trashId}/restore`, method: 'POST' }
      });
    } catch (e) { console.warn('[Editor] track additional file delete failed:', e); }
  }

  private async processSectionsChange(sections: SectionInfo[]) {
    let currentFiles = this.files();
    // Snapshot of file contents BEFORE this save batch — used to compute diffs for tracking
    const oldContentMap = this.buildOldContentMap(currentFiles);
    // Mutable copy so we can patch folderId/fileId after rename resolution
    const resolved = sections.map(s => ({ ...s }));

    console.log('[EDITOR] Sections changed, analyzing structure...', { sections: resolved.length });

    // 1. Liaison hiérarchique textuelle (parent direct dans le texte)
    // Le parent est la section précédente de niveau STRICTEMENT inférieur (ancêtre le plus
    // proche), pas forcément level-1 : gère les sauts de niveau. Ex. insérer un H1 au milieu
    // de H3 → les H3 suivants ont le H1 pour parent (puis seront remontés en H2 par la
    // normalisation de profondeur de buildDocSections). Un nouveau heading ferme les niveaux
    // ouverts plus profonds (réinitialisation).
    const parentSectionMap = new Map<SectionInfo, SectionInfo | null>();
    const lastAtLevel = new Array(6).fill(null);
    for (const s of resolved) {
      let parent: SectionInfo | null = null;
      for (let lv = s.level - 1; lv >= 1; lv--) { if (lastAtLevel[lv]) { parent = lastAtLevel[lv]; break; } }
      parentSectionMap.set(s, parent);
      lastAtLevel[s.level] = s;
      for (let lv = s.level + 1; lv < lastAtLevel.length; lv++) lastAtLevel[lv] = null;
    }

    interface RenameOp { folderId: string; newName: string; section: typeof resolved[0] }
    const renameOps: RenameOp[] = [];
    const matchedFolderIds = new Set<string>();

    // 2. Détection des renommages — uniquement par identifiant stable {{SID}}, jamais par
    // devinette de position (bug corrigé : voir "hierarchical match" ci-dessous, retiré).
    for (const s of resolved) {
      if (s.folderId) {
        matchedFolderIds.add(s.folderId);
        // Renommage robuste par identifiant stable {{SID}} : si le titre diffère du nom
        // de dossier courant, c'est un renommage — matché par ID, jamais par ordre.
        const sidFolder = this.findFolderById(s.folderId, currentFiles);
        if (sidFolder && s.folderName && sidFolder.name !== s.folderName
            && !renameOps.some(op => op.folderId === s.folderId)) {
          console.log('[EDITOR] Rename detected (SID):', { from: sidFolder.name, to: s.folderName });
          renameOps.push({ folderId: s.folderId, newName: s.folderName, section: s });
        }
        // Confirmation réelle : ce dossier est bien lié à une section du texte → la protection
        // anti-suppression posée à sa création (onFolderCreated) n'a plus lieu d'être.
        if (sidFolder) this.pendingFolderNames.delete(sidFolder.name);
      }
      // Ancienne logique retirée (incidents répétés — voir 2-5-2-2-4) : un dossier "orphelin"
      // (sans {{SID}} correspondant retrouvé) et une "section non matchée" du même niveau/parent
      // étaient appariés par simple position d'index dès que leurs comptes coïncidaient, sans
      // aucune garantie qu'ils se correspondent réellement (ex. suppression d'un prompt dans
      // « Pr - Questions » pendant que « Pr - Ideation » est aussi présent au même niveau →
      // appariement erroné, contenu écrit dans le mauvais dossier — effet visuel de "copie" dans
      // le mauvais dossier). Sans cette devinette, un renommage de titre tapé à la main (sans
      // passer par le SID) crée simplement un nouveau dossier au lieu de renommer l'existant
      // (dossier "orphelin" resté inoffensif, plus jamais fusionné/déplacé/supprimé à tort).
    }

    // 3. Mise à jour finale des parentFolderId pour les créations/déplacements
    for (const s of resolved) {
      const parentS = parentSectionMap.get(s);
      s.parentFolderId = parentS?.folderId || null;
    }

    const sectionPaths = new Set(
      resolved.map(s => [...s.parentPath, s.folderName].map(p => this.slugify(p)).join('/'))
    );
    const renamedIds = new Set(renameOps.map(op => op.folderId));

    const allFolderPaths = this.collectAllFolderPaths(currentFiles);
    const orphanPaths = new Set<string>();
    for (const [fp] of allFolderPaths) {
      if (!sectionPaths.has(fp)) orphanPaths.add(fp);
    }
    const toDelete: FileNode[] = [];
    for (const [fp, folder] of allFolderPaths) {
      // Si le dossier a été renommé, on ne le supprime pas (son ID est dans renamedIds)
      if (renamedIds.has(folder.id)) continue;
      // Filet de sécurité (identité stable) : un dossier encore référencé par une section
      // (via {{SID}}) ne doit JAMAIS être supprimé, même si son chemin slugifié a changé
      // suite au renommage d'un ancêtre. Évite les suppressions parasites.
      if (matchedFolderIds.has(folder.id)) continue;
      // Si le dossier vient d'être créé via la sidebar, on le protège d'une suppression
      // accidentelle (race entre le signal parent mis à jour et l'@Input editor zone stale)
      if (this.pendingFolderNames.has(folder.name)) continue;

      // Si le chemin n'existe plus dans le texte, c'est un orphelin
      if (!sectionPaths.has(fp)) {
          // On vérifie si un ancêtre est déjà orphelin (pour ne pas supprimer récursivement inutilement,
          // bien que le serveur gère le rmSync -r)
          const parts = fp.split('/');
          const hasOrphanAncestor = parts.slice(0, -1).some((_, i) =>
            orphanPaths.has(parts.slice(0, i + 1).join('/'))
          );
          if (!hasOrphanAncestor) {
            console.log('[EDITOR] Deletion detected:', folder.name, fp);
            toDelete.push(folder);
          }
      }
    }

    // SUPPRESSION AUTOMATIQUE DÉSACTIVÉE (incidents répétés du 2026-07-05 : d'abord 36 dossiers/65
    // fichiers supprimés d'un coup quand la réconciliation texte↔structure a détecté des sections
    // entières comme "orphelines" à partir d'un contenu partiel/obsolète — un premier garde-fou à
    // seuil avait alors été ajouté ; puis des dossiers Prompt isolés fraîchement créés supprimés
    // quelques secondes après leur création — cas que le seuil ne bloquait pas, un orphelin isolé
    // étant considéré comme une suppression manuelle normale). Après plusieurs itérations de
    // rustines toujours contournées, décision : la réconciliation ne supprime plus JAMAIS aucun
    // dossier automatiquement, quelle que soit la situation — seule la suppression manuelle via la
    // corbeille de la sidebar (`ProjetSidebarComponent.confirmDelete`) reste possible. La détection
    // ci-dessus (boucle `toDelete`/logs `console.log('[EDITOR] Deletion detected:'...)`) reste utile
    // pour le diagnostic mais n'entraîne plus aucune suppression réelle.
    if (toDelete.length > 0) {
      console.warn(
        `[EDITOR] Suppression automatique ignorée (désactivée) pour ${toDelete.length} dossier(s) ` +
        `détecté(s) comme "orphelins" : ${toDelete.map(f => f.name).join(', ')}.`
      );
      toDelete.length = 0;
    }

    // Détection de suppression de fichiers additionnels
    const allExistingAdditionalFileIds = new Set<string>();
    for (const folder of allFolderPaths.values()) {
      folder.children?.forEach(c => {
        if (c.type === 'file' && c.name !== 'contenu.md' && !isCssTwinName(c.name) && !this.projectFilesService.isImageFile(c.name)) {
          allExistingAdditionalFileIds.add(c.id);
        }
      });
    }

    const resolvedAdditionalFileIds = new Set<string>();
    resolved.forEach(s => {
      s.additionalFiles?.forEach(af => {
        if (af.fileId) resolvedAdditionalFileIds.add(af.fileId);
      });
    });

    let additionalFileDeleted = false;
    for (const id of allExistingAdditionalFileIds) {
      if (!resolvedAdditionalFileIds.has(id)) {
        additionalFileDeleted = true;
        break;
      }
    }

    // Détection de déplacement de fichiers additionnels
    const filesToMove: { fileId: string, targetFolderId: string }[] = [];
    const movedFileIds = new Set<string>();
    for (const s of resolved) {
      if (!s.folderId) continue;
      s.additionalFiles?.forEach(af => {
        if (af.fileId) {
          const existingFolder = this.findParentFolder(af.fileId, currentFiles);
          if (existingFolder && existingFolder.id !== s.folderId) {
            console.log(`[EDITOR] File move detected for ${af.name}: ${existingFolder.name} -> ${s.folderName}`);
            filesToMove.push({ fileId: af.fileId as string, targetFolderId: s.folderId as string });
            movedFileIds.add(af.fileId);
          }
        }
      });
    }

    // Détection de déplacement d'images : un marqueur {{IMG:id}} apparaît dans le contenu
    // d'une section dont le folderId diffère du parent réel du fichier image dans l'arborescence.
    for (const s of resolved) {
      if (!s.folderId) continue;
      for (const fileId of s.orderedFileIds || []) {
        if (movedFileIds.has(fileId)) continue;
        const fileNode = this.findFileById(fileId, currentFiles);
        if (!fileNode || !this.projectFilesService.isImageFile(fileNode.name)) continue;
        const existingFolder = this.findParentFolder(fileId, currentFiles);
        if (existingFolder && existingFolder.id !== s.folderId) {
          console.log(`[EDITOR] Image move detected for ${fileNode.name}: ${existingFolder.name} -> ${s.folderName}`);
          filesToMove.push({ fileId, targetFolderId: s.folderId as string });
          movedFileIds.add(fileId);
        }
      }
    }

    const toCreate = resolved
      .filter(s => {
        if (s.folderId || renameOps.some(op => op.section === s)) return false;
        const fp = [...s.parentPath, s.folderName].map(p => this.slugify(p)).join('/');
        return !this.pendingFolders.has(fp);
      })
      .sort((a, b) => a.level - b.level);

    if (toCreate.length > 0) console.log('[EDITOR] Creations detected:', toCreate.map(s => s.folderName));

    const needsFile = resolved.filter(s => {
      if (!s.folderId) return false;
      const folder = this.findFolderById(s.folderId, currentFiles);
      return !(folder?.children || []).some(c => c.type === 'file');
    });

    // Re-parentage requis : un dossier existant dont le parent textuel (imbrication markdown)
    // diffère du parent physique, même sans autre changement structurel (ré-imbrication pure
    // par couper/coller en mode Code). Le cas « parent pas encore créé » est déjà couvert par toCreate.
    const needsReparent = resolved.some(s => {
      if (!s.folderId) return false;
      const parentS = parentSectionMap.get(s);
      if (parentS && !parentS.folderId) return false; // parent à créer → couvert par toCreate
      const desiredParentId = parentS ? (parentS.folderId ?? null) : null;
      const physicalParentId = this.findParentFolder(s.folderId, currentFiles)?.id ?? null;
      return desiredParentId !== physicalParentId;
    });

    const hasStructural = renameOps.length > 0 || toDelete.length > 0 || toCreate.length > 0 || needsFile.length > 0 || additionalFileDeleted || filesToMove.length > 0 || needsReparent;
    const sectionsWithFile = resolved.filter(s => s.fileId || s.folderId); // Tous ceux qui ont potentiellement du contenu à sauver

    if (!hasStructural && sectionsWithFile.length === 0 && !resolved.some(s => s.additionalFiles?.some(af => !af.fileId))) {
      // Aucun changement à propager. Sortir de l'état 'saving' éventuellement
      // déclenché par onSaveStarting et marquer comme sauvegardé pour purger les pending.
      if (this.saveStatus() === 'saving') {
        this.saveStatus.set('saved');
        this.collab.clearAllPending();
        this.savedStatusTimer = setTimeout(() => this.saveStatus.set('idle'), 2000);
      }
      return;
    }

    this.saveStatus.set('saving');
    clearTimeout(this.savedStatusTimer);

    let hasError = false;
    let anyAdditionalFileCreated = false;

    try {
      if (hasStructural) {
        // 0. Moves
        for (const move of filesToMove) {
          try {
            console.log(`[EDITOR] Moving file ${move.fileId} to folder ${move.targetFolderId}...`);
            await this.projectFilesService.moveFile(this.projectFolderName, move.fileId, move.targetFolderId);
          } catch (e) {
            console.error('File move failed:', e);
          }
        }

        // 1. Renames
        for (const op of renameOps) {
          try {
            console.log(`[EDITOR] Renaming folder ${op.folderId} to "${op.newName}"...`);
            const oldFolder = this.findFolderById(op.folderId, currentFiles);
            const oldName = oldFolder?.name || '';
            await this.projectFilesService.renameFolder(this.projectFolderName, op.folderId, op.newName);
            this.trackFolderRename(op.folderId, oldName, op.newName);
          } catch (e) {
            console.error('Rename failed:', e);
            hasError = true;
          }
        }

        // 2. Deletions (toujours 0 itération — réconciliation auto désactivée, cf. plus haut)
        for (const folder of toDelete) {
          try {
            console.log(`[EDITOR] Deleting orphan folder ${folder.id} (${folder.name})...`);
            await this.projectFilesService.deleteFolder(this.projectFolderName, folder.id);
          } catch (e) {
            console.error('Deletion failed:', e);
          }
        }

        // 3. Creations (parents before children)
        const newFolderIds = new Map<string, string>();
        for (const section of toCreate) {
          const fullPath = [...section.parentPath, section.folderName].map(p => this.slugify(p)).join('/');
          this.pendingFolders.add(fullPath);
          const parentKey = section.parentPath.map(p => this.slugify(p)).join('/');
          const parentId = section.parentFolderId || (parentKey ? newFolderIds.get(parentKey) : undefined) || undefined;
          
          try {
            const folder = await this.projectFilesService.createFolder(this.projectFolderName, { name: section.folderName, parentId, outilSlug: !parentId ? this.activeOutil()?.type : undefined });
            newFolderIds.set(fullPath, folder.id);
            section.folderId = folder.id;
            this.trackFolderCreate(folder);
            const file = (folder.children || []).find(c => c.type === 'file') || await this.projectFilesService.createFile(this.projectFolderName, { name: 'contenu', parentId: folder.id, content: section.content });
            section.fileId = file.id;
          } catch (e) {
            console.error('Creation failed:', e);
            hasError = true;
          } finally {
            this.pendingFolders.delete(fullPath);
          }
        }

        // Mise à jour des rootFolderIds en un seul appel (évite la race condition des appels parallèles)
        const newRootFolderIds = toCreate
          .filter(s => !s.parentFolderId && s.folderId)
          .map(s => s.folderId as string);
        if (newRootFolderIds.length > 0 && this.activeOutil()) {
          const outilId = this.activeOutilId()!;
          const currentRootIds = this.activeOutil()!.rootFolderIds;
          const updatedRootIds = [...currentRootIds, ...newRootFolderIds.filter(id => !currentRootIds.includes(id))];
          this.projectFilesService.updateOutil(this.projectFolderName, outilId, { rootFolderIds: updatedRootIds })
            .then(() => this.outils.update(list => list.map(o => o.id === outilId ? { ...o, rootFolderIds: updatedRootIds } : o)))
            .catch(e => console.warn('[ProjetEditor] updateOutil rootFolderIds failed:', e));
        }

        // 3b. Re-parentage : déplacer les dossiers EXISTANTS dont le parent textuel
        // (imbrication markdown courante) diffère du parent physique. Indispensable pour que
        // l'insertion d'un titre rattache correctement les sous-sections suivantes :
        // ex. un H2 inséré au milieu de H3 → les H3 qui le suivent deviennent ses enfants,
        // ceux du dessus restent sous l'ancien H2. L'identité étant garantie par le {{SID}},
        // le déplacement est sûr (jamais une recréation/suppression).
        const createdIds = new Set(toCreate.map(s => s.folderId).filter((id): id is string => !!id));
        const folderMoves: { folderId: string; level: number; targetParentId: string | null }[] = [];
        for (const s of resolved) {
          if (!s.folderId || createdIds.has(s.folderId)) continue;
          const parentS = parentSectionMap.get(s);
          const desiredParentId = parentS ? (parentS.folderId ?? null) : null;
          const physicalParentId = this.findParentFolder(s.folderId, currentFiles)?.id ?? null;
          if (desiredParentId !== physicalParentId) {
            folderMoves.push({ folderId: s.folderId, level: s.level, targetParentId: desiredParentId });
          }
        }
        folderMoves.sort((a, b) => a.level - b.level); // parents avant enfants
        const movedToRoot: string[] = [];
        for (const mv of folderMoves) {
          try {
            console.log(`[EDITOR] Re-parenting folder ${mv.folderId} -> ${mv.targetParentId ?? '(racine)'}`);
            await this.projectFilesService.moveFolder(this.projectFolderName, mv.folderId, mv.targetParentId);
            if (mv.targetParentId === null) movedToRoot.push(mv.folderId);
          } catch (e) {
            console.error('Folder re-parent failed:', e);
          }
        }
        // Dossiers promus en racine → rattachés à l'outil Édition
        if (movedToRoot.length > 0 && this.activeOutil()) {
          const outilId = this.activeOutilId()!;
          const currentRootIds = this.activeOutil()!.rootFolderIds;
          const updatedRootIds = [...currentRootIds, ...movedToRoot.filter(id => !currentRootIds.includes(id))];
          this.projectFilesService.updateOutil(this.projectFolderName, outilId, { rootFolderIds: updatedRootIds })
            .then(() => this.outils.update(list => list.map(o => o.id === outilId ? { ...o, rootFolderIds: updatedRootIds } : o)))
            .catch(e => console.warn('[ProjetEditor] updateOutil rootFolderIds (move) failed:', e));
        }

        // 4. Missing content files
        for (const section of needsFile) {
          const folderId = section.folderId || renameOps.find(op => op.section === section)?.folderId;
          if (!folderId) continue;
          try {
             const file = await this.projectFilesService.createFile(this.projectFolderName, { name: 'contenu', parentId: folderId, content: section.content });
             section.fileId = file.id;
          } catch (e) {
             console.error('Create content file failed:', e);
          }
        }
      }

      // 5. Save content (main content and additional files) MUST be done BEFORE loadFiles()
      // to ensure the server has the latest text when ngOnChanges rebuilds the document.
      // N'écrit jamais projet_content_version, seulement le brouillon local de l'utilisateur —
      // aucun conflit possible ici (zone de travail privée). La version BDD partagée n'est créée
      // que par le bouton explicite "Enregistrer et partager" (voir writeSectionStyled côté zone).
      for (const s of resolved) {
        if (s.fileId) {
          // Système double fichier : contenu.md = Markdown propre (strip), contenu-css.md = stylisé
          // (styles markdown-compatibles en markdown, seuls couleur/taille/etc. en HTML).
          const styled = normalizeStyledMarkdown(s.content);
          const clean = stripStyleMarkdown(styled, this.cleanImgResolver);
          const oldContent = oldContentMap.get(s.fileId) ?? '';
          if (oldContent !== clean) {
            const fileNode2 = this.findFileById(s.fileId, this.files());
            const baseVersionId = fileNode2?.fileVersion ?? null;
            await this.projectFilesService.saveDraft(this.projectFolderName, s.fileId, clean, s.folderId ?? null, baseVersionId)
              .then(() => this.collab.markSaveSucceeded(s.fileId!))
              .catch(e => { console.warn('[EDITOR] Sauvegarde brouillon échouée:', e.message); this.collab.markSaveFailed(s.fileId!); });
            this.patchFileContent(s.fileId, clean);
            this.collab.addLocalPending(s.folderId ?? s.fileId);
          }
        }

        // Save additional files
        if (s.folderId && s.additionalFiles && s.additionalFiles.length > 0) {
          for (const af of s.additionalFiles) {
            if (af.fileId) {
              const oldContent = oldContentMap.get(af.fileId) ?? '';
              if (oldContent !== af.content) {
                await this.projectFilesService.saveDraft(this.projectFolderName, af.fileId, af.content, s.folderId ?? null)
                  .then(() => this.collab.markSaveSucceeded(af.fileId!))
                  .catch(e => { console.warn('[EDITOR] Sauvegarde brouillon (fichier additionnel) échouée:', e.message); this.collab.markSaveFailed(af.fileId!); });
                this.patchFileContent(af.fileId, af.content);
              }
            } else {
              try {
                console.log(`[EDITOR] Creating additional file "${af.name}" in folder ${s.folderId}...`);
                const newFile = await this.projectFilesService.createFile(this.projectFolderName, { 
                  name: af.name, 
                  parentId: s.folderId, 
                  content: af.content 
                });
                af.fileId = newFile.id;
                anyAdditionalFileCreated = true;
              } catch (e) {
                console.error(`Failed to create additional file ${af.name}:`, e);
              }
            }
          }
        }
      }

      if (hasStructural) {
        // Rafraîchir l'arborescence dès que la structure est prête
        await this.loadFiles().catch(() => {});
        currentFiles = this.files();

        // On remet à jour les IDs de fichiers dans resolved pour la sauvegarde finale
        for (const s of resolved) {
          const path = [...s.parentPath, s.folderName].map(p => this.slugify(p)).join('/');
          const freshFolder = this.findFolderByPath(path, currentFiles);
          if (freshFolder) {
            s.folderId = freshFolder.id;
            const contentFile = (freshFolder.children || []).find(c => c.type === 'file');
            if (contentFile) s.fileId = contentFile.id;
          }
        }
        // Rafraîchit le parent réel (folderId du parent textuel, désormais créé/déplacé) pour
        // que applySectionFolderOrder ordonne les frères sous le BON parent — sinon un nouveau
        // parent (folderId null au moment du calcul initial) ferait grouper ses enfants à la racine.
        for (const s of resolved) {
          s.parentFolderId = parentSectionMap.get(s)?.folderId ?? null;
        }
      }

      // 6. Delete orphaned additional files (files in folders that are not 'contenu.md' and not in resolved additionalFiles)
      let additionalFileOrphanDeleted = false;
      if (hasStructural) {
        const freshFiles = this.files();
        // IDs des instances Méga-Outils encore vivantes (DB). Sert à protéger les fichiers
        // prompt-/trello-/array- d'une suppression accidentelle par drift de parsing :
        // un MO n'est supprimé que via le flux explicite (qui supprime d'abord l'instance DB).
        const liveInstanceIds = new Set(this.megaOutilInstances().map(i => i.id));
        for (const s of resolved) {
          if (!s.folderId) continue;
          const freshFolder = this.findFolderById(s.folderId, freshFiles);
          if (!freshFolder || !freshFolder.children) continue;

          const existingFiles = freshFolder.children.filter(c => c.type === 'file');
          for (const ef of existingFiles) {
            if (ef.name === 'contenu.md') continue;
            if (isCssTwinName(ef.name)) continue;
            if (this.projectFilesService.isImageFile(ef.name)) continue;
            const stillExists = s.additionalFiles.some(af => this.slugify(af.name) === this.slugify(ef.name.replace(/\.md$/, '')));
            if (!stillExists) {
              // GARDE MÉGA-OUTIL : si le fichier porte un {{MOID:id}} dont l'instance est encore
              // vivante en DB, c'est un drift de parsing (ex: renommage mal détecté), PAS une
              // suppression voulue → on protège le fichier. La synchro ne doit jamais supprimer
              // un prompt/trello/array dont l'instance existe encore.
              const moidMatch = /\{\{MOID:([a-zA-Z0-9-]+)\}\}/.exec(ef.content || '');
              const isMoFile = /^(prompt|trello|array)-/i.test(ef.name);
              if (moidMatch && liveInstanceIds.has(moidMatch[1])) {
                console.warn(`[EDITOR] Suppression bloquée : fichier MO "${ef.name}" (MOID ${moidMatch[1]}) — instance encore vivante. Drift de parsing protégé.`);
                continue;
              }
              if (isMoFile && !moidMatch) {
                // Fichier MO sans MOID lisible (legacy) : par prudence, ne pas supprimer si une
                // instance du même nom existe encore.
                const baseName = ef.name.replace(/^(prompt|trello|array)-/i, '').replace(/\.md$/, '');
                const hasLiveByName = this.megaOutilInstances().some(i => this.slugify(i.name) === this.slugify(baseName));
                if (hasLiveByName) {
                  console.warn(`[EDITOR] Suppression bloquée : fichier MO legacy "${ef.name}" — instance homonyme vivante. Protégé.`);
                  continue;
                }
              }
              console.log(`[EDITOR] Deleting orphaned additional file ${ef.name} from ${freshFolder.name}...`);
              const delResult = await this.projectFilesService.deleteFile(this.projectFolderName, ef.id).catch(e => { console.error(e); return null; });
              if (delResult?.trashId) this.trackAdditionalFileDelete(ef, delResult.trashId);
              additionalFileOrphanDeleted = true;
            }
          }
        }
      }

      if (anyAdditionalFileCreated || additionalFileOrphanDeleted) {
        await this.loadFiles().catch(() => {});
      }

      // 6b. Patch orderedFileIds : injecter les af.fileId résolus après création
      // (un rename de bloc doc = delete + create côté serveur avec order=last ;
      // sans cette injection, l'étape 7 ne touche pas le nouveau fichier et il reste en bas)
      for (const s of resolved) {
        if (!s.additionalFiles || s.additionalFiles.length === 0) continue;
        if (!s.orderedFileIds) s.orderedFileIds = [];
        const orderedSet = new Set(s.orderedFileIds);
        for (let i = 0; i < s.additionalFiles.length; i++) {
          const af = s.additionalFiles[i];
          if (!af.fileId || orderedSet.has(af.fileId)) continue;
          // Position d'ancrage : af précédent déjà mappé, sinon mainFile, sinon fin
          let anchorId: string | null = null;
          for (let k = i - 1; k >= 0; k--) {
            const prev = s.additionalFiles[k];
            if (prev.fileId && orderedSet.has(prev.fileId)) { anchorId = prev.fileId; break; }
          }
          if (!anchorId && s.fileId && orderedSet.has(s.fileId)) anchorId = s.fileId;
          const idx = anchorId ? s.orderedFileIds.indexOf(anchorId) + 1 : s.orderedFileIds.length;
          s.orderedFileIds.splice(idx, 0, af.fileId);
          orderedSet.add(af.fileId);
        }
      }

      // 7. Sync ordre des dossiers de section (suit l'ordre du document) ET ordre des
      // fichiers dans chaque dossier (orderedFileIds). Réordonner une section directement
      // dans le code doit réordonner le menu + les dossiers physiques sans toucher au texte.
      let structureSnapshot = JSON.parse(JSON.stringify(this.files())) as FileNode[];
      const applyOrder = (snapshot: FileNode[]): boolean => {
        let changed = this.applySectionFolderOrder(snapshot, resolved);
        for (const s of resolved) {
          if (!s.folderId || !s.orderedFileIds || s.orderedFileIds.length < 2) continue;
          const folder = this.findFolderById(s.folderId, snapshot);
          if (!folder || !folder.children) continue;
          for (let i = 0; i < s.orderedFileIds.length; i++) {
            const child = folder.children.find(c => c.id === s.orderedFileIds[i]);
            if (child && child.order !== i + 1) { child.order = i + 1; changed = true; }
          }
        }
        return changed;
      };
      let orderNeedsUpdate = applyOrder(structureSnapshot);
      if (orderNeedsUpdate) {
        // Si aucun loadFiles() n'a eu lieu dans ce cycle de save (pas de changement structurel),
        // on recharge avant d'envoyer le snapshot — évite d'écraser config.json avec une structure
        // périmée qui effacerait des nœuds ajoutés depuis le dernier chargement (ex : image
        // fraîchement uploadée présente dans config.json mais absente de this.files()).
        if (!hasStructural && !anyAdditionalFileCreated && !additionalFileOrphanDeleted) {
          await this.loadFiles().catch(() => {});
          structureSnapshot = JSON.parse(JSON.stringify(this.files())) as FileNode[];
          applyOrder(structureSnapshot);
        }
        await this.projectFilesService.updateStructure(this.projectFolderName, structureSnapshot).catch(e => console.error('[EDITOR] Order sync failed:', e));
        await this.loadFiles().catch(() => {});
      }

      if (!hasError) {
        this.saveStatus.set('saved');
        this.savedStatusTimer = setTimeout(() => this.saveStatus.set('idle'), 2000);
      } else {
        this.saveStatus.set('error');
        this.savedStatusTimer = setTimeout(() => this.saveStatus.set('idle'), 3000);
      }
    } catch (e) {
      console.error('onSectionsChange error:', e);
      this.saveStatus.set('error');
      this.savedStatusTimer = setTimeout(() => this.saveStatus.set('idle'), 3000);
    }
  }

  private getFolderChildren(parentPathLower: string[], nodes: FileNode[]): FileNode[] {
    if (parentPathLower.length === 0) return nodes.filter(n => n.type === 'folder');
    const [first, ...rest] = parentPathLower;
    const parent = nodes.find(n => n.type === 'folder' && this.slugify(n.name) === first);
    return parent ? this.getFolderChildren(rest, parent.children || []) : [];
  }

  private collectAllFolderPaths(nodes: FileNode[], prefix: string[] = []): Map<string, FileNode> {
    const map = new Map<string, FileNode>();
    for (const node of nodes) {
      if (node.type === 'folder') {
        const parts = [...prefix, this.slugify(node.name)];
        map.set(parts.join('/'), node);
        const sub = this.collectAllFolderPaths(node.children || [], parts);
        sub.forEach((v, k) => map.set(k, v));
      }
    }
    return map;
  }



  private getFolderDepth(id: string, nodes: FileNode[], depth = 1): number {
    for (const node of nodes) {
      if (node.type === 'folder') {
        if (node.id === id) return depth;
        const d = this.getFolderDepth(id, node.children || [], depth + 1);
        if (d > 0) return d;
      }
    }
    return 0;
  }

  async onFileSave(event: FileSaveEvent) {
    this.saveStatus.set('saving');
    clearTimeout(this.savedStatusTimer);
    try {
      await this.projectFilesService.updateFile(this.projectFolderName, event.fileId, event.content);
      this.saveStatus.set('saved');
      this.savedStatusTimer = setTimeout(() => this.saveStatus.set('idle'), 2000);
    } catch {
      this.saveStatus.set('error');
      this.savedStatusTimer = setTimeout(() => this.saveStatus.set('idle'), 3000);
    }
  }

  /**
   * Changement de niveau d'une section (clic droit sidebar / Structure). Délègue à l'éditeur
   * qui modifie le `#` de la ligne de heading ; processSectionsChange applique ensuite le
   * re-parentage positionnel (outdent/indent) + la normalisation de profondeur :
   *  - Monter (−1) : la section remonte et récupère les sections suivantes comme enfants ;
   *  - Descendre (+1) : la section se niche sous sa sœur précédente.
   */
  onNodeLevelChange(event: { folderId: string; delta: number }) {
    this.editionOutil?.changeHeadingLevel(event.folderId, event.delta);
  }

  /**
   * Suppression d'un titre en gardant le texte (clic droit sidebar). Délègue à l'éditeur qui
   * retire la ligne de heading ; le texte est alors fusionné dans la section précédente.
   */
  onTitleMerge(event: { folderId: string }) {
    this.editionOutil?.mergeTitleIntoPrevious(event.folderId);
  }

  async onDragDrop(event: DragDropEvent) {
    // Pause pour garantir que le saveAll() de la zone 4 a bien émis sectionsChange et passé isSaving à true
    await new Promise(resolve => setTimeout(resolve, 150));

    // Attendre la fin des sauvegardes en cours (ex: le texte de la zone 4 vient d'être sauvegardé)
    // pour éviter un rechargement avec du vieux texte qui corromprait la position des images.
    while (this.isSaving) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const { draggedNode, draggedParentId, targetNode, targetParentId, position, targetSiblings } = event;
    try {
      const showRenameNotice = (result: any) => {
        if (result?.renamedTo) {
          if (this.dragDropErrorTimer) clearTimeout(this.dragDropErrorTimer);
          this.dragDropError.set(`Renommé en "${result.renamedTo}" (conflit de nom dans la cible)`);
          this.dragDropErrorTimer = setTimeout(() => this.dragDropError.set(null), 5000);
        }
      };

      if (draggedNode.type === 'folder') {
        if (position === 'inside' && targetNode.type === 'folder') {
          // Déplacer le dossier dans un autre dossier (changement de parent)
          const r = await this.projectFilesService.moveFolder(this.projectFolderName, draggedNode.id, targetNode.id);
          showRenameNotice(r);
        } else if (position !== 'inside') {
          if (draggedParentId === targetParentId) {
            // Même parent : réordonner
            const folderSiblings = targetSiblings.filter(n => n.type === 'folder');
            const fromIdx = folderSiblings.findIndex(n => n.id === draggedNode.id);
            const toIdx = folderSiblings.findIndex(n => n.id === targetNode.id);
            if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
              const newOrder = [...folderSiblings];
              const [item] = newOrder.splice(fromIdx, 1);
              const targetNewIdx = toIdx > fromIdx ? toIdx - 1 : toIdx;
              const insertAt = position === 'before' ? targetNewIdx : targetNewIdx + 1;
              newOrder.splice(insertAt, 0, item);
              const structure: FileNode[] = JSON.parse(JSON.stringify(this.files()));
              this.applyOrderInStructure(structure, targetParentId, newOrder.map(n => n.id));
              await this.projectFilesService.updateStructure(this.projectFolderName, structure);
            }
          } else {
            // Parent différent : déplacer dans le même parent que la cible
            const r = await this.projectFilesService.moveFolder(this.projectFolderName, draggedNode.id, targetParentId);
            showRenameNotice(r);
          }
        }
      } else {
        // Fichier (document additionnel ou image) : il doit TOUJOURS rester dans un dossier.
        let targetFolderId: string | null = null;

        if (position === 'inside' && targetNode.type === 'folder') {
          targetFolderId = targetNode.id;
        } else if (targetNode.type === 'folder') {
          targetFolderId = targetNode.id;
        } else {
          targetFolderId = targetParentId;
        }

        if (!targetFolderId) {
          targetFolderId = draggedParentId;
        }

        // 1) Déplacement physique si le dossier change
        const folderChanged = !!targetFolderId && targetFolderId !== draggedParentId;
        if (folderChanged) {
          // Sauvegarde d'abord le texte avec la bonne position (avant que le loadFiles n'écrase tout)
          if (this.editionOutil) {
            this.editionOutil.flushContentModifications();
          }
          await this.projectFilesService.moveFile(this.projectFolderName, draggedNode.id, targetFolderId!);
        }

        // 2) Réordonnancement dans le dossier cible quand on dépose
        //    avant/après un fichier frère (Doc1 ↔ Doc2 ↔ Doc3).
        if (position !== 'inside' && targetNode.type === 'file' && targetFolderId) {
          const currentFiles = this.files();
          const targetFolder = this.findFolderById(targetFolderId, currentFiles);
          const siblings = targetFolder ? (targetFolder.children || []) : currentFiles;
          const fileSiblings = siblings.filter(n => n.type === 'file');
          const fromIdx = fileSiblings.findIndex(n => n.id === draggedNode.id);
          const toIdx = fileSiblings.findIndex(n => n.id === targetNode.id);
          if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
            const newOrder = [...fileSiblings];
            const [item] = newOrder.splice(fromIdx, 1);
            const targetNewIdx = toIdx > fromIdx ? toIdx - 1 : toIdx;
            const insertAt = position === 'before' ? targetNewIdx : targetNewIdx + 1;
            newOrder.splice(insertAt, 0, item);
            const folderSiblings = siblings.filter(n => n.type === 'folder');
            const allOrdered = [...newOrder, ...folderSiblings];
            const structure: FileNode[] = JSON.parse(JSON.stringify(currentFiles));
            this.applyOrderInStructure(structure, targetFolderId, allOrdered.map(n => n.id));
            await this.projectFilesService.updateStructure(this.projectFolderName, structure);
          }
        }

        // 3) Pour un drop 'inside' : placer les fichiers avant les sous-dossiers
        if (position === 'inside' && targetNode.type === 'folder') {
          const targetFolder = this.findFolderById(targetNode.id, this.files());
          if (targetFolder?.children) {
            const childFiles = targetFolder.children.filter(c => c.type === 'file');
            const childFolders = targetFolder.children.filter(c => c.type === 'folder');
            if (childFiles.length > 0 && childFolders.length > 0) {
              const structure: FileNode[] = JSON.parse(JSON.stringify(this.files()));
              this.applyOrderInStructure(structure, targetNode.id, [...childFiles, ...childFolders].map(n => n.id));
              await this.projectFilesService.updateStructure(this.projectFolderName, structure);
            }
          }
        }
      }
      await this.loadFiles();
      this.onNodeActive(draggedNode.id);
    } catch (e: any) {
      console.error('DragDrop failed:', e);
      const msg = e?.error?.error || e?.message || 'Déplacement impossible';
      if (this.dragDropErrorTimer) clearTimeout(this.dragDropErrorTimer);
      this.dragDropError.set(msg);
      this.dragDropErrorTimer = setTimeout(() => this.dragDropError.set(null), 5000);
    }
  }

  private applyOrderInStructure(nodes: FileNode[], parentId: string | null, orderedIds: string[]): boolean {
    const reorderArray = (arr: FileNode[]) => {
      const reordered = orderedIds.map(id => arr.find(n => n.id === id)).filter((n): n is FileNode => !!n);
      const others = arr.filter(n => !orderedIds.includes(n.id));
      reordered.forEach((n, idx) => { n.order = idx + 1; });
      arr.splice(0, arr.length, ...reordered, ...others);
    };
    if (parentId === null) { reorderArray(nodes); return true; }
    for (const node of nodes) {
      if (node.id === parentId && node.children) { reorderArray(node.children); return true; }
      if (node.children && this.applyOrderInStructure(node.children, parentId, orderedIds)) return true;
    }
    return false;
  }

  async onRefresh() {
    // Race condition fix : si un save est en cours (déclenché par saveAll() juste avant
    // refresh.emit() côté zone, par ex. après upload/delete d'image), attendre sa fin
    // avant de relire le serveur — sinon loadFiles() lit un contenu.md obsolète et
    // buildDocSections place les marqueurs {{IMG:xxx}} au mauvais endroit.
    let waited = 0;
    while ((this.isSaving || this.pendingSections) && waited < 5000) {
      await new Promise(resolve => setTimeout(resolve, 50));
      waited += 50;
    }
    await this.loadFiles();
  }

  /** Après un pull réussi déclenché par la bannière de notification */
  async onProjectPulled(_event: { newCommits: number; changedFiles: string[] }): Promise<void> {
    await this.onRefresh();
  }

  private findParentFolder(fileId: string, nodes: FileNode[]): FileNode | null {
    for (const node of nodes) {
      if (node.type === 'folder') {
        if ((node.children || []).some(c => c.id === fileId)) return node;
        const found = this.findParentFolder(fileId, node.children || []);
        if (found) return found;
      }
    }
    return null;
  }

  private findFolderById(id: string, nodes: FileNode[]): FileNode | null {
    for (const node of nodes) {
      if (node.type === 'folder') {
        if (node.id === id) return node;
        const found = this.findFolderById(id, node.children || []);
        if (found) return found;
      }
    }
    return null;
  }

  /** Réordonne les dossiers de section (dans `snapshot`) pour suivre l'ordre du document :
   *  pour chaque parent, les dossiers enfants prennent l'ordre où leurs `###` apparaissent
   *  dans le texte. Met à jour `folder.order` (clé de tri du menu et de la reconstruction).
   *  Retourne true si au moins un `order` a changé. */
  private applySectionFolderOrder(snapshot: FileNode[], resolved: SectionInfo[]): boolean {
    // Regrouper les folderId par parent, dans l'ordre d'apparition dans le document
    const parentToChildren = new Map<string | null, string[]>();
    for (const s of resolved) {
      if (!s.folderId) continue;
      const pid = s.parentFolderId ?? null;
      let arr = parentToChildren.get(pid);
      if (!arr) { arr = []; parentToChildren.set(pid, arr); }
      if (!arr.includes(s.folderId)) arr.push(s.folderId);
    }
    let changed = false;
    for (const orderedIds of parentToChildren.values()) {
      for (let i = 0; i < orderedIds.length; i++) {
        const folder = this.findFolderById(orderedIds[i], snapshot);
        if (folder && folder.order !== i + 1) { folder.order = i + 1; changed = true; }
      }
    }
    return changed;
  }

  private findOutilForNode(nodeId: string): string | null {
    for (const outil of this.outils()) {
      if (!outil.rootFolderIds.length) continue;
      for (const rootId of outil.rootFolderIds) {
        if (this.isNodeInSubtree(nodeId, rootId)) return outil.id;
      }
    }
    return null;
  }

  private isNodeInSubtree(nodeId: string, rootId: string): boolean {
    if (rootId === nodeId) return true;
    const root = this.findFolderById(rootId, this.files());
    if (!root?.children) return false;
    return !!this.findNodeAnywhere(nodeId, root.children);
  }

  private findNodeAnywhere(id: string, nodes: FileNode[]): FileNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const f = this.findNodeAnywhere(id, n.children);
        if (f) return f;
      }
    }
    return null;
  }

  private findFolderByPath(path: string, nodes: FileNode[]): FileNode | null {
    for (const node of nodes) {
      if (node.type === 'folder') {
        const currentPath = node.path.replace(/\.md$/, ''); // Sécurité
        if (this.slugify(node.path) === path || node.path === path) return node;
        if (node.children) {
          const found = this.findFolderByPath(path, node.children);
          if (found) return found;
        }
      }
    }
    return null;
  }

  onHistoryEntryClick(entry: CollabHistoryEntry) {
    // Capturer le texte actuel AVANT de basculer la vue : entry.entityId est souvent le
    // folderId d'une section (pas un fileId, voir getCursorEntity/flushContentModifications
    // dans ProjetEditorZoneComponent) — seul editionOutil.getEntityText() sait résoudre le
    // texte "rendu" correspondant (heading + fichiers additionnels inclus, comme
    // beforeState/afterState). Une fois diffEntry non-null, <app-edition-outil> est démonté
    // (remplacé par <app-projet-diff> dans le template) et son ViewChild n'est plus valide.
    const entityId = entry.entityId != null ? String(entry.entityId) : null;
    const current = entityId
      ? (this.editionOutil?.getEntityText(entityId) ?? this.findFileById(entityId, this.files())?.content ?? null)
      : null;
    this.diffCurrentContent.set(current);
    this.diffEntry.set(entry);
  }

  // Annulation depuis l'historique : patche le contenu restauré dans les fichiers
  // puis force l'éditeur (zone 4) à se reconstruire via restoreToken.
  onHistoryRestored(restored: WoRestoredContent) {
    this.files.update(nodes => this.patchNodeContent(nodes, restored.nodeId, restored.content));
    this.restoreToken.update(n => n + 1);
  }

  closeDiff() {
    this.diffEntry.set(null);
  }

  async onTriDiffApply(content: string) {
    const entry = this.diffEntry();
    if (!entry?.entityId) return;
    const projectName = this.project()?.id;
    if (!projectName) return;
    const prevContent = this.diffCurrentContent();
    this.diffEntry.set(null);

    // entry.entityId est le folderId pour le texte principal d'une section (voir
    // getCursorEntity/flushContentModifications : entityId === folderId dans ce cas),
    // pas forcément un fileId. patchNodeContent()/updateFile() sur cet id ne
    // modifiaient donc rien de visible (le rendu lit le contenu du FICHIER
    // "contenu.md", pas un champ "content" posé sur le dossier) : le bouton
    // "Appliquer dans l'éditeur" semblait ne rien faire. On passe désormais par
    // applyExternalContent, qui remplace le texte de la bonne plage dans le
    // document unifié et déclenche le pipeline de sauvegarde normal (brouillon
    // local, comme une frappe manuelle — la publication reste un choix explicite
    // via "Enregistrer et partager").
    const applied = this.editionOutil?.applyExternalContent(String(entry.entityId), content);
    if (!applied) {
      console.error('[TriDiff] apply failed: entité introuvable dans le document actuel', entry.entityId);
      return;
    }

    this.history.track({
      section: 'projets/contenu',
      actionType: 'update',
      label: `Fusion manuelle — «${entry.entityLabel || entry.entityId}»`,
      entityType: 'content',
      entityId: entry.entityId,
      entityLabel: entry.entityLabel,
      beforeState: prevContent != null ? { content: prevContent } : undefined,
      afterState: { content },
      context: { projectId: projectName },
      // Pas d'undoAction fiable ici : le texte fusionné peut recouvrir plusieurs
      // fichiers (fichiers additionnels, images) au sein de la section, un simple
      // PUT sur un seul fichier serait incorrect/incomplet.
      undoable: false,
    }).catch(() => {});
  }

  async onAcceptAiEdit() {
    const projectName = this.project()?.id;
    const edit = this.aiEditService.pendingEdit();
    if (!projectName || !edit) return;
    try {
      await this.aiEditService.acceptEdit(projectName);
      // Patch le signal local immédiatement — évite la latence d'un onRefresh()
      this.files.update(nodes => this.patchNodeContent(nodes, edit.fileId, edit.proposedContent));
      // Enregistrement dans l'historique
      const sectionName = this.findFolderById(edit.sectionId, this.files())?.name ?? edit.sectionId;
      this.history.track({
        section: 'projets/contenu',
        actionType: 'ai-update',
        label: `Modification IA — «${sectionName}»`,
        entityType: 'content',
        entityId: edit.fileId,
        entityLabel: sectionName,
        beforeState: { content: edit.originalContent },
        afterState: { content: edit.proposedContent },
        context: { projectId: projectName },
        undoable: true,
        undoAction: {
          endpoint: `/api/file-projects/${projectName}/files/${edit.fileId}`,
          method: 'PUT',
          payload: { content: edit.originalContent }
        }
      }).catch(() => {});
    } catch (e) {
      console.error('[AI Edit] Accept failed:', e);
      this.aiEditService.cancelEdit();
    }
  }

  onCancelAiEdit() {
    this.aiEditService.cancelEdit();
  }

  // Choix rapide (tout garder d'un côté) — pour le cas simple où aucune fusion ligne à ligne n'est nécessaire.
  async resolveConflictQuick(choice: 'mine' | 'server'): Promise<void> {
    const conflict = this.conflictState();
    if (!conflict) return;
    await this.applyConflictResolution(choice === 'mine' ? conflict.mineContent : conflict.serverContent);
  }

  // Fusion ligne à ligne via <app-projet-diff> (bouton Synchro / résolution de conflit).
  onConflictDiffApply(mergedContent: string): void {
    this.applyConflictResolution(mergedContent);
  }

  private async applyConflictResolution(mergedContent: string): Promise<void> {
    const conflict = this.conflictState();
    if (!conflict) return;
    try {
      if (conflict.isLiveConflict) {
        // Conflit live résolu via "Voir le diff complet" : aucune tentative de publication n'a
        // encore eu lieu, donc pas de route resolve-conflict ici (elle ne déclenche jamais de
        // publish git/FTP) — fusion locale uniquement. Le prochain "Enregistrer et partager"
        // normal publiera avec baseVersionId=liveVersionId, sans conflit, avec push git/FTP normal.
        // mineContent/serverContent incluent tous deux le heading en 1ère ligne (cf.
        // openIncomingChangeDiff) pour un alignement correct dans <app-projet-diff> — mais
        // files().content/le brouillon sont conventionnellement sans heading (voir
        // insertIncomingChange), donc on le retire avant de persister.
        const bodyOnly = mergedContent.split('\n').slice(1).join('\n');
        this.patchFileContent(conflict.fileId, bodyOnly, conflict.liveVersionId);
        await this.projectFilesService.saveDraft(
          this.projectFolderName, conflict.fileId, bodyOnly, conflict.folderId ?? null, conflict.liveVersionId ?? null
        ).catch(() => {});
      } else {
        const result = await this.projectFilesService.resolveConflict(this.projectFolderName, conflict.fileId, {
          baseVersionId: conflict.baseVersionId,
          folderId: conflict.folderId,
          mineContent: conflict.mineContent,
          mergedContent
        });
        this.patchFileContent(conflict.fileId, mergedContent, result.versionId);
        this.collab.removeLocalPending(conflict.folderId ?? conflict.fileId);
        await this.projectFilesService.deleteDraft(this.projectFolderName, conflict.fileId).catch(() => {});
      }
    } catch (e) {
      console.error('[Conflict] Résolution échouée:', e);
    } finally {
      this.conflictState.set(null);
    }
  }

  get statusLabel(): string {
    return this.project()?.status === 'published' ? 'Publié' : 'Brouillon';
  }

  get projectTitle(): string {
    return this.project()?.title || '';
  }
}
