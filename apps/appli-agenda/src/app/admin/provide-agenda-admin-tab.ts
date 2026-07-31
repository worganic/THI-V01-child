import { EnvironmentProviders, Provider, provideAppInitializer, inject } from '@angular/core';
import { AdminTabsRegistryService, AdminTabDef } from '@portail/core-data-access';
import { AdminAgendaComponent } from './admin-agenda.component';

const AGENDA_ADMIN_TAB: AdminTabDef = {
  id: 'agenda', label: 'Agenda', icon: 'calendar_month', component: AdminAgendaComponent, order: 20, group: 'applications'
};

/**
 * Contribue l'onglet admin de l'agenda au portail hôte.
 *
 * La définition de l'onglet appartient au dossier de la sous-application, pas
 * au portail : c'est le contrat "sous-application" (voir
 * docs/architecture-sous-applications.md). Le portail se contente d'appeler
 * cette fonction dans les `providers` de son app.config.ts — une ligne, la même
 * des deux côtés.
 */
export function provideAgendaAdminTab(): (Provider | EnvironmentProviders)[] {
  return [
    provideAppInitializer(() => {
      inject(AdminTabsRegistryService).registerChild([AGENDA_ADMIN_TAB]);
    })
  ];
}
