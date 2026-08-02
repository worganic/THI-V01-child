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
 * le serveur Express local (`server/modules/portal-admin-api.js`, routes
 * `/api/portal-admin/...`). Préfixe distinct de `/api/portal/...`, qui reste
 * servi en camelCase par `portal-apps.js` pour l'administration maison (/admin-outils).
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
  serviceUsers: '/api/portal-admin/users/',
  serviceUsersMatricule: '/api/portal-admin/users/matricule/?matricule=',
  serviceUsersInsert: '/api/portal-admin/users/',
  serviceUsersUpdate: '/api/portal-admin/users/update/',
  serviceUsersDelete: '/api/portal-admin/users/delete/',

  // ─── Applications ─────────────────────────────────────────────────────────
  serviceApplications: '/api/portal-admin/applications/',
  serviceApplicationsAvailable: '/api/portal-admin/applications/available',
  serviceApplicationsInsert: '/api/portal-admin/applications/',
  serviceApplicationsUpdate: '/api/portal-admin/applications/update/',
  serviceApplicationsDelete: '/api/portal-admin/applications/delete/',

  // ─── Groupes ──────────────────────────────────────────────────────────────
  serviceGroupes: '/api/portal-admin/groupes/',
  serviceGroupesInsert: '/api/portal-admin/groupes/',
  serviceGroupesUpdate: '/api/portal-admin/groupes/update/',
  serviceGroupesDelete: '/api/portal-admin/groupes/delete/',

  // ─── Métiers ──────────────────────────────────────────────────────────────
  serviceMetiers: '/api/portal-admin/metiers/',
  serviceMetiersInsert: '/api/portal-admin/metiers/',
  serviceMetiersUpdate: '/api/portal-admin/metiers/update/',
  serviceMetiersDelete: '/api/portal-admin/metiers/delete/',

  // ─── Affectations utilisateur ↔ application ───────────────────────────────
  serviceUserApplications: '/api/portal-admin/user_applications/selectAll/',
  serviceUserApplicationsInsert: '/api/portal-admin/user_applications/',
  serviceUserApplicationsUpdate: '/api/portal-admin/user_applications/update/',
  serviceUserApplicationsDelete: '/api/portal-admin/user_applications/delete/',

  // ─── Affectations groupe ↔ application ────────────────────────────────────
  serviceGroupeApplications: '/api/portal-admin/groupe_applications/get/',
  serviceGroupeApplicationsInsert: '/api/portal-admin/groupe_applications/',
  serviceGroupeApplicationsDelete: '/api/portal-admin/groupe_applications/del/',

  // ─── Affectations utilisateur ↔ groupe ────────────────────────────────────
  serviceUserGroupes: '/api/portal-admin/user_groupes/',
  serviceUserGroupesInsert: '/api/portal-admin/user_groupes/',
  serviceUserGroupesDelete: '/api/portal-admin/user_groupes/delete/',
};
