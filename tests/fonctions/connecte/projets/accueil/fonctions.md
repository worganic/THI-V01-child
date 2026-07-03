# Projets › Accueil — Fonctions métier

Route : `/projets`  
Composant : `ProjetsComponent` + `ProjetSearchComponent`  
Accès : utilisateur connecté

---

## `2-5-1-1` — Chargement

- **Liste des projets** : GET `/api/frank/projects` au montage
- **Statut GitHub** : GET `/api/frank/projects/github-reachable` → `{ reachable: boolean }` (si au moins un projet GitHub)
- **État chargement** : spinner pendant la requête
- **Tri** : par date de mise à jour décroissante

---

## `2-5-1-2` — [modification] Affichage de la grille

- **Carte projet** : titre, date création/MàJ (`JJ/MM/AAAA HH:MM`), statut (Brouillon/Publié), badge backup
- **Badges backup** : GitHub (violet), GitLab (orange), FTP (cyan), Google Drive (vert)
- **Warning GitHub offline** : badge rouge si `backupType=github` et GitHub injoignable
- **Badge partagé** : badge indigo "Partagé" si le projet est partagé avec l'utilisateur connecté (`_sharedWithMe`)
- **Menu actions** : clic bouton actions → Modifier | Copier | Ouvrir dossier | Partager (masqué si projet partagé, pas propriétaire) | Supprimer

---

## `2-5-1-3` — Création d'un projet

- **Ouverture modal** : clic "Nouveau projet" → `openNewModal()`
- **Champs** : titre (requis), description (optionnel)
- **Soumission** : POST `/api/frank/projects`
- **Succès** : navigation vers éditeur `/projets/{id}`, action tracée (WoActionHistory)
- **Erreur** : message dans la modal
- **Fermeture** : Escape ou clic hors modal

---

## `2-5-1-4` — Édition inline titre/description

- **Déclenchement** : clic "Modifier" → `startEdit(project)`
- **Champs éditables** : titre, description
- **Sauvegarde** : clic "Sauvegarder" ou Enter → PUT `/api/frank/projects/{id}`
- **Annulation** : Escape → `cancelEdit()`
- **Validation** : titre non vide requis
- **Succès** : liste rechargée, action tracée

---

## `2-5-1-5` — Copie d'un projet

- **Déclenchement** : clic "Copier" → `openCopyModal(project)`
- **Champ** : nouveau titre (pré-rempli avec "Copie de {titre}")
- **Soumission** : POST `/api/frank/projects/{id}/copy`
- **Succès** : navigation vers le nouveau projet, action tracée
- **Erreur** : message dans la modal

---

## `2-5-1-6` — Ouverture du dossier projet

- **Déclenchement** : clic icône dossier
- **Action** : ouvre le dossier `data/projets/{id}/` dans l'explorateur de fichiers via Electron IPC

---

## `2-5-1-7` — Suppression d'un projet

- **Déclenchement** : clic "Supprimer" → `confirmDelete(id)` → confirmation modale
- **Confirmation** : bouton rouge "Supprimer définitivement"
- **Suppression** : DELETE `/api/frank/projects/{id}`
- **Succès** : liste rechargée, action tracée
- **Règle** : action irréversible (pas d'undo)

---

## `2-5-1-8` — Recherche fulltext (F4)

- **Raccourci** : F4 → `ProjetSearchComponent` s'ouvre
- **Recherche** : fulltext dans le contenu de tous les projets via `SearchService`
- **Résultats** : liste de sections avec extrait du contenu correspondant
- **Navigation** : clic résultat → `/projets/{id}?section={sectionId}`
- **Fermeture** : Escape

---

## `2-5-1-9` — Navigation vers l'éditeur

- **Clic sur une carte** : navigate `/projets/{id}`
- **Clic sur le titre** : idem
- **Double-clic sur titre en mode édition** : mode édition inline

---

## `2-5-1-11` — [modification] Partage d'un projet avec un autre utilisateur

- **Déclenchement** : clic icône "share" dans la barre d'actions (visible uniquement pour le propriétaire du projet)
- **Popup** : champ email + bouton ajouter, liste des utilisateurs avec qui le projet est partagé
- **Ajout** : POST `/api/frank/projects/{id}/shares` avec `{ email }` → recherche l'utilisateur par email (erreur si introuvable ou si c'est le propriétaire)
- **Retrait** : clic croix sur une ligne → DELETE `/api/frank/projects/{id}/shares/{userId}`
- **Effet** : l'utilisateur partagé voit le projet dans sa propre liste "Mes Projets" (badge "Partagé") et peut l'ouvrir/l'éditer, mais ne peut pas le partager ni le supprimer
- **Fermeture** : croix en haut à droite de la popup

---

## `2-5-1-10` — États

| État | Description |
|------|-------------|
| Chargement | Spinner centré |
| Liste vide | Message "Aucun projet" + bouton créer |
| GitHub offline | Badge warning sur projets GitHub |
| Modal création ouverte | Formulaire visible |
| Mode édition inline | Champs texte visibles sur la carte |
| Modal copie ouverte | Champ nouveau titre |
| Modal suppression | Double confirmation |
| Sauvegarde en cours | Bouton désactivé |
