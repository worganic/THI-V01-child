import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { ConfigService, MegaOutilsService, AiExecuteService, AiLogItem } from '@worganic/portail-core/data-access';

type PopupState = 'idle' | 'variable-fill' | 'running' | 'validating' | 'done';

@Component({
  selector: 'app-prompt-execution-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Overlay -->
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60"></div>

      <div class="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-amber-500/20 bg-light-surface dark:bg-surface shadow-2xl overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 border-b border-amber-500/15 bg-amber-500/5 flex-shrink-0">
          <span class="material-symbols-outlined text-amber-400">smart_toy</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-semibold text-light-text dark:text-white">{{ instanceName }}</h2>
            <p class="text-[11px] text-light-text-muted dark:text-white/40">Exécution du prompt</p>
          </div>
          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-muted dark:text-white/40 hover:text-light-text dark:hover:text-white hover:bg-light-border dark:hover:bg-white/5 transition-colors"
                  (click)="cancel.emit()">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <!-- Corps scrollable -->
        <div class="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          <!-- Sélecteur IA/Modèle (idle / variable-fill) -->
          @if (state() === 'idle' || state() === 'variable-fill') {
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">IA</label>
                <select class="w-full rounded-lg border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 text-sm px-3 py-2 dark:[color-scheme:dark]"
                        [ngModel]="selectedProvider()" (ngModelChange)="onProviderChange($event)">
                  @for (p of providers(); track p.value) {
                    <option [value]="p.value">{{ p.label }}</option>
                  }
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">Modèle</label>
                <select class="w-full rounded-lg border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 text-sm px-3 py-2 dark:[color-scheme:dark]"
                        [ngModel]="activeModel()" (ngModelChange)="selectedModel.set($event)">
                  @for (m of modelsForProvider(); track m.value) {
                    <option [value]="m.value">{{ m.label || m.value }}</option>
                  }
                </select>
              </div>
            </div>
          }

          <!-- Prompt système de base (global admin) -->
          @if (baseSystemPrompt && (state() === 'idle' || state() === 'variable-fill')) {
            <div class="flex flex-col gap-1.5">
              <button class="flex items-center gap-2 text-[11px] text-amber-400/70 hover:text-amber-400 transition-colors w-fit"
                      (click)="baseCollapsed.set(!baseCollapsed())">
                <span class="material-symbols-outlined text-[13px]">{{ baseCollapsed() ? 'expand_more' : 'expand_less' }}</span>
                <span class="uppercase tracking-wide font-medium">Prompt de base</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">global</span>
              </button>
              @if (!baseCollapsed()) {
                <div class="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
                  <p class="text-[12px] text-amber-300/70 font-mono whitespace-pre-wrap">{{ baseSystemPrompt }}</p>
                </div>
              }
            </div>
          }

          <!-- Prompt système de la section -->
          @if (systemPrompt && (state() === 'idle' || state() === 'variable-fill')) {
            <div class="flex flex-col gap-1.5">
              <button class="flex items-center gap-2 text-[11px] text-light-text-muted dark:text-white/40 hover:text-light-text dark:hover:text-white/60 transition-colors w-fit"
                      (click)="systemCollapsed.set(!systemCollapsed())">
                <span class="material-symbols-outlined text-[13px]">{{ systemCollapsed() ? 'expand_more' : 'expand_less' }}</span>
                <span class="uppercase tracking-wide font-medium">System prompt</span>
              </button>
              @if (!systemCollapsed()) {
                <div class="rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background p-3">
                  <p class="text-[12px] text-light-text-muted dark:text-white/50 font-mono whitespace-pre-wrap">{{ systemPrompt }}</p>
                </div>
              }
            </div>
          }

          <!-- Prompt user -->
          @if (state() === 'idle' || state() === 'variable-fill') {
            <div class="flex flex-col gap-1.5">
              <span class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">Prompt</span>
              <div class="rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background p-3">
                <p class="text-[13px] text-light-text dark:text-white/75 whitespace-pre-wrap" [innerHTML]="highlightedPrompt()"></p>
              </div>
            </div>
          }

          <!-- Variables -->
          @if (state() === 'variable-fill') {
            <div class="flex flex-col gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <p class="text-[11px] font-medium text-amber-400 uppercase tracking-wide">Variables à remplir</p>
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

          <!-- Prompt envoyé (running / validating / done) -->
          @if (state() === 'running' || state() === 'validating' || state() === 'done') {
            <div class="flex flex-col gap-1.5">
              <button class="flex items-center gap-2 text-[11px] text-light-text-muted dark:text-white/40 hover:text-light-text dark:hover:text-white/60 transition-colors w-fit"
                      (click)="sentPromptCollapsed.set(!sentPromptCollapsed())">
                <span class="material-symbols-outlined text-[13px]">{{ sentPromptCollapsed() ? 'expand_more' : 'expand_less' }}</span>
                <span class="uppercase tracking-wide font-medium">Prompt envoyé</span>
              </button>
              @if (!sentPromptCollapsed()) {
                <div class="rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background p-3 flex flex-col gap-2">
                  @if (sentSystemPrompt()) {
                    <div>
                      <p class="text-[10px] font-medium text-amber-400/70 uppercase tracking-wide mb-1">System</p>
                      <p class="text-[11px] text-light-text-muted dark:text-white/50 font-mono whitespace-pre-wrap">{{ sentSystemPrompt() }}</p>
                    </div>
                    <hr class="border-light-border dark:border-white/8">
                  }
                  <div>
                    <p class="text-[10px] font-medium text-light-text-muted dark:text-white/40 uppercase tracking-wide mb-1">User</p>
                    <p class="text-[11px] text-light-text dark:text-white/70 whitespace-pre-wrap">{{ sentUserPrompt() }}</p>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Zone de streaming -->
          @if (state() === 'running' || state() === 'validating' || state() === 'done') {
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">Résultat</span>
                @if (state() === 'running') {
                  <span class="flex items-center gap-1 text-[11px] text-amber-400">
                    <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    Génération en cours… {{ elapsedSeconds() }}s
                  </span>
                }
                @if (execSvc.tokenInfo()) {
                  <span class="ml-auto text-[10px] text-light-text-muted dark:text-white/30">
                    {{ execSvc.tokenInfo()!.used }} tokens
                  </span>
                }
              </div>
              <pre class="rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background p-3 text-[12px] text-light-text dark:text-white/80 whitespace-pre-wrap font-mono overflow-y-auto max-h-60 leading-relaxed">{{ accumulated() || ' ' }}</pre>
              <!-- Journal executor (stderr, info) -->
              @if (logs().length > 0) {
                <div class="rounded-lg border border-light-border dark:border-white/8 bg-light-background dark:bg-black/20 p-2 max-h-28 overflow-y-auto">
                  @for (entry of logs(); track $index) {
                    <p class="text-[10px] font-mono leading-relaxed"
                       [ngClass]="entry.stream === 'stderr' ? 'text-red-400/80' : (entry.stream === 'info' ? 'text-amber-400/60' : 'text-light-text-muted dark:text-white/25')">{{ entry.text }}</p>
                  }
                </div>
              }
            </div>
          }

          @if (state() === 'done') {
            <p class="text-center text-sm text-green-400 font-medium">Résultat inséré dans le document.</p>
          }
        </div>

        <!-- Footer actions -->
        <div class="flex items-center gap-2 px-5 py-4 border-t border-light-border dark:border-white/8 flex-shrink-0">

          @if (state() === 'idle') {
            <span class="flex-1"></span>
            <button class="text-sm px-4 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                    (click)="cancel.emit()">Annuler</button>
            <button class="text-sm px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold hover:bg-amber-500/25 transition-colors flex items-center gap-1.5"
                    (click)="startExecution()">
              <span class="material-symbols-outlined text-base">play_arrow</span>Envoyer
            </button>
          }

          @if (state() === 'variable-fill') {
            <span class="flex-1"></span>
            <button class="text-sm px-4 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                    (click)="state.set('idle')">Retour</button>
            <button class="text-sm px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold hover:bg-amber-500/25 transition-colors"
                    (click)="continueWithVars()">Continuer</button>
          }

          @if (state() === 'running') {
            <span class="flex-1"></span>
            <button class="text-sm px-4 py-2 rounded-lg border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-colors"
                    (click)="stopExecution()">Annuler</button>
          }

          @if (state() === 'validating') {
            <button class="text-sm px-3 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors flex items-center gap-1"
                    (click)="copyResult()" [title]="copied() ? 'Copié !' : 'Copier'">
              <span class="material-symbols-outlined text-sm">{{ copied() ? 'check' : 'content_copy' }}</span>
            </button>
            <span class="flex-1"></span>
            <button class="text-sm px-4 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                    (click)="reExecute()">Re-exécuter</button>
            <button class="text-sm px-4 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                    (click)="cancel.emit()">Annuler</button>
            <button class="text-sm px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold hover:bg-amber-500/25 transition-colors flex items-center gap-1.5"
                    (click)="insertResult()">
              <span class="material-symbols-outlined text-base">check</span>Insérer
            </button>
          }

          @if (state() === 'done') {
            <span class="flex-1"></span>
            <button class="text-sm px-4 py-2 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 font-semibold"
                    (click)="cancel.emit()">Fermer</button>
          }
        </div>
      </div>
    </div>
  `,
})
export class PromptExecutionPopupComponent implements OnInit, OnDestroy {
  @Input() instanceId = '';
  @Input() instanceName = 'Prompt';
  @Input() baseSystemPrompt: string | null = null;
  @Input() systemPrompt: string | null = null;
  @Input() userPrompt = '';
  @Input() variables: string[] = [];
  /** Niveau markdown auquel le livrable doit DÉMARRER ses titres (dynamique selon la profondeur
   *  de la section « PR-Res {nom} » qui recevra le résultat). 0 = pas de consigne de niveau. */
  @Input() startHeadingLevel = 0;

  @Output() insert = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  readonly execSvc = inject(AiExecuteService);
  private configSvc = inject(ConfigService);
  private megaSvc = inject(MegaOutilsService);

  state = signal<PopupState>('idle');
  selectedProvider = signal('');
  selectedModel = signal('');
  baseCollapsed = signal(true);
  systemCollapsed = signal(true);
  accumulated = signal('');
  logs = signal<AiLogItem[]>([]);
  elapsedSeconds = signal(0);
  sentUserPrompt = signal('');
  sentSystemPrompt = signal<string | null>(null);
  sentPromptCollapsed = signal(true);
  copied = signal(false);
  varValues: Record<string, string> = {};
  private timerSub: Subscription | null = null;

  private subs: Subscription[] = [];

  private readonly providerLabels: Record<string, string> = {
    claude: 'Claude',
    antigravity: 'AGY (Gemini)',
  };

  readonly allModels = computed(() => {
    const cfg = this.configSvc.cliConfig();
    const claude = (cfg.modelsList?.claude || []).map((m: any) => ({ ...m, provider: 'claude' }));
    const antigravity = (cfg.modelsList?.antigravity || []).map((m: any) => ({ ...m, provider: 'antigravity' }));
    return [...claude, ...antigravity];
  });

  readonly providers = computed(() => {
    const seen = new Set<string>();
    const result: { value: string; label: string }[] = [];
    for (const m of this.allModels()) {
      if (!seen.has(m.provider)) {
        seen.add(m.provider);
        result.push({ value: m.provider, label: this.providerLabels[m.provider] || m.provider });
      }
    }
    return result;
  });

  readonly modelsForProvider = computed(() =>
    this.allModels().filter(m => m.provider === this.selectedProvider())
  );

  readonly activeModel = computed(() => {
    const m = this.selectedModel();
    const available = this.modelsForProvider();
    if (m && available.some(x => x.value === m)) return m;
    return available[0]?.value || '';
  });

  readonly activeProvider = computed(() => this.selectedProvider() || 'claude');

  onProviderChange(provider: string) {
    this.selectedProvider.set(provider);
    const first = this.allModels().find(m => m.provider === provider);
    this.selectedModel.set(first?.value || '');
  }

  highlightedPrompt = () =>
    this.userPrompt.replace(
      /\{\{([A-Za-z0-9_]+)\}\}/g,
      '<span class="text-amber-400 font-bold">{&#123;$1&#125;}</span>'
    );

  ngOnInit() {
    const cfg = this.configSvc.cliConfig();
    const currentModel = cfg.headerSelection?.model || '';
    this.selectedModel.set(currentModel);
    const found = this.allModels().find(m => m.value === currentModel);
    this.selectedProvider.set(found?.provider || this.providers()[0]?.value || 'claude');

    this.subs.push(
      this.execSvc.chunk$.subscribe(chunk => this.accumulated.update(v => v + chunk)),
      this.execSvc.done$.subscribe(full => {
        this.stopTimer();
        this.state.set('validating');
        this.saveExecution(full);
      }),
      this.execSvc.error$.subscribe(err => {
        this.stopTimer();
        this.accumulated.update(v => v + `\n\n⚠ ERREUR : ${err}`);
        this.state.set('validating');
      }),
      this.execSvc.log$.subscribe(entry => {
        this.logs.update(v => [...v.slice(-50), entry]);
      }),
    );
  }

  ngOnDestroy() {
    this.stopTimer();
    this.subs.forEach(s => s.unsubscribe());
    this.execSvc.cancel();
  }

  startExecution() {
    if (this.variables.length > 0) {
      this.state.set('variable-fill');
      return;
    }
    this.doExecute(this.userPrompt);
  }

  continueWithVars() {
    let resolved = this.userPrompt;
    for (const [k, v] of Object.entries(this.varValues)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
    this.doExecute(resolved);
  }

  /** Consigne dynamique sur le niveau de titre de départ : le livrable sera inséré comme
   *  sous-section de « PR-Res {nom} », ses titres doivent donc démarrer un cran dessous. */
  private headingLevelInstruction(): string | null {
    const lvl = this.startHeadingLevel;
    if (!lvl || lvl < 1) return null;
    const hashes = '#'.repeat(lvl);
    return `FORMAT DES TITRES (impératif) : le document généré sera inséré comme sous-section d'une section existante. Démarre TOUS tes titres Markdown au niveau ${lvl} (« ${hashes} ») et utilise des niveaux plus profonds (jusqu'à 6 « ###### » maximum) pour les sous-titres. N'emploie JAMAIS un titre avec moins de ${lvl} dièses. Le tout premier titre du document doit commencer par « ${hashes} ».`;
  }

  private doExecute(resolvedPrompt: string) {
    this.accumulated.set('');
    this.logs.set([]);
    this.elapsedSeconds.set(0);
    this.state.set('running');
    // Combiner prompt de base global + system prompt de la section + consigne de niveau de titre
    const parts = [this.baseSystemPrompt, this.systemPrompt, this.headingLevelInstruction()].filter(Boolean);
    const effectiveSystem = parts.length ? parts.join('\n\n---\n\n') : null;
    this.sentUserPrompt.set(resolvedPrompt);
    this.sentSystemPrompt.set(effectiveSystem);
    this.sentPromptCollapsed.set(true);
    // Timer d'attente
    this.timerSub?.unsubscribe();
    this.timerSub = interval(1000).subscribe(() => this.elapsedSeconds.update(v => v + 1));
    this.subs.push(this.timerSub);
    this.execSvc.startExecution(effectiveSystem, resolvedPrompt, this.activeProvider(), this.activeModel());
  }

  private stopTimer() {
    this.timerSub?.unsubscribe();
    this.timerSub = null;
  }

  stopExecution() {
    this.stopTimer();
    this.execSvc.cancel();
    this.state.set('validating');
  }

  reExecute() {
    this.accumulated.set('');
    this.logs.set([]);
    this.elapsedSeconds.set(0);
    this.state.set('running');
    let resolved = this.userPrompt;
    for (const [k, v] of Object.entries(this.varValues)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
    const parts = [this.baseSystemPrompt, this.systemPrompt, this.headingLevelInstruction()].filter(Boolean);
    const effectiveSystem = parts.length ? parts.join('\n\n---\n\n') : null;
    this.execSvc.startExecution(effectiveSystem, resolved, this.activeProvider(), this.activeModel());
  }

  insertResult() {
    this.insert.emit(this.accumulated());
    this.state.set('done');
    setTimeout(() => this.cancel.emit(), 1500);
  }

  async copyResult() {
    await navigator.clipboard.writeText(this.accumulated());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }

  private saveExecution(result: string) {
    if (!this.instanceId || !result) return;
    this.megaSvc.savePromptExecution(this.instanceId, {
      userPrompt: this.userPrompt,
      systemPrompt: this.systemPrompt,
      result,
      provider: this.activeProvider(),
      model: this.activeModel(),
    }).catch(() => { /* silencieux */ });
  }
}
