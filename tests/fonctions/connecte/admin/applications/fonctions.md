# Admin › Portail — Fonctions métier

Route : `/admin/portail` (ancien `/admin/applications`, renommé — fusionné avec l'ancien onglet séparé `/admin/users`)  
Composant : `AdminPortailComponent` (sous-sections Utilisateurs / Applications / Groupes / Métiers)  
Accès : admin uniquement

Regroupe toute l'administration du portail : les comptes utilisateurs (compte,
métier, groupes, accès directs) et ce qui pilote le contenu de la page
d'accueil (`2-6-*`) : quelles sous-applications existent et comment elles sont
regroupées. Toutes les données sont en MySQL (tables `portal_*` + `users`).

---

## `2-1-9-1` — [modification] Navigation par sous-onglets

- **Sous-onglets** : Utilisateurs, Applications, Groupes, Métiers
- **Sous-onglet par défaut** : Utilisateurs
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

## `2-1-9-5` — [modification] Comptes utilisateurs (compte, métier, groupes, accès directs)

Fusionne l'ancien onglet séparé « Admin › Utilisateurs » (`2-1-4-*`, composant
`AdminUsersComponent`, supprimé) avec l'ancienne section « Droits » : un seul
endroit pour tout ce qui concerne un utilisateur.

- **Liste des utilisateurs** : GET `/api/portal/users` — nom, rôle, nombre de groupes, tag métier
- **Recherche** : champ texte, filtre la liste par username/email (insensible à la casse)
- **Sélection** : clic sur un utilisateur → panneau de détail à droite
- **Panneau Compte** : email, rôle, date de création, dernière connexion (lecture) ; boutons crayon/corbeille → édition (username, email, rôle, mot de passe optionnel) ou suppression (confirmation Oui/Non en ligne)
- **Création de compte** : bouton « Nouveau » → formulaire (username, email, mot de passe requis, rôle) → POST `/api/auth/register` puis PUT `/api/auth/users/{id}` `{ role: 'admin' }` si rôle admin
- **Édition de compte** : PUT `/api/auth/users/{id}`
- **Suppression de compte** : DELETE `/api/auth/users/{id}`
- **Métier** : sélecteur → PUT `/api/portal/users/{id}/metier` `{ metierId }` (valeur vide = aucun métier)
- **Groupes** : case à cocher par groupe → POST `/api/portal/user-groupes` `{ userId, groupeId, linked }`
- **Accès directs** : case à cocher par application → POST `/api/portal/user-apps` ; quand l'accès est actif, un sélecteur permet de choisir le niveau (`lecture` / `ecriture` / `admin`)
- **Cas admin** : rappel affiché — un administrateur voit de toute façon tous les groupes actifs sur son accueil
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-utilisateurs.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-utilisateurs.component.html`, `libs/portail-core/data-access/src/lib/portal-apps.models.ts`, `server/modules/portal-apps.js`, `server/server-data.js`

---

## `2-1-9-6` — [modification] Persistance et sécurité des routes

- **Stockage** : tables MySQL `portal_apps`, `portal_groupes`, `portal_groupe_apps`, `portal_metiers`, `portal_user_groupes`, `portal_user_apps`, colonne `users.metier_id`
- **Création automatique du schéma** : `ensureSchema` au démarrage du serveur (idempotent), amorçage des sous-applications `apps/*` uniquement si `portal_apps` est vide
- **Lecture** : toutes les routes GET exigent une session valide (401 sinon)
- **Écriture** : POST / PUT / DELETE réservés au rôle admin (403 sinon)
- **Priorité:** bloquant
- **Composants:** `server/modules/portal-apps.js`, `server/init-db.js`, `server/server-data.js`
