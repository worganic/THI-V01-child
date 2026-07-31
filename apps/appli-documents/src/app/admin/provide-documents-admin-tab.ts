import { APP_INITIALIZER, Provider } from '@angular/core';
import { AdminTabsRegistryService, AdminTabDef } from '@worganic/portail-core/data-access';
import { AdminDocumentsComponent } from './admin-documents.component';

const DOCUMENTS_ADMIN_TAB: AdminTabDef = {
  id: 'documents', label: 'Documents', icon: 'description', component: AdminDocumentsComponent, order: 22, group: 'applications'
};

/**
 * Contribue l'onglet admin des documents au portail — même mécanisme que
 * provide-agenda-admin-tab.ts / provide-recettes-admin-tab.ts, la définition
 * de l'onglet appartient au dossier de la sous-application, pas au portail —
 * voir docs/architecture-sous-applications.md.
 */
export function provideDocumentsAdminTab(): Provider[] {
  return [
    {
      provide: APP_INITIALIZER,
      useFactory: (registry: AdminTabsRegistryService) => () => registry.registerChild([DOCUMENTS_ADMIN_TAB]),
      deps: [AdminTabsRegistryService],
      multi: true
    }
  ];
}
