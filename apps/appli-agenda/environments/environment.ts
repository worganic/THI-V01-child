// L'agenda n'est plus une application autonome : elle est montée dans le portail
// (route `/agenda`, voir apps/portail/src/app/base-routes.ts). Toutes ses requêtes
// passent donc par l'API du portail (server/server-data.js, port 3001) et non plus
// par le proxy Angular de portail-shell.
//
// `runtimeEnv` applique déjà le décalage de port des instances multi-users.
import { runtimeEnv } from '../../portail/src/app/runtime-env';

export const environment = {
  production: false,

  // Base de l'API portail — conservée sous le nom `serviceVal` pour ne pas réécrire
  // tous les appels des services (`environment.serviceVal + environment.serviceXxx`).
  serviceVal: runtimeEnv.apiDataUrl,

  // Projets / tâches / indisponibilités de l'agenda
  serviceAgenda: '/api/agenda',

  // Utilisateurs, groupes et métiers : servis par le module agenda, qui les projette
  // depuis les tables du portail (`users`, `portal_groupes`, `portal_metiers`) avec un
  // identifiant numérique stable (`users.num_id`) attendu par les modèles de l'agenda.
  serviceUsers: '/api/agenda/users',
  serviceGroupes: '/api/agenda/groupes',
  serviceUserGroupes: '/api/agenda/user-groupes',
  serviceMetiers: '/api/agenda/metiers',
};
