import { Component, OnInit, ViewChild } from '@angular/core';
import {
  TicketWidgetComponent, CahierRecetteWidgetComponent,
  WoTchatIaWidgetComponent, WoActionsWidgetComponent,
  WoToolsPanelComponent
} from '@portail/shared-ui';
import { AuthService, ConfigService, WoActionHistoryService } from '@portail/core-data-access';
import { WorgHelpDrawerComponent } from './shared/help/worg-help-drawer.component';

/**
 * Éléments d'interface globaux propres à CE portail : widgets flottants,
 * panneaux, volets d'aide — tout ce qui vit à côté du `<router-outlet>` sans
 * appartenir au socle.
 *
 * Ce composant existe dans les deux monorepos sous le même nom, le même
 * sélecteur et le même chemin, avec un contenu propre à chaque portail : c'est
 * le point d'extension qui permet à `app.ts` et `app.html` de rester
 * identiques bit-à-bit.
 *
 * Ce portail y héberge ses outils maison (tickets, cahier de recette, Tchat IA,
 * actions, panneau d'outils externes, volet d'aide).
 */
@Component({
  selector: 'app-portal-extras',
  standalone: true,
  imports: [
    TicketWidgetComponent,
    CahierRecetteWidgetComponent,
    WoTchatIaWidgetComponent,
    WoActionsWidgetComponent,
    WoToolsPanelComponent,
    WorgHelpDrawerComponent
  ],
  template: `
    <!-- Widgets flottants (conditionnels sur feature flags) -->
    @if (configService.ticketsEnabled() && auth.currentUser()) {
      <wo-ticket-widget></wo-ticket-widget>
    }

    @if (configService.recetteWidgetEnabled() && auth.currentUser()) {
      <wo-cahier-recette-widget></wo-cahier-recette-widget>
    }

    @if (configService.tchatIaEnabled() && auth.currentUser()) {
      <wo-tchat-ia-widget></wo-tchat-ia-widget>
    }

    @if (configService.actionsEnabled() && auth.currentUser()) {
      <wo-actions-widget></wo-actions-widget>
    }

    <!-- Panneau Outils Externes (toujours présent si connecté, état géré en interne) -->
    @if (auth.currentUser()) {
      <wo-tools-panel></wo-tools-panel>
    }

    <!-- Volet d'aide contextuelle (global, déclenché par worg-help) -->
    <worg-help-drawer></worg-help-drawer>
  `,
})
export class PortalExtrasComponent implements OnInit {
  @ViewChild(WoToolsPanelComponent) toolsPanel?: WoToolsPanelComponent;

  constructor(
    public auth: AuthService,
    public configService: ConfigService,
    private woActionHistory: WoActionHistoryService
  ) {}

  ngOnInit(): void {
    // Revalide le jeton au démarrage : la session est restaurée de façon
    // optimiste depuis le localStorage, l'API tranche.
    if (this.auth.getToken()) {
      this.auth.verify().catch(() => {});
    }
    (window as any).WoActionHistory = {
      track: (ctx: any) => this.woActionHistory.track(ctx)
    };
  }

  openToolsPanel(): void {
    this.toolsPanel?.open();
  }
}
