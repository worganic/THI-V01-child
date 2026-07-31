import { APP_INITIALIZER, Provider } from '@angular/core';
import { AdminTabsRegistryService, AdminTabDef } from '@worganic/portail-core/data-access';
import { AdminRecettesComponent } from './admin-recettes.component';

const RECETTES_ADMIN_TAB: AdminTabDef = {
  id: 'recettes', label: 'Recettes', icon: 'restaurant_menu', component: AdminRecettesComponent, order: 21, group: 'applications'
};

/**
 * Contribue l'onglet admin des recettes au portail — même mécanisme que
 * provide-agenda-admin-tab.ts (apps/appli-agenda/src/app/admin/), la définition
 * de l'onglet appartient au dossier de la sous-application, pas au portail —
 * voir docs/architecture-sous-applications.md.
 */
export function provideRecettesAdminTab(): Provider[] {
  return [
    {
      provide: APP_INITIALIZER,
      useFactory: (registry: AdminTabsRegistryService) => () => registry.registerChild([RECETTES_ADMIN_TAB]),
      deps: [AdminTabsRegistryService],
      multi: true
    }
  ];
}
