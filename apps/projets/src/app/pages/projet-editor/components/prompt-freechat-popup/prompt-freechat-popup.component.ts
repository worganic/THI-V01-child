import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { ConfigService, AiExecuteService } from '@worganic/portail-core/data-access';

type FreeChatState = 'idle' | 'variable-fill' | 'chatting';
interface FreeChatMessage { role: 'user' | 'ai' | 'error'; text: string; }

/** Mode "Tchat libre" : conversation brute avec l'IA, sans prompts de configuration,
 *  sans détection de MegaOutils et sans rendu markdown → HTML (texte simple uniquement).
 *  Seule action de sortie : copier la dernière réponse vers le popup d'import de l'éditeur. */
@Component({
  selector: 'app-prompt-freechat-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60"></div>

      <div class="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-violet-500/20 bg-light-surface dark:bg-surface shadow-2xl overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 border-b border-violet-500/15 bg-violet-500/5 flex-shrink-0">
          <span class="material-symbols-outlined text-violet-400">chat</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-semibold text-light-text dark:text-white">{{ instanceName }}</h2>
            <p class="text-[11px] text-light-text-muted dark:text-white/40">Mode tchat libre · {{ phaseLabel() }}</p>
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
            <div class="flex flex-col gap-1.5">
              <span class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">Premier message</span>
              <div class="rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background p-3">
                <p class="text-[13px] text-light-text dark:text-white/75 whitespace-pre-wrap">{{ userPrompt }}</p>
              </div>
              <p class="text-[11px] text-light-text-muted dark:text-white/40">Conversation brute avec l'IA : pas de MegaOutils, pas de prompts de configuration, pas de mise en forme des réponses.</p>
            </div>
          }

          <!-- Variables -->
          @if (state() === 'variable-fill') {
            <div class="flex flex-col gap-3 p-4 rounded-lg border border-violet-500/20 bg-violet-500/5">
              <p class="text-[11px] font-medium text-violet-400 uppercase tracking-wide">Variables à remplir</p>
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

          <!-- Conversation (texte brut, sans rendu HTML) -->
          @if (state() === 'chatting') {
            <div class="flex flex-col gap-3">
              @for (m of messages(); track $index) {
                @if (m.role === 'user') {
                  <div class="self-end max-w-[85%] rounded-lg rounded-tr-sm border border-light-border dark:border-white/10 bg-light-background dark:bg-background px-3 py-2">
                    <p class="text-[13px] text-light-text dark:text-white/80 whitespace-pre-wrap">{{ m.text }}</p>
                  </div>
                } @else if (m.role === 'ai') {
                  <div class="self-start max-w-[85%] rounded-lg rounded-tl-sm border border-violet-500/20 bg-violet-500/5 px-3 py-2">
                    <p class="text-[13px] text-light-text dark:text-white/80 whitespace-pre-wrap">{{ m.text }}</p>
                  </div>
                } @else {
                  <div class="self-start max-w-[85%] rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2">
                    <p class="text-[12px] text-red-400 whitespace-pre-wrap">⚠ {{ m.text }}</p>
                  </div>
                }
              }
              @if (sending()) {
                <div class="self-start max-w-[85%] rounded-lg rounded-tl-sm border border-violet-500/20 bg-violet-500/5 px-3 py-2 flex flex-col gap-1">
                  <span class="flex items-center gap-1 text-[11px] text-violet-400">
                    <span class="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span>
                    L'IA écrit… {{ elapsedSeconds() }}s
                  </span>
                  @if (streamingText()) {
                    <p class="text-[13px] text-light-text dark:text-white/80 whitespace-pre-wrap">{{ streamingText() }}</p>
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
            <button class="text-sm px-4 py-2 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 font-semibold hover:bg-violet-500/25 transition-colors flex items-center gap-1.5"
                    (click)="start()">
              <span class="material-symbols-outlined text-base">play_arrow</span>Démarrer le tchat
            </button>
          }
          @if (state() === 'variable-fill') {
            <span class="flex-1"></span>
            <button class="text-sm px-4 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                    (click)="state.set('idle')">Retour</button>
            <button class="text-sm px-4 py-2 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 font-semibold hover:bg-violet-500/25 transition-colors"
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
                <textarea class="flex-1 resize-none rounded-lg border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 text-sm px-3 py-2 outline-none focus:border-violet-500 dark:focus:border-violet-400"
                          rows="2"
                          placeholder="Répondre à l'IA…"
                          [disabled]="sending()"
                          [(ngModel)]="composerText"
                          (keydown.enter)="onComposerEnter($event)"></textarea>
                <button class="text-sm px-4 py-2.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 font-semibold hover:bg-violet-500/25 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        [disabled]="sending() || !composerText.trim()"
                        (click)="sendMessage()">Envoyer</button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class PromptFreeChatPopupComponent implements OnInit, OnDestroy {
  @Input() instanceName = 'Prompt';
  @Input() systemPrompt: string | null = null;
  @Input() userPrompt = '';
  @Input() variables: string[] = [];

  @Output() insertAsSection = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  readonly execSvc = inject(AiExecuteService);
  private configSvc = inject(ConfigService);

  state = signal<FreeChatState>('idle');
  selectedProvider = signal('');
  selectedModel = signal('');
  messages = signal<FreeChatMessage[]>([]);
  composerText = '';
  streamingText = signal('');
  sending = signal(false);
  elapsedSeconds = signal(0);
  copied = signal(false);
  varValues: Record<string, string> = {};

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

  phaseLabel = computed(() => ({
    idle: 'prêt', 'variable-fill': 'variables', chatting: 'en discussion',
  } as Record<FreeChatState, string>)[this.state()]);

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
    this.sendTurn(resolvedFirstPrompt);
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
    this.sendTurn(this.buildTranscriptText());
  }

  /** Envoie tout l'historique reconstruit en un seul prompt (le CLI est relancé à froid à
   *  chaque tour) — seul le SYSTEM: propre à cette section est transmis, aucun prompt
   *  de configuration global n'est injecté en mode tchat libre. */
  private sendTurn(fullTranscriptOrFirst: string) {
    this.streamingText.set('');
    this.elapsedSeconds.set(0);
    this.sending.set(true);
    this.startTimer();
    this.execSvc.startExecution(this.systemPrompt || null, fullTranscriptOrFirst, this.activeProvider(), this.activeModel());
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
    this.messages.update(v => [...v, { role: 'ai', text: full.trim() }]);
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
