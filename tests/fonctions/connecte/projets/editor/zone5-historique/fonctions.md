# Éditeur › Zone 5 — Historique — Fonctions métier

Composant : `ProjetHistoryComponent`  
Position : panneau inférieur, onglet "Historique"  
Données : via `ProjetCollabService`, temps réel WebSocket

---

## `2-5-2-8-1` — Chargement

- **Connexion WebSocket** : lors de l'ouverture de l'éditeur → `collab.connect(projectId)`
- **Historique initial** : chargé depuis le signal `collab.history()`
- **Mises à jour temps réel** : nouvelles entrées poussées via WebSocket

---

## `2-5-2-8-2` — Affichage

- **Groupage par jour** : entrées groupées par date (`HistoryGroup[]`)
- **Expand/collapse par jour** :
  - Aujourd'hui : ouvert par défaut
  - Jours précédents : repliés par défaut (sauf si `expandedDays` override)
  - `toggleDay(date)` → bascule
- **Format heure** : `formatTime(timestamp)` → "HH:MM"
- **Icône par type d'action** : `getActionIcon(entry)` → Material icon
- **Couleur badge** : `getIconBgColor(entry)` → vert (create), bleu (update), rouge (delete), violet (undo/redo)
- **Compteur** : nombre total d'entrées affiché dans le badge de l'onglet

---

## `2-5-2-8-3` — Filtrage par entité active

- **Filtre automatique** : si `activeIds` est défini → `filteredEntries = computed` ne retient que les entrées pour ces IDs
- **Activation** : sélection d'un nœud dans la sidebar → `activeIds` mis à jour
- **Vue complète** : aucun filtre → tout l'historique du projet affiché

---

## `2-5-2-8-4` — Entrées en état "pending" (édition en cours)

- **Source** : `collab.pending()` → `PendingEditInfo[]`
- **Affichage** : entrées grisées avec label "en cours d'édition" ou "sauvegarde…"
- **State** : `editing` (frappe en cours) | `saving` (envoi serveur)
- **Username** : affiché pour identifier qui est en train d'éditer

---

## `2-5-2-8-5` — Clic sur une entrée (voir le diff)

- **Déclenchement** : `onEntryClick(entry)` → emit `entryClick`
- **Parent** : `ProjetEditorComponent` → `diffEntry.set(entry)`
- **Vue diff** : `ProjetDiffComponent` s'affiche → remplace temporairement la zone d'édition
- **Lazy load** : si `beforeState`/`afterState` non chargés → `collab.fetchEntry(id)` → GET pour charger le diff complet
- **Fermeture diff** : bouton "Fermer" → `closeDiff()` → `diffEntry.set(null)` → retour à l'éditeur

---

## `2-5-2-8-9` — [modification] Annulation d'une modification (undo simple)

- **Déclenchement** : bouton `undo` (icône `undo`) visible au hover sur les entrées `undoable && !undone`
- **Action** : `undoEntry(entry)` → `woHistory.undo(id)` → POST `/api/wo-action-history/:id/undo`
- **Détection de conflit** : le serveur lit la dernière version BDD (`projet_content_version`) du fichier avant l'undo et transmet son `versionId` en `x-base-version-id` au self-call `PUT` qui rejoue l'ancien contenu — si quelqu'un d'autre a checkpointé entre-temps, l'undo échoue proprement (409, message clair) au lieu d'écraser silencieusement une sauvegarde plus récente
- **Réponse serveur** : `{ restored: { nodeId, content } }` → émis via `(restored)` au parent → patch `files` + incrément `restoreToken` → reconstruction de la zone éditeur (mode focus préservé)
- **Grisage** : événement SSE `entries_undone` (vérité serveur) → la collab marque l'entrée `undone` → grisée + boutons retirés. Survit aux rechargements (`undoable`/`undone` renvoyés par la route de chargement)
- **Nouvelle entrée** : le serveur crée et diffuse (SSE `history`) une entrée "Annulation : ..." elle-même `undoable` (réapplique l'`afterState`) → permet d'annuler l'annulation
- **Résultat** : le contenu du fichier est restauré à `beforeState`; l'éditeur se met à jour automatiquement

---

## `2-5-2-8-10` — Retour à une ancienne version (undo cascade)

- **Déclenchement** : bouton `history` (icône `history`) visible au hover → confirmation inline affichée
- **Confirmation** : message + boutons "Annuler" / "Confirmer le retour"
- **Action** : `confirmCascade(entry)` → `woHistory.undoCascade(id)` → POST `/api/wo-action-history/:id/undo-cascade`
- **Périmètre** : uniquement le même fichier/entité (`entity_id`), toutes les modifications plus récentes non encore annulées
- **Feedback** : spinner, toutes les entrées concernées marquées "annulé" localement
- **Résultat** : le fichier revient à l'état juste avant la modification cible; une entrée récapitulative est créée dans l'historique

---

## `2-5-2-8-11` — Badge IA (actionType ai-update)

- **Source** : modifications IA acceptées via `onAcceptAiEdit()` dans `ProjetEditorComponent`
- **Icône** : `auto_awesome` (violet)
- **Couleur** : fond `bg-violet-500/20`, texte `text-violet-400`
- **Undoable** : oui — le `beforeState` est le contenu original avant la modification IA
- **Annulable** : via undo simple ou cascade comme toute autre modification

---

## `2-5-2-8-12` — Vue diff 3 panneaux avec sélection de lignes

- **Déclenchement** : clic sur une entrée `update` ou `ai-update` dans l'historique → `ProjetDiffComponent` s'affiche en remplacement de la zone éditeur
- **Panneau Actuel (gauche)** : contenu en cours du fichier (`diffCurrentContent` computed depuis `files`), lignes modifiées surlignées en bleu
- **Panneau Avant (milieu)** : `beforeState.content` de l'entrée d'historique, diff LCS vs afterState, bouton `←` au hover sur chaque ligne
- **Panneau Après (droite)** : `afterState.content`, bouton `→` au hover sur chaque ligne
- **Cherry-pick** : clic `←` ou `→` copie la ligne dans la copie de travail (`workingLines[]`), badge bleu sur la ligne modifiée
- **Réinitialiser** : restaure `workingLines` depuis `currentContent`
- **Appliquer dans l'éditeur** : `emit(workingLines.join('\n'))` → parent patch `files` + `restoreToken` + `updateFile` serveur + entrée "Fusion manuelle" dans l'historique (`undoable: true`)

---

## `2-5-2-8-13` — [modification] Versions de cette section (checkpoints BDD immuables)

- **Composant** : `ProjetHistoryComponent`, groupe collapsible "Versions de cette section" en haut du panneau (au-dessus de la timeline d'actions), alimenté par `activeFileId` (fichier `contenu.md` de la section active, résolu par `ProjetEditorComponent.activeContentFileId`)
- **Différence avec la timeline d'actions** : ce groupe liste les vraies versions de contenu (`projet_content_version`, jamais effacées) plutôt que le log d'audit `wo_action_history` — chaque checkpoint/publication/restauration/fusion de conflit y apparaît
- **Chargement** : `GET /api/file-projects/:name/files/:id/versions` (métadonnées seulement — auteur, date, origine), rechargé à chaque changement de section active
- **Origines affichées** : Sauvegarde (`checkpoint`), Publication (`publish`), Restauration (`restore`), Fusion de conflit (`merge`), Tentative en conflit (`conflict-mine`), Version initiale (`migration-bootstrap`), Synchronisation Git (`pull`)
- **Clic sur une version** : `GET .../versions/:versionId` (contenu complet) + contenu de la version de base (`base_version_id`) si disponible → ouvre `ProjetDiffComponent` (réutilise `entryClick`, même mécanisme que la timeline d'actions)
- **Restaurer** : bouton visible au hover → `POST .../restore {versionId}` → insère une **nouvelle** version BDD avec l'ancien contenu (jamais de suppression/réécriture d'historique) → émet `(restored)` au parent comme un undo classique
- **Composants:** `projet-history.component.ts`, `projet-history.component.html`, `projet-editor.component.ts`, `project-files.service.ts`, `server/server-data.js`

---

## `2-5-2-8-6` — Suppression de l'historique

- **Ouverture** : `openClear()` → modal de confirmation avec `clearOpen.set(true)`
- **Scope** :
  - `mine` : supprimer uniquement mes propres entrées
  - `all` : supprimer tout l'historique (admin seulement)
- **Compteur** : `clearTargetCount` → nombre d'entrées qui seront supprimées
- **Confirmation** : `confirmClear()` → POST `/api/collab/clear-history { projectId, scope, entityIds? }`
- **Après suppression** : liste rechargée, modal fermée

---

## `2-5-2-8-7` — Affichage du diff

- **Composant** : `ProjetDiffComponent`
- **Données** : `entry.beforeState` et `entry.afterState`
- **Vue** : côte à côte avant/après, lignes ajoutées/supprimées surlignées
- **Fermeture** : bouton × ou clic "Retour"

---

## `2-5-2-8-8` — États

| État | Description |
|------|-------------|
| Chargement | Spinner |
| Historique vide | Message "Aucune modification" |
| Filtre actif | Seules les entrées de la section active |
| Entrée pending | Grisé, label "en cours" |
| Groupe du jour ouvert | Entrées visibles |
| Groupe précédent replié | Seul l'en-tête de date visible |
| Modal suppression ouverte | Confirmation + compteur |
| Scope "mine" sélectionné | Supprimer mes entrées |
| Scope "all" (admin) | Supprimer tout |
| Vue diff active | `ProjetDiffComponent` visible |
