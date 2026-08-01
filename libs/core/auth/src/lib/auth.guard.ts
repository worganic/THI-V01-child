import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PORTAL_SESSION } from './portal-session';
import { PORTAL_AUTH_ROUTES } from './auth.routes';

/**
 * Protège une route qui exige une session ouverte.
 *
 * S'appuie sur `PORTAL_SESSION` et jamais sur l'`AuthService` du portail hôte :
 * l'un s'authentifie par matricule et en-têtes de traçabilité, l'autre par
 * jeton Bearer, et cette garde n'a pas à le savoir.
 *
 * Fichier identique dans les deux monorepos.
 */
export const authGuard: CanActivateFn = () => {
  const session = inject(PORTAL_SESSION);
  const router = inject(Router);
  const routes = inject(PORTAL_AUTH_ROUTES);

  if (session.isAuthenticated()) {
    return true;
  }

  return router.parseUrl(routes.login);
};
