import { InjectionToken } from '@angular/core';

/**
 * Routes d'entrée/sortie de session du portail hôte.
 *
 * Les deux portails ne placent pas leur écran de connexion au même endroit
 * (`/connexion` ici, `/` là-bas) et n'ont pas le même point d'atterrissage
 * après connexion. C'est la seule chose qui différait entre leurs gardes ;
 * en la sortant dans un token fourni par `app.config.ts`, `auth.guard.ts` et
 * `guest.guard.ts` deviennent identiques dans les deux monorepos.
 *
 * Fichier identique dans les deux monorepos.
 */
export interface PortalAuthRoutes {
  /** Où envoyer un visiteur non authentifié qui demande une route protégée. */
  login: string;
  /** Où renvoyer un utilisateur déjà connecté qui demande une route publique. */
  home: string;
}

export const PORTAL_AUTH_ROUTES = new InjectionToken<PortalAuthRoutes>('PORTAL_AUTH_ROUTES');
