import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent, FooterComponent, BackendUnavailableComponent, RuntimeInfoService } from '@portail/shared-ui';
import { PortalExtrasComponent } from './portal-extras.component';

/**
 * Racine du shell du portail : header, contenu routé, footer.
 *
 * Fichier identique dans les deux monorepos. Les éléments globaux propres à
 * chaque portail (widgets flottants, panneaux, volet d'aide) sont regroupés
 * dans `portal-extras.component.ts`, monté ci-dessous.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, HeaderComponent, FooterComponent, BackendUnavailableComponent, PortalExtrasComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  protected readonly runtime = inject(RuntimeInfoService);
}
