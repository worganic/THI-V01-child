import { APP_INITIALIZER, Provider } from '@angular/core';
import { AdminTabsRegistryService, AdminTabDef } from '../core/services/admin-tabs-registry.service';
import { AdminProjetsComponent } from '../pages/admin/tabs/admin-projets/admin-projets.component';
import { AdminToolsComponent } from '../pages/admin/tabs/admin-tools/admin-tools.component';
import { AdminThemeComponent } from '../pages/child/admin-theme/admin-theme.component';

const CHILD_ADMIN_TABS: AdminTabDef[] = [
  { id: 'projets', label: 'Projets', icon: 'article', component: AdminProjetsComponent, order: 0 },
  { id: 'theme',   label: 'Thème',   icon: 'palette', component: AdminThemeComponent,   order: 5 },
  { id: 'tools',   label: 'Outils',  icon: 'build',   component: AdminToolsComponent,   order: 10 },
];

export const CHILD_ADMIN_TABS_PROVIDERS: Provider[] = [
  {
    provide: APP_INITIALIZER,
    useFactory: (registry: AdminTabsRegistryService) => () => registry.registerChild(CHILD_ADMIN_TABS),
    deps: [AdminTabsRegistryService],
    multi: true
  }
];
