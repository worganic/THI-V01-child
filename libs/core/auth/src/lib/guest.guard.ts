import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PORTAL_SESSION } from './portal-session';
import { PORTAL_AUTH_ROUTES } from './auth.routes';

/**
 * Protège une route réservée aux visiteurs non connectés (écran de connexion,
 * page d'accueil publique) : un utilisateur déjà authentifié est renvoyé chez lui.
 *
 * Fichier identique dans les deux monorepos.
 */
export const guestGuard: CanActivateFn = () => {
  const session = inject(PORTAL_SESSION);
  const router = inject(Router);
  const routes = inject(PORTAL_AUTH_ROUTES);

  if (!session.isAuthenticated()) {
    return true;
  }

  return router.parseUrl(routes.home);
};
