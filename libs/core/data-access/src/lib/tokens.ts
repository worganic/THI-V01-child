import { InjectionToken } from '@angular/core';

/**
 * Tokens d'injection du socle portail — contrat commun aux deux monorepos.
 *
 * Une sous-application ne doit JAMAIS lire un fichier `environment` du portail
 * hôte ni l'importer par chemin relatif : elle injecte ces tokens, et chaque
 * portail les fournit avec ses propres valeurs dans son `app.config.ts`.
 * C'est ce qui permet de déplacer `apps/appli-<nom>/` d'un portail à l'autre
 * sans toucher une ligne de son code.
 *
 * Un portail qui n'expose pas un de ces services fournit une chaîne vide
 * plutôt que d'omettre le token : le contrat reste ainsi identique des deux
 * côtés, et une sous-application qui l'injecte ne casse pas à l'injection.
 */

/** Base d'URL de l'API de données du portail (catalogue, users, groupes, métiers…). */
export const API_DATA_URL = new InjectionToken<string>('API_DATA_URL');

/** Base d'URL de l'exécuteur local (actions système). Chaîne vide si non exposé. */
export const API_EXECUTOR_URL = new InjectionToken<string>('API_EXECUTOR_URL');

/** Base d'URL du service d'agent IA. Chaîne vide si non exposé. */
export const API_AGENT_URL = new InjectionToken<string>('API_AGENT_URL');

export interface AppBranding {
  appName: string;
  copyrightHolder: string;
  copyrightTagline: string;
  copyrightYear: number;
}

/** Identité affichée par le portail hôte (nom, mentions de pied de page). */
export const APP_BRANDING = new InjectionToken<AppBranding>('APP_BRANDING');
