import { InjectionToken, Signal } from '@angular/core';

/**
 * Contrat de session — la seule chose qu'une sous-application a le droit de
 * savoir de l'utilisateur connecté.
 *
 * Les deux portails s'authentifient contre des backends différents et leurs
 * `AuthService` respectifs n'ont presque rien en commun (matricule + signaux
 * d'un côté, token + `currentUser` de l'autre). Une sous-application qui
 * s'adresserait directement à l'un des deux ne serait pas copiable dans
 * l'autre. Elle injecte donc `PORTAL_SESSION`, que chaque portail fournit en
 * adaptant son propre service.
 *
 * Fichier identique dans les deux monorepos.
 * Voir docs/architecture-sous-applications.md, section « Découplage ».
 */

/** Champs d'identité communs aux deux portails. */
export interface PortalSessionUser {
  /**
   * Identifiant stable de l'utilisateur dans le portail hôte : matricule côté
   * portail d'entreprise, identifiant de compte côté plateforme. Une
   * sous-application s'en sert comme clé, jamais comme libellé.
   */
  id: string;
  /** Libellé affichable (nom complet, pseudo…) — jamais utilisé comme clé. */
  displayName: string;
  email: string | null;
  /** Rôle applicatif normalisé sur les deux portails. */
  role: 'admin' | 'user' | 'invite';
}

export interface PortalSession {
  /** Utilisateur courant, ou `null` si personne n'est connecté. */
  readonly user: Signal<PortalSessionUser | null>;
  isAuthenticated(): boolean;
  /** En-têtes d'authentification à joindre à un appel API du portail hôte. */
  getAuthHeaders(): Record<string, string>;
  logout(): void;
}

export const PORTAL_SESSION = new InjectionToken<PortalSession>('PORTAL_SESSION');
