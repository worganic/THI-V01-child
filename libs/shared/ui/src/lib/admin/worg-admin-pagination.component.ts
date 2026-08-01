import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Barre de pagination des tableaux d'administration : choix du nombre de
 * lignes par page (« Tous » = 0) et navigation page précédente / suivante.
 *
 * Partagée par les quatre tableaux d'Admin › Portail — c'est le même besoin à
 * chaque fois, et le composant reste purement présentatif : il ne découpe pas
 * la liste (voir `paginate()` dans admin-table.util.ts), il ne fait que
 * remonter les intentions de l'utilisateur.
 */
@Component({
  selector: 'worg-admin-pagination',
  imports: [FormsModule],
  template: `
    <div class="flex items-center flex-wrap gap-3 mt-3 text-xs">
      <label class="text-light-text-muted dark:text-white/40" [attr.for]="selectId()">Par page :</label>
      <select [id]="selectId()" [ngModel]="pageSize()" (ngModelChange)="pageSizeChange.emit(+$event)"
              class="px-2 py-1.5 rounded-lg bg-light-surface dark:bg-white/5 dark:[color-scheme:dark] border border-light-border dark:border-white/10 text-light-text dark:text-white text-xs focus:outline-none focus:border-light-primary dark:focus:border-primary transition-colors">
        @for (size of pageSizeOptions; track size) {
          <option [ngValue]="size">{{ size === 0 ? 'Tous' : size }}</option>
        }
      </select>

      @if (showTotal()) {
        <span class="text-light-text-muted dark:text-white/40">
          {{ total() }} {{ total() > 1 ? itemLabelPlural() : itemLabel() }}
        </span>
      }

      @if (pageSize() > 0) {
        <div class="flex items-center gap-2 ml-auto">
          <button type="button" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)"
                  class="px-2.5 py-1.5 rounded-lg bg-light-surface dark:bg-white/5 border border-light-border dark:border-white/10 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            ‹ Précédent
          </button>
          <span class="text-light-text-muted dark:text-white/40">Page {{ page() }} / {{ totalPages() }}</span>
          <button type="button" [disabled]="page() >= totalPages()" (click)="pageChange.emit(page() + 1)"
                  class="px-2.5 py-1.5 rounded-lg bg-light-surface dark:bg-white/5 border border-light-border dark:border-white/10 text-light-text-muted dark:text-white/50 hover:text-light-text dark:hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Suivant ›
          </button>
        </div>
      }
    </div>
  `
})
export class WorgAdminPaginationComponent {
  /** Nombre total de lignes APRÈS filtrage (et non la taille de la page). */
  total = input.required<number>();
  pageSize = input.required<number>();
  page = input.required<number>();
  /**
   * Résumé « 12 utilisateurs » dans la barre. Éteint par défaut : le compte est
   * en général déjà affiché à droite de la barre de filtres, au-dessus du
   * tableau, et le répéter ici alourdit la page pour rien.
   */
  showTotal = input<boolean>(false);
  /** Libellé de l'entité comptée, pour le résumé ci-dessus. */
  itemLabel = input<string>('élément');
  itemLabelPlural = input<string>('éléments');
  /** Distingue les `<label for>` quand plusieurs barres cohabitent. */
  selectId = input<string>('admin-page-size');

  pageSizeChange = output<number>();
  pageChange = output<number>();

  readonly pageSizeOptions = [10, 25, 50, 0];

  totalPages = computed(() =>
    this.pageSize() <= 0 ? 1 : Math.max(1, Math.ceil(this.total() / this.pageSize()))
  );
}
