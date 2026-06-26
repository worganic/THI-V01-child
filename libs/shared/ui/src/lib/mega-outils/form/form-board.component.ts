import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormQuestion, FormEntry } from '@worganic/portail-core/data-access';

@Component({
  selector: 'app-form-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col bg-light-background dark:bg-background rounded-lg border border-blue-500/20 overflow-hidden">

      <!-- Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-blue-500/15 flex-shrink-0 bg-blue-500/5">
        <span class="material-symbols-outlined text-blue-400 text-lg">assignment</span>
        <span class="text-sm font-semibold text-light-text dark:text-white/90">{{ instanceName }}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/25 text-blue-400">
          {{ questions.length }} question{{ questions.length !== 1 ? 's' : '' }}
        </span>
        <span class="flex-1"></span>
        <span class="text-[11px] text-light-text-muted dark:text-white/30 mr-2">
          {{ responses.length }} réponse{{ responses.length !== 1 ? 's' : '' }}
        </span>
        <button class="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold hover:bg-blue-500/25 transition-colors"
                (click)="execute.emit()">
          <span class="material-symbols-outlined text-[14px]">edit_note</span>
          Remplir
        </button>
      </div>

      <!-- Questions (lecture seule) -->
      @for (q of questions; track q.label; let last = $last) {
        <div [class]="'px-4 py-2' + (last && responses.length === 0 ? '' : ' border-b border-blue-500/10')">
          <div class="text-[11px] font-semibold text-blue-300/80 mb-1.5">{{ q.label }}</div>
          <div class="flex flex-col gap-0.5">
            @for (opt of q.options; track opt.text) {
              <div class="flex items-center gap-2 text-[12px] text-light-text-muted dark:text-white/40">
                @if (q.type === 'checkbox') {
                  <span class="w-3 h-3 flex-shrink-0 border border-light-border dark:border-white/20 rounded-sm"></span>
                } @else {
                  <span class="w-3 h-3 flex-shrink-0 border border-light-border dark:border-white/20 rounded-full"></span>
                }
                <span>{{ opt.text.replace('______', '…') }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Stats (si réponses) -->
      @if (responses.length > 0) {
        <div class="border-t border-blue-500/15 px-4 py-3">
          <div class="text-[10px] font-semibold text-light-text-muted dark:text-white/30 uppercase tracking-wide mb-2">
            Statistiques — {{ responses.length }} réponse{{ responses.length !== 1 ? 's' : '' }}
          </div>
          @for (q of questions; track q.label) {
            <div class="mb-3">
              <div class="text-[11px] font-medium text-blue-300/70 mb-1">{{ q.label }}</div>
              @for (opt of q.options; track opt.text) {
                @if (countForOption(q.label, opt.text) > 0) {
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-[11px] text-light-text-muted dark:text-white/40 truncate flex-1">{{ opt.text }}</span>
                    <span class="text-[11px] font-mono text-blue-400 w-6 text-right">{{ countForOption(q.label, opt.text) }}</span>
                    <div class="w-16 h-1.5 bg-blue-500/10 rounded-full overflow-hidden">
                      <div class="h-full bg-blue-400 rounded-full" [style.width.%]="pctForOption(q.label, opt.text)"></div>
                    </div>
                  </div>
                }
              }
            </div>
          }
          <div class="text-[10px] text-light-text-muted dark:text-white/20 mt-1">
            Dernière réponse : {{ responses[responses.length - 1]?.date }}
          </div>
        </div>
      }
    </div>
  `,
})
export class FormBoardComponent {
  @Input() instanceName = 'Formulaire';
  @Input() questions: FormQuestion[] = [];
  @Input() responses: FormEntry[] = [];

  @Output() execute = new EventEmitter<void>();

  countForOption(questionLabel: string, optionText: string): number {
    const hasDetail = /______/.test(optionText);
    // Pour une option à champ libre, on matche sur le préfixe avant ______ (la réponse
    // stockée contient la valeur saisie à la place du ______). Sinon, égalité stricte.
    const stem = optionText.split('______')[0].trim();
    const exact = optionText.trim();
    return this.responses.filter(r => {
      const val = r.answers[questionLabel];
      const arr = Array.isArray(val) ? val : (val != null ? [String(val)] : []);
      return arr.some(v => {
        const vv = v.trim();
        return hasDetail ? (stem.length > 0 && vv.startsWith(stem)) : vv === exact;
      });
    }).length;
  }

  pctForOption(questionLabel: string, optionText: string): number {
    if (this.responses.length === 0) return 0;
    return Math.round((this.countForOption(questionLabel, optionText) / this.responses.length) * 100);
  }
}
