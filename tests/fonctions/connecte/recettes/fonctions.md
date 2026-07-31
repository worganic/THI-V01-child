# Recettes — Fonctions métier

Route : `/recettes`
Composant : `HomeRecettesComponent` (`apps/appli-recettes`), monté à la demande dans le portail
Accès : utilisateur connecté

Sous-application de cahiers de recette (campagnes et sessions de test), intégrée au
portail : elle hérite de son en-tête, de son thème et de sa session, et ses données
sont servies par `/api/recettes/*` (tables MySQL `recette_*`). Elle est listée sur la
page d'accueil (`2-6-*`) et se configure dans Admin › Portail (`2-1-9-*`) ; ses
réglages propres (le cas échéant) vivent dans son propre onglet « Recettes »
des onglets admin globaux (`2-8-7`). Suit le contrat "sous-application" (voir
docs/architecture-sous-applications.md).

---

## `2-8-1` — [modification] Montage dans le portail

- **Route interne** : `/recettes`, `/recettes/{bookId}`, `/recettes/{bookId}/{onglet}`, chargées à la demande
- **Garde d'accès** : `authGuard` — un utilisateur non connecté est renvoyé sur la landing
- **Ouverture depuis l'accueil** : clic sur la carte « Recettes » → navigation Angular interne, sans rechargement de page
- **Styles Bootstrap confinés** : les gabarits d'origine utilisent Bootstrap 5, compilé sous le sélecteur `.bs-scope` posé sur le composant racine — aucun débordement sur le reste du portail (Tailwind) ; le contenu vit désormais dans `apps/appli-recettes/src/styles-recettes.scss` (propre à la sous-appli), importé par une seule ligne depuis le bridge global
- **Thème** : les écrans suivent le thème actif du portail via les variables de compatibilité (partagées avec l'agenda, encore dans `apps/portail/src/styles-sous-apps.scss`)
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/base-routes.ts`, `apps/appli-recettes/src/app/app.routes.ts`, `apps/appli-recettes/src/app/home/home-recettes.component.html`, `apps/appli-recettes/src/styles-recettes.scss`, `apps/portail/src/styles-sous-apps.scss`

---

## `2-8-2` — [modification] Cahiers de recette et arborescence

- **Liste des cahiers** : GET `/api/recettes/recipe_book/` avec vue globale (taux de réussite, nombre de tests, cahiers en cours, sessions du mois)
- **CRUD cahier** : création / édition via POST `/api/recettes/recipe_book/` et `/update/`, suppression via POST `/del/`
- **Arborescence** : catégories → applicatifs → sections → tests → tâches, chaque niveau avec son propre CRUD (`recipe_category`, `recipe_applicatif`, `recipe_section`, `recipe_test`, `recipe_task`)
- **Réordonnancement** : glisser-déposer des sections et des tests, persisté via `order_index`
- **Identifiants** : générés côté client ; toutes les écritures sont des upserts côté serveur (création et édition passent par le même chemin)
- **Priorité:** bloquant
- **Composants:** `apps/appli-recettes/src/app/home/home-recettes.component.ts`, `apps/appli-recettes/src/app/home/cahier/cahier.component.ts`, `apps/appli-recettes/src/app/core/services/recipe.service.ts`, `apps/appli-recettes/server/index.js`

---

## `2-8-3` — [modification] Campagnes et exécution des sessions

- **Campagnes** : liste, création et suppression via `/api/recettes/test_campaign/`
- **Session de test** : choix du testeur (utilisateurs du portail via GET `/api/recettes/users/`), du titre, du périmètre et de l'environnement, puis déroulé test par test
- **Réponses** : enregistrées par couple session/test (`/api/recettes/test_response/`) et session/tâche (`/api/recettes/test_task_response/`) — un même couple ne peut jamais produire de doublon
- **Reprise** : une session interrompue peut être reprise là où elle s'était arrêtée
- **Purge des résultats** : la relance d'une session supprime ses réponses précédentes avant réécriture
- **Priorité:** bloquant
- **Composants:** `apps/appli-recettes/src/app/home/execution/execution.component.ts`, `apps/appli-recettes/src/app/core/services/recipe.service.ts`, `apps/appli-recettes/server/index.js`

---

## `2-8-4` — [modification] Captures d'écran annotées

- **Capture** : annotation dans le modal dédié, puis POST `/api/recettes/capture/upload/` `{ dataUrl }`
- **Stockage serveur** : fichier écrit dans `data/recettes/captures/`, servi par la route statique `/data`
- **Retour** : URL absolue, affichée directement sur la réponse de test (vignette cliquable)
- **Refus** : une valeur qui n'est pas une image encodée en base64 renvoie 400
- **Priorité:** mineur
- **Composants:** `apps/appli-recettes/src/app/home/execution/capture-modal/capture-modal.component.ts`, `apps/appli-recettes/server/index.js`

---

## `2-8-5` — [modification] Résultats et indicateurs qualité

- **Onglet Résultats** : synthèse par cahier, par campagne et par session
- **Portes qualité** : statut GO / GO-CONDITIONAL / NO-GO calculé selon la criticité des tests et l'environnement
- **Vue globale d'accueil** : statut du dernier passage de chaque cahier, sessions récentes, sessions du mois
- **Priorité:** majeur
- **Composants:** `apps/appli-recettes/src/app/home/resultats/resultats.component.ts`, `apps/appli-recettes/src/app/core/models/recipe.model.ts`

---

## `2-8-6` — [modification] Persistance et sécurité des routes

- **Stockage** : tables MySQL `recette_books`, `recette_categories`, `recette_applicatifs`, `recette_sections`, `recette_tests`, `recette_tasks`, `recette_campaigns`, `recette_sessions`, `recette_responses`, `recette_task_responses`
- **Création automatique du schéma** : `ensureSchema` au démarrage du serveur, idempotent
- **Verbes conservés** : GET liste (filtrable par colonne en paramètre), POST création, POST `update/` et `update2/`, POST `del/` — contrat de l'API d'origine, réimplémenté sur le portail
- **Authentification** : toutes les routes `/api/recettes/*` exigent une session valide (401 sinon)
- **En-têtes envoyés** : uniquement `Content-Type` et `Authorization` — tout en-tête personnalisé supplémentaire doit d'abord être ajouté aux `allowedHeaders` du CORS (`server/server-data.js`), sinon le navigateur bloque l'appel après le préflight
- **Backend co-localisé** : le module serveur vit dans `apps/appli-recettes/server/index.js` (et non plus `server/modules/appli-recettes.js`) — contrat "sous-application", voir `docs/architecture-sous-applications.md`
- **Priorité:** bloquant
- **Composants:** `apps/appli-recettes/server/index.js`, `server/server-data.js`, `server/init-db.js`

---

## `2-8-7` — [modification] Admin propre aux recettes & catalogue auto-porté

- **Onglet admin dédié** : « Recettes » apparaît dans la catégorie « Applications » des onglets admin globaux, à côté de « Agenda », contribué depuis le dossier des recettes lui-même via `AdminTabsRegistryService.registerChild()` — pas de fonctionnalité spécifique pour l'instant (placeholder), point d'extension pour de futurs réglages
- **Catalogue `portal_apps`** : les recettes insèrent leur propre ligne de catalogue (`code appli-recettes`, url `/recettes`) depuis leur propre `ensureSchema()` (`upsertCatalogEntry`), au lieu d'être connues par leur nom dans `server/modules/portal-apps.js`
- **Priorité:** mineur
- **Composants:** `apps/appli-recettes/src/app/admin/admin-recettes.component.ts`, `apps/appli-recettes/src/app/admin/provide-recettes-admin-tab.ts`, `apps/portail/src/app/app.config.ts`, `apps/appli-recettes/server/index.js`, `server/modules/portal-apps.js`
