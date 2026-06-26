import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { ConfigService, AiExecuteService, AiLogItem, FormQuestion, FormEntry, MaterializedMoPreview } from '@worganic/portail-core/data-access';
import { FormExecutionPopupComponent } from '../form-execution-popup/form-execution-popup.component';

type WfState = 'idle' | 'clarifying' | 'form-fill' | 'generating' | 'preview' | 'done' | 'error';

interface TranscriptEntry { rawForm: string; answers: FormEntry; }

@Component({
  selector: 'app-prompt-workflow-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, FormExecutionPopupComponent],
  template: `
    <!-- Phase remplissage : on délègue à la popup formulaire (réutilisée) -->
    @if (state() === 'form-fill') {
      <app-form-execution-popup
        [formName]="instanceName + ' — cadrage (vague ' + (transcript().length + 1) + ')'"
        [questions]="currentQuestions()"
        [userName]="userName"
        [secondaryAction]="'Générer le livrable maintenant'"
        (submitted)="onFormSubmitted($event)"
        (secondary)="onForceGenerate()"
        (cancel)="cancel.emit()" />
    } @else {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60"></div>
        <div class="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-blue-500/20 bg-light-surface dark:bg-surface shadow-2xl overflow-hidden">

          <!-- Header -->
          <div class="flex items-center gap-3 px-5 py-4 border-b border-blue-500/15 bg-blue-500/5 flex-shrink-0">
            <span class="material-symbols-outlined text-blue-400">conversation</span>
            <div class="flex-1 min-w-0">
              <h2 class="text-sm font-semibold text-light-text dark:text-white">{{ instanceName }}</h2>
              <p class="text-[11px] text-light-text-muted dark:text-white/40">Workflow guidé · {{ phaseLabel() }}</p>
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
              <div class="flex flex-col gap-1.5">
                <span class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">Demande</span>
                <div class="rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background p-3">
                  <p class="text-[13px] text-light-text dark:text-white/75 whitespace-pre-wrap">{{ userPrompt }}</p>
                </div>
                <p class="text-[11px] text-light-text-muted dark:text-white/40">L'IA va d'abord poser des questions de cadrage. Tu y répondras via un formulaire, puis elle produira le livrable.</p>
              </div>
            }

            <!-- Étapes (récap des vagues) -->
            @if (transcript().length > 0 && state() !== 'idle') {
              <div class="flex flex-col gap-1.5">
                <span class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">Cadrage</span>
                <div class="rounded-lg border border-blue-500/15 bg-blue-500/5 p-2.5 flex flex-col gap-1">
                  @for (t of transcript(); track $index) {
                    <p class="text-[11px] text-blue-300/70">✓ Vague {{ $index + 1 }} — {{ answerCount(t) }} réponse(s)</p>
                  }
                </div>
              </div>
            }

            <!-- Streaming (clarifying / generating) -->
            @if (state() === 'clarifying' || state() === 'generating') {
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="flex items-center gap-1 text-[11px] text-blue-400">
                    <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                    {{ state() === 'clarifying' ? 'Analyse du besoin…' : 'Génération du livrable…' }} {{ elapsedSeconds() }}s
                  </span>
                  @if (execSvc.tokenInfo()) {
                    <span class="ml-auto text-[10px] text-light-text-muted dark:text-white/30">{{ execSvc.tokenInfo()!.used }} tokens</span>
                  }
                </div>
                <pre class="rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background p-3 text-[12px] text-light-text dark:text-white/80 whitespace-pre-wrap font-mono overflow-y-auto max-h-60 leading-relaxed">{{ accumulated() || ' ' }}</pre>
              </div>
            }

            <!-- Erreur de format cadrage -->
            @if (state() === 'error') {
              <div class="rounded-lg border border-red-500/25 bg-red-500/5 p-3">
                <p class="text-[12px] text-red-400 mb-2">La réponse de l'IA n'est pas un formulaire exploitable.</p>
                <pre class="text-[11px] text-light-text-muted dark:text-white/50 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{{ accumulated() }}</pre>
              </div>
            }

            <!-- Aperçu de matérialisation -->
            @if (state() === 'preview') {
              <div class="flex flex-col gap-2">
                <span class="text-[11px] font-medium text-light-text-muted dark:text-white/50 uppercase tracking-wide">MegaOutils détectés</span>
                @if (moPreviews().length === 0) {
                  <p class="text-[12px] text-light-text-muted dark:text-white/40">Aucun MegaOutil détecté — le livrable sera inséré tel quel.</p>
                } @else {
                  <div class="flex flex-col gap-1.5">
                    @for (mo of moPreviews(); track $index) {
                      <label class="flex items-center gap-2.5 rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background px-3 py-2 cursor-pointer">
                        <input type="checkbox" class="w-4 h-4 accent-blue-500 cursor-pointer"
                               [checked]="mo.selected" (change)="toggleMo($index, $any($event.target).checked)" />
                        <span class="material-symbols-outlined text-[15px]"
                              [ngClass]="mo.type === 'trello' ? 'text-emerald-400' : (mo.type === 'array' ? 'text-sky-400' : (mo.type === 'chart' ? 'text-indigo-400' : (mo.type === 'agenda' ? 'text-amber-400' : 'text-blue-400')))">
                          {{ mo.type === 'trello' ? 'view_kanban' : (mo.type === 'array' ? 'table' : (mo.type === 'chart' ? 'show_chart' : (mo.type === 'agenda' ? 'calendar_month' : 'assignment'))) }}
                        </span>
                        <span class="text-[13px] text-light-text dark:text-white/80 flex-1 truncate">{{ mo.name }}</span>
                        <span class="text-[11px] text-light-text-muted dark:text-white/40">{{ mo.summary }}</span>
                      </label>
                    }
                  </div>
                }
                <details class="mt-1">
                  <summary class="text-[11px] text-light-text-muted dark:text-white/40 cursor-pointer">Voir le livrable brut</summary>
                  <pre class="mt-2 rounded-lg border border-light-border dark:border-white/10 bg-light-background dark:bg-background p-3 text-[11px] text-light-text dark:text-white/70 whitespace-pre-wrap font-mono max-h-52 overflow-y-auto">{{ deliverable() }}</pre>
                </details>
              </div>
            }

            @if (state() === 'done') {
              <p class="text-center text-sm text-green-400 font-medium">Livrable inséré dans la section.</p>
            }
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-2 px-5 py-4 border-t border-light-border dark:border-white/8 flex-shrink-0">
            @if (state() === 'idle') {
              <span class="flex-1"></span>
              <button class="text-sm px-4 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                      (click)="cancel.emit()">Annuler</button>
              <button class="text-sm px-4 py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold hover:bg-blue-500/25 transition-colors flex items-center gap-1.5"
                      (click)="startClarify()">
                <span class="material-symbols-outlined text-base">play_arrow</span>Démarrer le cadrage
              </button>
            }
            @if (state() === 'clarifying' || state() === 'generating') {
              <span class="flex-1"></span>
              <button class="text-sm px-4 py-2 rounded-lg border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-colors"
                      (click)="stop()">Annuler</button>
            }
            @if (state() === 'error') {
              <span class="flex-1"></span>
              <button class="text-sm px-4 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                      (click)="startClarify()">Réessayer</button>
              <button class="text-sm px-4 py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold hover:bg-blue-500/25 transition-colors"
                      (click)="onForceGenerate()">Forcer la génération</button>
            }
            @if (state() === 'preview') {
              <span class="flex-1"></span>
              <button class="text-sm px-4 py-2 rounded-lg border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                      (click)="cancel.emit()">Annuler</button>
              <button class="text-sm px-4 py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold hover:bg-blue-500/25 transition-colors flex items-center gap-1.5"
                      (click)="confirmMaterialize()">
                <span class="material-symbols-outlined text-base">check</span>Insérer dans la section
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
    }
  `,
})
export class PromptWorkflowPopupComponent implements OnInit, OnDestroy {
  @Input() instanceId = '';
  @Input() instanceName = 'Prompt';
  @Input() userPrompt = '';
  @Input() extraSystemPrompt: string | null = null;   // SYSTEM: de la section
  @Input() baseSystemPrompt: string | null = null;     // prompt de base global
  @Input() clarifyPrompt = '';
  @Input() generatePrompt = '';
  @Input() userName = '';
  @Input() maxWaves = 5;
  @Input() currentState = '';

  @Output() materialize = new EventEmitter<{ deliverable: string; selectedMos: MaterializedMoPreview[]; transcript: string }>();
  @Output() cancel = new EventEmitter<void>();

  readonly execSvc = inject(AiExecuteService);
  private configSvc = inject(ConfigService);

  state = signal<WfState>('idle');
  accumulated = signal('');
  elapsedSeconds = signal(0);
  transcript = signal<TranscriptEntry[]>([]);
  currentQuestions = signal<FormQuestion[]>([]);
  deliverable = signal('');
  moPreviews = signal<MaterializedMoPreview[]>([]);

  selectedProvider = signal('');
  selectedModel = signal('');

  private phase: 'clarify' | 'generate' = 'clarify';
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

  phaseLabel = computed(() => ({
    idle: 'prêt', clarifying: 'cadrage', 'form-fill': 'réponses', generating: 'génération',
    preview: 'validation', done: 'terminé', error: 'erreur',
  } as Record<WfState, string>)[this.state()]);

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
      this.execSvc.chunk$.subscribe(c => this.accumulated.update(v => v + c)),
      this.execSvc.done$.subscribe(full => this.onStreamDone(full)),
      this.execSvc.error$.subscribe(err => { this.stopTimer(); this.accumulated.update(v => v + `\n\n⚠ ERREUR : ${err}`); this.state.set('error'); }),
    );
  }

  ngOnDestroy() {
    this.stopTimer();
    this.subs.forEach(s => s.unsubscribe());
    this.execSvc.cancel();
  }

  // ── Phase cadrage ──────────────────────────────────────────────────────────
  startClarify() {
    this.phase = 'clarify';
    this.accumulated.set('');
    this.elapsedSeconds.set(0);
    this.state.set('clarifying');
    this.startTimer();
    const system = this.combineSystem(this.clarifyPrompt);
    this.execSvc.startExecution(system, this.buildClarifyUser(), this.activeProvider(), this.activeModel());
  }

  private onStreamDone(full: string) {
    this.stopTimer();
    if (this.phase === 'generate') { this.onGenerateDone(full); return; }
    // Phase cadrage : ===PRÊT=== → génération ; sinon parser un formulaire
    if (/===\s*PR[ÊE]T\s*===/i.test(full)) { this.startGenerate(); return; }
    const questions = this.parseFormContent(full);
    if (questions.length > 0) {
      this.currentQuestions.set(questions);
      this.lastRawForm = full;
      this.state.set('form-fill');
    } else {
      this.state.set('error');
    }
  }

  private lastRawForm = '';

  onFormSubmitted(entry: FormEntry) {
    this.transcript.update(t => [...t, { rawForm: this.lastRawForm, answers: entry }]);
    if (this.transcript().length >= this.maxWaves) { this.startGenerate(); return; }
    this.startClarify();   // vague suivante : l'IA reposera ou répondra ===PRÊT===
  }

  onForceGenerate() {
    // Si on force depuis le formulaire courant sans l'avoir soumis, on génère avec ce qu'on a.
    this.startGenerate();
  }

  // ── Phase génération ───────────────────────────────────────────────────────
  private startGenerate() {
    this.phase = 'generate';
    this.accumulated.set('');
    this.elapsedSeconds.set(0);
    this.state.set('generating');
    this.startTimer();
    const system = this.combineSystem(this.generatePrompt);
    this.execSvc.startExecution(system, this.buildGenerateUser(), this.activeProvider(), this.activeModel());
  }

  private onGenerateDone(full: string) {
    this.deliverable.set(full.trim());
    this.moPreviews.set(this.detectMos(full));
    this.state.set('preview');
  }

  toggleMo(idx: number, checked: boolean) {
    this.moPreviews.update(list => list.map((m, i) => i === idx ? { ...m, selected: checked } : m));
  }

  confirmMaterialize() {
    this.materialize.emit({
      deliverable: this.deliverable(),
      selectedMos: this.moPreviews().filter(m => m.selected),
      transcript: this.buildTranscriptText(),
    });
    this.state.set('done');
    setTimeout(() => this.cancel.emit(), 1500);
  }

  stop() { this.stopTimer(); this.execSvc.cancel(); this.state.set(this.phase === 'generate' ? 'preview' : 'error'); }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private combineSystem(meta: string): string {
    return [this.baseSystemPrompt, this.extraSystemPrompt, meta].filter(Boolean).join('\n\n---\n\n');
  }

  private buildClarifyUser(): string {
    if (this.transcript().length === 0) return this.userPrompt;
    return `${this.userPrompt}\n\n[Échanges de cadrage précédents]\n${this.buildTranscriptText()}`;
  }

  private buildGenerateUser(): string {
    const t = this.buildTranscriptText();
    let base = t ? `${this.userPrompt}\n\n[Réponses de cadrage]\n${t}` : this.userPrompt;
    if (this.currentState.trim()) base += `\n\n[État actuel du projet]\n${this.currentState.trim()}`;
    return base;
  }

  private buildTranscriptText(): string {
    return this.transcript().map((t, i) => {
      const a = Object.entries(t.answers.answers)
        .map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(' ; ') : v}`).join('\n');
      return `--- Vague ${i + 1} ---\n${a}`;
    }).join('\n\n');
  }

  answerCount(t: TranscriptEntry): number { return Object.keys(t.answers.answers).length; }

  private startTimer() {
    this.timerSub?.unsubscribe();
    this.timerSub = interval(1000).subscribe(() => this.elapsedSeconds.update(v => v + 1));
    this.subs.push(this.timerSub);
  }
  private stopTimer() { this.timerSub?.unsubscribe(); this.timerSub = null; }

  /** Parse une sortie cadrage en questions de formulaire (même grammaire que l'éditeur). */
  private parseFormContent(body: string): FormQuestion[] {
    const questions: FormQuestion[] = [];
    let current: FormQuestion | null = null;
    for (const line of body.split('\n')) {
      const q = line.match(/^\s*[\*\-]\s+\*\*(.+?)\*\*\s*:?\s*$/);
      if (q) { if (current) questions.push(current); current = { label: q[1].trim(), type: 'checkbox', options: [] }; continue; }
      const c = line.match(/^\s*[\*\-]\s+\[\s*\]\s+(.+)$/);
      if (c && current) { current.type = 'checkbox'; current.options.push({ text: c[1].trim(), hasDetail: /_{5,}/.test(c[1]) }); continue; }
      const r = line.match(/^\s*[\*\-]\s+\(\s*\)\s+(.+)$/);
      if (r && current) { current.type = 'radio'; current.options.push({ text: r[1].trim(), hasDetail: /_{5,}/.test(r[1]) }); }
    }
    if (current) questions.push(current);
    return questions.filter(q => q.options.length > 0);
  }

  /** Détecte les fences TRELLO/ARRAY/FORM/CHART/AGENDA du livrable pour l'aperçu. */
  private detectMos(deliverable: string): MaterializedMoPreview[] {
    const out: MaterializedMoPreview[] = [];
    const re = /```(TRELLO|ARRAY|FORM|CHART|AGENDA):[ \t]*([^\n]+)\n([\s\S]*?)\n```/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(deliverable)) !== null) {
      const type = m[1].toLowerCase() as 'trello' | 'array' | 'form' | 'chart' | 'agenda';
      const name = m[2].trim();
      const body = m[3];
      out.push({ type, name, summary: this.summarize(type, body), fence: m[0], selected: true });
    }
    return out;
  }

  private summarize(type: 'trello' | 'array' | 'form' | 'chart' | 'agenda', body: string): string {
    if (type === 'trello') {
      const n = (body.match(/^\s*-\s*\[[ x~!]?\]/gm) || []).length;
      return `${n} carte${n > 1 ? 's' : ''}`;
    }
    if (type === 'array') {
      const rows = (body.match(/^\s*\|.*\|\s*$/gm) || []).filter(l => !/^\s*\|[\s|:-]+\|\s*$/.test(l));
      const cols = rows[0] ? rows[0].split('|').filter(c => c.trim() !== '').length : 0;
      return `${Math.max(0, rows.length - 1)}×${cols}`;
    }
    if (type === 'chart') {
      const pts = body.split('\n').filter(l => /^source:/i.test(l.trim()) ? false : /\S/.test(l)).length;
      return pts > 0 ? `${pts} point${pts > 1 ? 's' : ''}` : 'live';
    }
    if (type === 'agenda') {
      const n = body.split('\n').filter(l => /\d{4}-\d{2}-\d{2}/.test(l)).length;
      return `${n} événement${n > 1 ? 's' : ''}`;
    }
    const q = (body.match(/^\s*[\*\-]\s+\*\*(.+?)\*\*\s*:?\s*$/gm) || []).length;
    return `${q} question${q > 1 ? 's' : ''}`;
  }
}
