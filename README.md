# Worganic Base — Template de projet

Stack complète Angular 18 + Express + Electron, prête à l'emploi pour démarrer un nouveau projet.

---

## Ce que contient ce template

| Composant | Port | Description |
|-----------|------|-------------|
| Angular 18 (frontend) | 4202 | Interface utilisateur — `frankenstein/` |
| server-data.js | 3001 | API données, config, auth — `server/` |
| server-executor.js | 3002 | Exécution IA locale — `electron/executor/` |

**Fonctionnalités incluses :**
- Auth (guard, interceptor, token localStorage)
- Pages : Home, Editor, Documents, Config, Deployments
- Admin : Users, Deployments, Help, Config
- Layout complet (header / nav / footer)
- Help drawer system
- Markdown editor réutilisable
- Tools : tchat-ia, ticket-widget, cahier-recette
- Workflow Claude (CLAUDE.md, histoModif, version, deploy-log)

---

## Créer un nouveau projet depuis ce template (Git Subtree)

```bash
# 1. Initialiser le nouveau projet
mkdir mon-projet && cd mon-projet
git init

# 2. Intégrer le template comme sous-dossier "base"
git subtree add --prefix=base https://github.com/worganic/worganic-base.git main --squash

# 3. Créer le code spécifique au projet à côté de base/
mkdir src
```

Structure résultante :
```
mon-projet/
  base/        ← stack de base (synchronisable)
  src/         ← code spécifique au projet
  package.json
```

---

## Mettre à jour un projet depuis le template

```bash
# Depuis le dossier du projet enfant
git subtree pull --prefix=base https://github.com/worganic/worganic-base.git main --squash
```

En cas de conflit : résoudre manuellement, puis `git commit`.

---

## Installation du template en local

### Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | 20+ |
| Angular CLI | 18+ (`npm install -g @angular/cli`) |
| Windows Terminal | — (pour `launch-frankenstein.bat`) |

### Installer les dépendances

```bash
install.bat
```

### Configurer les clés API

Éditer `data/config/conf.json` :

```json
{
  "apiKeys": {
    "gemini": { "key": "<votre-clé>", "active": true },
    "claude": { "key": "<votre-clé>",  "active": true }
  }
}
```

### Démarrer

```bash
launch-frankenstein.bat
```

---

## Workflow Claude Code

Ce projet inclut `CLAUDE.md` avec les règles de workflow IA (histoModif, versioning, git).
