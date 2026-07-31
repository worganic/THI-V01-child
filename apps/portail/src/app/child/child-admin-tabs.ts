import { APP_INITIALIZER, Provider } from '@angular/core';
import { AdminTabsRegistryService, AdminTabDef } from '@worganic/portail-core/data-access';
import { AdminProjetsComponent } from '../pages/admin/tabs/admin-projets/admin-projets.component';
import { AdminToolsComponent } from '../pages/admin/tabs/admin-tools/admin-tools.component';
import { AdminTestsComponent } from '../pages/admin/tabs/admin-tests/admin-tests.component';

const CHILD_ADMIN_TABS: AdminTabDef[] = [
  // Groupe 'applications' comme agenda/recettes : c'est l'admin propre à la
  // sous-application projets (Mode autonome — le composant redirige vers
  // l'app externe plutôt que de rendre une UI locale, voir
  // docs/architecture-sous-applications.md, mais reste catégorisé pareil).
  { id: 'projets', label: 'Projets', icon: 'article',     component: AdminProjetsComponent, order: 0,  group: 'applications' },
  // Outils : active/désactive les widgets flottants (Tchat IA, Recette, Tickets, Actions...)
  // via des réglages de config générale (ConfigService) — transverse, pas propre à une
  // sous-appli particulière malgré leur usage principal dans l'éditeur de apps/appli-projets.
  { id: 'tools',   label: 'Outils',  icon: 'build',       component: AdminToolsComponent,   order: 10, group: 'portail' },
  { id: 'tests',   label: 'Tests',   icon: 'bug_report',  component: AdminTestsComponent,   order: 11, group: 'autres' },
];

export const CHILD_ADMIN_TABS_PROVIDERS: Provider[] = [
  {
    provide: APP_INITIALIZER,
    useFactory: (registry: AdminTabsRegistryService) => () => registry.registerChild(CHILD_ADMIN_TABS),
    deps: [AdminTabsRegistryService],
    multi: true
  }
];
