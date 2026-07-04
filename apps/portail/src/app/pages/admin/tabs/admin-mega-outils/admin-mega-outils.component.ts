import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrelloAdminComponent, MockupAdminComponent, ArrayAdminComponent, PromptAdminComponent } from '@worganic/shared/ui';
import { navigateToProjets } from '../../../../shared/utils/navigate-to-projets';

type MoType = 'trello' | 'mockup' | 'array' | 'prompt' | 'form';

interface MoTypeDef {
  id: MoType;
  label: string;
  description: string;
  icon: string;
  /** Classes complètes (littérales, pour que Tailwind les détecte statiquement). */
  cardIdle: string;
  cardActive: string;
  iconWrap: string;
  iconColor: string;
  hasInstances: boolean; // false = pas de listing d'instances partagées possible (voir note)
}

@Component({
  selector: 'app-admin-mega-outils',
  standalone: true,
  imports: [CommonModule, TrelloAdminComponent, MockupAdminComponent, ArrayAdminComponent, PromptAdminComponent],
  template: `
    <div class="space-y-8">
      <div>
        <h2 class="text-base font-semibold text-light-text dark:text-white mb-1">Méga-outils</h2>
        <p class="text-sm text-light-text-muted dark:text-white/40">Gestion des outils partagés entre les projets.</p>
      </div>

      <!-- Types disponibles (accordéon) -->
      <div>
        <h3 class="text-xs font-bold uppercase tracking-wider text-light-text-muted dark:text-white/30 mb-3">Types disponibles</h3>
        <div class="flex flex-col gap-2">
          @for (t of types; track t.id) {
            <button type="button"
                    class="flex items-center gap-3 p-3 rounded-xl border transition-colors text-left w-full"
                    [ngClass]="expanded() === t.id ? t.cardActive : t.cardIdle"
                    (click)="toggle(t.id)">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" [ngClass]="t.iconWrap">
                <span class="material-symbols-outlined text-base" [ngClass]="t.iconColor">{{ t.icon }}</span>
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-light-text dark:text-white/85">{{ t.label }}</div>
                <div class="text-xs text-light-text-muted dark:text-white/40">{{ t.description }}</div>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-semibold">Actif</span>
              <span class="material-symbols-outlined text-light-text-muted dark:text-white/30 text-xl flex-shrink-0">{{ expanded() === t.id ? 'expand_less' : 'expand_more' }}</span>
            </button>
            @if (expanded() === t.id) {
              <div class="rounded-xl border border-light-border dark:border-white/10 bg-light-background/40 dark:bg-black/10 p-4">
                @switch (t.id) {
                  @case ('trello') { <app-trello-admin (openInEditor)="onOpenInEditor($event)" /> }
                  @case ('mockup') { <app-mockup-admin (openInEditor)="onOpenInEditor($event)" /> }
                  @case ('array')  { <app-array-admin (openInEditor)="onOpenInEditor($event)" /> }
                  @case ('prompt') { <app-prompt-admin (openInEditor)="onOpenInEditor($event)" /> }
                  @case ('form') {
                    <p class="text-sm text-light-text-muted dark:text-white/40">
                      Les formulaires du mode Guidé (et les questions ouvertes du mode Tchat) sont générés et répondus directement dans le document de chaque section — ce ne sont pas des instances partagées entre projets, il n'y a donc rien à lister ici.
                    </p>
                  }
                }
              </div>
            }
          }
        </div>
      </div>
    </div>
  `
})
export class AdminMegaOutilsComponent {
  readonly types: MoTypeDef[] = [
    {
      id: 'trello', label: 'Trello', description: 'Tableau kanban avec cartes, statuts et priorités', icon: 'view_kanban',
      cardIdle: 'border-light-border dark:border-white/10 bg-light-surface dark:bg-surface hover:border-blue-500/25',
      cardActive: 'border-blue-500/40 bg-blue-500/5',
      iconWrap: 'bg-blue-500/10 border border-blue-500/20', iconColor: 'text-blue-400',
      hasInstances: true,
    },
    {
      id: 'mockup', label: 'Mockup', description: 'Plan d\'écrans et de connexions entre pages', icon: 'design_services',
      cardIdle: 'border-light-border dark:border-white/10 bg-light-surface dark:bg-surface hover:border-violet-500/25',
      cardActive: 'border-violet-500/40 bg-violet-500/5',
      iconWrap: 'bg-violet-500/10 border border-violet-500/20', iconColor: 'text-violet-400',
      hasInstances: true,
    },
    {
      id: 'array', label: 'Tableau', description: 'Tableur simple avec cellules et styles', icon: 'table',
      cardIdle: 'border-light-border dark:border-white/10 bg-light-surface dark:bg-surface hover:border-lime-500/25',
      cardActive: 'border-lime-500/40 bg-lime-500/5',
      iconWrap: 'bg-lime-500/10 border border-lime-500/20', iconColor: 'text-lime-400',
      hasInstances: true,
    },
    {
      id: 'prompt', label: 'Prompt', description: 'Blocs de prompt IA exécutables avec historique', icon: 'smart_toy',
      cardIdle: 'border-light-border dark:border-white/10 bg-light-surface dark:bg-surface hover:border-amber-500/25',
      cardActive: 'border-amber-500/40 bg-amber-500/5',
      iconWrap: 'bg-amber-500/10 border border-amber-500/20', iconColor: 'text-amber-400',
      hasInstances: true,
    },
    {
      id: 'form', label: 'Form', description: 'Formulaires de cadrage (mode Guidé) et questions (mode Tchat)', icon: 'assignment',
      cardIdle: 'border-light-border dark:border-white/10 bg-light-surface dark:bg-surface hover:border-sky-500/25',
      cardActive: 'border-sky-500/40 bg-sky-500/5',
      iconWrap: 'bg-sky-500/10 border border-sky-500/20', iconColor: 'text-sky-400',
      hasInstances: false,
    },
  ];

  expanded = signal<MoType | null>(null);

  toggle(type: MoType) {
    this.expanded.update(v => v === type ? null : type);
  }

  onOpenInEditor(evt: { projectId: string; folderId?: string; outilId?: string }) {
    const params = new URLSearchParams();
    if (evt.folderId) params.set('section', evt.folderId);
    if (evt.outilId) params.set('outil', evt.outilId);
    const qs = params.toString();
    navigateToProjets(`projets/${evt.projectId}` + (qs ? `?${qs}` : ''));
  }
}
