import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { loadFromLocalStorage, saveToLocalStorage, userScopedKey } from '../../../../utils/local-cache';

/**
 * Zone d'aide générale, en bas de page : récapitule à quoi sert chaque zone de l'agenda et les
 * règles de fonctionnement qui ne se devinent pas à l'écran (plan figé après création, jours
 * ajoutés tracés, contraintes non rétroactives...).
 *
 * Repliée par défaut — c'est une référence qu'on consulte, pas un contenu à traverser à chaque
 * visite. L'état de repli est mémorisé par utilisateur, comme les autres zones de la page.
 */
@Component({
  selector: 'app-aide-agenda',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aide-agenda.component.html',
  styleUrls: ['./aide-agenda.component.scss']
})
export class AideAgendaComponent {
  private readonly collapsedCacheKey = userScopedKey('agenda:local-cache:collapsed:aide');
  collapsed = loadFromLocalStorage(this.collapsedCacheKey, true);

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    saveToLocalStorage(this.collapsedCacheKey, this.collapsed);
  }
}
