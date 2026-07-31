import { Component, Input, Output, EventEmitter, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MegaOutilsService, ProjetCollabService, PromptExecution } from '@portail/core-data-access';

@Component({
  selector: 'app-prompt-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col bg-light-background dark:bg-background rounded-lg border border-amber-500/20 overflow-hidden">

      <!-- Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-amber-500/15 flex-shrink-0 bg-amber-500/5">
        <span class="material-symbols-outlined text-amber-400 text-lg">smart_toy</span>
        <span class="text-sm font-semibold text-light-text dark:text-white/90">{{ instanceName }}</span>
        @if (!readonly) {
          <select class="text-[10px] font-medium px-1.5 py-0.5 rounded border cursor-pointer bg-light-surface dark:bg-surface dark:[color-scheme:dark]"
                  [ngClass]="mode === 'guided' ? 'border-blue-500/25 text-blue-400' : (mode === 'chat' ? 'border-emerald-500/25 text-emerald-400' : (mode === 'freechat' ? 'border-violet-500/25 text-violet-400' : 'border-light-border dark:border-white/15 text-light-text-muted dark:text-white/40'))"
                  [ngModel]="mode" (ngModelChange)="modeChange.emit($any($event))">
            <option value="simple">Normal</option>
            <option value="guided">Guidé</option>
            <option value="chat">Tchat</option>
            <option value="freechat">Tchat libre</option>
          </select>
        } @else if (mode === 'guided') {
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center gap-1">
            <span class="material-symbols-outlined text-[11px]">conversation</span>Guidé
          </span>
        } @else if (mode === 'chat') {
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center gap-1">
            <span class="material-symbols-outlined text-[11px]">forum</span>Tchat
          </span>
        } @else if (mode === 'freechat') {
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/25 text-violet-400 flex items-center gap-1">
            <span class="material-symbols-outlined text-[11px]">chat</span>Tchat libre
          </span>
        }
        @if (variables.length > 0) {
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/25 text-amber-400">
            {{ variables.length }} variable{{ variables.length > 1 ? 's' : '' }}
          </span>
        }
        <span class="flex-1"></span>
        @if (!readonly) {
          <button class="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold hover:bg-amber-500/25 transition-colors"
                  (click)="execute.emit()">
            <span class="material-symbols-outlined text-[14px]">play_arrow</span>
            Exécuter
          </button>
        }
        @if (deletable) {
          @if (confirmDelete()) {
            <button class="text-[11px] px-2 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/25 transition-colors"
                    (click)="emitDelete()">Confirmer</button>
            <button class="text-[11px] px-2 py-1 rounded-md border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/40 hover:text-light-text dark:hover:text-white transition-colors"
                    (click)="confirmDelete.set(false)">Annuler</button>
          } @else {
            <button class="w-7 h-7 flex items-center justify-center rounded-md text-light-text-muted dark:text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Supprimer ce Prompt"
                    (click)="confirmDelete.set(true)">
              <span class="material-symbols-outlined text-base">delete</span>
            </button>
          }
        }
      </div>

      <!-- System prompt (collapsable) -->
      @if (systemPrompt) {
        <div class="border-b border-amber-500/10">
          <button class="w-full flex items-center gap-2 px-4 py-2 text-left text-[11px] text-light-text-muted dark:text-white/40 hover:text-light-text dark:hover:text-white/60 transition-colors"
                  (click)="systemCollapsed.set(!systemCollapsed())">
            <span class="material-symbols-outlined text-[13px]">{{ systemCollapsed() ? 'expand_more' : 'expand_less' }}</span>
            <span class="font-medium uppercase tracking-wide">System</span>
          </button>
          @if (!systemCollapsed()) {
            <div class="px-4 pb-3">
              <p class="text-[12px] text-light-text-muted dark:text-white/40 font-mono whitespace-pre-wrap leading-relaxed">{{ systemPrompt }}</p>
            </div>
          }
        </div>
      }

      <!-- User prompt avec variables colorées -->
      <div class="px-4 py-3">
        <p class="text-[13px] text-light-text dark:text-white/75 whitespace-pre-wrap leading-relaxed" [innerHTML]="highlightedPrompt()"></p>
      </div>

      <!-- Dernier résultat -->
      @if (lastExecution()) {
        <div class="border-t border-amber-500/10 px-4 py-2 flex items-center gap-2 text-[11px] text-light-text-muted dark:text-white/30">
          <span class="material-symbols-outlined text-[13px]">history</span>
          Dernière exécution : {{ formatDate(lastExecution()!.executedAt) }} via {{ lastExecution()!.provider }}/{{ lastExecution()!.model }}
        </div>
      }
    </div>
  `,
})
export class PromptBoardComponent implements OnInit, OnDestroy {
  @Input() instanceId = '';
  @Input() instanceName = 'Prompt';
  @Input() systemPrompt: string | null = null;
  @Input() userPrompt = '';
  @Input() variables: string[] = [];
  @Input() readonly = false;
  @Input() deletable = false;
  @Input() mode: 'simple' | 'guided' | 'chat' | 'freechat' = 'simple';

  @Output() execute = new EventEmitter<void>();
  @Output() deleteBoard = new EventEmitter<string>();
  @Output() modeChange = new EventEmitter<'simple' | 'guided' | 'chat' | 'freechat'>();

  private megaSvc = inject(MegaOutilsService);
  private collabSvc = inject(ProjetCollabService);
  private sub?: Subscription;

  confirmDelete = signal(false);
  systemCollapsed = signal(true);
  lastExecution = signal<PromptExecution | null>(null);

  highlightedPrompt = () => {
    return this.userPrompt.replace(
      /\{\{([A-Za-z0-9_]+)\}\}/g,
      '<span class="text-amber-400 font-bold">{&#123;$1&#125;}</span>'
    );
  };

  ngOnInit() {
    if (this.instanceId) this.loadHistory();
    const svc = this.collabSvc as any;
    this.sub = svc.promptUpdate$?.subscribe((evt: { instanceId: string | null }) => {
      if (evt?.instanceId === this.instanceId) this.loadHistory();
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  private async loadHistory() {
    try {
      const history = await this.megaSvc.getPromptHistory(this.instanceId);
      this.lastExecution.set(history[0] ?? null);
    } catch { /* silencieux */ }
  }

  emitDelete() { this.deleteBoard.emit(this.instanceId); }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
