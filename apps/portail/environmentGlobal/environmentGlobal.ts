import { runtimeEnv } from '../src/app/runtime-env';

/**
 * Configuration de CE portail : adresses de services et identité d'appel.
 *
 * Même rôle et mêmes clés que le fichier homonyme de l'autre monorepo — c'est
 * le seul endroit où les deux portails divergent côté front. Les composants
 * d'administration, `services/admin.service.ts` et `services/connexion.service.ts`
 * sont, eux, identiques bit-à-bit des deux côtés : ils ne connaissent aucun
 * chemin en dur et lisent tout ici.
 *
 * Là-bas les chemins pointent sur l'API d'entreprise (`/POPORTAIL/...`) ; ici sur
 * le serveur Express local (`server/server-data.js`, routes `/api/portal/...`).
 */
export const environmentGlobal = {
  production: false,
  version: '0.339',
  versionDate: '2026-08-01',
  debug: true,
  isLocal: true,

  // Label affiché par le footer (RuntimeInfoService).
  runtimeEnvironment: 'Dev' as const,

  // ─── Bases d'API ──────────────────────────────────────────────────────────
  // Passent par runtimeEnv pour conserver le décalage de port du launcher
  // (deux instances de l'app sur des ports différents, voir runtime-env.ts).
  serviceDomaine: runtimeEnv.apiDataUrl,
  serviceProd: runtimeEnv.apiDataUrl,
  serviceVal: runtimeEnv.apiDataUrl,
  serviceDev: runtimeEnv.apiDataUrl,

  // ─── Identité d'appel ─────────────────────────────────────────────────────
  // Ce portail authentifie par jeton Bearer et n'exige aucun en-tête de
  // traçabilité : valeurs vides plutôt qu'absentes, pour que le contrat reste
  // injectable (voir API_TRACE_HEADERS dans app.config.ts).
  IDUSER: '',
  IDAPPEL: '',
  IDTRANSACTION: '',

  // ─── Connexion ────────────────────────────────────────────────────────────
  serviceConnexion: '/api/auth/login',

  // ─── Utilisateurs ─────────────────────────────────────────────────────────
  serviceUsers: '/api/portal/users/',
  serviceUsersMatricule: '/api/portal/users/matricule/?matricule=',
  serviceUsersInsert: '/api/portal/users/',
  serviceUsersUpdate: '/api/portal/users/update/',
  serviceUsersDelete: '/api/portal/users/delete/',

  // ─── Applications ─────────────────────────────────────────────────────────
  serviceApplications: '/api/portal/applications/',
  serviceApplicationsInsert: '/api/portal/applications/',
  serviceApplicationsUpdate: '/api/portal/applications/update/',
  serviceApplicationsDelete: '/api/portal/applications/delete/',

  // ─── Groupes ──────────────────────────────────────────────────────────────
  serviceGroupes: '/api/portal/groupes/',
  serviceGroupesInsert: '/api/portal/groupes/',
  serviceGroupesUpdate: '/api/portal/groupes/update/',
  serviceGroupesDelete: '/api/portal/groupes/delete/',

  // ─── Métiers ──────────────────────────────────────────────────────────────
  serviceMetiers: '/api/portal/metiers/',
  serviceMetiersInsert: '/api/portal/metiers/',
  serviceMetiersUpdate: '/api/portal/metiers/update/',
  serviceMetiersDelete: '/api/portal/metiers/delete/',

  // ─── Affectations utilisateur ↔ application ───────────────────────────────
  serviceUserApplications: '/api/portal/user_applications/selectAll/',
  serviceUserApplicationsInsert: '/api/portal/user_applications/',
  serviceUserApplicationsUpdate: '/api/portal/user_applications/update/',
  serviceUserApplicationsDelete: '/api/portal/user_applications/delete/',

  // ─── Affectations groupe ↔ application ────────────────────────────────────
  serviceGroupeApplications: '/api/portal/groupe_applications/get/',
  serviceGroupeApplicationsInsert: '/api/portal/groupe_applications/',
  serviceGroupeApplicationsDelete: '/api/portal/groupe_applications/del/',

  // ─── Affectations utilisateur ↔ groupe ────────────────────────────────────
  serviceUserGroupes: '/api/portal/user_groupes/',
  serviceUserGroupesInsert: '/api/portal/user_groupes/',
  serviceUserGroupesDelete: '/api/portal/user_groupes/delete/',
};
