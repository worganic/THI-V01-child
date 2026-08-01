import {
  ApplicationConfig,
  provideZoneChangeDetection,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { appRoutes } from './app.routes';
import { runtimeEnv } from './runtime-env';
import { authInterceptor } from '@portail/core-auth';
import { API_DATA_URL, API_EXECUTOR_URL, API_AGENT_URL, APP_BRANDING, AppConfigService } from '@portail/core-data-access';
import { ThemeService, PORTAL_THEME_CONFIG } from '@portail/shared-ui';

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
    // Mêmes thèmes que le portail hôte : cette application autonome partage sa
    // clé de stockage, de sorte que la préférence suive l'utilisateur d'un port
    // à l'autre (voir la transmission thème/token par paramètres d'URL).
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
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideAppInitializer(() => {
      inject(ThemeService).initTheme();
    }),
    provideAppInitializer(() => inject(AppConfigService).load()),
  ],
};
