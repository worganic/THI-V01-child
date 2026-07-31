# Architecture : portail vs sous-applications

> Ce document est **identique dans les deux monorepos** (`portail/` et
> `THI-V01-child-user3/`). Il décrit le contrat qui permet de déplacer un
> dossier `apps/appli-<nom>/` de l'un à l'autre sans adaptation.
> Toute modification doit être reportée des deux côtés.

## Principe

Le **portail** est le seul propriétaire du système transverse : utilisateurs,
groupes, métiers, catalogue des applications (table `portal_apps`), thème,
config générale.

Une **sous-application** (`apps/appli-<nom>/`) est une unité autonome : même
structure de dossier d'une sous-appli à l'autre et d'un portail à l'autre, sa
propre admin, sa propre configuration, son propre sous-design. Elle ne dépend
du portail que via des points de contrat explicites — **jamais par chemin
relatif vers le code du portail**.

Les deux portails ont volontairement des identités visuelles différentes
(Airbus bleu marine d'un côté, Lavande violet de l'autre, logos propres) et des
backends différents. C'est le contrat, pas le design ni l'infrastructure, qui
est partagé.

## Convention de dossier

```
apps/appli-<nom>/
├─ src/
│  ├─ app/
│  │  ├─ home/                  ← page d'accueil de la sous-appli
│  │  ├─ admin/                 ← admin propre à la sous-appli
│  │  │  ├─ admin-<nom>.component.ts / .html / .scss
│  │  │  └─ provide-<nom>-admin-tab.ts   ← contribue l'onglet au portail
│  │  ├─ core/
│  │  │  ├─ models/
│  │  │  ├─ services/
│  │  │  └─ utils/
│  │  └─ app.routes.ts
│  └─ environments/
│     └─ environment.ts          ← chemins de service UNIQUEMENT
└─ server/
   └─ index.js                   ← register(app,{pool,getSessionUser})
                                   + ensureSchema(pool) + CATALOG_ENTRY
```

`project.json` est facultatif : sa présence fait de la sous-application une app
NX à part entière (« Mode autonome », build et port dédiés) en plus de son
montage dans le portail.

## Les mécanismes de contrat

### 1. Montage dans le portail (routing)

Une ligne dans les routes du portail :

```ts
{ path: 'agenda', canActivate: [authGuard],
  loadChildren: () => import('../../../appli-agenda/src/app/app.routes').then(m => m.appRoutes) }
```

La sous-appli est chargée à la demande dans le shell : elle hérite donc
automatiquement de son header, de son thème et de sa session.

### 2. Admin plug-in (`AdminTabsRegistryService`)

`libs/core/data-access/src/lib/admin-tabs-registry.service.ts` expose
`registerBase()` (une fois, par le portail) et `registerChild()` (par n'importe
qui, plusieurs fois — les onglets s'ajoutent par `id`, ils ne se remplacent
pas). Chaque sous-appli fournit son `provide-<nom>-admin-tab.ts` et le portail
l'ajoute à ses `providers` — la définition de l'onglet appartient au dossier de
la sous-appli.

Chaque `AdminTabDef` porte un `group` (`'portail' | 'applications' | 'autres'`).
Un onglet de sous-appli déclare `group: 'applications'`.

### 3. Catalogue `portal_apps` auto-porté

`server/modules/portal-apps.js` expose `upsertCatalogEntry(pool, entry)` :
insère la ligne `portal_apps` d'une sous-appli si son `code` n'existe pas encore
(jamais d'écrasement d'une entrée modifiée à la main). Chaque module serveur de
sous-appli l'appelle depuis son `ensureSchema()` avec sa propre `CATALOG_ENTRY`.

**Vérification de présence au démarrage** : `markAppMounted(code)`, appelé en
tête de chaque `register()`, alimente l'ensemble des applications réellement
présentes. `isAppAvailable()` compare le catalogue à cet ensemble : une entrée
pointant vers une route interne dont le dossier a été retiré est signalée
indisponible et n'est pas affichée.

### 4. Backend co-localisé

`register(app, {pool, getSessionUser})` + `ensureSchema(pool)` vivent dans
`apps/appli-<nom>/server/index.js`. Le serveur du portail garde une courte liste
d'une ligne par sous-appli.

Le `require('../../../server/modules/portal-apps')` d'une sous-application
résout au même endroit dans les deux monorepos — c'est pour cela que ce chemin
est imposé.

### 5. Découplage : tokens d'injection

Une sous-application ne lit **jamais** un fichier `environment` du portail ni
n'importe son code par chemin relatif. Elle injecte les tokens de
`@portail/core-data-access` :

| Token | Rôle |
|---|---|
| `API_DATA_URL` | base de l'API de données du portail |
| `API_EXECUTOR_URL` | exécuteur local — `''` si le portail n'en a pas |
| `API_AGENT_URL` | service d'agent IA — `''` si le portail n'en a pas |
| `API_TRACE_HEADERS` | en-têtes de traçabilité exigés par le portail — `{}` si aucun |
| `APP_BRANDING` | nom et mentions du portail hôte |

Un portail qui n'expose pas un service fournit une valeur vide **plutôt que
d'omettre le token** : le contrat reste injectable des deux côtés.

Le `environment.ts` d'une sous-appli ne contient donc que ses chemins de
service.

### 6. Découplage : session

Les deux portails s'authentifient contre des backends différents et leurs
`AuthService` respectifs n'ont presque rien en commun. Une sous-application
injecte donc **`PORTAL_SESSION`** (`@portail/core-auth`), jamais `AuthService` :

```ts
readonly user: Signal<PortalSessionUser | null>;
isAuthenticated(): boolean;
getAuthHeaders(): Record<string, string>;
logout(): void;
```

Chaque portail fournit ce token en adaptant son propre service.

### 7. Design

Le contrat visuel est un **vocabulaire de variables CSS**, défini au même chemin
dans les deux monorepos : `libs/shared/ui/src/portal-tokens.scss`. Mêmes noms
des deux côtés, valeurs propres à chaque portail.

```
--brand-primary --brand-secondary --brand-green
--surface --surface-alt --page-bg
--heading-color --text-primary --text-secondary --border-color --shadow-card
--category-{blue,green,purple,amber,slate,red}-{bg,text,border}
```

Règles pour une sous-application :

- **uniquement** du SCSS scopé à ses propres composants ;
- pour les couleurs, **uniquement** les variables ci-dessus ;
- **ni Bootstrap ni Tailwind** : l'un et l'autre sont un détail interne du
  portail hôte (ce portail-ci est en Bootstrap, l'autre en Tailwind).

Le thème sombre est sélectionné par `:root[data-theme="dark"]`. Les deux
portails posent **aussi** la classe `.dark` sur `<html>` : une sous-application
peut donc s'adosser indifféremment à l'un ou à l'autre.

## Vérifier le contrat

Certains fichiers doivent rester **identiques bit-à-bit** dans les deux
monorepos. Rien ne l'impose mécaniquement — d'où le garde-fou :

```bash
node tools/verifier-contrat.mjs
```

À lancer avant de committer un changement qui touche le socle. Il liste les
fichiers concernés et sort en erreur au moindre écart.

## Déplacer une sous-application d'un portail à l'autre

1. Copier le dossier `apps/appli-<nom>/` (sans `project.json`, sauf si l'on veut
   aussi le Mode autonome dans le portail de destination).
2. Ajouter la route (`loadChildren`) dans les routes du portail.
3. Ajouter `...provide<Nom>AdminTab()` dans les `providers` de son `app.config.ts`.
4. Ajouter le chemin du module serveur à la liste des sous-applications du
   serveur.
5. Builder.

Rien d'autre. Vérifié dans les deux sens avec `appli-agenda` : les deux portails
compilent avec la version de l'autre.
