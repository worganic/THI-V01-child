import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { runtimeEnv } from './runtime-env';
import { authInterceptor, providePortalSession, PORTAL_AUTH_ROUTES } from '@portail/core-auth';
import { PORTAL_THEME_CONFIG } from '@portail/shared-ui';
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
    // Points d'entrée/sortie de session de CE portail : c'est la seule valeur
    // qui distinguait les gardes des deux monorepos, désormais identiques.
    { provide: PORTAL_AUTH_ROUTES, useValue: { login: '/', home: '/home' } },
    // Thèmes de CE portail. Le ThemeService est le même code des deux côtés :
    // seule cette configuration change (ici trois thèmes, deux en face).
    {
      provide: PORTAL_THEME_CONFIG,
      useValue: {
        storageKey: 'theme',
        cycle: ['dark', 'light', 'pink'],
        fallback: 'dark',
        classes: { dark: ['dark'], light: [], pink: ['dark', 'pink'] },
        icons: { dark: 'light_mode', light: 'favorite', pink: 'dark_mode' },
      }
    },
    // Détection de changement : les deux portails embarquent zone.js et la
    // configurent de la même façon. Déclaré explicitement des deux côtés plutôt
    // que laissé implicite, pour que la ligne soit comparable d'un dépôt à l'autre.
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
