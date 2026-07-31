# Agenda — Fonctions métier

Route : `/agenda`
Composant : `HomeAgendaComponent` (`apps/appli-agenda`), monté à la demande dans le portail
Accès : utilisateur connecté

Sous-application de planification de projets et de tâches, intégrée au portail :
elle hérite de son en-tête, de son thème et de sa session, et ses données sont
servies par `/api/agenda/*` (tables MySQL `agenda_*`). Elle est listée sur la page
d'accueil (`2-6-*`) et se configure dans Admin › Portail (`2-1-9-*`) ; ses
réglages propres (le cas échéant) vivent dans son propre onglet « Agenda »
des onglets admin globaux (`2-7-7`).

---

## `2-7-1` — [modification] Montage dans le portail

- **Route interne** : `/agenda`, chargée à la demande (pas d'application autonome ni de port dédié)
- **Garde d'accès** : `authGuard` — un utilisateur non connecté est renvoyé sur la landing
- **Ouverture depuis l'accueil** : clic sur la carte « Agenda » → navigation Angular interne, sans rechargement de page
- **Chrome du portail** : en-tête, navigation, pied de page et widgets restent affichés
- **Thème** : les écrans suivent le thème actif du portail (clair / sombre / rose) via les variables de compatibilité
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/base-routes.ts`, `apps/appli-agenda/src/app/app.routes.ts`, `apps/appli-agenda/src/app/home/home-agenda.component.scss`

---

## `2-7-2` — [modification] Référentiel des intervenants

- **Utilisateurs** : GET `/api/agenda/users` — projection des utilisateurs du portail avec un identifiant numérique stable (`users.num_id`)
- **Filtre développeurs** : si un groupe nommé `Developpeur` existe (Admin › Applications › Groupes), seuls ses membres sont proposés ; sinon tous les utilisateurs actifs le sont
- **Métiers** : GET `/api/agenda/metiers` — métiers actifs du portail, en lecture seule (la gestion reste dans Admin › Applications › Métiers)
- **Bandeau d'alerte** : si une de ces requêtes échoue, message « … indisponible côté serveur » et affichage des dernières données connues
- **Priorité:** majeur
- **Composants:** `apps/appli-agenda/src/app/core/services/project.service.ts`, `apps/appli-agenda/src/environments/environment.ts`, `apps/appli-agenda/server/index.js`

---

## `2-7-3` — [modification] Projets

- **Liste** : GET `/api/agenda/projects` — projets hydratés (développeurs, métiers, tâches, avancement calculé)
- **Création** : formulaire « Nouveau Projet » → POST `/api/agenda/projects` (code, nom, description, risque, dates, charge estimée, développeurs, métiers, règles week-end/fériés, tâches initiales)
- **Édition** : bouton « Modifier » → PUT `/api/agenda/projects/{id}`
- **Filtres** : statut (Tous / En cours / À faire / Terminés), personnel, métier, recherche texte
- **Mode dégradé** : en cas d'API injoignable, les projets restent modifiables localement et sont persistés en `localStorage` (clé `agenda:local-cache:projects`), avec bandeau d'avertissement
- **Priorité:** bloquant
- **Composants:** `apps/appli-agenda/src/app/home/home-agenda.component.ts`, `apps/appli-agenda/src/app/home/components/liste-projets/liste-projets.component.ts`, `apps/appli-agenda/src/app/home/components/nouveau-projet/nouveau-projet.component.ts`, `apps/appli-agenda/server/index.js`

---

## `2-7-4` — [modification] Tâches et planning

- **Création** : POST `/api/agenda/projects/{id}/tasks`
- **Édition** : PUT `/api/agenda/tasks/{id}` — nom, statut, développeur assigné, dates, demi-journées, sous-tâches, extensions, historique
- **Ancrage du plan initial** : `baseDateEnd` n'est jamais écrasé quand l'appelant l'omet (recalcul de retard, déplacement d'une tâche)
- **Changement de statut rapide** : PATCH `/api/agenda/tasks/{id}` `{ status }`
- **Suppression** : DELETE `/api/agenda/tasks/{id}`
- **Planning** : vue Gantt par demi-journées et vue mois, glisser-déposer des tâches, alertes retard et échéance
- **Priorité:** bloquant
- **Composants:** `apps/appli-agenda/src/app/home/components/planning-agenda/planning-agenda.component.ts`, `apps/appli-agenda/src/app/home/components/task-modal/task-modal.component.ts`, `apps/appli-agenda/server/index.js`

---

## `2-7-5` — [modification] Indisponibilités

- **Liste** : GET `/api/agenda/unavailabilities`
- **Ajout** : POST `/api/agenda/unavailabilities` `{ userId, dateStart, dateEnd, reason }`
- **Suppression** : DELETE `/api/agenda/unavailabilities/{id}`
- **Effet** : les périodes sont affichées en surimpression du planning et déclenchent un avertissement à l'assignation d'une tâche
- **Priorité:** majeur
- **Composants:** `apps/appli-agenda/src/app/home/components/indisponibilites/indisponibilites.component.ts`, `apps/appli-agenda/server/index.js`

---

## `2-7-6` — [modification] Persistance et sécurité des routes

- **Stockage** : tables MySQL `agenda_projects`, `agenda_project_developers`, `agenda_project_metiers`, `agenda_tasks`, `agenda_unavailabilities`
- **Identifiant numérique** : colonne `users.num_id` (auto-incrément) ajoutée au démarrage — les modèles de l'agenda identifient les développeurs par un entier alors que `users.id` est un UUID
- **Création automatique du schéma** : `ensureSchema` au démarrage du serveur, idempotent
- **Authentification** : toutes les routes `/api/agenda/*` exigent une session valide (401 sinon) ; le token est ajouté automatiquement par l'intercepteur du portail
- **En-têtes envoyés** : uniquement `Content-Type` et `Authorization` — tout en-tête personnalisé supplémentaire doit d'abord être ajouté aux `allowedHeaders` du CORS (`server/server-data.js`), sinon le navigateur bloque l'appel après le préflight
- **Backend co-localisé** : le module serveur vit dans `apps/appli-agenda/server/index.js` (et non plus `server/modules/appli-agenda.js`) — contrat "sous-application", voir `docs/architecture-sous-applications.md`
- **Priorité:** bloquant
- **Composants:** `apps/appli-agenda/server/index.js`, `server/server-data.js`, `server/init-db.js`

---

## `2-7-7` — [modification] Admin propre à l'agenda & catalogue auto-porté

- **Onglet admin dédié** : « Agenda » apparaît dans la liste des onglets admin globaux (à côté de Portail, Déploiement, etc.), contribué depuis le dossier de l'agenda lui-même via `AdminTabsRegistryService.registerChild()` — pas de fonctionnalité spécifique pour l'instant (placeholder), point d'extension pour de futurs réglages
- **Catalogue `portal_apps`** : l'agenda insère sa propre ligne de catalogue (`code appli-agenda`, url `/agenda`) depuis son propre `ensureSchema()` (`upsertCatalogEntry`), au lieu d'être connue par son nom dans `server/modules/portal-apps.js`
- **Priorité:** mineur
- **Composants:** `apps/appli-agenda/src/app/admin/admin-agenda.component.ts`, `apps/appli-agenda/src/app/admin/provide-agenda-admin-tab.ts`, `apps/portail/src/app/app.config.ts`, `libs/portail-core/data-access/src/lib/admin-tabs-registry.service.ts`, `apps/appli-agenda/server/index.js`, `server/modules/portal-apps.js`
