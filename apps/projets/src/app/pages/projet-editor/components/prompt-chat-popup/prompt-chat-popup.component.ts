import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { Subscription, interval } from 'rxjs';
import {
  ConfigService, AiExecuteService, AiLogItem, FormQuestion, FormEntry, MaterializedMoPreview,
  detectMoFences, parseChoiceForm, fenceBody, parseChartPoints, MegaOutilsService,
} from '@worganic/portail-core/data-access';
import { ChartBoardComponent } from '@worganic/shared/ui';
import { FormExecutionPopupComponent } from '../form-execution-popup/form-execution-popup.component';

type ChatState = 'idle' | 'variable-fill' | 'chatting';
interface ChatMessage { role: 'user' | 'ai' | 'error'; text: string; mos?: MaterializedMoPreview[]; }

@Component({
  selector: 'app-prompt-chat-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartBoardComponent, FormExecutionPopupComponent],
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
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60"></div>

      <div class="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-emerald-500/20 bg-light-surface dark:bg-surface shadow-2xl overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 border-b border-emerald-500/15 bg-emerald-500/5 flex-shrink-0">
          <span class="material-symbols-outlined text-emerald-400">forum</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-semibold text-light-text dark:text-white">{{ instanceName }}</h2>
            <p class="text-[11px] text-light-text-muted dark:text-white/40">Mode tchat · {{ phaseLabel() }}</p>
          </div>
          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-muted dark:text-white/40 hover:text-light-text dark:hover:text-white hover:bg-light-border dark:hover:bg-white/5 transition-colors"
                  (click)="cancel.emit()">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <!-- Corps -->
        <div class="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          <!-- Sélecteur IA/Modèle (idle) -->
          @if (state() === 'idle') {
            @if (resumableSession(); as rs) {
              <div class="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <span class="material-symbols-outlined text-emerald-400 text-base">history</span>
                <span class="flex-1 text-[12px] text-light-text dark:text-white/75">Une conversation précédente est disponible ({{ formatSessionDate(rs.updatedAt) }}).</span>
                @if (confirmDeleteHistory()) {
                  <button class="text-[11px] px-2 py-1 rounded-md bg-red-500/20 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/30 transition-colors"
                          [disabled]="deletingHistory()"
                          (click)="deleteHistory()">{{ deletingHistory() ? 'Suppression…' : 'Confirmer' }}</button>
                  <button class="text-[11px] px-2 py-1 rounded-md border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/40 hover:text-light-text dark:hover:text-white transition-colors"
                          (click)="confirmDeleteHistory.set(false)">Annuler</button>
                } @else {
                  <button class="w-7 h-7 flex items-center justify-center rounded-md text-light-text-muted dark:text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                          title="Effacer l'historique de conversation"
                          (click)="confirmDeleteHistory.set(true)">
                    <span class="material-symbols-outlined text-base">delete</span>
                  </button>
                  <button class="text-[11px] px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/30 transition-colors"
                          (click)="resumeSession(rs.id)">Reprendre</button>
                }
              </div>
            }
            @if (providers().length === 0) {
              <div class="flex items-center gap-2 rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background px-3 py-2.5 text-[12px] text-light-text-muted dark:text-white/40">
                <span class="material-symbols-outlined text-base animate-spin">progress_activity</span>
                En attente de la liste des IA disponibles…
              </div>
            } @else {
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">IA</label>
                  <select class="w-full rounded-lg border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 text-sm px-3 py-2 dark:[color-scheme:dark]"
                          [ngModel]="selectedProvider()" (ngModelChange)="onProviderChange($event)">
                    @for (p of providers(); track p.value) { <option [value]="p.value">{{ p.label }}</option> }
                  </select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">Modèle</label>
                  <select class="w-full rounded-lg border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 text-sm px-3 py-2 dark:[color-scheme:dark]"
                          [ngModel]="activeModel()" (ngModelChange)="selectedModel.set($event)">
                    @for (m of modelsForProvider(); track m.value) { <option [value]="m.value">{{ m.label || m.value }}</option> }
                  </select>
                </div>
              </div>
            }
            <label class="flex items-center gap-2 text-[11px] text-light-text-muted dark:text-white/50 cursor-pointer select-none w-fit"
                   title="Désactive l'injection du prompt de base global et du format structuré du tchat configurés en admin — seul le SYSTEM: propre à cette section reste appliqué">
              <input type="checkbox" class="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                     [ngModel]="useConfigPrompts()" (ngModelChange)="useConfigPrompts.set($event)" />
              Utiliser les prompts de configuration (base + format structuré tchat)
            </label>
            <div class="flex flex-col gap-1.5">
              <span class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">Premier message</span>
              <div class="rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background p-3">
                <p class="text-[13px] text-light-text dark:text-white/75 whitespace-pre-wrap">{{ userPrompt }}</p>
              </div>
              <p class="text-[11px] text-light-text-muted dark:text-white/40">Ce message part dès le démarrage du tchat. Tu pourras ensuite discuter librement avec l'IA.</p>
            </div>
          }

          <!-- Variables -->
          @if (state() === 'variable-fill') {
            <div class="flex flex-col gap-3 p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <p class="text-[11px] font-medium text-emerald-400 uppercase tracking-wide">Variables à remplir</p>
              @for (varName of variables; track varName) {
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-light-text-muted dark:text-white/50">{{ '{{' + varName + '}}' }}</label>
                  <input type="text"
                         class="w-full rounded-md border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 text-sm px-3 py-1.5"
                         [placeholder]="'Valeur pour ' + varName"
                         [ngModel]="varValues[varName] || ''"
                         (ngModelChange)="varValues[varName] = $event" />
                </div>
              }
            </div>
          }

          <!-- Conversation -->
          @if (state() === 'chatting') {
            <div class="flex flex-col gap-3">
              @for (m of messages(); track $index; let mi = $index) {
                @if (m.role === 'user') {
                  <div class="self-end max-w-[85%] rounded-lg rounded-tr-sm border border-light-border dark:border-white/10 bg-light-background dark:bg-background px-3 py-2">
                    <p class="text-[13px] text-light-text dark:text-white/80 whitespace-pre-wrap">{{ m.text }}</p>
                  </div>
                } @else if (m.role === 'ai') {
                  <div class="self-start max-w-[85%] flex flex-col gap-1.5">
                    <div class="rounded-lg rounded-tl-sm border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                      <div class="chat-md text-[13px] text-light-text dark:text-white/80" [innerHTML]="renderedHtml(m)"></div>
                    </div>
                    @if (m.mos && m.mos.length > 0) {
                      <div class="rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background p-2.5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-medium text-light-text-muted dark:text-white/40 uppercase tracking-wide">MegaOutils détectés</span>
                        @for (mo of m.mos; track $index; let moi = $index) {
                          <label class="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-light-border dark:hover:bg-white/5 cursor-pointer">
                            <input type="checkbox" class="w-3.5 h-3.5 accent-emerald-500 cursor-pointer flex-shrink-0"
                                   [checked]="mo.selected" (change)="toggleMo(mi, moi, $any($event.target).checked)" />
                            <span class="material-symbols-outlined text-[14px] flex-shrink-0"
                                  [ngClass]="mo.type === 'trello' ? 'text-emerald-400' : (mo.type === 'array' ? 'text-sky-400' : (mo.type === 'chart' ? 'text-indigo-400' : (mo.type === 'agenda' ? 'text-amber-400' : 'text-blue-400')))">
                              {{ mo.type === 'trello' ? 'view_kanban' : (mo.type === 'array' ? 'table' : (mo.type === 'chart' ? 'show_chart' : (mo.type === 'agenda' ? 'calendar_month' : 'assignment'))) }}
                            </span>
                            <span class="text-[12px] text-light-text dark:text-white/80 flex-1 truncate">{{ mo.name }}</span>
                            <span class="text-[10px] text-light-text-muted dark:text-white/40">{{ mo.summary }}</span>
                          </label>
                          @if (mo.type === 'chart' && mo.selected) {
                            <app-chart-board [title]="mo.name" [points]="chartPointsFor(mo)" />
                          }
                        }
                        <button class="self-start text-[11px] px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/25 transition-colors"
                                (click)="materializeMo(mi)">Ajouter au projet</button>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="self-start max-w-[85%] rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2">
                    <p class="text-[12px] text-red-400 whitespace-pre-wrap">⚠ {{ m.text }}</p>
                  </div>
                }
              }
              @if (sending()) {
                <div class="self-start max-w-[85%] rounded-lg rounded-tl-sm border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex flex-col gap-1">
                  <span class="flex items-center gap-1 text-[11px] text-emerald-400">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    L'IA écrit… {{ elapsedSeconds() }}s
                  </span>
                  @if (streamingText()) {
                    <div class="chat-md text-[13px] text-light-text dark:text-white/80" [innerHTML]="renderedStreamingHtml()"></div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="flex items-center gap-2 px-5 py-4 border-t border-light-border dark:border-white/8 flex-shrink-0">
          @if (state() === 'idle') {
            <span class="flex-1"></span>
            <button class="text-sm px-4 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                    (click)="cancel.emit()">Annuler</button>
            <button class="text-sm px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/25 transition-colors flex items-center gap-1.5"
                    (click)="start()">
              <span class="material-symbols-outlined text-base">play_arrow</span>Démarrer le tchat
            </button>
          }
          @if (state() === 'variable-fill') {
            <span class="flex-1"></span>
            <button class="text-sm px-4 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                    (click)="state.set('idle')">Retour</button>
            <button class="text-sm px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/25 transition-colors"
                    (click)="continueWithVars()">Continuer</button>
          }
          @if (state() === 'chatting') {
            <div class="flex flex-col gap-2 w-full">
              <div class="flex items-center gap-2">
                <button class="text-sm px-3 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                        [disabled]="!lastAiMessage()"
                        (click)="copyLastToImport()">
                  <span class="material-symbols-outlined text-base">{{ copied() ? 'check' : 'content_paste_go' }}</span>
                  {{ copied() ? 'Envoyé !' : 'Copier la dernière réponse → Coller en édition' }}
                </button>
                <span class="flex-1"></span>
                <button class="text-sm px-3 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                        (click)="cancel.emit()">Fermer</button>
              </div>
              <div class="flex items-end gap-2">
                <textarea class="flex-1 resize-none rounded-lg border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 text-sm px-3 py-2 outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
                          rows="2"
                          placeholder="Répondre à l'IA…"
                          [disabled]="sending()"
                          [(ngModel)]="composerText"
                          (keydown.enter)="onComposerEnter($event)"></textarea>
                <button class="text-sm px-4 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        [disabled]="sending() || !composerText.trim()"
                        (click)="sendMessage()">Envoyer</button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    @if (activeForm(); as af) {
      <app-form-execution-popup
        [formName]="'Répondre au formulaire'"
        [questions]="af.questions"
        [userName]="userName"
        (submitted)="onChatFormSubmitted($event)"
        (cancel)="dismissForm()" />
    }
  `,
})
export class PromptChatPopupComponent implements OnInit, OnDestroy {
  @Input() instanceId = '';
  @Input() instanceName = 'Prompt';
  @Input() baseSystemPrompt: string | null = null;
  @Input() systemPrompt: string | null = null;
  @Input() chatStructuredPrompt: string | null = null;
  @Input() userPrompt = '';
  @Input() variables: string[] = [];
  @Input() userName = '';

  @Output() insertAsSection = new EventEmitter<string>();
  @Output() materialize = new EventEmitter<{ deliverable: string; selectedMos: MaterializedMoPreview[] }>();
  @Output() cancel = new EventEmitter<void>();

  readonly execSvc = inject(AiExecuteService);
  private configSvc = inject(ConfigService);
  private sanitizer = inject(DomSanitizer);
  private megaSvc = inject(MegaOutilsService);

  /** Session BDD de la conversation en cours (mega_outil_prompt_chat_sessions), créée
   *  au premier message envoyé. Persistance best-effort, fire-and-forget (ne bloque
   *  jamais l'UI ; en cas d'échec la conversation continue normalement en mémoire). */
  private currentSessionId: string | null = null;
  private nextSeq = 0;
  resumableSession = signal<{ id: string; provider: string; model: string | null; createdAt: string; updatedAt: string } | null>(null);
  confirmDeleteHistory = signal(false);
  deletingHistory = signal(false);

  state = signal<ChatState>('idle');
  selectedProvider = signal('');
  selectedModel = signal('');
  messages = signal<ChatMessage[]>([]);
  composerText = '';
  streamingText = signal('');
  sending = signal(false);
  elapsedSeconds = signal(0);
  copied = signal(false);
  varValues: Record<string, string> = {};
  /** Si désactivé, ignore le prompt de base global + le format structuré du tchat configurés
   *  en admin — ne garde que le SYSTEM: propre à cette section. */
  useConfigPrompts = signal(true);

  private timerSub: Subscription | null = null;
  private subs: Subscription[] = [];

  private readonly providerLabels: Record<string, string> = { claude: 'Claude', antigravity: 'AGY (Gemini)' };

  readonly allModels = computed(() => {
    const cfg = this.configSvc.cliConfig();
    const claude = (cfg.modelsList?.claude || []).map((m: any) => ({ ...m, provider: 'claude' }));
    const antigravity = (cfg.modelsList?.antigravity || []).map((m: any) => ({ ...m, provider: 'antigravity' }));
    return [...claude, ...antigravity];
  });
  readonly providers = computed(() => {
    const seen = new Set<string>(); const result: { value: string; label: string }[] = [];
    for (const m of this.allModels()) {
      if (!seen.has(m.provider)) { seen.add(m.provider); result.push({ value: m.provider, label: this.providerLabels[m.provider] || m.provider }); }
    }
    return result;
  });
  readonly modelsForProvider = computed(() => this.allModels().filter(m => m.provider === this.selectedProvider()));
  readonly activeModel = computed(() => {
    const m = this.selectedModel(); const avail = this.modelsForProvider();
    if (m && avail.some(x => x.value === m)) return m;
    return avail[0]?.value || '';
  });
  readonly activeProvider = computed(() => this.selectedProvider() || 'claude');

  readonly lastAiMessage = computed(() => {
    const msgs = this.messages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'ai') return msgs[i];
    }
    return null;
  });

  /** Index (dans messages()) du dernier formulaire fermé sans réponse, pour ne pas
   *  le rouvrir tant qu'un nouveau message IA n'est pas arrivé. */
  formDismissedIndex = signal<number | null>(null);

  /** Formulaire à proposer en overlay : uniquement sur le DERNIER message IA, détecté
   *  soit via une fence ```FORM:```, soit directement dans le texte libre (cas non fenser,
   *  ex. questions ouvertes du type "Label" + "_____"). */
  readonly activeForm = computed<{ msgIndex: number; questions: FormQuestion[] } | null>(() => {
    const msgs = this.messages();
    const lastIdx = msgs.length - 1;
    if (lastIdx < 0 || msgs[lastIdx].role !== 'ai') return null;
    if (this.formDismissedIndex() === lastIdx) return null;
    const m = msgs[lastIdx];
    const formMo = m.mos?.find(mo => mo.type === 'form');
    const questions = formMo ? parseChoiceForm(fenceBody(formMo.fence)) : parseChoiceForm(m.text);
    return questions.length > 0 ? { msgIndex: lastIdx, questions } : null;
  });

  phaseLabel = computed(() => ({
    idle: 'prêt', 'variable-fill': 'variables', chatting: 'en discussion',
  } as Record<ChatState, string>)[this.state()]);

  onProviderChange(provider: string) {
    this.selectedProvider.set(provider);
    this.selectedModel.set(this.allModels().find(m => m.provider === provider)?.value || '');
  }

  ngOnInit() {
    const cfg = this.configSvc.cliConfig();
    const currentModel = cfg.headerSelection?.model || '';
    this.selectedModel.set(currentModel);
    this.selectedProvider.set(this.allModels().find(m => m.value === currentModel)?.provider || this.providers()[0]?.value || 'claude');

    this.subs.push(
      this.execSvc.chunk$.subscribe(c => this.streamingText.update(v => v + c)),
      this.execSvc.done$.subscribe(full => this.onTurnDone(full)),
      this.execSvc.error$.subscribe(err => this.onTurnError(err)),
    );

    if (this.instanceId) {
      this.megaSvc.getChatSessions(this.instanceId)
        .then(sessions => { if (sessions.length > 0) this.resumableSession.set(sessions[0]); })
        .catch(() => {});
    }
  }

  ngOnDestroy() {
    this.stopTimer();
    this.subs.forEach(s => s.unsubscribe());
    this.execSvc.cancel();
  }

  start() {
    if (this.variables.length > 0) {
      this.state.set('variable-fill');
      return;
    }
    this.launch(this.userPrompt);
  }

  continueWithVars() {
    let resolved = this.userPrompt;
    for (const [k, v] of Object.entries(this.varValues)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
    this.launch(resolved);
  }

  private launch(resolvedFirstPrompt: string) {
    this.messages.set([{ role: 'user', text: resolvedFirstPrompt }]);
    this.state.set('chatting');
    this.nextSeq = 0;
    if (this.instanceId) {
      this.megaSvc.createChatSession(this.instanceId, this.activeProvider(), this.activeModel() || null)
        .then(res => {
          this.currentSessionId = res.id;
          this.persistMessage('user', resolvedFirstPrompt);
        })
        .catch(() => {});
    }
    this.sendTurn(resolvedFirstPrompt);
  }

  /** Persistance best-effort d'un message (fire-and-forget, échec silencieux — la
   *  conversation reste utilisable même si l'écriture BDD échoue). */
  private persistMessage(role: 'user' | 'ai', text: string) {
    if (!this.currentSessionId) return;
    this.megaSvc.appendChatMessage(this.currentSessionId, role, text, this.nextSeq++).catch(() => {});
  }

  /** Reprend une conversation précédente : recharge les messages et redétecte les MO
   *  des réponses IA (non persistés séparément, recalculés à l'identique depuis le texte). */
  resumeSession(sessionId: string) {
    this.megaSvc.getChatSessionMessages(sessionId).then(rows => {
      this.currentSessionId = sessionId;
      this.nextSeq = rows.length;
      this.messages.set(rows.map(r => {
        if (r.role === 'ai') {
          const mos = detectMoFences(r.text);
          return { role: 'ai' as const, text: r.text, mos: mos.length ? mos : undefined };
        }
        return { role: r.role as 'user' | 'error', text: r.text };
      }));
      this.state.set('chatting');
    }).catch(() => {});
  }

  /** Efface définitivement tout l'historique de tchat (toutes les sessions + messages)
   *  de cette instance Prompt — fait disparaître la bannière "Reprendre". */
  deleteHistory() {
    if (!this.instanceId || this.deletingHistory()) return;
    this.deletingHistory.set(true);
    this.megaSvc.deleteChatHistory(this.instanceId)
      .then(() => { this.resumableSession.set(null); })
      .catch(() => {})
      .finally(() => { this.deletingHistory.set(false); this.confirmDeleteHistory.set(false); });
  }

  formatSessionDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  onComposerEnter(ev: Event) {
    const kev = ev as KeyboardEvent;
    if (kev.shiftKey) return;
    kev.preventDefault();
    this.sendMessage();
  }

  sendMessage() {
    const text = this.composerText.trim();
    if (!text || this.sending()) return;
    this.composerText = '';
    this.messages.update(v => [...v, { role: 'user', text }]);
    this.persistMessage('user', text);
    this.sendTurn(this.buildTranscriptText());
  }

  /** Envoie tout l'historique reconstruit en un seul prompt (le CLI est relancé à froid à
   *  chaque tour) — même pattern que PromptWorkflowPopupComponent.buildGenerateUser(). */
  private sendTurn(fullTranscriptOrFirst: string) {
    this.streamingText.set('');
    this.elapsedSeconds.set(0);
    this.sending.set(true);
    this.startTimer();
    const effectiveSystem = this.useConfigPrompts()
      ? ([this.baseSystemPrompt, this.systemPrompt, this.chatStructuredPrompt].filter(Boolean).join('\n\n---\n\n') || null)
      : (this.systemPrompt || null);
    this.execSvc.startExecution(effectiveSystem, fullTranscriptOrFirst, this.activeProvider(), this.activeModel());
  }

  private buildTranscriptText(): string {
    return this.messages()
      .filter(m => m.role !== 'error')
      .map(m => `[${m.role === 'user' ? 'UTILISATEUR' : 'IA'}] : ${m.text}`)
      .join('\n\n');
  }

  private onTurnDone(full: string) {
    this.stopTimer();
    this.sending.set(false);
    this.streamingText.set('');
    const text = full.trim();
    const mos = detectMoFences(text);
    this.messages.update(v => [...v, { role: 'ai', text, mos: mos.length ? mos : undefined }]);
    this.persistMessage('ai', text);
  }

  private onTurnError(err: string) {
    this.stopTimer();
    this.sending.set(false);
    this.streamingText.set('');
    this.messages.update(v => [...v, { role: 'error', text: err || 'Erreur inconnue' }]);
  }

  copyLastToImport() {
    const last = this.lastAiMessage();
    if (!last) return;
    this.insertAsSection.emit(last.text);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }

  /** Retire les lignes de 5+ underscores seules (marqueur "champ libre" du formulaire,
   *  voir parseChoiceForm) — sans ce nettoyage, marked() les interprète comme une
   *  ligne de séparation (thematic break) et affiche un trait parasite sous la question. */
  private stripFormBlankMarkers(text: string): string {
    return text.replace(/^[ \t]*_{5,}[ \t]*$/gm, '');
  }

  /** Rendu markdown d'un message IA — les fences MO déjà extraites (barre "MegaOutils
   *  détectés" sous la bulle) sont retirées du texte pour ne pas apparaître deux fois. */
  renderedHtml(m: ChatMessage): SafeHtml {
    let text = m.text;
    for (const mo of m.mos ?? []) text = text.replace(mo.fence, '');
    text = this.stripFormBlankMarkers(text);
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    const html = marked.parse(text, { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  renderedStreamingHtml(): SafeHtml {
    const html = marked.parse(this.stripFormBlankMarkers(this.streamingText()), { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  chartPointsFor(mo: MaterializedMoPreview) {
    return parseChartPoints(fenceBody(mo.fence));
  }

  toggleMo(msgIndex: number, moIndex: number, checked: boolean) {
    this.messages.update(list => list.map((m, i) => {
      if (i !== msgIndex || !m.mos) return m;
      return { ...m, mos: m.mos.map((mo, j) => j === moIndex ? { ...mo, selected: checked } : mo) };
    }));
  }

  /** Émet la matérialisation des MO cochés pour ce message, puis masque la barre
   *  (le tchat reste ouvert — contrairement au mode Guidé qui se ferme après validation). */
  materializeMo(msgIndex: number) {
    const m = this.messages()[msgIndex];
    const selected = m?.mos?.filter(mo => mo.selected) ?? [];
    if (!selected.length) return;
    this.materialize.emit({ deliverable: m.text, selectedMos: selected });
    this.messages.update(list => list.map((mm, i) => i === msgIndex ? { ...mm, mos: undefined } : mm));
  }

  /** Formulaire validé : pré-remplit le composer pour relecture (pas d'envoi automatique),
   *  l'utilisateur clique "Envoyer" lui-même. */
  onChatFormSubmitted(entry: FormEntry) {
    const active = this.activeForm();
    if (active) this.formDismissedIndex.set(active.msgIndex);
    this.composerText = Object.entries(entry.answers)
      .map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(' ; ') : v}`)
      .join('\n');
  }

  dismissForm() {
    const active = this.activeForm();
    if (active) this.formDismissedIndex.set(active.msgIndex);
  }

  private startTimer() {
    this.timerSub?.unsubscribe();
    this.timerSub = interval(1000).subscribe(() => this.elapsedSeconds.update(v => v + 1));
    this.subs.push(this.timerSub);
  }
  private stopTimer() {
    this.timerSub?.unsubscribe();
    this.timerSub = null;
  }
}
