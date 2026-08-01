import {
  ApplicationConfig,
  provideZoneChangeDetection,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { PORTAIL_RUNTIME_CONFIG, PortailRuntimeConfig, PORTAL_THEME_CONFIG } from '@portail/shared-ui';
import {
  API_DATA_URL,
  API_EXECUTOR_URL,
  API_AGENT_URL,
  API_TRACE_HEADERS,
  APP_BRANDING,
  DbStatusService,
  AppConfigService,
} from '@portail/core-data-access';
import { PORTAL_AUTH_ROUTES, providePortalSession, authInterceptor } from '@portail/core-auth';
import { CHILD_ADMIN_TABS_PROVIDERS } from './child/child-admin-tabs';
import { provideAgendaAdminTab } from '../../../appli-agenda/src/app/admin/provide-agenda-admin-tab';
import { provideRecettesAdminTab } from '../../../appli-recettes/src/app/admin/provide-recettes-admin-tab';
import { provideDocumentsAdminTab } from '../../../appli-documents/src/app/admin/provide-documents-admin-tab';
import { runtimeEnv } from './runtime-env';
import { environmentGlobal } from '../../environmentGlobal/environmentGlobal';

// Source unique des informations affichées dans le footer (version, environnement, mode de
// connexion). Fournie ici plutôt que lue dans la lib : shared-ui ne peut pas importer un fichier
// d'application sans inverser la dépendance lib -> app.
const runtimeConfig: PortailRuntimeConfig = {
  version: environmentGlobal.version,
  versionDate: environmentGlobal.versionDate,
  // Préfixe réellement utilisé par les services du portail pour joindre le backend
  // (AuthService, AdminService... utilisent tous `environmentGlobal.serviceVal` comme base,
  // quel que soit le fichier d'environnement actif — voir les fichiers environmentGlobal.*.ts).
  serviceBase: environmentGlobal.serviceVal,
  serviceDev: environmentGlobal.serviceDev,
  serviceVal: environmentGlobal.serviceVal,
  serviceProd: environmentGlobal.serviceProd,
  environment: environmentGlobal.runtimeEnvironment
};

export const appConfig: ApplicationConfig = {
  providers: [
    // ── Contrat portail ↔ sous-applications ─────────────────────────────────
    // Ces tokens sont fournis à l'identique par les deux portails, chacun avec
    // ses valeurs : c'est ce qui permet de déplacer un dossier apps/appli-<nom>/
    // de l'un à l'autre sans toucher son code.
    // Voir libs/core/data-access/src/lib/tokens.ts.
    { provide: API_DATA_URL, useValue: environmentGlobal.serviceVal },
    // Ce portail expose un exécuteur local et un service d'agent.
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
    { provide: PORTAL_AUTH_ROUTES, useValue: { login: '/connexion', home: '/home' } },
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
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    { provide: PORTAIL_RUNTIME_CONFIG, useValue: runtimeConfig },

    provideAppInitializer(() => inject(DbStatusService).check()),
    provideAppInitializer(() => inject(AppConfigService).load()),

    // ── Onglets d'admin contribués par les sous-applications ────────────────
    // Une ligne par sous-application, la même des deux côtés : la définition de
    // l'onglet appartient au dossier apps/appli-<nom>/, pas au portail.
    ...CHILD_ADMIN_TABS_PROVIDERS,
    ...provideAgendaAdminTab(),
    ...provideRecettesAdminTab(),
    ...provideDocumentsAdminTab(),
  ],
};
