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

## Les mécanismes de contrat

### 1. Montage dans le portail (routing)

Une ligne dans `apps/portail/src/app/base-routes.ts` :

```ts
{ path: 'agenda', canActivate: [authGuard], loadChildren: () => import('../../../appli-agenda/src/app/app.routes').then(m => m.appRoutes) }
```

La sous-appli est chargée à la demande dans le shell du portail : elle hérite
donc automatiquement de son header, de son thème et de sa session (pas de
pont cross-origin nécessaire, contrairement à `apps/projets` qui est une
application séparée sur son propre port).

### 2. Admin plug-in (`AdminTabsRegistryService`)

`libs/portail-core/data-access/src/lib/admin-tabs-registry.service.ts` expose
`registerBase()` (une fois, par le portail) et `registerChild()` (par
n'importe qui, plusieurs fois — les onglets s'ajoutent par `id`, ils ne se
remplacent pas). Chaque sous-appli fournit son propre
`provide-<nom>-admin-tab.ts` (voir `apps/appli-agenda/src/app/admin/`) et
`apps/portail/src/app/app.config.ts` l'ajoute au tableau `providers` — la
définition de l'onglet appartient au dossier de la sous-appli, pas au portail.

### 3. Catalogue `portal_apps` auto-porté

`server/modules/portal-apps.js` expose `upsertCatalogEntry(pool, entry)` :
insère la ligne `portal_apps` d'une sous-appli si son `code` n'existe pas
encore (jamais d'écrasement d'une entrée modifiée à la main dans
Admin › Portail). Chaque module serveur de sous-appli appelle cette fonction
depuis son propre `ensureSchema()` avec sa propre constante `CATALOG_ENTRY`
(voir `apps/appli-agenda/server/index.js`) — `portal-apps.js` n'a plus besoin
de connaître le nom de chaque sous-appli existante.

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
(`@worganic/portail-core/data-access`) pour la base de l'API, plutôt que de
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

- **`appli-agenda`** suit le contrat complet ci-dessus (pilote).
- **`appli-recettes`** et **`apps/projets`** n'y sont pas encore alignés :
  - `appli-recettes` reste montée comme avant (pas de dossier `admin/`, backend
    encore dans `server/modules/appli-recettes.js`, catalogue encore dans
    `SEED_APPS`/`URL_MIGRATIONS` de `portal-apps.js`, alias CSS encore partagés
    dans `apps/portail/src/styles-sous-apps.scss`).
  - `apps/projets` est une application NX séparée (port dédié, pont
    cross-origin token/thème déjà en place) mais ses onglets admin sont encore
    déclarés dans `apps/portail/src/app/child/child-admin-tabs.ts` plutôt que
    dans son propre dossier.
- Ces deux alignements sont prévus dans un prompt de suivi, une fois le modèle
  validé en usage réel sur l'agenda.
