import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { runtimeEnv } from './runtime-env';
import { authInterceptor, providePortalSession } from '@portail/core-auth';
import { DbStatusService, AppConfigService, API_DATA_URL, API_EXECUTOR_URL, API_AGENT_URL, API_TRACE_HEADERS, APP_BRANDING } from '@portail/core-data-access';
import { CHILD_ADMIN_TABS_PROVIDERS } from './child/child-admin-tabs';
import { provideAgendaAdminTab } from '../../../appli-agenda/src/app/admin/provide-agenda-admin-tab';
import { provideRecettesAdminTab } from '../../../appli-recettes/src/app/admin/provide-recettes-admin-tab';
import { provideDocumentsAdminTab } from '../../../appli-documents/src/app/admin/provide-documents-admin-tab';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: API_DATA_URL, useValue: runtimeEnv.apiDataUrl },
    { provide: API_EXECUTOR_URL, useValue: runtimeEnv.apiExecutorUrl },
    { provide: API_AGENT_URL, useValue: runtimeEnv.apiAgentUrl },
    // Ce portail n'impose aucun en-tête de traçabilité (l'authentification passe
    // par le jeton Bearer ajouté par l'intercepteur) : objet vide plutôt
    // qu'absence de provider, pour que le contrat reste injectable — une
    // sous-application venue de l'autre portail l'injecte sans échouer.
    { provide: API_TRACE_HEADERS, useValue: {} },
    {
      provide: APP_BRANDING,
      useValue: {
        appName: runtimeEnv.appName,
        copyrightHolder: runtimeEnv.copyrightHolder,
        copyrightTagline: runtimeEnv.copyrightTagline,
        copyrightYear: runtimeEnv.copyrightYear,
      }
    },
    // Vue normalisée de la session pour les sous-applications : elles injectent
    // PORTAL_SESSION, jamais AuthService dont la forme diffère d'un portail à l'autre.
    ...providePortalSession(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideAppInitializer(() => inject(DbStatusService).check()),
    provideAppInitializer(() => inject(AppConfigService).load()),
    ...CHILD_ADMIN_TABS_PROVIDERS,
    ...provideAgendaAdminTab(),
    ...provideRecettesAdminTab(),
    ...provideDocumentsAdminTab()
  ]
};
