import { APP_INITIALIZER, Provider } from '@angular/core';
import { AdminTabsRegistryService, AdminTabDef } from '@worganic/portail-core/data-access';
import { AdminAgendaComponent } from './admin-agenda.component';

const AGENDA_ADMIN_TAB: AdminTabDef = {
  id: 'agenda', label: 'Agenda', icon: 'calendar_month', component: AdminAgendaComponent, order: 20
};

/**
 * Contribue l'onglet admin de l'agenda au portail — même mécanisme que
 * CHILD_ADMIN_TABS_PROVIDERS (apps/portail/src/app/child/child-admin-tabs.ts),
 * mais la définition de l'onglet appartient au dossier de la sous-application,
 * pas au portail : c'est le contrat "sous-application" (voir
 * docs/architecture-sous-applications.md).
 */
export function provideAgendaAdminTab(): Provider[] {
  return [
    {
      provide: APP_INITIALIZER,
      useFactory: (registry: AdminTabsRegistryService) => () => registry.registerChild([AGENDA_ADMIN_TAB]),
      deps: [AdminTabsRegistryService],
      multi: true
    }
  ];
}
