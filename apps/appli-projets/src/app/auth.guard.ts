import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '@worganic/portail-core/data-access';
import { runtimeEnv } from './runtime-env';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);

  // Attend que la vérification initiale du token (depuis localStorage) soit terminée
  await auth.initDone;

  if (!auth.isAuthenticated()) {
    window.location.href = runtimeEnv.portailUrl;
    return false;
  }

  return true;
};
