# Index des fonctions métier — Worganic Platform

Arborescence de documentation pour la validation et les tests de recette.  
Chaque dossier contient un `fonctions.md` listant toutes les fonctions testables.

---

## Structure

```
tests/
├── non-connecte/
│   └── landing/                  → Page d'accueil + formulaire de connexion
│
└── connecte/
    ├── admin/
    │   ├── utilisateurs/         → CRUD utilisateurs (admin)
    │   ├── deploiements/         → Historique versions, Git, filtres, migration
    │   ├── config/               → (voir connecte/config)
    │   └── theme/                → Thème, branding, couleurs
    │
    ├── config/                   → Clés API, providers IA, modèles, outils
    ├── deploiements/             → Vue déploiements (utilisateur)
    │
    ├── projets/
    │   ├── accueil/              → Liste projets, CRUD, copie, recherche F4
    │   └── editor/
    │       ├── toolbar/          → Modes, formatage, barres Annuler/Partager, badges
    │       ├── sidebar/          → Arborescence, CRUD nœuds, drag-drop, locks
    │       ├── zone-code/        → Édition Markdown, focus, images, slash commands
    │       ├── zone-structure/   → Édition structure inline, blocs, pending
    │       ├── zone-preview/     → Rendu HTML éditable, commentaires, images
    │       ├── zone5-conversation/ → Chat IA, diff suggestions, modèles
    │       ├── zone5-historique/ → Historique collaboratif, diffs, suppression
    │       └── commentaires-f6/  → Drawer commentaires par section
    │
    └── outils/
        ├── tchat-ia/             → Chat IA standalone
        ├── cahier-recette/       → Campagnes de tests avec IA
        ├── tickets/              → Signalement bugs + capture écran
        └── actions-ia/           → Orchestrateur prompts IA batch
```

---

## Légende des types de fonctions

| Symbole | Signification |
|---------|---------------|
| 🔵 | Lecture / Affichage |
| 🟢 | Création |
| 🟡 | Modification |
| 🔴 | Suppression |
| ⚡ | Action immédiate |
| 🔒 | Requiert authentification |
| 👑 | Requiert rôle admin |
| 🌐 | Requiert backup externe (FTP/GitHub/GitLab) |
| 🤖 | Requiert clé API IA |

---

## Règles métier globales

- **Authentification** : toutes les routes `connecte/` requièrent un token JWT valide
- **Projets locaux** : pas de barre Annuler/Partager — auto-sauvegarde uniquement
- **Projets avec backup** : barre Annuler/Partager disponible dans tous les modes d'édition
- **Collaboration** : verrous en temps réel via WebSocket — une section ne peut être éditée que par un seul utilisateur à la fois
- **FTP sync** : la synchronisation FTP est non-bloquante (lecture) — l'édition reste possible pendant la sync
- **Actions tracées** : toutes les opérations CRUD passent par `WoActionHistoryService`
