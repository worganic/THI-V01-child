import { Component, OnInit, Output, EventEmitter, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MegaOutilsService, MegaOutilInstance, PromptExecution } from '@worganic/portail-core/data-access';

interface AdminPrompt {
  instance: MegaOutilInstance;
  projectName: string;
  folderName: string | null;
  history?: PromptExecution[];
  historyExpanded?: boolean;
  historyLoading?: boolean;
}

@Component({
  selector: 'app-prompt-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>

      <!-- Prompt de base global -->
      <div class="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-amber-400 text-base">auto_awesome</span>
          <h3 class="text-sm font-semibold text-light-text dark:text-white">Prompt système de base</h3>
          <span class="text-[10px] text-light-text-muted dark:text-white/40 ml-1">— Ajouté automatiquement avant le prompt de chaque section</span>
        </div>
        <textarea
          class="w-full rounded-lg border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 text-sm px-3 py-2 resize-y min-h-[100px] font-mono"
          placeholder="Ex: Tu es un expert en rédaction web pour PME francophones. Réponds toujours en français..."
          [(ngModel)]="basePromptDraft"
          rows="5"></textarea>
        <div class="flex items-center gap-2 mt-2">
          @if (basePromptSaved()) {
            <span class="text-xs text-green-400 flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">check_circle</span>Sauvegardé
            </span>
          }
          <span class="flex-1"></span>
          <button class="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold hover:bg-amber-500/25 transition-colors flex items-center gap-1.5"
                  [disabled]="basePromptSaving()"
                  (click)="saveBasePrompt()">
            <span class="material-symbols-outlined text-sm">save</span>
            {{ basePromptSaving() ? 'Sauvegarde…' : 'Sauvegarder' }}
          </button>
        </div>
      </div>

      <!-- Workflow guidé : méta-prompts cadrage + génération -->
      <div class="mb-8 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div class="flex items-center gap-2 mb-1">
          <span class="material-symbols-outlined text-blue-400 text-base">conversation</span>
          <h3 class="text-sm font-semibold text-light-text dark:text-white">Workflow guidé (Mode guidé des prompts)</h3>
        </div>
        <p class="text-[11px] text-light-text-muted dark:text-white/40 mb-3">Méta-prompts utilisés quand un prompt est en « Mode guidé » : l'IA pose d'abord des questions (cadrage), puis produit le livrable (génération).</p>

        <label class="block text-[11px] font-medium text-blue-300/80 mb-1">Prompt de cadrage (génère le formulaire de questions)</label>
        <textarea
          class="w-full rounded-lg border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 text-sm px-3 py-2 resize-y min-h-[100px] font-mono mb-3"
          [(ngModel)]="clarifyPromptDraft"
          rows="6"></textarea>

        <label class="block text-[11px] font-medium text-blue-300/80 mb-1">Prompt de génération (produit le livrable + MegaOutils)</label>
        <textarea
          class="w-full rounded-lg border border-light-border dark:border-white/15 bg-light-background dark:bg-background text-light-text dark:text-white/85 text-sm px-3 py-2 resize-y min-h-[100px] font-mono"
          [(ngModel)]="generatePromptDraft"
          rows="6"></textarea>

        <div class="flex items-center gap-2 mt-2">
          @if (workflowPromptSaved()) {
            <span class="text-xs text-green-400 flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">check_circle</span>Sauvegardé
            </span>
          }
          <span class="flex-1"></span>
          <button class="text-xs px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold hover:bg-blue-500/25 transition-colors flex items-center gap-1.5"
                  [disabled]="workflowPromptSaving()"
                  (click)="saveWorkflowPrompts()">
            <span class="material-symbols-outlined text-sm">save</span>
            {{ workflowPromptSaving() ? 'Sauvegarde…' : 'Sauvegarder' }}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3 mb-6">
        <div class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <span class="material-symbols-outlined text-amber-400 text-base">smart_toy</span>
        </div>
        <div class="flex-1">
          <h2 class="text-base font-semibold text-light-text dark:text-white">Prompt — Toutes les instances</h2>
          <p class="text-xs text-light-text-muted dark:text-white/40">{{ items().length }} instance{{ items().length > 1 ? 's' : '' }} au total</p>
        </div>
        <button class="text-xs px-3 py-1.5 rounded-lg border border-light-border dark:border-white/20 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-colors flex items-center gap-1.5"
                (click)="reload()">
          <span class="material-symbols-outlined text-sm" [ngClass]="{'animate-spin': loading()}">refresh</span> Rafraîchir
        </button>
      </div>

      @if (loading()) {
        <p class="text-sm text-light-text-muted dark:text-white/40">Chargement…</p>
      } @else if (!items().length) {
        <p class="text-sm text-light-text-muted dark:text-white/40">Aucune instance Prompt.</p>
      } @else {
        <div class="flex flex-col gap-3">
          @for (item of items(); track item.instance.id) {
            <div class="rounded-xl border border-light-border dark:border-white/10 bg-light-surface dark:bg-surface overflow-hidden">

              <!-- En-tête instance -->
              <div class="flex items-start gap-3 p-3">
                <span class="material-symbols-outlined text-amber-400 text-base flex-shrink-0 mt-0.5">smart_toy</span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-light-text dark:text-white/85 truncate">{{ item.instance.name }}</div>
                  <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <button type="button"
                            class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-light-background dark:bg-background border border-light-border dark:border-white/10 text-light-text-muted dark:text-white/50 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                            (click)="openInEditor.emit({ projectId: item.instance.projectId })">
                      <span class="material-symbols-outlined text-[11px]">grid_view</span>projets
                    </button>
                    @if (item.projectName) {
                      <button type="button"
                              class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-light-background dark:bg-background border border-light-border dark:border-white/10 text-light-text-muted dark:text-white/50 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                              (click)="openInEditor.emit({ projectId: item.instance.projectId })">
                        <span class="material-symbols-outlined text-[11px]">folder</span>{{ item.projectName }}
                      </button>
                    }
                    @if (item.folderName) {
                      <span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-light-background dark:bg-background border border-light-border dark:border-white/10 text-light-text-muted dark:text-white/50">
                        <span class="material-symbols-outlined text-[11px]">tag</span>{{ item.folderName }}
                      </span>
                    }
                  </div>
                </div>
                <!-- Bouton historique -->
                <button class="text-[11px] px-2.5 py-1 rounded-md border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/40 hover:text-amber-400 hover:border-amber-500/30 transition-colors flex items-center gap-1"
                        (click)="toggleHistory(item)">
                  <span class="material-symbols-outlined text-[13px]">history</span>
                  {{ item.historyExpanded ? 'Fermer' : 'Historique' }}
                </button>
                <!-- Bouton supprimer -->
                @if (confirmDeleteId() === item.instance.id) {
                  <button class="text-[11px] px-2 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/25 transition-colors"
                          (click)="deleteInstance(item.instance.id)">Confirmer</button>
                  <button class="text-[11px] px-2 py-1 rounded-md border border-light-border dark:border-white/15 text-light-text-muted dark:text-white/40 hover:text-light-text dark:hover:text-white transition-colors"
                          (click)="confirmDeleteId.set(null)">Annuler</button>
                } @else {
                  <button class="w-7 h-7 flex items-center justify-center rounded-md text-light-text-muted dark:text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Supprimer ce Prompt"
                          (click)="confirmDeleteId.set(item.instance.id)">
                    <span class="material-symbols-outlined text-base">delete</span>
                  </button>
                }
              </div>

              <!-- Historique des exécutions -->
              @if (item.historyExpanded) {
                <div class="border-t border-light-border dark:border-white/8 p-3">
                  @if (item.historyLoading) {
                    <p class="text-xs text-light-text-muted dark:text-white/30">Chargement…</p>
                  } @else if (!item.history?.length) {
                    <p class="text-xs text-light-text-muted dark:text-white/30">Aucune exécution enregistrée.</p>
                  } @else {
                    <div class="flex flex-col gap-2">
                      @for (exec of item.history; track exec.id) {
                        <div class="rounded-lg border border-light-border dark:border-white/8 bg-light-background dark:bg-background p-2.5">
                          <div class="flex items-center gap-2 mb-1.5">
                            <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">{{ exec.provider }}/{{ exec.model }}</span>
                            <span class="text-[10px] text-light-text-muted dark:text-white/30">{{ formatDate(exec.executedAt) }}</span>
                          </div>
                          <p class="text-[12px] text-light-text-muted dark:text-white/50 line-clamp-3 whitespace-pre-wrap">{{ exec.result }}</p>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PromptAdminComponent implements OnInit {
  @Output() openInEditor = new EventEmitter<{ projectId: string; folderId?: string; outilId?: string }>();

  private megaSvc = inject(MegaOutilsService);

  items = signal<AdminPrompt[]>([]);
  loading = signal(false);
  confirmDeleteId = signal<string | null>(null);
  basePromptDraft = '';
  basePromptSaving = signal(false);
  basePromptSaved = signal(false);

  clarifyPromptDraft = '';
  generatePromptDraft = '';
  workflowPromptSaving = signal(false);
  workflowPromptSaved = signal(false);

  ngOnInit() {
    this.reload();
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const cfg = await this.megaSvc.getPromptGlobalConfig();
      this.basePromptDraft = cfg.baseSystemPrompt || '';
      this.clarifyPromptDraft = cfg.workflowClarifyPrompt || '';
      this.generatePromptDraft = cfg.workflowGeneratePrompt || '';
    } catch { /* silencieux */ }
  }

  async saveBasePrompt() {
    this.basePromptSaving.set(true);
    this.basePromptSaved.set(false);
    try {
      await this.megaSvc.savePromptGlobalConfig({ baseSystemPrompt: this.basePromptDraft });
      this.basePromptSaved.set(true);
      setTimeout(() => this.basePromptSaved.set(false), 2000);
    } catch { /* silencieux */ } finally {
      this.basePromptSaving.set(false);
    }
  }

  async saveWorkflowPrompts() {
    this.workflowPromptSaving.set(true);
    this.workflowPromptSaved.set(false);
    try {
      await this.megaSvc.savePromptGlobalConfig({
        workflowClarifyPrompt: this.clarifyPromptDraft,
        workflowGeneratePrompt: this.generatePromptDraft,
      });
      this.workflowPromptSaved.set(true);
      setTimeout(() => this.workflowPromptSaved.set(false), 2000);
    } catch { /* silencieux */ } finally {
      this.workflowPromptSaving.set(false);
    }
  }

  async reload() {
    this.loading.set(true);
    try {
      const rows = await this.megaSvc.getAllPromptInstances();
      this.items.set(rows.map(r => ({ ...r, historyExpanded: false, historyLoading: false, history: undefined })));
    } catch { /* silencieux */ } finally {
      this.loading.set(false);
    }
  }

  async deleteInstance(id: string) {
    try {
      await this.megaSvc.deleteInstance(id);
      this.items.update(arr => arr.filter(i => i.instance.id !== id));
    } catch { /* silencieux */ } finally {
      this.confirmDeleteId.set(null);
    }
  }

  async toggleHistory(item: AdminPrompt) {
    item.historyExpanded = !item.historyExpanded;
    if (item.historyExpanded && !item.history) {
      item.historyLoading = true;
      try {
        item.history = await this.megaSvc.getPromptHistory(item.instance.id);
      } catch { item.history = []; } finally {
        item.historyLoading = false;
      }
    }
    this.items.update(arr => [...arr]);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
