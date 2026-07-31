# Architecture : portail vs sous-applications

## Principe

Le **portail** (`apps/portail`) est le seul propriétaire du système transverse :
utilisateurs, groupes, métiers, catalogue des applications (table `portal_apps`),
thème général (dark/light/pink), logs, config générale, déploiement.

Une **sous-application** (`apps/appli-<nom>`, ex. `appli-agenda`) est une unité
quasi autonome : même structure de dossier d'une sous-appli à l'autre, sa
propre admin, sa propre configuration/environnement, son propre sous-design
pour ce qui n'est pas couvert par le thème général. Elle ne dépend du portail
que via des points de contrat explicites — jamais par chemin relatif vers le
code du portail.

But : pouvoir prendre le dossier d'une sous-application et le glisser dans un
autre portail avec un minimum de câblage.

## Convention de dossier

```
apps/appli-<nom>/
├─ src/
│  ├─ app/
│  │  ├─ home/                  ← page d'accueil de la sous-appli
│  │  ├─ admin/                 ← admin propre à la sous-appli
│  │  │  ├─ admin-<nom>.component.ts/.html
│  │  │  └─ provide-<nom>-admin-tab.ts   ← contribue l'onglet au portail
│  │  ├─ core/
│  │  │  ├─ models/
│  │  │  ├─ services/
│  │  │  └─ utils/
│  │  └─ app.routes.ts
│  └─ environments/
│     └─ environment.ts          ← convention Angular CLI standard
└─ server/
   └─ index.js                   ← register(app,{pool,getSessionUser}) + ensureSchema(pool)
                                     + sa propre entrée de catalogue portal_apps
```

## Deux modes de sous-application

- **Mode intégré** (`appli-agenda`, `appli-recettes`) : le code source de la
  sous-appli est compilé dans le même bundle Angular que le portail (routes
  chargées à la demande par chemin relatif). C'est ce qui permet à son admin
  de contribuer un composant directement au `AdminTabsRegistryService` du
  portail (mécanisme 2 ci-dessous) : le composant existe dans le même bundle,
  donc `NgComponentOutlet` peut le rendre.
- **Mode autonome** (`apps/appli-projets`) : application NX séparée, son propre
  build, son propre port, son propre bundle. Son admin ne peut **pas**
  contribuer un composant au portail de la même façon — un composant compilé
  dans le bundle de `apps/appli-projets` n'existe pas dans celui du portail au
  runtime. C'est pourquoi son admin reste un onglet géré côté portail
  (`apps/portail/src/app/child/child-admin-tabs.ts`), qui se contente de
  lister/rediriger vers l'app autonome plutôt que de rendre un composant
  venu de son propre dossier. En revanche, tout le reste du contrat
  s'applique normalement : backend co-localisé (`apps/appli-projets/server/`),
  catalogue `portal_apps` auto-porté, tokens DI déjà découplés (elle a
  toujours été une app NX à part, avec son propre `app.config.ts`).

## Les mécanismes de contrat

### 1. Montage dans le portail (routing)

Une ligne dans `apps/portail/src/app/base-routes.ts` :

```ts
{ path: 'agenda', canActivate: [authGuard], loadChildren: () => import('../../../appli-agenda/src/app/app.routes').then(m => m.appRoutes) }
```

La sous-appli est chargée à la demande dans le shell du portail : elle hérite
donc automatiquement de son header, de son thème et de sa session (pas de
pont cross-origin nécessaire, contrairement à `apps/appli-projets` qui est une
application séparée sur son propre port).

### 2. Admin plug-in (`AdminTabsRegistryService`)

`libs/portail-core/data-access/src/lib/admin-tabs-registry.service.ts` expose
`registerBase()` (une fois, par le portail) et `registerChild()` (par
n'importe qui, plusieurs fois — les onglets s'ajoutent par `id`, ils ne se
remplacent pas). Chaque sous-appli fournit son propre
`provide-<nom>-admin-tab.ts` (voir `apps/appli-agenda/src/app/admin/`) et
`apps/portail/src/app/app.config.ts` l'ajoute au tableau `providers` — la
définition de l'onglet appartient au dossier de la sous-appli, pas au portail.

Chaque `AdminTabDef` porte un champ `group` (`'portail' | 'applications' |
'autres'`) : la page `/admin` (`AdminComponent`) affiche ces 3 catégories,
déduites automatiquement des onglets enregistrés. Un onglet de sous-appli
(ex. `provide-agenda-admin-tab.ts`) déclare `group: 'applications'` — il
apparaît alors dans la catégorie « Applications », regroupé avec l'admin des
autres sous-applications, séparé de l'admin transverse du portail (catégorie
« Portail »). Tout ce qui n'est pas encore catégorisé reste dans « Autres ».

### 3. Catalogue `portal_apps` auto-porté

`server/modules/portal-apps.js` expose `upsertCatalogEntry(pool, entry)` :
insère la ligne `portal_apps` d'une sous-appli si son `code` n'existe pas
encore (jamais d'écrasement d'une entrée modifiée à la main dans
Admin › Portail). Chaque module serveur de sous-appli appelle cette fonction
depuis son propre `ensureSchema()` avec sa propre constante `CATALOG_ENTRY`
(voir `apps/appli-agenda/server/index.js`) — `portal-apps.js` n'a plus besoin
de connaître le nom de chaque sous-appli existante.

**Vérification de présence au démarrage** : `portal-apps.js` maintient aussi
un ensemble `MOUNTED_APP_CODES`, alimenté par `markAppMounted(code)` que
chaque module de sous-appli appelle en tête de son propre `register()` (qui
s'exécute à chaque démarrage — son exécution sans erreur prouve que le code
est bien présent). Le calcul `isAvailable` (exposé sur chaque `PortalApp`)
compare le catalogue à cet ensemble : une entrée `portal_apps` pointant vers
une route interne dont le code n'a pas été monté à ce démarrage (dossier
retiré) est `isAvailable: false`, et le front (page d'accueil, voir `2-6-2`
dans `tests/fonctions/connecte/accueil/fonctions.md`) ne l'affiche pas. Une
application externe (URL absolue) est toujours considérée disponible.

### 4. Backend co-localisé

`register(app, {pool, getSessionUser})` + `ensureSchema(pool)` vivent dans
`apps/appli-<nom>/server/index.js`. `server/server-data.js` garde une courte
liste de `require()` (une ligne par sous-appli) pointant vers ce dossier :

```js
require('../apps/appli-agenda/server').register(app, { pool, getSessionUser });
await require('../apps/appli-agenda/server').ensureSchema(pool);
```

### 5. Découplage des tokens DI

Les services de la sous-appli injectent `API_DATA_URL`
(`@portail/core-data-access`) pour la base de l'API, plutôt que de
lire un `environment.serviceVal` construit depuis le `runtime-env` du
portail. Aucun `import` par chemin relatif vers `apps/portail/` ne doit
subsister dans le code d'une sous-appli.

### 6. Design

La sous-appli consomme les variables CSS générales du portail (`--surface`,
`--text-dark`, etc. — c'est ce qui fait hériter dark/light/pink
automatiquement). Ce qui est strictement spécifique à son propre balisage
(ex. le correctif natif `select/input` de l'agenda) vit dans le style *scoped*
de son propre composant, pas dans un fichier de pont global.

## État transitoire (2026-07-31)

- **`appli-agenda`**, **`appli-recettes`** et **`appli-documents`** suivent le
  contrat complet ci-dessus (dossier `admin/` propre, backend co-localisé dans
  leur propre `server/index.js`, catalogue `portal_apps` auto-porté). Pour les
  recettes, Bootstrap vit dans `apps/appli-recettes/src/styles-recettes.scss`,
  importé par une seule ligne depuis le bridge global. `appli-documents` est
  la première à ne dépendre d'aucun bridge de compatibilité (Tailwind natif,
  aucune variable CSS legacy à réconcilier) — elle a été extraite de
  `apps/portail/src/app/pages/user/documents/` (où elle vivait directement
  dans le code du portail) plutôt que reprise d'un autre portail comme
  agenda/recettes ; son composant `MarkdownEditorComponent` a été déplacé vers
  `libs/shared/ui` (partagé avec la page `/editor`, un aperçu Markdown
  autonome resté dans le portail). Les variables CSS génériques (`--surface`,
  `--text-dark`, etc.) restent partagées entre agenda et recettes dans
  `apps/portail/src/styles-sous-apps.scss` (état transitoire — les dupliquer
  par sous-appli est un futur pas possible mais pas encore fait).
- **`apps/appli-projets`** (Mode autonome, voir ci-dessus) suit désormais le contrat
  backend : son code serveur (Mes Projets, éditeur de fichiers-projets,
  commentaires F6, conversations Zone 5, collaboration temps réel, git par
  projet, Méga-Outils, outil de tests par projet) a été extrait de
  `server/server-data.js` vers `apps/appli-projets/server/index.js`
  (`register`/`ensureSchema` + catalogue `portal_apps` auto-porté, comme
  agenda/recettes). Au passage, un bloc de code mort (~1640 lignes, ancien
  système `/api/projects` sur fichiers JSON, prédécesseur du système actuel
  basé sur git, sans plus aucun appelant frontend) a été supprimé de
  `server-data.js`. Ses onglets admin restent déclarés dans
  `apps/portail/src/app/child/child-admin-tabs.ts` — ce n'est pas un
  alignement restant à faire, mais une conséquence structurelle du Mode
  autonome (voir ci-dessus) : un composant compilé dans le bundle
  `apps/appli-projets` ne peut pas être rendu par le portail.
