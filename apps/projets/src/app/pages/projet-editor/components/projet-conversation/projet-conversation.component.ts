import { Component, Input, Output, EventEmitter, OnChanges, OnInit, OnDestroy, SimpleChanges, signal, computed, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { Subscription } from 'rxjs';
import {
  ConversationService, Message, PromptContext, FileNode, PromptLaunchContext,
  MaterializedMoPreview, PromptGlobalConfig, FormQuestion, FormEntry,
  AiExecuteService, MegaOutilsService,
  composeSystemPrompt, promptDeliverableHeadingInstruction,
  detectMoFences, parseChoiceForm, fenceBody, parseChartPoints,
} from '@worganic/portail-core/data-access';
import { ConfigService } from '@worganic/portail-core/data-access';
import { WoActionHistoryService } from '@worganic/portail-core/data-access';
import { DocumentService } from '@worganic/portail-core/data-access';
import { ProjetAiEditService } from '../../services/projet-ai-edit.service';
import { ChartBoardComponent } from '@worganic/shared/ui';
import { FormExecutionPopupComponent } from '../form-execution-popup/form-execution-popup.component';

const MAX_CADRAGE_WAVES = 5;

@Component({
  selector: 'app-projet-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartBoardComponent, FormExecutionPopupComponent],
  templateUrl: './projet-conversation.component.html',
  styles: [`
    .chat-md :where(h1, h2, h3) { font-weight: 700; margin: 0.5em 0 0.25em; line-height: 1.3; }
    .chat-md h1 { font-size: 1.05em; }
    .chat-md h2 { font-size: 1em; }
    .chat-md h3 { font-size: 0.95em; }
    .chat-md p { margin: 0.35em 0; }
    .chat-md ul, .chat-md ol { margin: 0.35em 0; padding-left: 1.3em; }
    .chat-md li { margin: 0.15em 0; }
    .chat-md strong { font-weight: 700; }
    .chat-md em { font-style: italic; }
    .chat-md hr { border: none; border-top: 1px solid currentColor; opacity: 0.15; margin: 0.6em 0; }
    .chat-md code { font-family: 'Cascadia Code', monospace; font-size: 0.9em; background: rgba(128,128,128,0.15); border-radius: 3px; padding: 0.1em 0.3em; }
    .chat-md pre { background: rgba(0,0,0,0.25); border-radius: 6px; padding: 0.6em 0.8em; overflow-x: auto; margin: 0.4em 0; }
    .chat-md pre code { background: none; padding: 0; }
    .chat-md blockquote { border-left: 2px solid currentColor; opacity: 0.85; padding-left: 0.7em; margin: 0.35em 0; }
    .chat-md > *:first-child { margin-top: 0; }
    .chat-md > *:last-child { margin-bottom: 0; }
  `],
  host: { class: 'flex flex-col min-h-0 flex-1 overflow-hidden' },
})
export class ProjetConversationComponent implements OnChanges, OnInit, AfterViewChecked, OnDestroy {
  @Input() sectionId: string | null = null;
  @Input() projectId: string | null = null;
  @Input() files: FileNode[] = [];
  @Input() projectName: string | null = null;
  @Input() iaInstructions: string | null = null;
  /** MO Prompt exécuté (bouton "Exécuter" du board) : lance/poursuit sa conversation ici. */
  @Input() launchPrompt: PromptLaunchContext | null = null;
  @Output() conversationAdded = new EventEmitter<string>();
  /** MegaOutils cochés sur un message d'une conversation Prompt à matérialiser (Trello/Array réels,
   *  Agenda réel, livrable inséré dans la section) — relayé par le parent vers la zone d'édition. */
  @Output() materializeRequested = new EventEmitter<{ promptInstanceId: string; deliverable: string; selectedMos: MaterializedMoPreview[]; transcript?: string }>();
  /** "Copier vers l'édition" sur un message IA d'une conversation Prompt — relayé par le parent. */
  @Output() copyToEditionRequested = new EventEmitter<{ text: string; sectionId: string }>();
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  private convService = inject(ConversationService);
  configService = inject(ConfigService);
  private woHistory = inject(WoActionHistoryService);
  private documentService = inject(DocumentService);
  aiEditService = inject(ProjetAiEditService);
  readonly execSvc = inject(AiExecuteService);
  private megaSvc = inject(MegaOutilsService);
  private sanitizer = inject(DomSanitizer);

  inputMessage = '';
  loading = signal(false);
  private shouldScroll = false;
  private subs = new Subscription();

  messages: Message[] = [];

  // Mode IA : true = les envois vont à l'IA (pas besoin de taper @ia)
  iaMode = signal(false);
  // Inclure l'historique de la conversation comme contexte supplémentaire
  includeHistory = signal(false);
  // Modèle sélectionné localement (init depuis config, modifiable)
  selectedModel = signal('');
  // Afficher/masquer le sélecteur de modèle
  showModelSelect = signal(false);
  // Popup infos IA du projet
  showIaInfo = signal(false);
  // Prompt tapé dans le popup IA (partagé avec l'input principal via sendFromPopup)
  popupPrompt = '';
  // Inclure le document entier comme contexte (au lieu de la section seule)
  includeFullDocument = signal(false);
  // Popup prompt complet (par message IA — session courante avec promptContext)
  showPromptInfo = signal(false);
  selectedPromptContext = signal<PromptContext | null>(null);
  // Popup contexte IA lecture seule (messages historiques sans promptContext)
  showContextView = signal(false);
  contextViewUserPrompt = signal<string | null>(null);
  // Instruction globale : doc par défaut de la catégorie "Instructions IA"
  globalIaInstruction = signal<string | null>(null);
  // Infos de la section courante
  currentSectionName = signal<string | null>(null);
  currentSectionContent = signal<string | null>(null);
  currentSectionHasSubSections = signal(false);

  // ── Conversation lancée depuis un MO Prompt (mode Normal/Guidé/Tchat/Tchat libre) ──────────
  /** Contexte du Prompt actuellement "actif" dans ce fil : les messages tapés dans le composeur
   *  principal lui sont adressés tant qu'il est actif (voir send()/continuePromptConversation()). */
  activePromptLaunch: PromptLaunchContext | null = null;
  private lastPromptLaunchToken = 0;
  private promptGlobalConfig: PromptGlobalConfig | null = null;
  private currentPromptPhase: 'clarify' | 'generate' | 'chat' = 'chat';
  promptSending = signal(false);
  promptStreamingText = signal('');
  // Variables {{var}} à remplir avant le premier envoi (carte en ligne, pas de popup)
  awaitingPromptVars = signal<PromptLaunchContext | null>(null);
  promptVarValues: Record<string, string> = {};
  private formDismissedMessageKey: string | null = null;

  // Liste consolidée de tous les modèles disponibles
  readonly allModels = computed(() => {
    const cfg = this.configService.cliConfig();
    const claude = (cfg.modelsList?.claude || []).map(m => ({ ...m, provider: 'claude' }));
    const antigravity = (cfg.modelsList?.antigravity || []).map(m => ({ ...m, provider: 'antigravity' }));
    return [...claude, ...antigravity];
  });

  // Le modèle actif : soit selectedModel, soit celui de la config
  readonly activeModel = computed(() => {
    const manual = this.selectedModel();
    if (manual) return manual;
    return this.configService.cliConfig().headerSelection?.model || 'claude-sonnet-4-6';
  });

  // Provider dérivé du modèle actif — pas de sélecteur dédié, cohérent avec la sélection de l'onglet.
  readonly activeProvider = computed(() => {
    const found = this.allModels().find(m => m.value === this.activeModel());
    return found?.provider || this.configService.cliConfig().headerSelection?.provider || 'claude';
  });

  // Label court du modèle actif (affichage bouton)
  readonly modelLabel = computed(() => {
    const m = this.activeModel();
    const found = this.allModels().find(x => x.value === m);
    if (found) return found.label || m;
    return m.replace('claude-', '').replace('gemini-', '');
  });

  get isAiMessage(): boolean {
    return this.iaMode() || this.inputMessage.trimStart().toLowerCase().startsWith('@ia ');
  }

  /** Vrai si une génération est en cours (Mode IA fichier OU conversation Prompt) — désactive la saisie. */
  get isBusy(): boolean {
    return this.aiEditService.isStreaming() || this.promptSending();
  }

  toggleIaMode() {
    this.iaMode.update(v => !v);
    // Nettoie le préfixe @ia s'il était tapé manuellement
    if (!this.iaMode() && this.inputMessage.trimStart().toLowerCase().startsWith('@ia ')) {
      const raw = this.inputMessage.trimStart();
      this.inputMessage = raw.slice(raw.toLowerCase().indexOf('@ia ') + 4);
    }
  }

  ngOnInit() {
    this.subs.add(this.execSvc.chunk$.subscribe(c => this.promptStreamingText.update(v => v + c)));
    this.subs.add(this.execSvc.done$.subscribe(full => this.onPromptTurnDone(full)));
    this.subs.add(this.execSvc.error$.subscribe(err => this.onPromptTurnError(err)));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['sectionId'] || changes['files']) {
      this.updateCurrentSection();
    }
    if (changes['sectionId']) {
      if (this.sectionId) {
        this.loadHistory();
        const pending = this.aiEditService.pendingEdit();
        if (pending && pending.sectionId !== this.sectionId) {
          this.aiEditService.cancelEdit();
        }
      } else {
        this.messages = [];
      }
    }
    // Init du modèle et chargement de l'instruction globale au premier chargement du projet
    if (changes['projectId']) {
      if (!this.selectedModel()) {
        const cfg = this.configService.cliConfig();
        this.selectedModel.set(cfg.headerSelection?.model || '');
      }
      this.loadGlobalIaInstruction();
    }
    if (changes['launchPrompt'] && this.launchPrompt) {
      this.startPromptLaunch(this.launchPrompt);
    }
  }

  private updateCurrentSection() {
    if (!this.sectionId) {
      this.currentSectionName.set(null);
      this.currentSectionContent.set(null);
      this.currentSectionHasSubSections.set(false);
      return;
    }
    const info = this.findContenFile(this.sectionId, this.files);
    if (!info) {
      this.currentSectionName.set(null);
      this.currentSectionContent.set(null);
      this.currentSectionHasSubSections.set(false);
      return;
    }
    const subContent = this.collectSubSectionsContent(this.sectionId, this.files);
    this.currentSectionName.set(info.fileName);
    this.currentSectionHasSubSections.set(subContent !== null);
    this.currentSectionContent.set(subContent
      ? `${info.content}\n\n${subContent}`
      : info.content);
  }

  private async loadGlobalIaInstruction() {
    try {
      const [cats, docs] = await Promise.all([
        this.documentService.getCategories(),
        this.documentService.getDocuments()
      ]);
      const iaCat = cats.find(c => c.name === 'Instructions IA');
      if (!iaCat?.defaultDocumentId) { this.globalIaInstruction.set(null); return; }
      const defaultDoc = docs.find(d => d.id === iaCat.defaultDocumentId);
      this.globalIaInstruction.set(defaultDoc?.text || null);
    } catch {
      this.globalIaInstruction.set(null);
    }
  }

  private buildSystemInstructions(
    subSectionsContent?: string | null,
    fullDocContent?: string | null,
    sectionName?: string | null
  ): string | null {
    const global = this.globalIaInstruction();
    const project = this.iaInstructions;
    const parts: string[] = [];
    if (global) parts.push(global);
    if (project) parts.push(project);
    if (fullDocContent) {
      const header = sectionName
        ? `[Document complet — contexte général]\nSection active ciblée : "${sectionName}"\n\n`
        : `[Document complet — contexte général]\n\n`;
      parts.push(`${header}${fullDocContent}`);
    } else if (subSectionsContent) {
      parts.push(`[Sous-sections de la section courante — contexte supplémentaire]\n${subSectionsContent}`);
    }
    return parts.length > 0 ? parts.join('\n\n---\n\n') : null;
  }

  openPromptInfo(ctx: PromptContext) {
    this.selectedPromptContext.set(ctx);
    this.showPromptInfo.set(true);
  }

  openContextView(msg: Message) {
    const idx = this.messages.indexOf(msg);
    const prev = idx > 0 ? this.messages[idx - 1] : null;
    this.contextViewUserPrompt.set(prev?.role === 'user' ? prev.text : null);
    this.showContextView.set(true);
  }

  toggleFullDocument() {
    this.includeFullDocument.update(v => !v);
  }

  sendFromPopup() {
    if (!this.popupPrompt.trim() || !this.sectionId || this.aiEditService.isStreaming()) return;
    const msg = this.popupPrompt;
    this.popupPrompt = '';
    this.showIaInfo.set(false);
    this.sendAiEdit(msg);
  }

  onPopupKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendFromPopup();
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch { }
  }

  loadHistory() {
    if (!this.sectionId) return;
    this.loading.set(true);
    this.convService.getHistory(this.sectionId).subscribe({
      next: (data) => {
        this.messages = data.messages || [];
        this.loading.set(false);
        this.shouldScroll = true;
      },
      error: () => this.loading.set(false)
    });
  }

  toggleHistory() {
    this.includeHistory.update(v => !v);
  }

  toggleModelSelect() {
    this.showModelSelect.update(v => !v);
  }

  onModelChange(value: string) {
    this.selectedModel.set(value);
    this.showModelSelect.set(false);
  }

  send() {
    if (!this.inputMessage.trim() || !this.sectionId) return;
    if (this.activePromptLaunch && !this.iaMode()) {
      this.continuePromptConversation();
    } else if (this.isAiMessage) {
      this.sendAiEdit();
    } else {
      this.sendChat();
    }
  }

  private sendChat() {
    const text = this.inputMessage;
    this.inputMessage = '';
    this.convService.sendMessage(this.sectionId!, text).subscribe({
      next: (msg) => {
        this.messages = [...this.messages, msg];
        this.shouldScroll = true;
        this.conversationAdded.emit(this.sectionId!);
        this.woHistory.track({
          section: 'projets/conversation',
          actionType: 'create',
          label: `Message envoyé dans la section «${this.sectionId}»`,
          entityType: 'message',
          entityId: this.sectionId ?? undefined,
          afterState: { text: text.substring(0, 200) },
          context: { projectId: this.projectId, sectionId: this.sectionId },
          undoable: false
        }).catch(() => { });
      },
      error: () => { this.inputMessage = text; }
    });
  }

  private sendAiEdit(messageOverride?: string) {
    if (this.aiEditService.isStreaming()) return;

    // Extraire le prompt : depuis l'override (popup), ou depuis inputMessage
    const raw = messageOverride !== undefined
      ? messageOverride.trimStart()
      : this.inputMessage.trimStart();
    const prompt = raw.toLowerCase().startsWith('@ia ')
      ? raw.slice(raw.toLowerCase().indexOf('@ia ') + 4).trim()
      : raw.trim();
    if (!prompt) return;

    // Trouver le contenu de contenu.md pour la section active
    const fileInfo = this.findContenFile(this.sectionId!, this.files);
    if (!fileInfo) {
      this.addSystemMessage('⚠️ Impossible de trouver le fichier contenu.md pour cette section.');
      return;
    }

    const provider = this.configService.cliConfig().headerSelection?.provider || 'claude';
    if (provider.startsWith('gemini')) {
      this.addSystemMessage('⚠️ Gemini n\'est pas supporté pour la modification de fichiers. Sélectionnez un modèle Claude.');
      return;
    }
    const model = this.activeModel();

    // Contexte : document entier OU sous-sections selon l'option active
    let subSectionsContent: string | null = null;
    let fullDocumentContent: string | null = null;
    let systemInstructions: string | null;

    if (this.includeFullDocument()) {
      fullDocumentContent = this.collectAllSectionsContent(this.files);
      systemInstructions = this.buildSystemInstructions(null, fullDocumentContent, fileInfo.fileName);
    } else {
      subSectionsContent = this.collectSubSectionsContent(this.sectionId!, this.files);
      systemInstructions = this.buildSystemInstructions(subSectionsContent);
    }

    // Construire le prompt final (avec historique si option activée)
    let finalPrompt = prompt;
    if (this.includeHistory() && this.messages.length > 0) {
      const historyLines = this.messages
        .map(m => `${m.role === 'ai' ? 'IA' : m.user}: ${m.text.slice(0, 500)}`)
        .join('\n');
      finalPrompt = `[Historique de la conversation]\n${historyLines}\n\n[Demande actuelle]\n${prompt}`;
    }

    // Effacer uniquement l'input source utilisé
    if (messageOverride === undefined) {
      this.inputMessage = '';
    }

    // Message user dans la conversation
    const userMsg: Message = {
      user: 'Moi',
      userId: 'local',
      // Messages du popup sont toujours en mode IA
      text: (this.iaMode() || messageOverride !== undefined) ? `@ia ${prompt}` : raw,
      timestamp: new Date().toISOString(),
      role: 'user'
    };
    this.messages = [...this.messages, userMsg];
    this.convService.sendMessage(this.sectionId!, userMsg.text).subscribe();

    // Contexte du prompt pour le popup d'informations
    const promptCtx: PromptContext = {
      sectionName: fileInfo.fileName,
      sectionContent: fileInfo.content,
      subSectionsContent,
      fullDocumentContent,
      globalInstruction: this.globalIaInstruction(),
      projectInstruction: this.iaInstructions,
      userPrompt: prompt,
      model
    };

    // Placeholder IA
    const aiMsg: Message = {
      user: 'IA',
      userId: 'ai',
      text: '',
      timestamp: new Date().toISOString(),
      role: 'ai',
      promptContext: promptCtx
    };
    this.messages = [...this.messages, aiMsg];
    this.shouldScroll = true;

    const sub = this.aiEditService.chunk$.subscribe(chunk => {
      const updated = [...this.messages];
      const last = updated[updated.length - 1];
      if (last?.role === 'ai') updated[updated.length - 1] = { ...last, text: last.text + chunk };
      this.messages = updated;
      this.shouldScroll = true;
    });
    this.subs.add(sub);

    const doneSub = this.aiEditService.done$.subscribe(finalText => {
      sub.unsubscribe();
      doneSub.unsubscribe();
      const tokens = this.aiEditService.tokenInfo();
      if (tokens) {
        const updated = [...this.messages];
        const last = updated[updated.length - 1];
        if (last?.role === 'ai') updated[updated.length - 1] = { ...last, tokenInfo: tokens };
        this.messages = updated;
      }
      if (finalText && this.sectionId) {
        this.convService.saveAiMessage(this.sectionId, finalText).subscribe();
        this.conversationAdded.emit(this.sectionId);
      }
    });
    this.subs.add(doneSub);

    const errSub = this.aiEditService.error$.subscribe(errMsg => {
      sub.unsubscribe();
      errSub.unsubscribe();
      const updated = [...this.messages];
      const last = updated[updated.length - 1];
      if (last?.role === 'ai') updated[updated.length - 1] = { ...last, text: `⚠️ Erreur : ${errMsg}` };
      this.messages = updated;
    });
    this.subs.add(errSub);

    this.aiEditService.startEdit(
      this.sectionId!,
      fileInfo.fileId,
      fileInfo.content,
      finalPrompt,
      fileInfo.fileName,
      provider,
      model,
      systemInstructions
    );
  }

  private addSystemMessage(text: string) {
    const msg: Message = { user: 'Système', userId: 'system', text, timestamp: new Date().toISOString(), role: 'ai' };
    this.messages = [...this.messages, msg];
  }

  private findFolder(folderId: string, nodes: FileNode[]): FileNode | null {
    for (const node of nodes) {
      if (node.type === 'folder' && node.id === folderId) return node;
      if (node.children) {
        const found = this.findFolder(folderId, node.children);
        if (found) return found;
      }
    }
    return null;
  }

  private collectSubSectionsContent(sectionId: string, nodes: FileNode[]): string | null {
    const folder = this.findFolder(sectionId, nodes);
    if (!folder) return null;
    const subFolders = (folder.children || []).filter(c => c.type === 'folder');
    if (subFolders.length === 0) return null;
    const parts: string[] = [];
    for (const sub of subFolders) {
      const content = this.collectFolderContent(sub);
      if (content) parts.push(`## ${sub.name}\n\n${content}`);
    }
    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  private collectFolderContent(node: FileNode): string {
    const parts: string[] = [];
    const contenu = (node.children || []).find(c => c.type === 'file' && c.name === 'contenu.md');
    if (contenu?.content) parts.push(contenu.content);
    for (const sub of (node.children || []).filter(c => c.type === 'folder')) {
      const subContent = this.collectFolderContent(sub);
      if (subContent) parts.push(`### ${sub.name}\n\n${subContent}`);
    }
    return parts.join('\n\n');
  }

  private collectAllSectionsContent(nodes: FileNode[]): string {
    const parts: string[] = [];
    for (const node of nodes) {
      if (node.type === 'folder') {
        const content = this.collectFolderContent(node);
        if (content) parts.push(`# ${node.name}\n\n${content}`);
      }
    }
    return parts.join('\n\n---\n\n');
  }

  private findContenFile(sectionId: string, nodes: FileNode[]): { fileId: string; content: string; fileName: string } | null {
    for (const node of nodes) {
      if (node.type === 'folder' && node.id === sectionId) {
        const contenu = (node.children || []).find(c => c.type === 'file' && c.name === 'contenu.md');
        if (contenu) return { fileId: contenu.id, content: contenu.content ?? '', fileName: node.name };
      }
      if (node.children) {
        const found = this.findContenFile(sectionId, node.children);
        if (found) return found;
      }
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ── Conversation lancée depuis un MO Prompt (Normal/Guidé/Tchat/Tchat libre) ────────────
  // Remplace les 4 anciens popups : tout se passe désormais dans ce fil de conversation,
  // avec l'IA/modèle déjà sélectionnés ci-dessus (activeProvider/activeModel), sans sélecteur
  // dédié. Les 4 modes ne diffèrent que par la composition du system prompt (composeSystemPrompt)
  // et par la phase de cadrage préalable du mode Guidé — après quoi tout redevient un chat libre.
  // ══════════════════════════════════════════════════════════════════════════════════════

  private startPromptLaunch(ctx: PromptLaunchContext) {
    if (ctx.token === this.lastPromptLaunchToken) return;
    this.lastPromptLaunchToken = ctx.token;
    this.activePromptLaunch = ctx;
    this.promptVarValues = {};
    if (ctx.variables.length > 0) {
      this.awaitingPromptVars.set(ctx);
      return;
    }
    this.beginPromptConversation(ctx, ctx.userPrompt);
  }

  continuePromptWithVars() {
    const ctx = this.awaitingPromptVars();
    if (!ctx) return;
    let resolved = ctx.userPrompt;
    for (const [k, v] of Object.entries(this.promptVarValues)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
    this.awaitingPromptVars.set(null);
    this.beginPromptConversation(ctx, resolved);
  }

  cancelPromptVars() {
    this.awaitingPromptVars.set(null);
    this.activePromptLaunch = null;
  }

  private async beginPromptConversation(ctx: PromptLaunchContext, resolvedPrompt: string) {
    if (!this.promptGlobalConfig) {
      try {
        this.promptGlobalConfig = await this.megaSvc.getPromptGlobalConfig();
      } catch {
        this.promptGlobalConfig = { baseSystemPrompt: '', workflowClarifyPrompt: '', workflowGeneratePrompt: '', chatStructuredPrompt: '' };
      }
    }
    this.appendPromptMessage(ctx, 'user', resolvedPrompt, {});
    if (ctx.mode === 'guided') {
      this.sendPromptTurn(ctx, resolvedPrompt, 'clarify');
    } else {
      this.sendPromptTurn(ctx, this.buildPromptTranscriptText(ctx.instanceId), 'chat');
    }
  }

  /** Poursuite d'une conversation Prompt déjà lancée, depuis le composeur principal. */
  continuePromptConversation() {
    const ctx = this.activePromptLaunch;
    if (!ctx || !this.inputMessage.trim() || this.isBusy) return;
    const text = this.inputMessage.trim();
    this.inputMessage = '';
    this.appendPromptMessage(ctx, 'user', text, {});
    this.sendPromptTurn(ctx, this.buildPromptTranscriptText(ctx.instanceId), 'chat');
  }

  /** Termine la conversation Prompt active : les messages tapés redeviennent du chat normal. */
  endPromptConversation() {
    this.activePromptLaunch = null;
  }

  private buildPromptTranscriptText(instanceId: string): string {
    return this.messages
      .filter(m => m.promptInstanceId === instanceId)
      .map(m => `[${m.role === 'user' ? 'UTILISATEUR' : 'IA'}] : ${m.text}`)
      .join('\n\n');
  }

  private buildGenerateUserPrompt(ctx: PromptLaunchContext): string {
    const transcript = this.buildPromptTranscriptText(ctx.instanceId);
    return ctx.currentState.trim() ? `${transcript}\n\n[État actuel du projet]\n${ctx.currentState.trim()}` : transcript;
  }

  private sendPromptTurn(ctx: PromptLaunchContext, userPromptForAi: string, phase: 'clarify' | 'generate' | 'chat') {
    if (!this.promptGlobalConfig) return;
    let systemPrompt = composeSystemPrompt({
      mode: ctx.mode,
      fenceSystemPrompt: ctx.systemPrompt,
      globalConfig: this.promptGlobalConfig,
      useConfigPrompts: true,
      phase: ctx.mode === 'guided' ? (phase === 'generate' ? 'generate' : 'clarify') : undefined,
    });
    if (phase === 'generate') {
      const headingInstruction = promptDeliverableHeadingInstruction(ctx.startHeadingLevel);
      systemPrompt = [systemPrompt, headingInstruction].filter(Boolean).join('\n\n---\n\n') || null;
    }
    this.currentPromptPhase = phase;
    this.promptSending.set(true);
    this.promptStreamingText.set('');
    this.execSvc.startExecution(systemPrompt, userPromptForAi, this.activeProvider(), this.activeModel());
  }

  private onPromptTurnDone(full: string) {
    this.promptSending.set(false);
    this.promptStreamingText.set('');
    const ctx = this.activePromptLaunch;
    if (!ctx) return;
    const text = full.trim();

    if (ctx.mode === 'guided' && this.currentPromptPhase === 'clarify') {
      if (/===\s*PR[ÊE]T\s*===/i.test(text)) {
        this.sendPromptTurn(ctx, this.buildGenerateUserPrompt(ctx), 'generate');
        return;
      }
      const wave = this.nextCadrageWave(ctx.instanceId);
      const questions = parseChoiceForm(text);
      if (questions.length > 0) {
        this.appendPromptMessage(ctx, 'ai', text, { cadrageWave: wave, isCadrageForm: true });
      } else {
        // Pas de formulaire exploitable : ce n'est pas une erreur, on enchaîne sur la génération.
        this.appendPromptMessage(ctx, 'ai', text, { cadrageWave: wave });
        this.sendPromptTurn(ctx, this.buildGenerateUserPrompt(ctx), 'generate');
      }
      return;
    }

    // Génération (Guidé) ou tour de chat normal (Normal/Tchat/Tchat libre/Guidé post-cadrage)
    const mos = detectMoFences(text);
    this.appendPromptMessage(ctx, 'ai', text, { mos: mos.length ? mos : undefined });
    this.megaSvc.savePromptExecution(ctx.instanceId, {
      userPrompt: ctx.userPrompt,
      systemPrompt: ctx.systemPrompt,
      result: text,
      provider: this.activeProvider(),
      model: this.activeModel(),
    }).catch(() => {});
  }

  private onPromptTurnError(errMsg: string) {
    this.promptSending.set(false);
    this.promptStreamingText.set('');
    const ctx = this.activePromptLaunch;
    if (!ctx) return;
    this.appendPromptMessage(ctx, 'ai', `⚠️ Erreur : ${errMsg}`, {});
  }

  private nextCadrageWave(instanceId: string): number {
    return this.messages.filter(m => m.promptInstanceId === instanceId && m.isCadrageForm).length + 1;
  }

  private appendPromptMessage(ctx: PromptLaunchContext, role: 'user' | 'ai', text: string, extra: Partial<Message>) {
    if (!this.sectionId) return;
    const msg = {
      ...extra,
      user: role === 'ai' ? 'IA' : 'Moi',
      userId: role === 'ai' ? 'ai' : 'local',
      text,
      timestamp: new Date().toISOString(),
      role,
      promptInstanceId: ctx.instanceId,
      promptInstanceName: ctx.instanceName,
      mode: ctx.mode,
    };
    this.messages = [...this.messages, msg];
    this.shouldScroll = true;
    this.convService.appendMessage(this.sectionId, msg).subscribe();
    this.conversationAdded.emit(this.sectionId);
  }

  /** Dernier message IA du fil, s'il porte un formulaire exploitable (cadrage Guidé, ou fence/texte
   *  FORM en mode Tchat/Tchat libre/Normal) — même logique que l'ancien popup Tchat, unifiée ici. */
  activeForm(): { message: Message; questions: FormQuestion[] } | null {
    const msgs = this.messages;
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'ai' || !last.promptInstanceId) return null;
    if (this.formDismissedMessageKey === last.timestamp) return null;
    const formMo = last.mos?.find(mo => mo.type === 'form');
    const questions = formMo ? parseChoiceForm(fenceBody(formMo.fence)) : parseChoiceForm(last.text);
    return questions.length > 0 ? { message: last, questions } : null;
  }

  onFormSubmitted(entry: FormEntry) {
    const active = this.activeForm();
    if (!active) return;
    this.formDismissedMessageKey = active.message.timestamp;
    if (active.message.isCadrageForm) {
      this.onCadrageFormSubmitted(active.message, entry);
    } else {
      // Mode Tchat/Tchat libre/Normal : pré-remplit le composeur pour relecture, pas d'envoi auto.
      this.inputMessage = Object.entries(entry.answers)
        .map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(' ; ') : v}`)
        .join('\n');
    }
  }

  onFormSecondary(entry: FormEntry) {
    const active = this.activeForm();
    if (!active || !active.message.isCadrageForm) return;
    this.formDismissedMessageKey = active.message.timestamp;
    this.onForceGenerateFromCadrage(entry);
  }

  dismissForm() {
    const active = this.activeForm();
    if (active) this.formDismissedMessageKey = active.message.timestamp;
  }

  private onCadrageFormSubmitted(msg: Message, entry: FormEntry) {
    const ctx = this.activePromptLaunch;
    if (!ctx || ctx.instanceId !== msg.promptInstanceId) return;
    const answersText = Object.entries(entry.answers)
      .map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(' ; ') : v}`)
      .join('\n');
    this.appendPromptMessage(ctx, 'user', answersText, {});
    const waveCount = this.messages.filter(m => m.promptInstanceId === ctx.instanceId && m.isCadrageForm).length;
    if (waveCount >= MAX_CADRAGE_WAVES) {
      this.sendPromptTurn(ctx, this.buildGenerateUserPrompt(ctx), 'generate');
    } else {
      this.sendPromptTurn(ctx, this.buildPromptTranscriptText(ctx.instanceId), 'clarify');
    }
  }

  private onForceGenerateFromCadrage(entry?: FormEntry) {
    const ctx = this.activePromptLaunch;
    if (!ctx) return;
    if (entry && Object.keys(entry.answers || {}).length > 0) {
      const answersText = Object.entries(entry.answers)
        .map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(' ; ') : v}`)
        .join('\n');
      this.appendPromptMessage(ctx, 'user', answersText, {});
    }
    this.sendPromptTurn(ctx, this.buildGenerateUserPrompt(ctx), 'generate');
  }

  toggleMo(msg: Message, moIndex: number, checked: boolean) {
    if (!msg.mos) return;
    const updatedMos = msg.mos.map((mo, i) => i === moIndex ? { ...mo, selected: checked } : mo);
    this.messages = this.messages.map(m => m === msg ? { ...m, mos: updatedMos } : m);
  }

  /** Émet la matérialisation des MO cochés pour ce message — relayée par le parent vers la
   *  zone d'édition (Trello/Array réels, Agenda réel, livrable inséré dans la section). */
  materializeMo(msg: Message) {
    const selected = msg.mos?.filter(mo => mo.selected) ?? [];
    if (!selected.length || !msg.promptInstanceId) return;
    this.materializeRequested.emit({ promptInstanceId: msg.promptInstanceId, deliverable: msg.text, selectedMos: selected });
    this.messages = this.messages.map(m => m === msg ? { ...m, mos: undefined } : m);
  }

  /** "Copier vers l'édition" sur un message IA d'une conversation Prompt. */
  copyMessageToImport(msg: Message) {
    if (!msg.text.trim() || !this.sectionId) return;
    this.copyToEditionRequested.emit({ text: msg.text, sectionId: this.sectionId });
  }

  chartPointsFor(mo: MaterializedMoPreview) {
    return parseChartPoints(fenceBody(mo.fence));
  }

  /** Rendu markdown d'un message IA d'une conversation Prompt — les fences MO déjà extraites
   *  (carte "MegaOutils détectés") sont retirées du texte pour ne pas apparaître deux fois. */
  renderedHtml(msg: Message): SafeHtml {
    let text = msg.text;
    for (const mo of msg.mos ?? []) text = text.replace(mo.fence, '');
    text = text.replace(/^[ \t]*_{5,}[ \t]*$/gm, '');
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    const html = marked.parse(text, { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  renderedPromptStreamingHtml(): SafeHtml {
    const html = marked.parse(this.promptStreamingText().replace(/^[ \t]*_{5,}[ \t]*$/gm, ''), { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
