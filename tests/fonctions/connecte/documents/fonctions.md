# Documents — Fonctions métier

Route : `/documents`
Composant : `DocumentsComponent` (`apps/appli-documents`), monté à la demande dans le portail
Accès : utilisateur connecté

Sous-application de documents Markdown classés par catégorie, intégrée au
portail : elle hérite de son en-tête, de son thème et de sa session, et ses
données sont servies par `/api/doc-categories` et `/api/documents` (tables
MySQL `doc_categories`, `documents`). Auparavant intégrée directement dans le
code du portail (`apps/portail/src/app/pages/user/documents/`), elle a été
extraite en sous-application à part entière (`apps/appli-documents`), suivant
le même contrat que l'agenda et les recettes (voir
`docs/architecture-sous-applications.md`). Elle se configure dans Admin ›
Portail (`2-1-9-*`) et apparaît dans la catégorie « Applications » des onglets
admin globaux (`2-1-9-7`).

---

## `2-9-1` — Montage dans le portail

- **Route interne** : `/documents`, chargée à la demande
- **Garde d'accès** : `authGuard` — un utilisateur non connecté est renvoyé sur la landing
- **Accès depuis la navigation** : item « Documents » toujours en deuxième position dans la barre de navigation (portail et sous-applications), masqué si l'entrée `portal_apps` de code `appli-documents` est désactivée ou indisponible (même mécanisme que l'item « Projets », voir `2-6-4`)
- **Thème** : les écrans suivent le thème actif du portail (Tailwind natif, pas de bridge de compatibilité nécessaire — contrairement à agenda/recettes)
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/base-routes.ts`, `apps/appli-documents/src/app/app.routes.ts`, `libs/shared/ui/src/lib/layout/nav/nav.component.ts`, `libs/shared/ui/src/lib/layout/nav/nav.component.html`

---

## `2-9-2` — Catégories

- **Liste** : GET `/api/doc-categories`
- **CRUD** : création/édition (nom requis, description) via POST/PUT, suppression via DELETE — réservé au créateur ou à un admin
- **Document par défaut** : une catégorie peut désigner un de ses documents comme « par défaut » (doit appartenir à la catégorie)
- **Priorité:** majeur
- **Composants:** `apps/appli-documents/src/app/home/documents.component.ts`, `apps/appli-documents/server/index.js`

---

## `2-9-3` — Documents

- **Liste** : GET `/api/documents` — un admin voit tous les documents, un utilisateur standard voit les documents publics + les siens
- **CRUD** : création/édition (titre requis, description, contenu Markdown, catégorie, public/privé) via POST/PUT, suppression via DELETE — réservé au créateur ou à un admin
- **Éditeur Markdown** : `MarkdownEditorComponent` (barre d'outils, aperçu live) — composant partagé (`libs/shared/ui`), également utilisé par la page `/editor` (aperçu Markdown autonome, sans persistance)
- **Priorité:** majeur
- **Composants:** `apps/appli-documents/src/app/home/documents.component.ts`, `apps/appli-documents/server/index.js`, `libs/shared/ui/src/lib/markdown-editor/markdown-editor.component.ts`

---

## `2-9-4` — Admin propre aux documents & catalogue auto-porté

- **Onglet admin dédié** : « Documents » apparaît dans la catégorie « Applications » des onglets admin globaux (à côté d'Agenda, Recettes, Projets), contribué depuis le dossier des documents lui-même via `AdminTabsRegistryService.registerChild()` — pas de fonctionnalité spécifique pour l'instant (placeholder)
- **Catalogue `portal_apps`** : les documents insèrent leur propre ligne de catalogue (`code appli-documents`, url `/documents`) depuis leur propre `ensureSchema()` (`upsertCatalogEntry`)
- **Priorité:** mineur
- **Composants:** `apps/appli-documents/src/app/admin/admin-documents.component.ts`, `apps/appli-documents/src/app/admin/provide-documents-admin-tab.ts`, `apps/portail/src/app/app.config.ts`, `apps/appli-documents/server/index.js`, `server/modules/portal-apps.js`

---

## `2-9-5` — Persistance et sécurité des routes

- **Stockage** : tables MySQL `doc_categories`, `documents`
- **Création automatique du schéma** : `ensureSchema` au démarrage du serveur, idempotent
- **Authentification** : toutes les routes exigent une session valide (401 sinon)
- **Autorisation** : édition/suppression réservées au créateur ou à un admin (403 sinon)
- **Priorité:** bloquant
- **Composants:** `apps/appli-documents/server/index.js`, `server/server-data.js`
