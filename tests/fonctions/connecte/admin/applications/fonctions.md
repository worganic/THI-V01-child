# Admin › Applications — Fonctions métier

Route : `/admin/applications`  
Composant : `AdminPortailComponent` (sous-sections Applications / Groupes / Métiers / Droits)  
Accès : admin uniquement

Cet onglet pilote le contenu de la page d'accueil (`2-6-*`) : quelles
sous-applications existent, comment elles sont regroupées et qui y a accès.
Toutes les données sont en MySQL (tables `portal_*`).

---

## `2-1-9-1` — Navigation par sous-onglets

- **Sous-onglets** : Applications, Groupes, Métiers, Droits
- **Sous-onglet par défaut** : Applications
- **Rendu conditionnel** : une seule section montée à la fois, rechargée à chaque affichage
- **Priorité:** majeur
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/admin-portail.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/admin-portail.component.html`, `apps/portail/src/app/pages/admin/admin.component.ts`

---

## `2-1-9-2` — [modification] CRUD des applications

- **Liste** : GET `/api/portal/apps` — nom, code, URL/route, ordre, état
- **Création** : bouton « Nouvelle application » → formulaire (code technique requis et unique, nom requis, description, URL ou route interne, icône avec aperçu, ordre, actif) → POST `/api/portal/apps`
- **Édition** : bouton crayon → même formulaire prérempli → PUT `/api/portal/apps/{id}`
- **Suppression** : bouton corbeille → confirmation Oui/Non en ligne → DELETE `/api/portal/apps/{id}`
- **Bascule d'état** : clic sur le badge Active/Inactive → PUT avec `isActive` inversé ; une application inactive disparaît de la page d'accueil
- **Erreur code dupliqué** : message « Ce code d'application existe déjà » (contrainte unique)
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-apps.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-apps.component.html`, `libs/portail-core/data-access/src/lib/portal-apps.service.ts`, `server/modules/portal-apps.js`

---

## `2-1-9-3` — Groupes et rattachement des applications

- **Liste des groupes** : GET `/api/portal/groupes` avec compteur d'applications rattachées
- **CRUD groupe** : création / édition (nom requis, description, ordre, actif) / suppression avec confirmation
- **Sélection** : clic sur un groupe → le panneau de droite liste toutes les applications
- **Matrice groupe × applications** : case à cocher par application → POST `/api/portal/groupe-apps` `{ groupeId, appId, linked }`
- **Effet** : les membres du groupe voient sur leur accueil toutes les applications cochées
- **Suppression en cascade** : supprimer un groupe supprime ses rattachements et les affectations utilisateurs correspondantes
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-groupes.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-groupes.component.html`, `server/modules/portal-apps.js`

---

## `2-1-9-4` — CRUD des métiers

- **Liste** : GET `/api/portal/metiers` avec nombre d'utilisateurs rattachés
- **CRUD métier** : nom requis, couleur du tag parmi 6 teintes, actif/inactif ; aperçu du tag en direct dans le formulaire
- **Suppression** : détache le métier des utilisateurs concernés (`users.metier_id` remis à NULL) avant suppression
- **Portée** : un métier qualifie la fiche utilisateur et n'accorde aucun droit
- **Priorité:** mineur
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-metiers.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-metiers.component.html`, `libs/portail-core/data-access/src/lib/portal-apps.models.ts`, `server/modules/portal-apps.js`

---

## `2-1-9-5` — Droits par utilisateur

- **Liste des utilisateurs** : GET `/api/portal/users` — nom, rôle, nombre de groupes, tag métier
- **Sélection** : clic sur un utilisateur → panneau de détail à droite
- **Métier** : sélecteur → PUT `/api/portal/users/{id}/metier` `{ metierId }` (valeur vide = aucun métier)
- **Groupes** : case à cocher par groupe → POST `/api/portal/user-groupes` `{ userId, groupeId, linked }`
- **Accès directs** : case à cocher par application → POST `/api/portal/user-apps` ; quand l'accès est actif, un sélecteur permet de choisir le niveau (`lecture` / `ecriture` / `admin`)
- **Cas admin** : rappel affiché — un administrateur voit de toute façon tous les groupes actifs sur son accueil
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-droits.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-droits.component.html`, `server/modules/portal-apps.js`

---

## `2-1-9-6` — [modification] Persistance et sécurité des routes

- **Stockage** : tables MySQL `portal_apps`, `portal_groupes`, `portal_groupe_apps`, `portal_metiers`, `portal_user_groupes`, `portal_user_apps`, colonne `users.metier_id`
- **Création automatique du schéma** : `ensureSchema` au démarrage du serveur (idempotent), amorçage des sous-applications `apps/*` uniquement si `portal_apps` est vide
- **Lecture** : toutes les routes GET exigent une session valide (401 sinon)
- **Écriture** : POST / PUT / DELETE réservés au rôle admin (403 sinon)
- **Priorité:** bloquant
- **Composants:** `server/modules/portal-apps.js`, `server/init-db.js`, `server/server-data.js`
