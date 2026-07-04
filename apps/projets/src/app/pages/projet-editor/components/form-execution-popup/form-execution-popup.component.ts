import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormQuestion, FormEntry } from '@worganic/portail-core/data-access';

@Component({
  selector: 'app-form-execution-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
      <div class="w-[560px] max-h-[85vh] overflow-y-auto rounded-2xl border border-blue-500/20 bg-white dark:bg-[#0f0f1a] shadow-2xl flex flex-col">

        <!-- Header -->
        <div class="flex items-center gap-3 px-6 py-4 border-b border-blue-500/15 flex-shrink-0 bg-blue-500/5 rounded-t-2xl">
          <div class="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-blue-400 text-base">assignment</span>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-light-text dark:text-white">{{ formName }}</h3>
            <p class="text-[11px] text-light-text-muted dark:text-white/40">{{ questions.length }} question{{ questions.length !== 1 ? 's' : '' }}</p>
          </div>
        </div>

        <!-- Questions -->
        <div class="flex-1 px-6 py-4 flex flex-col gap-5">
          @for (q of questions; track q.label; let qi = $index) {
            <div>
              <div class="text-[12px] font-semibold text-light-text dark:text-white/80 mb-2">{{ q.label }}</div>

              @if (q.type === 'checkbox') {
                @for (opt of q.options; track opt.text; let oi = $index) {
                  <div class="mb-1.5">
                    <label class="flex items-start gap-2.5 cursor-pointer group">
                      <input type="checkbox"
                             class="mt-0.5 w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0"
                             [checked]="isChecked(qi, oi)"
                             (change)="toggleCheckbox(qi, oi, $event)" />
                      <span class="text-sm text-light-text dark:text-white/70 group-hover:text-light-text dark:group-hover:text-white/90 transition-colors">
                        {{ displayText(opt.text) }}
                        @if (opt.hasDetail && isChecked(qi, oi)) {
                          <input type="text"
                                 class="ml-1 text-sm bg-light-background dark:bg-background border-b border-blue-400/50 outline-none text-light-text dark:text-white px-1 w-36"
                                 placeholder="préciser…"
                                 [value]="getDetail(qi, oi)"
                                 (input)="setDetail(qi, oi, $any($event.target).value)" />
                        }
                      </span>
                    </label>
                  </div>
                }
              } @else if (q.type === 'radio') {
                @for (opt of q.options; track opt.text; let oi = $index) {
                  <div class="mb-1.5">
                    <label class="flex items-start gap-2.5 cursor-pointer group">
                      <input type="radio"
                             class="mt-0.5 w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0"
                             [name]="'q' + qi"
                             [checked]="radioAnswers()[qi] === oi"
                             (change)="selectRadio(qi, oi)" />
                      <span class="text-sm text-light-text dark:text-white/70 group-hover:text-light-text dark:group-hover:text-white/90 transition-colors">
                        {{ displayText(opt.text) }}
                        @if (opt.hasDetail && radioAnswers()[qi] === oi) {
                          <input type="text"
                                 class="ml-1 text-sm bg-light-background dark:bg-background border-b border-blue-400/50 outline-none text-light-text dark:text-white px-1 w-36"
                                 placeholder="préciser…"
                                 [value]="getDetail(qi, oi)"
                                 (input)="setDetail(qi, oi, $any($event.target).value)" />
                        }
                      </span>
                    </label>
                  </div>
                }
              } @else {
                <textarea rows="2"
                          class="w-full text-sm rounded-lg border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 px-3 py-2 outline-none focus:border-blue-500 dark:focus:border-blue-400 resize-none"
                          placeholder="Votre réponse…"
                          [value]="getText(qi)"
                          (input)="setText(qi, $any($event.target).value)"></textarea>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="flex gap-2 px-6 py-4 border-t border-blue-500/15 flex-shrink-0 bg-blue-500/5 rounded-b-2xl">
          <button class="flex-1 text-xs px-4 py-2.5 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
                  [disabled]="!hasAnswers()"
                  (click)="submit()">
            Envoyer les réponses
          </button>
          @if (secondaryAction) {
            <button class="text-xs px-4 py-2.5 rounded-lg border border-blue-500/30 text-blue-400 font-semibold hover:bg-blue-500/10 transition-colors"
                    (click)="onSecondary()">{{ secondaryAction }}</button>
          }
          <button class="text-xs px-4 py-2.5 rounded-lg border border-light-border dark:border-white/20 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors"
                  (click)="cancel.emit()">Annuler</button>
        </div>
      </div>
    </div>
  `,
})
export class FormExecutionPopupComponent implements OnInit {
  @Input() formName = '';
  @Input() questions: FormQuestion[] = [];
  @Input() userName = '';
  /** Libellé d'une action secondaire optionnelle (ex: « Générer le livrable maintenant »). */
  @Input() secondaryAction = '';

  @Output() submitted = new EventEmitter<FormEntry>();
  @Output() cancel = new EventEmitter<void>();
  @Output() secondary = new EventEmitter<FormEntry>();

  checkboxAnswers = signal<boolean[][]>([]);
  radioAnswers = signal<number[]>([]);
  details = signal<string[][]>([]);
  textAnswers = signal<string[]>([]);

  ngOnInit() {
    this.checkboxAnswers.set(this.questions.map(q => q.options.map(() => false)));
    this.radioAnswers.set(this.questions.map(() => -1));
    this.details.set(this.questions.map(q => q.options.map(() => '')));
    this.textAnswers.set(this.questions.map(() => ''));
  }

  displayText(text: string): string {
    return text.replace(/_{5,}/g, '').trim();
  }

  isChecked(qi: number, oi: number): boolean {
    return this.checkboxAnswers()[qi]?.[oi] ?? false;
  }

  toggleCheckbox(qi: number, oi: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.checkboxAnswers().map(row => [...row]);
    current[qi][oi] = checked;
    this.checkboxAnswers.set(current);
  }

  selectRadio(qi: number, oi: number) {
    const current = [...this.radioAnswers()];
    current[qi] = oi;
    this.radioAnswers.set(current);
  }

  getDetail(qi: number, oi: number): string {
    return this.details()[qi]?.[oi] ?? '';
  }

  setDetail(qi: number, oi: number, value: string) {
    const current = this.details().map(row => [...row]);
    current[qi][oi] = value;
    this.details.set(current);
  }

  getText(qi: number): string {
    return this.textAnswers()[qi] ?? '';
  }

  setText(qi: number, value: string) {
    const current = [...this.textAnswers()];
    current[qi] = value;
    this.textAnswers.set(current);
  }

  hasAnswers(): boolean {
    for (let qi = 0; qi < this.questions.length; qi++) {
      const q = this.questions[qi];
      if (q.type === 'checkbox' && this.checkboxAnswers()[qi]?.some(Boolean)) return true;
      if (q.type === 'radio' && this.radioAnswers()[qi] >= 0) return true;
      if (q.type === 'text' && this.textAnswers()[qi]?.trim()) return true;
    }
    return false;
  }

  /** Construit l'entrée de formulaire à partir des réponses cochées/saisies. */
  private buildEntry(): FormEntry {
    const now = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const answers: Record<string, string | string[]> = {};

    for (let qi = 0; qi < this.questions.length; qi++) {
      const q = this.questions[qi];
      if (q.type === 'checkbox') {
        const selected = q.options
          .map((opt, oi) => {
            if (!this.checkboxAnswers()[qi]?.[oi]) return null;
            const detail = opt.hasDetail ? this.getDetail(qi, oi).trim() : '';
            return detail ? opt.text.replace(/_{5,}/g, detail) : opt.text;
          })
          .filter((v): v is string => v !== null);
        if (selected.length > 0) answers[q.label] = selected;
      } else if (q.type === 'radio') {
        const oi = this.radioAnswers()[qi];
        if (oi >= 0) {
          const opt = q.options[oi];
          const detail = opt.hasDetail ? this.getDetail(qi, oi).trim() : '';
          answers[q.label] = detail ? opt.text.replace(/_{5,}/g, detail) : opt.text;
        }
      } else {
        const text = this.textAnswers()[qi]?.trim();
        if (text) answers[q.label] = text;
      }
    }
    return { date: now, user: this.userName, answers };
  }

  submit() {
    this.submitted.emit(this.buildEntry());
  }

  /** Action secondaire (ex: « Générer le livrable maintenant ») : émet AUSSI les réponses
   *  saisies pour qu'elles ne soient pas perdues si l'utilisateur force la génération. */
  onSecondary() {
    this.secondary.emit(this.buildEntry());
  }
}
