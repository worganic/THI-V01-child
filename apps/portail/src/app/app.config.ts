import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { runtimeEnv } from './runtime-env';
import { authInterceptor } from '@worganic/portail-core/auth';
import { DbStatusService, AppConfigService, API_DATA_URL, API_EXECUTOR_URL, API_AGENT_URL, APP_BRANDING } from '@worganic/portail-core/data-access';
import { CHILD_ADMIN_TABS_PROVIDERS } from './child/child-admin-tabs';
import { provideAgendaAdminTab } from '../../../appli-agenda/src/app/admin/provide-agenda-admin-tab';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: API_DATA_URL, useValue: runtimeEnv.apiDataUrl },
    { provide: API_EXECUTOR_URL, useValue: runtimeEnv.apiExecutorUrl },
    { provide: API_AGENT_URL, useValue: runtimeEnv.apiAgentUrl },
    {
      provide: APP_BRANDING,
      useValue: {
        appName: runtimeEnv.appName,
        copyrightHolder: runtimeEnv.copyrightHolder,
        copyrightTagline: runtimeEnv.copyrightTagline,
        copyrightYear: runtimeEnv.copyrightYear,
      }
    },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideAppInitializer(() => inject(DbStatusService).check()),
    provideAppInitializer(() => inject(AppConfigService).load()),
    ...CHILD_ADMIN_TABS_PROVIDERS,
    ...provideAgendaAdminTab()
  ]
};
