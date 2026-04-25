# Worganic Platform — Guide d'utilisation

## Architecture générale

```
┌─────────────────────────────────────────────────────┐
│                    Cloud / Serveur                  │
│                                                     │
│   Angular (ng serve / build)  ←→  server-data.js    │
│          port 4200                    port 3001     │
│                                   (BDD, fichiers,   │
│                                    config, logs)    │
└─────────────────────────────────────────────────────┘
                         ↑
                         │ HTTP (requêtes données)
                         │
┌─────────────────────────────────────────────────────┐
│                 PC de l'utilisateur                 │
│                                                     │
│   Electron (fenêtre navigateur Angular)             │
│       └── fork → server-executor.js  port 3002      │
│                  (Claude CLI, Gemini CLI,           │
│                   exécution IA en streaming SSE)    │
└─────────────────────────────────────────────────────┘
```

**Deux serveurs distincts :**
| Serveur | Fichier | Port | Rôle | Hébergement |
|---------|---------|------|------|-------------|
| Data server | `server/server-data.js` | 3001 | BDD, fichiers, config, logs | Cloud |
| Executor | `electron/executor/server-executor.js` | 3002 | Exécution IA (CLI/API) | Local (Electron) |

---

## Prérequis

- **Node.js** ≥ 18
- **Angular CLI** : `npm install -g @angular/cli`
- **Claude CLI** installé et authentifié sur le PC (si utilisation de Claude CLI)
- **Gemini CLI** installé et authentifié sur le PC (si utilisation de Gemini CLI)
- **Electron** (installé via `npm install` dans `electron/`)

---

## Démarrage en développement

### 1. Serveur de données cloud (`server-data.js`)

```bash
cd server
npm install          # première fois uniquement
npm run dev-data     # démarre server-data.js avec hot-reload
# ou
npm run start-data   # démarre en mode production
```

Le serveur écoute sur **http://localhost:3001** (dev) ou sur votre domaine cloud en production.

### 2. Application Angular

```bash
cd angular
npm install          # première fois uniquement
ng serve             # démarre Angular sur http://localhost:4200
```

Angular communique automatiquement avec :
- `http://localhost:3001` → données (projets, config, fichiers)
- `http://localhost:3002` → exécution IA (via Electron)

### 3. Application Electron (executor IA local)

```bash
cd electron
npm install          # première fois uniquement (installe electron)
npm run dev          # démarre Electron (Windows : npm run dev-win)
```

Electron va :
1. Démarrer `server-executor.js` sur le port 3002
2. Ouvrir une fenêtre navigateur sur `http://localhost:4200`

> **Note Windows :** Utiliser `npm run dev-win` au lieu de `npm run dev`

---

## Démarrage en production

### Serveur cloud

```bash
cd server
npm run start-data   # node server-data.js sur le port 3001
```

Configurer un proxy/reverse proxy (nginx, etc.) pour exposer le port 3001 via HTTPS.

### Angular (build production)

```bash
cd angular && ng build --configuration production
# Les fichiers sont dans dist/worganic-angular/ (à la racine du projet)
# À déployer sur votre serveur web / CDN
```

### Electron (distribution)

```bash
cd electron
# Définir l'URL Angular externe avant de lancer / package.json
ANGULAR_URL=https://votre-domaine.com electron .
# ou via electron-builder pour packager l'application
```

---

## Variables d'environnement Angular

Fichier `angular/src/environments/environment.ts` (développement) :
```typescript
export const environment = {
  production: false,
  apiDataUrl: 'http://localhost:3001',     // → server-data.js
  apiExecutorUrl: 'http://localhost:3002'  // → server-executor.js (Electron)
};
```

Fichier `angular/src/environments/environment.prod.ts` (production) :
```typescript
export const environment = {
  production: true,
  apiDataUrl: 'https://api.votre-domaine.com',  // serveur cloud
  apiExecutorUrl: 'http://localhost:3002'        // toujours local
};
```

---

## Routes API

### server-data.js (port 3001) — Données

| Méthode | Route               | Description                     |
|---------|---------------------|---------------------------------|
| GET     | `/api/config`       | Configuration globale           |
| GET     | `/api/config/keys`  | Clés API et providers actifs    |
| POST    | `/api/config/keys`  | Sauvegarder clés API            |
| GET     | `/api/projects`     | Liste des projets               |
| POST    | `/api/projects`     | Créer un projet                 |
| GET     | `/api/projects/:id` | Détail d'un projet              |
| PUT     | `/api/projects/:id` | Mettre à jour un projet         |
| DELETE  | `/api/projects/:id` | Supprimer un projet             |
| GET     | `/api/files/read`   | Lire un fichier (query: `path`) |
| POST    | `/api/files/write`  | Écrire un fichier               |
| GET     | `/api/admin/*`      | Routes d'administration         |

### server-executor.js (port 3002) — Exécution IA

| Méthode | Route                  | Description                                       |
|---------|------------------------|---------------------------------------------------|
| GET     | `/api/cli-status`      | État des CLI (Claude, Gemini) + modèles           |
| GET     | `/api/cli-check-only`  | Vérification rapide de disponibilité              |
| POST    | `/change-model`        | Changer le modèle actif                           |
| GET     | `/get-model`           | Modèle actuellement actif                         |
| POST    | `/sync-model`          | Synchroniser modèle global → local                |
| POST    | `/execute-prompt`      | Exécuter un prompt IA (SSE streaming)             |
| POST    | `/execute-file-prompt` | Exécuter un prompt sur un fichier (SSE streaming) |
| POST    | `/execute-workflow-ai` | Exécuter un workflow IA (SSE streaming)           |
| POST    | `/stop-execution`      | Arrêter une exécution en cours                    |

---

## Flux de données — Exécution IA

```
Angular Component
    │
    ├─► GET /api/files/read  (server-data :3001)   → contenu du fichier
    ├─► GET /api/config/keys (server-data :3001)   → provider/modèle actif
    │
    └─► POST /execute-file-prompt (executor :3002)
            { fileName, promptContent, fileContent, provider, model }
            ↓
        SSE streaming chunks → Angular reçoit en temps réel
            ↓
        Angular POST /api/files/write (server-data :3001)  → sauvegarde résultat
```

**Important :** L'executor ne lit ni n'écrit jamais sur le disque cloud. Il reçoit le contenu dans le corps de la requête et renvoie uniquement le flux SSE.

---

## Dépannage

### "Le serveur d'exécution IA n'est pas accessible"
→ L'application Electron n'est pas lancée. Lancer `npm run dev` dans `electron/`.

### Angular ne charge pas dans Electron
→ Vérifier que `ng serve` tourne sur le port 4200 avant de lancer Electron.

### "Cannot load config keys from data server"
→ `server-data.js` n'est pas démarré. Lancer `npm run dev-data` dans `server/`.

### Les modèles Claude/Gemini n'apparaissent pas
→ Vérifier que Claude CLI / Gemini CLI sont installés et authentifiés :
```bash
claude --version
gemini --version
```

### Erreur CORS
→ Vérifier que l'origine Angular est bien autorisée dans les deux serveurs.
   En dev : `http://localhost:4200` est déjà autorisée.
   En prod : ajouter l'URL Angular dans la config CORS de `server-data.js`.

---

## Structure des fichiers

```
projet/
├── angular/                       # Application Angular
│   ├── src/
│   │   ├── environments/
│   │   │   ├── environment.ts         # URLs dev (localhost:3001/3002)
│   │   │   └── environment.prod.ts    # URLs prod (cloud + localhost:3002)
│   │   └── app/
│   │       └── services/
│   │           ├── api.service.ts     # Routes → server-data.js
│   │           ├── ai.service.ts      # Routes → server-executor.js
│   │           └── config.service.ts  # Mixte (data + executor)
│   ├── public/
│   ├── angular.json
│   ├── tsconfig.json
│   └── package.json
│
├── dist/                          # Build Angular (ng build → ici)
│
├── electron/
│   ├── main.js                    # Point d'entrée Electron
│   ├── package.json               # Dépendances Electron
│   └── executor/
│       └── server-executor.js     # Serveur local executor IA (port 3002)
│
├── server/
│   ├── server-data.js             # Serveur cloud données (port 3001)
│   ├── server.js                  # (ancien - serveur monolithique)
│   └── package.json
│
├── USAGE.md                       # Ce fichier
└── new.md                         # Spécifications d'architecture
```
