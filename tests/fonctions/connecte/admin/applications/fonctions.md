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
- **Auto-cochage des accès directs à l'association d'un groupe** : associer un groupe coche automatiquement, dans « Accès directs », les applications rattachées à ce groupe (`portal_groupe_apps`) qui n'étaient pas déjà cochées individuellement (droit `lecture` par défaut) — simple confort admin, l'accès réel provient déjà du groupe. Le retrait du groupe ne décoche jamais ces accès directs (choix explicite conservé)
- **Accès directs** : case à cocher par application → POST `/api/portal/user-apps` ; quand l'accès est actif, un sélecteur permet de choisir le niveau (`lecture` / `ecriture` / `admin`)
- **Cas admin** : le rôle admin donne accès au panneau `/admin` mais n'accorde plus aucun bypass sur l'accueil/le menu — un admin ne voit que ses propres groupes cochés et accès directs, comme tout autre utilisateur (voir mod-601)
- **Pas de scroll intempestif** : la bascule d'un groupe/accès direct/métier/compte ne relance pas l'état de chargement plein panneau (spinner) — seules les valeurs sous-jacentes sont rafraîchies, le panneau détail reste monté et la position de défilement ne saute plus
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-utilisateurs.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-utilisateurs.component.html`, `libs/portail-core/data-access/src/lib/portal-apps.models.ts`, `libs/portail-core/data-access/src/lib/portal-apps.service.ts`, `server/modules/portal-apps.js`, `server/server-data.js`

---

## `2-1-9-6` — [modification] Persistance et sécurité des routes

- **Stockage** : tables MySQL `portal_apps`, `portal_groupes`, `portal_groupe_apps`, `portal_metiers`, `portal_user_groupes`, `portal_user_apps`, colonne `users.metier_id`
- **Création automatique du schéma** : `ensureSchema` au démarrage du serveur (idempotent), amorçage des sous-applications `apps/*` uniquement si `portal_apps` est vide
- **Lecture** : toutes les routes GET exigent une session valide (401 sinon)
- **Écriture** : POST / PUT / DELETE réservés au rôle admin (403 sinon)
- **Priorité:** bloquant
- **Composants:** `server/modules/portal-apps.js`, `server/init-db.js`, `server/server-data.js`

---

## `2-1-9-7` — [modification] Catégories de la zone Admin (Portail / Applications / Autres)

La page `/admin` (`AdminComponent`, hôte de tous les onglets — Portail comme
les autres) affiche 3 catégories, calculées depuis le champ `group` de
chaque onglet enregistré dans `AdminTabsRegistryService` :

- **Portail** : administration transverse du système — non spécifique à une sous-application. Sous-onglets : « Système » (`AdminPortailComponent`, id `portail` — renommé pour ne pas doublonner le nom de la catégorie ; `2-1-9-1` à `2-1-9-6` ci-dessus, avec son propre sous-menu Utilisateurs/Applications/Groupes/Métiers), « Déploiement » (`2-1-2-*`), « Config » (`2-1-1-*`), « Thème » (`2-1-3-*`), « Outils » (`2-1-10-1`)
- **Applications** : un onglet par sous-application ayant fourni sa propre
  admin (ex. `2-7-7` — Agenda) ; message « Aucune sous-application n'a encore
  d'admin propre » si aucune n'en fournit
- **Autres** : tout ce qui n'est pas encore rangé dans les deux zones
  ci-dessus (Méga-outils, Mémo, IA, Projets, Tests) — zone provisoire, à
  démembrer au fur et à mesure
- **Sélection d'une catégorie** : bascule sur son premier onglet (triés par
  `order`) ; l'URL (`/admin/{tab}`) reste la source de vérité, la catégorie
  active est déduite de l'onglet actif (pas d'état à synchroniser séparément)
- **Priorité:** majeur
- **Composants:** `apps/portail/src/app/pages/admin/admin.component.ts`, `apps/portail/src/app/pages/admin/admin.component.html`, `libs/portail-core/data-access/src/lib/admin-tabs-registry.service.ts`, `apps/portail/src/app/child/child-admin-tabs.ts`, `apps/appli-agenda/src/app/admin/provide-agenda-admin-tab.ts`
