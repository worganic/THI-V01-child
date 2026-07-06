# Éditeur › Zone 5 — Historique — Fonctions métier

Composant : `ProjetHistoryComponent`  
Position : panneau inférieur, onglet "Historique"  
Données : via `ProjetCollabService`, temps réel SSE (Server-Sent Events — `EventSource`, unidirectionnel serveur→client, pas de WebSocket)

---

## `2-5-2-8-1` — Chargement

- **Connexion SSE** : lors de l'ouverture de l'éditeur → `collab.connect(projectId)`
- **Historique initial** : chargé depuis le signal `collab.history()`
- **Mises à jour temps réel** : nouvelles entrées poussées via SSE

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

## `2-5-2-8-12` — [modification] Vue diff 3 panneaux alignés (Actuel/Avant/Après)

- **Déclenchement** : clic sur une entrée `update` ou `ai-update` dans l'historique → `ProjetDiffComponent` s'affiche **en overlay** par-dessus la zone éditeur (`app-edition-outil` reste monté en arrière-plan, voir Fix ci-dessous)
- **Grille unifiée** : les 3 colonnes partagent un **seul scroll** et sont alignées ligne à ligne via `computeTriDiff()` (`utils/compute-tri-diff.ts`) — fusionne deux passes de `computeLineDiff` (avant↔après et après↔actuel) en utilisant "après" comme pivot commun. Une ligne absente d'une version s'affiche en placeholder rouge italique `— absente —`, **sans numéro de ligne**, plutôt que de décaler les lignes suivantes
- **Panneau Actuel (gauche)** : contenu actuel de l'entité (section ou fichier), capturé en **snapshot au clic** sur l'entrée (`ProjetEditorComponent.onHistoryEntryClick()` → `EditionOutilComponent.getEntityText()` → `ProjetEditorZoneComponent.getEntityText()`, résolu via `sectionRanges`/`fileRanges`/`inlineBlockRanges` sur le document unifié courant) et stocké dans le signal `diffCurrentContent`, lignes modifiées surlignées en bleu
- **Panneau Avant (milieu)** : `beforeState.content` de l'entrée d'historique, bouton `←` au hover sur chaque ligne présente
- **Panneau Après (droite)** : `afterState.content`, bouton `→` au hover sur chaque ligne présente
- **Cherry-pick** : clic `←` ou `→` copie la ligne dans `rows[i].current` (indices stables dans `TriDiffRow[]`, renumérotés via `renumberCurrent()`), badge bleu sur la ligne modifiée
- **Réinitialiser** : restaure `rows[i].current` depuis le snapshot original (`originalCurrent[]`)
- **Appliquer dans l'éditeur** : `emit(rows filtrées (current non-null) jointes par \n)` → `ProjetEditorComponent.onTriDiffApply()` → `EditionOutilComponent.applyExternalContent()` → `ProjetEditorZoneComponent.applyExternalContent()` remplace la plage de lignes de la section/fichier ciblé dans le document unifié puis déclenche le pipeline de sauvegarde normal (brouillon local `projet_local_draft`, comme une frappe manuelle — la publication reste un choix explicite via "Enregistrer et partager") + entrée "Fusion manuelle" dans l'historique (`undoable: false`, un simple PUT sur un seul fichier serait incorrect si la section a des fichiers additionnels)
  - **Fix (2026-07-04)** : plusieurs bugs liés à `entry.entityId`, qui est le **folderId** pour le texte principal d'une section (pas un fileId, voir `getCursorEntity`/`flushContentModifications`) : (1) l'ancien "Appliquer dans l'éditeur" patchait `files`/appelait `updateFile` directement avec cet id, sans effet visible ; (2) le panneau "Actuel" était **toujours vide** pour ces entrées (`findFileById` ne trouve jamais un dossier) ; (3) **bug critique de corruption** : `<app-projet-diff>` et `<app-edition-outil>` étaient mutuellement exclusifs dans le template (`@else if (diffEntry())`) — `onTriDiffApply()` forçait un `detectChanges()` après `diffEntry.set(null)` pour réattacher le `ViewChild editionOutil`, ce qui **détruisait puis recréait** `ProjetEditorZoneComponent` ; la nouvelle instance n'avait pas encore le focus de section établi au moment où `applyExternalContent()` lisait `unifiedContent`/`sectionRanges`, qui reflétaient alors le document entier non focus → **mélange de contenu entre sections** (une ligne d'une autre section de "Cahier des Charges" écrite dans "test 2" lors des tests). Corrigé en gardant `app-edition-outil` **monté en permanence** (la vue diff s'affiche en overlay absolu `absolute inset-0 z-10` par-dessus, plus en remplacement exclusif) — `editionOutil` ne devient donc plus jamais indisponible, `detectChanges()`/`ChangeDetectorRef` retirés (devenus inutiles).
- **Composants:** `projet-diff.component.ts`, `compute-tri-diff.ts`, `projet-editor.component.ts`, `projet-editor.component.html`, `projet-editor-zone.component.ts`, `edition-outil.component.ts`

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

## `2-5-2-8-14` — Corbeille (fichiers/dossiers supprimés, réversibles 30 jours)

- **Composant** : `ProjetHistoryComponent`, groupe collapsible "Corbeille" en haut du panneau (au-dessus de la timeline d'actions, sous "Versions de cette section")
- **Alimentation** : `GET /api/file-projects/:name/trash` → liste les entrées `projet_trash_entry` actives (ni restaurées, ni purgées) du projet, chargée à l'ouverture du projet et au dépliage du groupe
- **Mécanisme serveur** : les routes `DELETE .../files/:id` et `DELETE .../folders/:id` ne suppriment plus jamais directement sur disque — elles déplacent le fichier/dossier vers `.trash/<horodatage>-<id>/` (jamais poussé au remote git, `.gitignore` dédié) et conservent un snapshot JSON restaurable de la structure. Rétention : purge physique automatique après 30 jours (balayage horaire), ou purge volontaire immédiate
- **Restaurer** : bouton visible au hover sur chaque entrée → `POST .../trash/:trashId/restore` → réinsère le noeud à son emplacement d'origine (ou à la racine avec avertissement si le dossier parent a disparu depuis), remet le contenu physique en place, diffuse `structure_update` (SSE) aux autres utilisateurs connectés
- **Purger définitivement** : icône corbeille sur chaque entrée → `DELETE .../trash/:trashId` → suppression physique immédiate, sans attendre les 30 jours
- **Lien avec l'historique des suppressions** : la suppression manuelle d'un fichier ou d'un dossier depuis la sidebar (`ProjetSidebarComponent.confirmDelete()`) est désormais toujours tracée dans la timeline (`undoable: true`), y compris pour les **dossiers** (auparavant non tracés du tout). Le bouton "Annuler" (↺) d'une entrée de suppression appelle le dispatcher générique `wo-action-history`, qui self-fetch cette même route de restauration — aucune adaptation du dispatcher n'a été nécessaire
- **Limite connue** : restaurer via l'icône ↺ de la timeline ne rafraîchit pas toujours la sidebar en direct (donnée intacte côté serveur, recharger la page si l'arbre ne se met pas à jour) ; restaurer via le bouton "Restaurer" du groupe Corbeille rafraîchit bien la sidebar immédiatement
- **Composants:** `projet-history.component.ts`, `projet-history.component.html`, `project-files.service.ts` (`TrashEntry`, `getTrash`/`restoreFromTrash`/`purgeTrashEntry`), `projet-sidebar.component.ts`, `projet-editor.component.ts`, `server/server-data.js`, `server/modules/projet-git.js`

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
