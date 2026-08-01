# Admin › Portail — Fonctions métier

Route : `/admin/portail` (ancien `/admin/applications`, renommé — fusionné avec l'ancien onglet séparé `/admin/users`)  
Composant : `AdminPortailComponent` (sous-sections Utilisateurs / Groupes / Métiers / Applications / Export JSON / Infos config)  
Accès : admin uniquement

Regroupe toute l'administration du portail : les comptes utilisateurs (compte,
métier, groupes, accès directs) et ce qui pilote le contenu de la page
d'accueil (`2-6-*`) : quelles sous-applications existent et comment elles sont
regroupées. Toutes les données sont en MySQL (tables `portal_*` + `users`).

---

## `2-1-9-1` — [modification] Navigation par sous-onglets

- **Sous-onglets** : Utilisateurs, Groupes, Métiers, Applications, Export JSON, Infos config — mêmes pages et même ordre que l'autre portail
- **Sous-onglet par défaut** : Utilisateurs
- **Rendu conditionnel** : une seule section montée à la fois, rechargée à chaque affichage
- **Présentation commune aux quatre premières sections** : carte « Ajouter un… » en tête, barre de filtres, tableau triable (clic sur l'en-tête : croissant puis décroissant), édition en ligne, ligne dépliable pour le détail, barre de pagination (10 / 25 / 50 / Tous)
- **Priorité:** majeur
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/admin-portail.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/admin-portail.component.html`, `apps/portail/src/app/pages/admin/admin.component.ts`, `libs/shared/ui/src/lib/admin/admin-table.util.ts`, `libs/shared/ui/src/lib/admin/worg-admin-pagination.component.ts`

---

## `2-1-9-2` — [modification] CRUD des applications

- **Liste** : GET `/api/portal/apps` — nom, code, URL/route, ordre, état
- **Recherche / filtres** : texte libre (code, nom, URL, description) et statut (tous / active / inactive)
- **Tri** : colonnes Application, Code, URL, Ordre, Statut ; tri initial sur Ordre
- **Création** : formulaire en tête de page (code technique requis et unique, nom requis, description, URL ou route interne, icône, ordre, visible) → POST `/api/portal/apps`
- **Édition** : bouton « Éditer » → édition en ligne dans la ligne du tableau → PUT `/api/portal/apps/{id}`
- **Suppression** : bouton « Supprimer » → confirmation en ligne → DELETE `/api/portal/apps/{id}`
- **Bascule d'état** : bouton Masquer/Afficher → PUT avec `isActive` inversé ; une application inactive disparaît de la page d'accueil
- **Erreur code dupliqué** : message « Ce code d'application existe déjà » (contrainte unique)
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-apps.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-apps.component.html`, `libs/portail-core/data-access/src/lib/portal-apps.service.ts`, `server/modules/portal-apps.js`

---

## `2-1-9-3` — [modification] Groupes et rattachement des applications

- **Liste des groupes** : GET `/api/portal/groupes` — tableau (groupe, description, ordre, nombre d'applications, statut) avec compteur d'applications rattachées
- **Recherche / filtres** : texte libre (nom, description) et statut (tous / actif / inactif)
- **Tri** : colonnes Groupe, Description, Ordre, Applications, Statut ; tri initial sur Ordre
- **CRUD groupe** : création par le formulaire en tête (nom requis, description, ordre, actif), édition en ligne dans le tableau, suppression avec confirmation en ligne
- **Sélection** : bouton « Applications » → la ligne se déplie sous le groupe et liste toutes les applications
- **Matrice groupe × applications** : case à cocher par application → POST `/api/portal/groupe-apps` `{ groupeId, appId, linked }`
- **Effet** : les membres du groupe voient sur leur accueil toutes les applications cochées
- **Suppression en cascade** : supprimer un groupe supprime ses rattachements et les affectations utilisateurs correspondantes
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-groupes.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-groupes.component.html`, `server/modules/portal-apps.js`

---

## `2-1-9-4` — [modification] CRUD des métiers

- **Liste** : GET `/api/portal/metiers` — tableau (badge du métier, couleur, nombre d'utilisateurs rattachés, statut)
- **Recherche / filtres** : texte libre sur le nom et statut (tous / actif / inactif)
- **Tri** : colonnes Métier, Couleur, Utilisateurs, Statut ; tri initial sur Métier
- **CRUD métier** : nom requis, couleur du tag parmi 6 teintes, actif/inactif ; aperçu du tag en direct dans le formulaire d'ajout comme en édition en ligne
- **Utilisateurs rattachés** : bouton « Utilisateurs » → la ligne se déplie et affiche une pastille par utilisateur (croix pour retirer le métier) plus un champ de recherche pour en rattacher un — PUT `/api/portal/users/{id}/metier`
- **Suppression** : bouton désactivé tant qu'au moins un utilisateur porte le métier (réaffecter d'abord)
- **Portée** : un métier qualifie la fiche utilisateur et n'accorde aucun droit
- **Priorité:** mineur
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-metiers.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-metiers.component.html`, `libs/core/data-access/src/lib/portal-apps.models.ts`, `server/modules/portal-apps.js`

---

## `2-1-9-5` — [modification] Comptes utilisateurs (compte, métier, groupes, accès directs)

Fusionne l'ancien onglet séparé « Admin › Utilisateurs » (`2-1-4-*`, composant
`AdminUsersComponent`, supprimé) avec l'ancienne section « Droits » : un seul
endroit pour tout ce qui concerne un utilisateur.

- **Fiche utilisateur** : matricule, nom, prénom, email, rôle, statut actif/inactif, métier — mêmes champs que l'autre portail (colonnes `users.matricule`, `nom`, `prenom`, `is_active`, ajoutées par `ensureSchema`, valeurs par défaut vides/actif pour les comptes antérieurs). `username` reste l'identité technique du compte (unique, affichée dans l'en-tête) : saisi au formulaire et rappelé sous le matricule dans le tableau
- **Liste des utilisateurs** : GET `/api/portal/users` — colonnes Matricule, Nom, Prénom, Email, Rôle Global, Métier, Statut, Actions
- **Recherche / filtres** : texte libre (matricule, nom, prénom, username, email — insensible à la casse), rôle, métier, statut
- **Tri** : colonnes Matricule, Nom, Prénom, Email, Rôle Global, Métier, Statut ; tri initial sur Matricule. Un compte sans nom d'annuaire est trié sur son username plutôt que sur une chaîne vide
- **Création de compte** : formulaire en tête de page (matricule, nom, prénom, email, rôle, métier, nom d'utilisateur et mot de passe requis, case Actif) → POST `/api/auth/register`, puis PUT `/api/auth/users/{id}` `{ role: 'admin' }` si rôle admin et PUT `/api/portal/users/{id}/metier` si un métier est choisi
- **Matricule unique** : 409 « Ce matricule est déjà utilisé » à la création comme à l'édition (le matricule vide reste autorisé, il n'est pas contraint)
- **Édition de compte** : bouton « Éditer » → édition en ligne (matricule, username, nom, prénom, email, mot de passe optionnel, rôle, métier, statut) → PUT `/api/auth/users/{id}` (+ PUT métier si modifié)
- **Activer / Désactiver** : bouton dédié dans les actions → PUT `/api/auth/users/{id}` `{ isActive }` ; un compte désactivé est conservé mais sa connexion est refusée (403 « Ce compte est désactivé »), identifiants pourtant corrects
- **Suppression de compte** : bouton « Supprimer » → confirmation en ligne → DELETE `/api/auth/users/{id}`
- **Droits** : bouton « Droits » → la ligne se déplie sous l'utilisateur et affiche groupes et accès directs
- **Rendu du tableau** : en-tête en bandeau plein (couleur primaire, libellés en gras + flèche de tri), lignes zébrées et survol, badges pleins (rôle, métier), boutons d'action en contour coloré par nature (Droits cyan, Éditer bleu, Supprimer rouge, Valider vert) — rendu aligné sur le tableau de l'autre portail
- **Compteur** : « N utilisateur(s) » à droite de la barre de filtres (reflète le filtrage, pas la page courante)
- **Métier** : sélecteur dans la ligne en édition → PUT `/api/portal/users/{id}/metier` `{ metierId }` (valeur vide = aucun métier)
- **Groupes** : case à cocher par groupe dans la ligne dépliée → POST `/api/portal/user-groupes` `{ userId, groupeId, linked }`
- **Auto-cochage des accès directs à l'association d'un groupe** : associer un groupe coche automatiquement, dans « Accès directs », les applications rattachées à ce groupe (`portal_groupe_apps`) qui n'étaient pas déjà cochées individuellement (droit `lecture` par défaut) — simple confort admin, l'accès réel provient déjà du groupe. Le retrait du groupe ne décoche jamais ces accès directs (choix explicite conservé)
- **Accès directs** : case à cocher par application → POST `/api/portal/user-apps` ; quand l'accès est actif, un sélecteur permet de choisir le niveau (`lecture` / `ecriture` / `admin`)
- **Cas admin** : le rôle admin donne accès au panneau `/admin` mais n'accorde plus aucun bypass sur l'accueil/le menu — un admin ne voit que ses propres groupes cochés et accès directs, comme tout autre utilisateur (voir mod-601)
- **Pas de scroll intempestif** : la bascule d'un groupe/accès direct/métier/compte ne relance pas l'état de chargement plein panneau (spinner) — seules les valeurs sous-jacentes sont rafraîchies, le tableau reste monté et la position de défilement ne saute plus
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-utilisateurs.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-utilisateurs.component.html`, `libs/core/data-access/src/lib/portal-apps.models.ts`, `libs/core/data-access/src/lib/portal-apps.service.ts`, `server/modules/portal-apps.js`, `server/server-data.js`

---

## `2-1-9-6` — [modification] Persistance et sécurité des routes

- **Stockage** : tables MySQL `portal_apps`, `portal_groupes`, `portal_groupe_apps`, `portal_metiers`, `portal_user_groupes`, `portal_user_apps`, colonnes `users.metier_id`, `users.matricule`, `users.nom`, `users.prenom`, `users.is_active`
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
- **Composants:** `apps/portail/src/app/pages/admin/admin.component.ts`, `apps/portail/src/app/pages/admin/admin.component.html`, `libs/core/data-access/src/lib/admin-tabs-registry.service.ts`, `apps/portail/src/app/child/child-admin-tabs.ts`, `apps/appli-agenda/src/app/admin/provide-agenda-admin-tab.ts`

---

## `2-1-9-8` — [modification] Export JSON des données d'habilitation

- **Périmètre** : boutons « Tous », « Socle du portail » et un bouton par sous-application
- **Socle du portail** : utilisateurs, groupes, métiers implicites, applications et les trois tables de liaison, en un seul bloc
- **Une application** : l'application, ses groupes rattachés (`portal_groupe_apps`), les accès directs la concernant et uniquement les utilisateurs qui y accèdent (par groupe ou en direct) — le bloc est donc utilisable seul
- **Tous** : le bloc socle suivi d'un bloc par application
- **Rendu** : JSON indenté (2 espaces) dans une zone défilante, avec le nombre de caractères
- **Copie** : bouton « Copier » → presse-papiers, libellé « Copié ! » pendant 2,5 s ; message d'erreur si le navigateur refuse l'accès au presse-papiers
- **Priorité:** mineur
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-export.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-export.component.html`, `libs/core/data-access/src/lib/portal-apps.service.ts`

---

## `2-1-9-9` — [modification] Infos config (état d'exécution)

- **État actuel** : statut de la base de données (Connectée / Injoignable / Vérification…) avec l'IP cliente, version locale (`version.json`) et indication « à jour » ou « un déploiement plus récent existe », branche git courante, date du dernier déploiement — GET `/api/version/check` et `DbStatusService`
- **Réessayer la sonde** : bouton relançant les deux sondes (base + version)
- **Services contactés** : tableau des tokens d'injection `API_DATA_URL`, `API_EXECUTOR_URL`, `API_AGENT_URL` et de leur valeur ; « non exposé » si la valeur est vide
- **Modes de lancement** : tableau des commandes npm disponibles (portail seul, projets seul, API seule, tout, tout + Electron)
- **Lecture seule** : aucune valeur n'est modifiable depuis cette page
- **Priorité:** mineur
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-config.component.ts`, `apps/portail/src/app/pages/admin/tabs/admin-portail/sections/portail-config.component.html`, `libs/core/data-access/src/lib/db-status.service.ts`, `server/server-data.js`
