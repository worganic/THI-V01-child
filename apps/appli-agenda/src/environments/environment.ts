// L'agenda est montée dans le portail (route `/agenda`, voir
// apps/portail/src/app/base-routes.ts). La base de l'API (host + décalage de port
// multi-instances) est injectée via le token DI `API_DATA_URL`
// (@worganic/portail-core/data-access, voir project.service.ts) plutôt que lue ici :
// ce fichier ne connaît donc plus rien de l'app qui héberge l'agenda.
export const environment = {
  production: false,

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
