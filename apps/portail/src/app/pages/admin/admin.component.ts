import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '@worganic/portail-core/data-access';
import { AdminDeploymentsComponent } from './tabs/admin-deployments/admin-deployments.component';
import { AdminThemeComponent } from './tabs/admin-theme/admin-theme.component';
import { ConfigComponent } from '../user/config/config.component';
import { AdminMegaOutilsComponent } from './tabs/admin-mega-outils/admin-mega-outils.component';
import { AdminMemoComponent } from './tabs/admin-memo/admin-memo.component';
import { AdminIaComponent } from './tabs/admin-ia/admin-ia.component';
import { AdminPortailComponent } from './tabs/admin-portail/admin-portail.component';
import { AdminTabsRegistryService, AdminTabDef, AdminTabGroup } from '@worganic/portail-core/data-access';

const BASE_ADMIN_TABS: AdminTabDef[] = [
  // Système : users/groupes/métiers/catalogue d'apps — voir AdminPortailComponent, qui
  // affiche son propre sous-menu (Utilisateurs/Applications/Groupes/Métiers). Renommé
  // "Système" (id inchangé) pour ne pas doublonner le nom de la catégorie "Portail".
  { id: 'portail',      label: 'Système',      icon: 'apps',          component: AdminPortailComponent,     order: 0, group: 'portail' },
  // Déploiement, Config et Thème pilotent le système transverse du portail (version/
  // déploiement, config générale, design général) — jamais spécifiques à une sous-appli.
  { id: 'deploiement',  label: 'Déploiement',  icon: 'rocket_launch', component: AdminDeploymentsComponent, order: 1, group: 'portail' },
  { id: 'config',       label: 'Config',       icon: 'settings',      component: ConfigComponent,           order: 2, group: 'portail' },
  { id: 'theme',        label: 'Thème',        icon: 'palette',       component: AdminThemeComponent,       order: 3, group: 'portail' },
  { id: 'mega-outils',  label: 'Méga-outils',  icon: 'extension',     component: AdminMegaOutilsComponent,  order: 4, group: 'autres' },
  { id: 'memo',         label: 'Mémo',         icon: 'menu_book',     component: AdminMemoComponent,        order: 5, group: 'autres' },
  { id: 'ia',           label: 'IA',           icon: 'smart_toy',     component: AdminIaComponent,          order: 6, group: 'autres' },
];

const CATEGORIES: { id: AdminTabGroup; label: string; icon: string }[] = [
  { id: 'portail',      label: 'Portail',      icon: 'apps' },
  { id: 'applications', label: 'Applications', icon: 'view_module' },
  { id: 'autres',       label: 'Autres',       icon: 'more_horiz' },
];

@Component({
    selector: 'app-admin',
    imports: [CommonModule, NgComponentOutlet, AdminDeploymentsComponent, AdminThemeComponent, ConfigComponent, AdminMegaOutilsComponent, AdminMemoComponent, AdminIaComponent, AdminPortailComponent],
    templateUrl: './admin.component.html',
    styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  readonly tabsRegistry = inject(AdminTabsRegistryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = CATEGORIES;

  activeTab     = signal<string>('projets');
  helpCount     = signal(0);
  versionStatus = signal<any>(null);

  /** Catégorie déduite de l'onglet actif — pas d'état séparé à garder synchronisé. */
  activeCategory = computed<AdminTabGroup>(() => {
    const tab = this.tabsRegistry.allTabs().find(t => t.id === this.activeTab());
    return tab?.group ?? 'autres';
  });

  /** Onglets de la catégorie active, pour la rangée de sous-onglets. */
  tabsInCategory = computed<AdminTabDef[]>(() =>
    this.tabsRegistry.allTabs().filter(t => (t.group ?? 'autres') === this.activeCategory())
  );

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const user = this.authService.currentUser();
    if (!user || user.role !== 'admin') {
      this.router.navigate(['/home']);
      return;
    }

    this.tabsRegistry.registerBase(BASE_ADMIN_TABS);

    // Redirige les anciennes URLs queryParam (/admin?tab=xxx) vers le format path (/admin/xxx)
    const qpTab = this.route.snapshot.queryParamMap.get('tab');
    if (qpTab) {
      this.router.navigate(['/admin', qpTab], { replaceUrl: true });
      return;
    }

    // Abonnement réactif aux changements de segment de route (inclut le chargement initial)
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const tab = params['tab'] || 'projets';
      this.activeTab.set(tab);
      // Pas de segment → redirige vers l'onglet par défaut
      if (!params['tab']) {
        this.router.navigate(['/admin', 'projets'], { replaceUrl: true });
      }
    });
  }

  setTab(tab: string) {
    this.activeTab.set(tab);
    this.router.navigate(['/admin', tab]);
  }

  /** Sélectionne une catégorie : bascule sur son premier onglet (trié par order). */
  setCategory(category: AdminTabGroup) {
    const tabs = this.tabsRegistry.allTabs()
      .filter(t => (t.group ?? 'autres') === category)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    if (tabs[0]) this.setTab(tabs[0].id);
  }

  getBadge(tabId: string): number | null {
    if (tabId === 'memo') return this.helpCount() > 0 ? this.helpCount() : null;
    return null;
  }

  getAlert(tabId: string): boolean {
    if (tabId === 'deploiement' && this.versionStatus()) {
      const vs = this.versionStatus();
      return vs.mode === 'child' ? (!vs.child?.upToDate || !vs.base?.upToDate) : !vs.upToDate;
    }
    return false;
  }
}
