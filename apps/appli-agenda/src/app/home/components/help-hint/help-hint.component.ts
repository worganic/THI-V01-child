import { Component, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Petite pastille « ? » ouvrant une explication contextuelle de la zone où elle est posée.
 *
 * Le contenu est projeté (`<ng-content>`) plutôt que passé en chaîne : les explications
 * contiennent des listes et de la mise en forme, et les écrire directement dans le template de
 * la zone concernée garde le texte au plus près de ce qu'il décrit (il vieillit moins vite).
 *
 * Posée dans un `card-header` cliquable (les en-têtes replient/déplient leur zone), elle stoppe
 * la propagation de ses propres clics : demander de l'aide ne doit pas refermer la zone.
 */
@Component({
  selector: 'app-help-hint',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './help-hint.component.html',
  styleUrls: ['./help-hint.component.scss']
})
export class HelpHintComponent {
  /** Titre affiché en tête du popup (en général le nom de la zone expliquée). */
  @Input() heading = 'Aide';

  open = false;

  toggle(event: Event): void {
    event.stopPropagation();
    this.open = !this.open;
  }

  close(event?: Event): void {
    event?.stopPropagation();
    this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }
}
