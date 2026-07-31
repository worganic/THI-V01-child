import { Component, Input, OnInit, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService, AppConfigService, ConfigService, PortalAppsService, PortalApp } from '@portail/core-data-access';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './nav.component.html',
})
export class NavComponent implements OnInit {
  /** Quand fourni (contexte projets), tous les liens portail redirigent vers cette URL de base */
  @Input() externalBaseUrl?: string;
  /** Route active à mettre en évidence en mode externe (ex: '/projets' dans l'app projets) */
  @Input() activeExternalRoute = '';
  /** Callback appelé quand une sous-application externe (URL absolue, ex. projets) est cliquée
   * en mode portail — transmet la session (token/thème) via navigateToApp(url). */
  @Input() onAppClick?: (url: string) => void;

  private portalApps = inject(PortalAppsService);

  /**
   * Sous-applications à afficher dans le menu : dérivées du signal partagé
   * `PortalAppsService.authorizedApps` (providedIn: 'root') — c'est-à-dire les
   * applications réellement autorisées pour l'utilisateur connecté (groupes
   * auxquels il appartient + accès directs, même filtrage que la page
   * d'accueil ; un admin voit toujours tout), PAS le catalogue brut de toutes
   * les apps actives. Triées par `ordre` puis nom. Dès qu'une app est
   * enregistrée (auto-catalogage au démarrage du serveur), qu'un utilisateur
   * est ajouté/retiré d'un groupe, ou que son état change dans Admin › Portail
   * › Système › Applications, ce computed se met à jour automatiquement — le
   * menu reflète les permissions en direct, sans rechargement de page.
   */
  visibleApps = computed<PortalApp[]>(() => {
    return [...this.portalApps.authorizedApps()]
      .filter(a => a.isAvailable !== false)
      .sort((a, b) => (a.ordre - b.ordre) || a.nom.localeCompare(b.nom));
  });

  constructor(
    public auth: AuthService,
    public appConfig: AppConfigService,
    public configService: ConfigService,
  ) {}

  ngOnInit(): void {
    // Amorce le signal partagé s'il n'a encore été chargé par personne dans cette session
    // (ex. la page d'accueil n'a pas encore été ouverte).
    if (this.portalApps.authorizedApps().length === 0) {
      this.portalApps.getHomeDashboard().catch(() => { /* silencieux — au pire le menu reste vide */ });
    }
  }

  get isExternal(): boolean {
    return !!this.externalBaseUrl;
  }

  handleExternalRoute(route: string): void {
    window.location.href = `${this.externalBaseUrl}${route}`;
  }

  isActiveExternal(route: string): boolean {
    return this.isExternal && this.activeExternalRoute === route;
  }

  /** Une sous-appli "autonome" (Mode autonome, voir docs/architecture-sous-applications.md)
   * a une URL absolue dans son `urlPath` (ex. projets, http://localhost:4203) — toutes les
   * autres sont montées en interne (`/agenda`, `/recettes`, `/documents`…). */
  isExternalApp(app: PortalApp): boolean {
    return /^https?:\/\//i.test(app.urlPath || '');
  }

  /** Vrai si ce nav est actuellement rendu DEPUIS l'app externe elle-même (ex. le nav de
   * appli-projets affichant son propre item "Projets") : pas de lien cliquable dans ce cas,
   * juste un indicateur actif — convention : `activeExternalRoute` = '/' + code de l'app. */
  isCurrentApp(app: PortalApp): boolean {
    return this.isExternal && this.activeExternalRoute === `/${app.code}`;
  }

  openExternalApp(app: PortalApp): void {
    this.onAppClick?.(app.urlPath);
  }
}
