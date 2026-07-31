# Agenda — Fonctions métier

Route : `/agenda`
Composant : `HomeAgendaComponent` (`apps/appli-agenda`), monté à la demande dans le portail
Accès : utilisateur connecté

Sous-application de planification de projets et de tâches, intégrée au portail :
elle hérite de son en-tête, de son thème et de sa session, et ses données sont
servies par `/api/agenda/*` (tables MySQL `agenda_*`). Elle est listée sur la page
d'accueil (`2-6-*`) et se configure dans Admin › Applications (`2-1-9-*`).

---

## `2-7-1` — [modification] Montage dans le portail

- **Route interne** : `/agenda`, chargée à la demande (pas d'application autonome ni de port dédié)
- **Garde d'accès** : `authGuard` — un utilisateur non connecté est renvoyé sur la landing
- **Ouverture depuis l'accueil** : clic sur la carte « Agenda » → navigation Angular interne, sans rechargement de page
- **Chrome du portail** : en-tête, navigation, pied de page et widgets restent affichés
- **Thème** : les écrans suivent le thème actif du portail (clair / sombre / rose) via les variables de compatibilité
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/base-routes.ts`, `apps/appli-agenda/src/app/app.routes.ts`, `apps/portail/src/styles-sous-apps.scss`

---

## `2-7-2` — [modification] Référentiel des intervenants

- **Utilisateurs** : GET `/api/agenda/users` — projection des utilisateurs du portail avec un identifiant numérique stable (`users.num_id`)
- **Filtre développeurs** : si un groupe nommé `Developpeur` existe (Admin › Applications › Groupes), seuls ses membres sont proposés ; sinon tous les utilisateurs actifs le sont
- **Métiers** : GET `/api/agenda/metiers` — métiers actifs du portail, en lecture seule (la gestion reste dans Admin › Applications › Métiers)
- **Bandeau d'alerte** : si une de ces requêtes échoue, message « … indisponible côté serveur » et affichage des dernières données connues
- **Priorité:** majeur
- **Composants:** `apps/appli-agenda/src/services/project.service.ts`, `apps/appli-agenda/environments/environment.ts`, `server/modules/appli-agenda.js`

---

## `2-7-3` — [modification] Projets

- **Liste** : GET `/api/agenda/projects` — projets hydratés (développeurs, métiers, tâches, avancement calculé)
- **Création** : formulaire « Nouveau Projet » → POST `/api/agenda/projects` (code, nom, description, risque, dates, charge estimée, développeurs, métiers, règles week-end/fériés, tâches initiales)
- **Édition** : bouton « Modifier » → PUT `/api/agenda/projects/{id}`
- **Filtres** : statut (Tous / En cours / À faire / Terminés), personnel, métier, recherche texte
- **Mode dégradé** : en cas d'API injoignable, les projets restent modifiables localement et sont persistés en `localStorage` (clé `agenda:local-cache:projects`), avec bandeau d'avertissement
- **Priorité:** bloquant
- **Composants:** `apps/appli-agenda/src/app/home-agenda/home-agenda.component.ts`, `apps/appli-agenda/src/app/home-agenda/components/liste-projets/liste-projets.component.ts`, `apps/appli-agenda/src/app/home-agenda/components/nouveau-projet/nouveau-projet.component.ts`, `server/modules/appli-agenda.js`

---

## `2-7-4` — Tâches et planning

- **Création** : POST `/api/agenda/projects/{id}/tasks`
- **Édition** : PUT `/api/agenda/tasks/{id}` — nom, statut, développeur assigné, dates, demi-journées, sous-tâches, extensions, historique
- **Ancrage du plan initial** : `baseDateEnd` n'est jamais écrasé quand l'appelant l'omet (recalcul de retard, déplacement d'une tâche)
- **Changement de statut rapide** : PATCH `/api/agenda/tasks/{id}` `{ status }`
- **Suppression** : DELETE `/api/agenda/tasks/{id}`
- **Planning** : vue Gantt par demi-journées et vue mois, glisser-déposer des tâches, alertes retard et échéance
- **Priorité:** bloquant
- **Composants:** `apps/appli-agenda/src/app/home-agenda/components/planning-agenda/planning-agenda.component.ts`, `apps/appli-agenda/src/app/home-agenda/components/task-modal/task-modal.component.ts`, `server/modules/appli-agenda.js`

---

## `2-7-5` — [modification] Indisponibilités

- **Liste** : GET `/api/agenda/unavailabilities`
- **Ajout** : POST `/api/agenda/unavailabilities` `{ userId, dateStart, dateEnd, reason }`
- **Suppression** : DELETE `/api/agenda/unavailabilities/{id}`
- **Effet** : les périodes sont affichées en surimpression du planning et déclenchent un avertissement à l'assignation d'une tâche
- **Priorité:** majeur
- **Composants:** `apps/appli-agenda/src/app/home-agenda/components/indisponibilites/indisponibilites.component.ts`, `server/modules/appli-agenda.js`

---

## `2-7-6` — [modification] Persistance et sécurité des routes

- **Stockage** : tables MySQL `agenda_projects`, `agenda_project_developers`, `agenda_project_metiers`, `agenda_tasks`, `agenda_unavailabilities`
- **Identifiant numérique** : colonne `users.num_id` (auto-incrément) ajoutée au démarrage — les modèles de l'agenda identifient les développeurs par un entier alors que `users.id` est un UUID
- **Création automatique du schéma** : `ensureSchema` au démarrage du serveur, idempotent
- **Authentification** : toutes les routes `/api/agenda/*` exigent une session valide (401 sinon) ; le token est ajouté automatiquement par l'intercepteur du portail
- **En-têtes envoyés** : uniquement `Content-Type` et `Authorization` — tout en-tête personnalisé supplémentaire doit d'abord être ajouté aux `allowedHeaders` du CORS (`server/server-data.js`), sinon le navigateur bloque l'appel après le préflight
- **Priorité:** bloquant
- **Composants:** `server/modules/appli-agenda.js`, `server/server-data.js`, `server/init-db.js`
