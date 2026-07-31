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
import { authInterceptor } from '@worganic/portail-core/auth';
import { API_DATA_URL, API_EXECUTOR_URL, API_AGENT_URL, APP_BRANDING, ThemeService, AppConfigService } from '@worganic/portail-core/data-access';

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
