# Architecture Cible : Séparation Cloud/Local (v2)

Ce document décrit l'architecture cible pour le projet **Worganic Platform** basée sur une
analyse du code existant (`server/server.js` — 3494 lignes, Angular 18, services Angular actuels).

## Contraintes à respecter

1. **Données centralisées :** Tous les fichiers et la base de données (dossier `/data`) restent
   exclusivement sur le serveur cloud. L'utilisateur ne stocke rien localement.
2. **Mises à jour instantanées :** Angular et l'API Data se déploient sur le cloud ; le client
   reçoit automatiquement la nouvelle version.
3. **Exécution IA locale :** Claude CLI et Gemini CLI s'exécutent sur l'ordinateur de
   l'utilisateur avec ses propres credentials et sa propre facturation.
4. **Electron = coquille exécutante :** Electron ne contient pas Angular. Il lance un serveur
   Node.js local léger dédié à l'exécution IA et communique avec Angular via HTTP.
5. **Angular autonome :** Angular tourne séparément d'Electron (aujourd'hui `ng serve` en
   local, plus tard hébergé sur un serveur externe). Il sait parler à deux serveurs différents.

---

## 1. Vue d'ensemble des 3 composants

```
┌─────────────────────────────────────────────────────────────────┐
│  CLOUD (serveur distant)                                        │
│                                                                 │
│  ┌──────────────────┐      ┌───────────────────────────────┐   │
│  │  Angular App     │◄────►│  server-data.js (port 3001)   │   │
│  │  (ng serve /     │      │  - Gestion BDD / fichiers      │   │
│  │   dist statique) │      │  - Projets, Config, Logs       │   │
│  └──────────────────┘      │  - Données dans /data/         │   │
│                            └───────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (requêtes d'exécution IA)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL (PC utilisateur — Application Electron)                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Electron (BrowserWindow → charge l'URL Angular)         │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  server-executor.js (port 3002, interne Electron)  │  │   │
│  │  │  - Reçoit les requêtes d'exécution IA              │  │   │
│  │  │  - Spawn claude / gemini CLI                        │  │   │
│  │  │  - SSE streaming vers Angular                       │  │   │
│  │  │  - Vérifie l'état des CLI (cli-status)              │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Claude CLI / Gemini CLI (installés sur le PC)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Découpage de `server/server.js` (fichier actuel : 3494 lignes)

Le fichier actuel `server/server.js` doit être divisé en **deux fichiers distincts**.

---

### A. `server-data.js` — Serveur Cloud (port 3001)

Responsable de toutes les données. Hébergé sur le cloud. Le dossier `/data` ne quitte jamais ce serveur.

| Route actuelle                              | Méthode | Description                              |
| :------------------------------------------ | :------ | :--------------------------------------- |
| `/api/config`                               | GET     | Lit index.json (config globale)          |
| `/api/config/keys`                          | GET/POST| Clés API et cliConfig                    |
| `/api/admin/update-models-costs`            | POST    | Met à jour les prix des modèles          |
| `/api/projects`                             | GET     | Liste tous les projets                   |
| `/api/projects/:id`                         | GET     | Détail d'un projet + pipeline            |
| `/api/projects`                             | POST    | Crée un projet                           |
| `/api/projects/:id`                         | PUT     | Modifie les métadonnées d'un projet      |
| `/api/projects/:id`                         | DELETE  | Supprime un projet                       |
| `/api/projects/:id/add-workflow`            | POST    | Ajoute un workflow à un projet           |
| `/api/projects/:id/workflows/:workflowId`   | DELETE  | Supprime un workflow d'un projet         |
| `/api/projects/:id/file-exists`             | GET     | Vérifie l'existence d'un fichier         |
| `/api/projects/:id/reset-step`              | POST    | Réinitialise une étape du pipeline       |
| `/api/projects/:id/admin-reset-step`        | POST    | Réinitialise une étape et les suivantes  |
| `/api/projects/:id/update`                  | POST    | Met à jour le pipeline/progression       |
| `/api/projects/:id/validate-step`           | POST    | Valide ou invalide une étape             |
| `/save-documents`                           | POST    | Sauvegarde documents dans index.json     |
| `/save-etapes`                              | POST    | Sauvegarde les étapes dans index.json    |
| `/save-workflows`                           | POST    | Sauvegarde les types de projets          |
| `/save-workflow-categories`                 | POST    | Sauvegarde les catégories de workflows   |
| `/save-roles`                               | POST    | Sauvegarde les rôles                     |
| `/save-role-categories`                     | POST    | Sauvegarde les catégories de rôles       |
| `/save-users`                               | POST    | Sauvegarde les utilisateurs              |
| `/read-file`                                | GET     | Lit un fichier du dossier /data          |
| `/write-file`                               | POST    | Écrit dans un fichier                    |
| `/rename-file`                              | POST    | Renomme un fichier                       |
| `/archive-file`                             | POST    | Archive un fichier                       |
| `/save-file`                                | POST    | Sauvegarde un fichier                    |
| `/save-prompt`                              | POST    | Sauvegarde un prompt                     |
| `/save-file-prompt`                         | POST    | Sauvegarde un prompt de fichier          |
| `/get-prompt`                               | GET     | Récupère le contenu d'un prompt          |
| `/save-design-choice`                       | POST    | Sauvegarde un choix de design            |
| `/save-test-status`                         | POST    | Sauvegarde le statut de test             |
| `/save-execution-result`                    | POST    | Sauvegarde le résultat d'exécution       |
| `/update-project-type`                      | POST    | Modifie le type de projet                |
| `/validate-step`                            | POST    | Valide une étape (legacy)                |
| `/api/ai-logs`                              | GET     | Récupère les logs IA                     |
| `/api/ai-logs`                              | POST    | Enregistre un log IA                     |
| `/api/ai-logs`                              | DELETE  | Supprime tous les logs IA                |
| `/index.json`                               | GET     | Retourne index.json avec statuts         |
| `/data/*`                                   | static  | Fichiers statiques du dossier /data      |

**CORS :** Autoriser l'URL Angular (actuellement `http://localhost:4200`, plus tard l'URL de prod).

---

### B. `server-executor.js` — Serveur Local Electron (port 3002)

Responsable uniquement de l'exécution des IA. Tourne dans le processus Electron sur le PC utilisateur.
Il ne stocke aucune donnée, ne lit aucun fichier projet. Il reçoit le prompt depuis Angular et lance la CLI.

| Route actuelle                | Méthode | Description                                      |
| :---------------------------- | :------ | :----------------------------------------------- |
| `/execute-prompt`             | POST    | Lance Claude ou Gemini CLI, stream SSE           |
| `/execute-file-prompt`        | POST    | Lance CLI pour un fichier spécifique, stream SSE |
| `/execute-workflow-ai`        | POST    | Lance CLI pour générer un workflow, stream SSE   |
| `/stop-execution`             | POST    | Tue le processus CLI en cours                    |
| `/api/cli-status`             | GET     | Statut complet des CLI (cache)                   |
| `/api/cli-check-only`         | GET     | Statut CLI instantané (cache uniquement)         |
| `/sync-model`                 | GET     | Sync paramètres modèle depuis fichiers Claude    |
| `/sync-model-force`           | POST    | Force la synchronisation du modèle               |
| `/change-model`               | POST    | Change le fournisseur/modèle IA actif            |
| `/get-model`                  | GET     | Retourne le modèle actif                         |

**CORS :** Autoriser uniquement l'URL Angular locale/cloud (à configurer).
**Note :** Ce serveur n'a pas accès au dossier `/data`. Il reçoit le contenu des prompts directement
dans le corps de la requête HTTP envoyée par Angular.

---

## 3. Architecture Angular — Adaptation des services

Angular doit connaître **deux URLs de base** configurées dans un fichier d'environnement.

### `environments/environment.ts` (à créer ou modifier)

```typescript
export const environment = {
  production: false,
  // Pointe vers server-data.js — aujourd'hui local, plus tard cloud
  apiDataUrl: 'http://localhost:3001',
  // Pointe vers server-executor.js dans Electron — toujours local
  apiExecutorUrl: 'http://localhost:3002'
};
```

### `environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiDataUrl: 'https://api.worganic.com',      // URL du serveur cloud
  apiExecutorUrl: 'http://localhost:3002'       // Toujours local
};
```

---

### Services Angular à modifier

#### `api.service.ts` — Inchangé dans sa logique, changer la base URL

```typescript
// Avant (tout sur :3001)
private apiUrl = 'http://localhost:3001';

// Après
import { environment } from '../environments/environment';
private apiUrl = environment.apiDataUrl;   // server-data.js cloud
```

Toutes les routes existantes (`/api/projects`, `/api/config`, `/read-file`, etc.) pointent
désormais vers `server-data.js`.

---

#### `ai.service.ts` — Changer la base URL vers le serveur executor

```typescript
// Avant
private executorUrl = 'http://localhost:3001';

// Après
import { environment } from '../environments/environment';
private executorUrl = environment.apiExecutorUrl;  // server-executor.js local Electron
```

Les méthodes `executePrompt()`, `executeFilePrompt()`, `executeWorkflowAi()`, `stopExecution()`
pointent désormais vers `server-executor.js` (port 3002).

**Gestion du mode hors-Electron :** Si `server-executor.js` n'est pas accessible (Angular ouvert
dans un navigateur classique sans Electron), afficher un message explicite :

```typescript
// Dans executePrompt() au moment de créer l'EventSource
// Ajouter un handler d'erreur de connexion
source.onerror = (err) => {
  if (!this.hasReceivedData) {
    // Le serveur executor n'est pas joignable
    observer.error('Veuillez lancer l\'application Bureau (Electron) pour exécuter les commandes IA.');
  }
};
```

---

#### `config.service.ts` — Séparer les appels selon la destination

```typescript
// loadCliConfig() et refreshModels() → apiExecutorUrl (server-executor)
// loadConfig(), getProjectTypes(), getEtapes(), getDocuments() → apiDataUrl (server-data)
```

---

## 4. Structure Electron (nouveau dossier `/electron`)

Electron est une **coquille vide** qui :
1. Charge l'URL Angular dans une `BrowserWindow`.
2. Lance `server-executor.js` en tant que processus enfant Node.js.
3. N'a pas de `preload.js` complexe — la communication Angular ↔ Executor se fait en HTTP simple.

### Arborescence à créer

```
/electron/
├── main.js           ← Point d'entrée Electron
├── executor/
│   └── server-executor.js   ← Copie/déplacement depuis server.js (routes IA)
└── package.json      ← Dépendances Electron séparées
```

### `electron/main.js`

```javascript
const { app, BrowserWindow } = require('electron');
const { fork } = require('child_process');
const path = require('path');

let executorProcess = null;

function startExecutorServer() {
  executorProcess = fork(path.join(__dirname, 'executor', 'server-executor.js'));
  executorProcess.on('error', (err) => console.error('Executor server error:', err));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      // Pas de preload nécessaire — communication via HTTP uniquement
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Charge Angular (local dev ou URL cloud en prod)
  const angularUrl = process.env.ANGULAR_URL || 'http://localhost:4200';
  win.loadURL(angularUrl);
}

app.whenReady().then(() => {
  startExecutorServer();
  // Laisser le temps au serveur executor de démarrer
  setTimeout(createWindow, 500);
});

app.on('before-quit', () => {
  if (executorProcess) executorProcess.kill();
});
```

### `electron/package.json`

```json
{
  "name": "worganic-electron",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "ANGULAR_URL=http://localhost:4200 electron .",
    "start:prod": "ANGULAR_URL=https://app.worganic.com electron .",
    "build": "electron-builder"
  },
  "dependencies": {
    "express": "^4.21.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "electron": "^latest",
    "electron-builder": "^latest"
  }
}
```

---

## 5. Flux de données détaillés

### Scénario A : CRUD Projets (Angular ↔ Cloud)

```
Utilisateur clique "Créer projet"
  → Angular (ProjectService.createProject())
  → POST http://localhost:3001/api/projects       ← server-data.js
  → server-data.js écrit dans /data/projets/
  → Retourne le projet créé
  → Angular met à jour la vue
```

### Scénario B : Exécution IA (Angular ↔ Electron local)

```
Utilisateur clique "Lancer IA"
  → Angular (AiService.executePrompt())
  → POST http://localhost:3002/execute-prompt     ← server-executor.js (dans Electron)
  → server-executor.js spawn('claude', [...args])
      → Utilise le CPU/RAM de l'utilisateur
      → Utilise la session `claude login` de l'utilisateur
  → SSE stream du texte généré vers Angular
  → Angular affiche le résultat en temps réel
```

### Scénario C : Vérification CLI (Angular ↔ Electron local)

```
Angular (ConfigService.loadCliConfig())
  → GET http://localhost:3002/api/cli-status      ← server-executor.js
  → server-executor.js vérifie claude/gemini sur le PC
  → Retourne { claude: true, gemini: false, ... }
  → Angular affiche l'état des CLI dans la config
```

---

## 6. Étapes de migration (ordre recommandé)

### Étape 1 — Séparer `server/server.js` en deux fichiers

1. Copier `server/server.js` → `server/server-data.js`
2. **Dans `server-data.js` :** Supprimer les routes d'exécution IA :
   - `/execute-prompt`, `/execute-file-prompt`, `/execute-workflow-ai`, `/stop-execution`
   - `/api/cli-status`, `/api/cli-check-only`
   - `/sync-model`, `/sync-model-force`, `/change-model`, `/get-model`
   - Supprimer toute la logique `child_process.spawn`, `runningProcess`, cache CLI
3. Créer `electron/executor/server-executor.js` avec uniquement les routes supprimées
   - Ce fichier n'a PAS accès à `../data` — il reçoit tout dans le body des requêtes
   - Adapter les routes pour accepter le contenu des prompts dans le body (déjà le cas)
   - Port : `3002`
4. Vérifier que `server-data.js` tourne seul sur port `3001` et répond à toutes les routes data

### Étape 2 — Créer le dossier `/electron`

1. Créer `electron/main.js` (voir code section 4)
2. Créer `electron/package.json` (voir code section 4)
3. Déplacer `server-executor.js` dans `electron/executor/`
4. Tester : `cd electron && npm install && npm start`
   - Doit ouvrir une fenêtre qui charge `http://localhost:4200`
   - Le serveur executor doit répondre sur `http://localhost:3002`

### Étape 3 — Adapter les services Angular

1. Créer `src/environments/environment.ts` et `environment.prod.ts`
2. Modifier `api.service.ts` → utiliser `environment.apiDataUrl`
3. Modifier `ai.service.ts` → utiliser `environment.apiExecutorUrl`
4. Modifier `config.service.ts` → séparer les URLs (cli* → executor, reste → data)
5. Tester : Angular sur `:4200`, data server sur `:3001`, executor dans Electron sur `:3002`

### Étape 4 — Tester les 3 scénarios

| Test | Attendu |
| :--- | :------ |
| Ouvrir Angular sans Electron | CRUD projets fonctionne, bouton IA affiche "Lancez l'application Bureau" |
| Ouvrir Angular avec Electron | Tout fonctionne, IA exécutée localement |
| Déployer `server-data.js` sur VPS | Angular en local se connecte au cloud, données centralisées |
| Modifier `environment.prod.ts` avec URL cloud | Build Angular prod utilise automatiquement le cloud |

---

## 7. Avantages & Inconvénients de cette architecture

| Avantages | Inconvénients |
| :--- | :--- |
| **Données 100% centralisées :** Aucun fichier projet ne quitte le cloud | **Electron obligatoire pour l'IA :** Pas d'exécution IA sans l'app bureau |
| **Mises à jour instantanées :** Déployer `server-data.js` = tout le monde à jour | **Double serveur :** Complexité de maintenance de deux serveurs Node.js |
| **Sécurité tokens :** Les API keys Claude/Gemini restent sur le PC utilisateur | **CORS à gérer :** Angular cloud → Executor local (prévoir les headers) |
| **Scalable :** `server-data.js` peut passer sur n'importe quel hébergeur cloud | **Latence :** Petite latence réseau pour les données (négligeable avec SPA) |
| **Séparation claire :** Chaque serveur a une responsabilité unique | **Onboarding :** L'utilisateur doit installer Electron + Claude/Gemini CLI |

---

## 8. Fichiers concernés par la migration

| Fichier | Action | Destination |
| :--- | :--- | :--- |
| `server/server.js` | Diviser en 2 | Voir détail section 2 |
| `server/server-data.js` | Créer (dérivé de server.js) | Reste dans `/server/` |
| `electron/executor/server-executor.js` | Créer (dérivé de server.js) | Nouveau dossier `/electron/` |
| `electron/main.js` | Créer | Nouveau dossier `/electron/` |
| `electron/package.json` | Créer | Nouveau dossier `/electron/` |
| `src/environments/environment.ts` | Créer | `/src/environments/` |
| `src/environments/environment.prod.ts` | Créer | `/src/environments/` |
| `src/app/services/api.service.ts` | Modifier base URL | `/src/app/services/` |
| `src/app/services/ai.service.ts` | Modifier base URL | `/src/app/services/` |
| `src/app/services/config.service.ts` | Séparer URLs | `/src/app/services/` |
| `data/` (dossier entier) | NE PAS toucher, reste sur cloud | `/data/` |

---

## 9. Configuration CORS à prévoir

`server-data.js` doit autoriser :
- `http://localhost:4200` (Angular dev)
- `https://app.worganic.com` (Angular prod — à ajouter quand déployé)

`server-executor.js` doit autoriser :
- `http://localhost:4200` (Angular dev)
- `https://app.worganic.com` (Angular prod — CORS cross-origin depuis cloud vers localhost:3002)

> **Attention :** Un navigateur web classique bloquera les requêtes de `https://app.worganic.com`
> vers `http://localhost:3002` (mixed content + CORS). Ce cas ne concerne que la version Electron
> où le contexte de sécurité est différent. En mode navigateur pur, l'exécution IA est désactivée.

Crait moi une nouvelle page d'accueil qui serait une page d'accueil non connecté. Cette page présentera de façon très graphique et design le site et proposera un bouton connexion et un bouton création de compte. Un popup s'ouvrira pour le login et un autre pour l'inscription. Cela sera en relation direct avec la section admin/users. Ainsi tous le site sera protégé si la personne n'est pas connecté.