import { Component, OnInit, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthService,
  AppConfigService,
  PortalAppsService,
  PortalApp,
  PortalGroupeAvecApps,
} from '@worganic/portail-core/data-access';
import { navigateToApp } from '../../../shared/utils/navigate-to-projets';

/**
 * Page d'accueil du portail : liste les sous-applications auxquelles
 * l'utilisateur a accès, regroupées par groupe (voir Admin › Applications).
 */
@Component({
    selector: 'app-home',
    imports: [],
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private portalApps = inject(PortalAppsService);

  groupes = signal<PortalGroupeAvecApps[]>([]);
  loading = signal(true);
  error   = signal('');

  constructor(private router: Router, public auth: AuthService, public appConfig: AppConfigService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.portalApps.getHomeDashboard();
      // Une application référencée en base mais dont le dossier est absent de
      // cette installation (isAvailable === false, voir portal-apps.js) ne doit
      // pas apparaître : ni carte cliquable, ni groupe vide en résultant.
      const groupes = (data.groupes || [])
        .map(g => ({ ...g, apps: g.apps.filter(a => a.isAvailable !== false) }))
        .filter(g => g.apps.length > 0);
      this.groupes.set(groupes);
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Impossible de charger vos applications.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Route interne du portail (`/documents`) ou sous-application externe (`http://…`). */
  openApp(app: PortalApp): void {
    const url = (app.urlPath || '').trim();
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      navigateToApp(url);
    } else {
      this.router.navigate([url.startsWith('/') ? url : `/${url}`]);
    }
  }

  goToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  get isAdmin(): boolean {
    return this.auth.currentUser()?.role === 'admin';
  }

  get totalApps(): number {
    return this.groupes().reduce((n, g) => n + g.apps.length, 0);
  }
}
