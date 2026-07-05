# Éditeur › Zone 4 — Mode Code — Fonctions métier

Composant : `ProjetEditorZoneComponent` — onglet "Code"  
Vue : textarea Markdown à gauche, rendu HTML miroir à droite

---

## `2-5-2-4-1` — [modification] Saisie et édition

- **Textarea principale** : saisie libre du contenu Markdown unifié (toutes sections du projet)
- **Auto-save** : délai 2s après dernière frappe → `scheduleSave()` → `saveAll()`
- **Sauvegarde forcée** : clic badge "Non sauvegardé" → `forceSave()`
- **Dirty state** : `localDirty = true` dès la première frappe → emit `dirtyChange(true)`
- **Contenu unifié** : toutes les sections (`## Nom dossier`) concaténées en un seul document
- **Vue assemblée lecture seule** : quand aucune section n'est sélectionnée dans la sidebar (`activeNodeId = null`, `focusedHandle = null`), la textarea est en `readonly` — un overlay invite à sélectionner une section
- **Retour à la ligne automatique** : `white-space: pre-wrap` + `overflow-wrap: break-word` — le texte long passe à la ligne sans ascenseur horizontal; `overflow-x: hidden` sur mirror et textarea
- **Redimensionnement** : la zone s'étend dynamiquement selon la fenêtre via `:host { flex: 1; min-width: 0 }`

---

## `2-5-2-4-2` — [modification] Mode Focus (section sélectionnée dans la sidebar)

- **Activation** : sélection d'un dossier dans la sidebar → `applyFocusByActiveNode()` → `enterFocusMode(handle)`
- **Vue focusée** : seul le contenu de la section sélectionnée est affiché dans le textarea
- **Sauvegarde du contexte** : `fullContentBackup` conserve le document complet, `focusedLineStart` et `focusedOriginalLineCount` mémorisent la position
- **Sortie de focus** : changement de mode (→ Structure/Preview) → `exitFocusMode()` → merge du contenu
- **Mode focus sur image** : si le nœud est une image, affiche le marqueur `{{IMG:id}}` uniquement

---

## `2-5-2-4-3` — Rendu miroir (aperçu)

- **Synchronisation** : le HTML rendu suit le scroll de la textarea
- **Highlights** : sections surlignées selon `highlightNodeId`
- **Scroll auto** : `scrollToNodeId` → défile vers la section demandée
- **Rendu Markdown** : via `marked`
- **Marqueur Trello** : `{{TRELLO:id}}` est présent dans le texte brut ; le board Trello complet est affiché dans le panneau bas (voir `2-5-2-4-15`)

---

## `2-5-2-4-4` — Slash commands (/)

- **Déclenchement** : saisie `/` en début de ligne → affiche `SlashCommandMenuComponent`
- **Options** : `/nouveau dossier`, `/nouveau fichier`, `/table`, `/code`, `/liste`, `/titre`, etc.
- **Sélection** : Enter ou clic sur l'option → insère le contenu approprié
- **Fermeture** : Escape ou clic ailleurs

---

## `2-5-2-4-5` — Insertion de formatage

Via les boutons de la toolbar (voir toolbar/fonctions.md) ou raccourcis :
- **Gras** : sélection + Ctrl+B
- **Italique** : sélection + Ctrl+I
- **Insertion à la position curseur** : les boutons H1-H4, liste, séparateur, etc.

---

## `2-5-2-4-6` — Gestion des images (mode Code)

- **Upload** : clic bouton image (toolbar) → input file → POST `/api/file-projects/{name}/files` (multipart)
- **Types acceptés** : jpeg, jpg, png, gif, webp, svg, bmp
- **Insertion** : marqueur `{{IMG:uuid}}` inséré à la position du curseur dans le texte
- **Affichage** : rendu comme `<figure>` dans le miroir HTML
- **Erreur upload** : toast rouge avec message d'erreur (cliquable pour fermer)

---

## `2-5-2-4-7` — Repliage de sections (folding)

- **Replier une section** : clic sur le handle de la section → `foldSection(sectionId)`
  - Contenu de la section masqué dans la textarea (indicateur `[...]`)
  - Auto-save bloqué si sections repliées
- **Déplier** : clic handle → `unfoldSection(sectionId)`
- **Déplier tout** : `unfoldAll()` → lors du changement de mode ou sortie focus

---

## `2-5-2-4-8` — Drag & Drop dans la zone Code

- **Drag handles** : icônes de déplacement sur les sections, fichiers, images
- **Réorganisation** : glisser-déposer → repositionne dans le document Markdown
- **Sections** (dossiers) : déplacement de blocs Markdown complets
- **Fichiers additionnels** : documents secondaires dans une section
- **Images** : déplacement des marqueurs `{{IMG:id}}` entre sections

---

## `2-5-2-4-9` — [modification] Présence douce et état "en attente" (projets backup)

- **Premier keystroke dans une section** : snapshot du contenu → `codeSectionSnapshots`
- **Présence granulaire (non bloquante)** : `collab.lockNode(projectName, entityId)` enregistre une présence (avec heartbeat ~20s tant que la section reste active), `activeEntityLocks: Set<entityId>` — n'empêche plus un autre utilisateur d'éditer la même entité en même temps (voir `2-5-2-4-37`)
- **Affichage** : badge rouge sur le nœud dans la sidebar (indicatif — "quelqu'un édite aussi ici")
- **Partager / Annuler depuis le menu de la section** (vB-0.279) : les actions sont déclenchées depuis le **menu contextuel de la sidebar** (voir `2-5-2-2-9`), et non plus depuis une barre en bas de zone. La zone écoute `collab.publishSectionRequest$` / `cancelSectionRequest$` (abonnement `takeUntilDestroyed` dans le constructeur) → `publishSection(sectionId)` / `cancelSection(sectionId)`.
  - **Portée = sous-arbre** : publier/annuler une section traite la section **ET ses sous-sections modifiées** (descendants `pending`). `collectSectionPublishIds(sectionId)` = `{ sectionId }` ∪ descendants (`getDescendantFolderIds`) qui sont `isLocalPending` ∪ dossiers des entités granulaires verrouillées du sous-arbre. Les sous-sections **non modifiées** ne sont jamais écrites (pas de `publish=true` superflu).
  - **`publishSection(sectionId)`** : indépendant du mode/focus. Calcule `publishFolderIds` (sous-arbre) et capture les entités verrouillées **avant** le flush, reconstruit le document si focus, parse, écrit avec `publish=true` les fichiers dont `folderId ∈ publishFolderIds`, exécute les suppressions d'images différées, puis `releaseSectionsPending()` + `unlockNode()` pour chaque dossier.
  - **`cancelSection(sectionId)`** : restaure chaque section du sous-arbre depuis `codeSectionSnapshots` (remplacement par plage via `sectionRanges`, **du bas vers le haut** pour préserver les indices de ligne), restaure les images annulées, `recomputeAll()` + `saveAll()`, puis `releaseSectionsPending()` + `unlockNode()`.
  - **`releaseSectionsPending(folderIds, lockedEntityIds)`** : libère verrous + pending de l'ensemble de sections et de leurs entités granulaires (blocs/fichiers), nettoie `codeSectionSnapshots`, `dirtyVisuSectionIds`, `visuSectionLockSnapshot`, `editingVisuSectionId`, `cursorEntityId`.
- **Barre du bas** : ne contient plus de boutons Annuler/Partager pour le mode Code (`showCodePublishBar` / `showCrossModePendingBar` n'affichent qu'un libellé « Modifications en cours — partager via le menu de la section »). La **barre Preview** (mode visu) a été **supprimée** (vB-0.282) : partage/annulation via le menu contextuel de la section. Seule la barre Structure (`structureHasPending`) conserve ses boutons.
- **Portée du partage (mode focus, `publishCodeEdit`)** : seules les sections **réellement éditées** sont publiées et déverrouillées. `publishFolderIds` est calculé depuis `activeEntityLocks` (mappés vers leur `folderId` via `modifiedEntities`), sinon la section ciblée. Le document complet est reconstruit uniquement pour résoudre les `folderId` des sous-sections ; les sections enfants **non modifiées ne sont pas écrites** avec `publish=true`, donc elles restent verrouillées (correctif : sans ce filtre, toutes les sous-sections enfants étaient partagées + déverrouillées côté serveur)

---

## `2-5-2-4-10` — Snapshot pre-édition vue document (sans focus)

- **Premier keystroke** (hors mode focus) : `codeDocSnapshot = lastSavedContent`
- **Annuler vue document** : restaure le snapshot entier du document
- **Partager vue document** : publie toutes les sections du document

---

## `2-5-2-4-11` — [modification] Sections et parsing

- **Détection headings** : regex `^(#{1,6}) (.+)$` → niveaux 1-6
- **Niveaux** : `#` = niveau 1 … `######` = niveau 6 (dossiers navigables jusqu'au niveau 6). La limite était précédemment de 4 (`####`) ; portée à 6 pour que les sous-sections profondes des livrables IA (séances, cours, sous-points) restent des dossiers dans la sidebar.
- **SectionRanges** : `{ folderId, lineStart, lineEnd }` pour chaque section. Le mappage titre→`folderId` itère dans l'ordre du **buffer** (`flatHeads`, ce que l'utilisateur voit) et associe chaque titre à un `docSection` non encore consommé (level + name) — robuste même quand l'ordre du buffer diverge de l'ordre stocké des fichiers (cas de la préservation du texte en mode Code, voir `2-5-2-4-16`). Sans cette logique, une section déplacée dans le code pointait vers le mauvais dossier (focus erroné à la navigation).
- **Calcul de `lineEnd` (portée = section + sous-sections)** : la fin de plage d'une section va jusqu'à la prochaine section qui **n'est pas un descendant** dans l'arbre (`getDescendantFolderIds`), et non « la prochaine section de niveau markdown ≤ ». Indispensable car `buildDocSections` plafonne le niveau de titre à 6 (`######` max) : au-delà de 6 niveaux de profondeur, parent et enfants partagent le même niveau markdown → un calcul par niveau tronquerait la plage de focus au seul titre. Le focus d'une section profonde affiche donc bien la section ET toutes ses sous-sections (cohérent avec le filtre de la preview).
- **FileRanges** : `{ fileId, lineStart, lineEnd }` pour les blocs fichiers additionnels
- **Blocs-fichiers additionnels** : délimités par une ligne commençant par `'`, `` ` `` ou `^`. Les fences de code markdown ` ``` ` sont explicitement exclues (lookahead `(?!` + 3 backticks + `)` / garde `!startsWith('```')`) → un bloc de code ` ``` … ``` ` n'est jamais interprété comme un bloc-fichier ni reformaté à la sauvegarde

---

## `2-5-2-4-12` — Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| Ctrl+S | Forcer la sauvegarde |
| Escape | Fermer menu slash commands |
| / | Ouvrir menu slash commands (si début de ligne) |
| Tab | Indentation |

---

## `2-5-2-4-15` — Panneau Trello en mode Code

- **Affichage** : le panneau `app-trello-board` s'affiche dès que le marqueur ` ```TRELLO: NOM ` est présent dans la section active (voir `2-5-2-4-14`)
- **Synchronisation live** : le composant reste monté lors des changements de mode → les modifications (ajout/édition/déplacement de tâche) faites dans un mode sont immédiatement visibles dans les autres
- **SSE** : les mises à jour de collaborateurs (`trelloUpdate$`) sont reçues dans tous les modes puisque le board n'est jamais détruit
- **Propagation vers Code** : `@Output() cardsChanged` → `onTrelloCardsChanged` → `syncTrelloInlineBlock()` met à jour le bloc fencé inline **uniquement si le toggle Sync auto est activé** (voir `2-5-2-4-14`)

---

## `2-5-2-4-14` — Bloc Trello inline dans le contenu (mode Code)

- **Format** : bloc fencé ` ```TRELLO: NOM_DU_TRELLO ` inséré directement dans le markdown de la section
- **Structure** :
  ```
  ```TRELLO: Nom du board
  ### À faire
  - [ ] Titre task `[Haute]` — auteur · date
  ### En cours
  - [~] Task 2
  ```
  ```
- **Source de vérité = le code** : le marqueur ` ```TRELLO: NOM ` dans le contenu pilote l'existence du Trello (nœud sidebar, onglet MO, vue board). Le `folderId` DB n'est qu'un fallback de migration.
- **Insertion** : création d'un Trello → `confirmTrelloPopup()` crée l'instance DB + insère le bloc à la position du curseur. À la sauvegarde, le fence est parsé comme **fichier additionnel système** → fichier créé (nœud sidebar) via la réconciliation parente.
- **Carte de démarrage** (vB-0.281) : à la création d'un Trello vierge, une carte par défaut est ajoutée. `confirmTrelloPopup()` appelle `createTrelloCard(inst.id, { title:'Task test 1', status:'todo', priority:'medium', description:'Description Task test 1' })` (BDD) et insère le fence avec le corps généré par `buildDefaultTrelloBody()` :
  ```
  ### À faire
  - [ ] Task test 1 `[Normale]` — <user> · <jj/mm/aa>
    Description Task test 1
  ```
  La réconciliation par titre (`reconcileTrelloCardsFromCode`) évite tout doublon entre la carte BDD et la carte du code.
- **Création depuis le menu section** (vB-0.280) : le menu contextuel de la sidebar (voir `2-5-2-2-9`) propose « Ajout MO Trello » / « Ajout MO Tableau ». La zone écoute `collab.createMegaOutilRequest$` (abonnement `takeUntilDestroyed`) → mémorise `pendingMoFolderId` puis ouvre `openTrelloPopup()` / `openArrayPopup()`. `confirmTrelloPopup` / `confirmArrayPopup` utilisent `pendingMoFolderId` comme `folderId` de l'instance (fallback : curseur/section active) et insèrent le fence **en fin de section focalisée** (curseur déplacé en fin de textarea) pour qu'il appartienne bien à la section. `pendingMoFolderId` est réinitialisé à la confirmation/annulation.
- **Nom du nœud sidebar** : le fichier est nommé ` TL: NOM ` (préfixe ajouté par `parseContent`) ; le fence dans le code reste ` ```TRELLO: NOM `. `buildDocSections` retire le préfixe pour matcher l'instance, `reconcileTrelloLifecycle` l'ignore à la suppression.
- **Parsing** : `parseContent()` pré-scanne les fences Trello (exclut leurs `###` internes de la détection de sections) puis extrait chaque ` ```TRELLO: NOM … ``` ` en `AdditionalFile{name:NOM, content:body}` (retiré de `contenu.md`).
- **Re-sérialisation** : `buildDocSections()` re-sérialise un fichier lié à une instance trello (match `folderId`+nom) en fence ` ```TRELLO: NOM … ``` ` (au lieu du délimiteur `'`).
- **Affichage miroir** : la ligne d'ouverture ` ```TRELLO: NOM ` est affichée en **code brut** (classe `.ed-trello-fence`, plus de badge) ; le corps du bloc s'affiche normalement.
- **Vue board selon le mode** : le panneau `app-trello-board` (bas) est affiché **uniquement en mode Structure** (`mode === 'structure'`), pour la **section active** seulement. Masqué en Code et en Preview. `recomputeContentTrelloIds()` scope toujours à la section active (résolution fichier→dossier via `resolveActiveFolderId`).
- **Board visuel en Preview** : en mode Preview, le bloc Trello est rendu **inline** dans la zone d'édition sous forme de **kanban visuel** (4 colonnes, cartes titre + badge priorité + description) via `renderTrelloVisuHtml` (injecté dans `buildVisuSectionHtml`). Pas de panneau bas.
- **Tag graphique en Structure** : en mode Structure, le code brut du fence est remplacé par un **tag graphique bleu « TRELLO : NOM »** (`getStructBodySegments` émet un segment `trello`, bloc complet préservé). `parseStructureNodes` exclut les `###` internes du fence de la détection de headings.
- **Suppression / corruption** : à la sauvegarde, `reconcileTrelloLifecycle()` détecte qu'un marqueur vu auparavant a disparu (bloc effacé) ou n'est plus reconnu (ex: ` ```TREO: `) → supprime l'instance DB, émet `megaOutilDeleted` (onglet MO retiré), supprime le fichier `trello.md` (+`refresh`). Le texte corrompu restant est intégré à `contenu.md`, l'affichage de la section ne change pas. `seedSeenTrelloMarkers()` amorce le suivi au chargement pour ne jamais supprimer une instance legacy sans marqueur.
- **Migration** : l'ancienne syntaxe ` ```## Trello: NAME ` reste reconnue en lecture.
- **Élément à part entière / focus** : le fence a une `fileRange` (mappée au fichier `TL: NOM` via `recomputeRanges`) → un handle `file`. Cliquer sur le nœud sidebar `TL: NOM` met la zone Code en **mode focus** sur le seul bloc Trello. Clic sur l'onglet MO (`selectMegaOutil`, mode édition) → émet l'id du fichier Trello → même focus.
- **Label MO** : les onglets Trello dans la barre instances affichent `[trello:NOM]`
- **Sync bidirectionnelle code ↔ board** :
  - **board → code** : ajouter/modifier une carte → `onTrelloCardsChanged()` → `syncTrelloInlineBlock()` régénère le corps du fence (### colonnes + cartes). Le regex gère le bloc vide ` ```TRELLO: NOM\n``` ` (corps optionnel `(?:[\s\S]*?\n)?`).
  - **code → board/BDD** : à la sauvegarde, `reconcileTrelloCardsFromCode()` parse le corps du bloc et réconcilie les cartes en base (correspondance par **titre**) : ligne supprimée → carte supprimée, ligne ajoutée → carte créée, statut/priorité modifiés → carte mise à jour. Le board se rafraîchit via SSE. Helpers : `parseTrelloBodyCards`, `trelloLabelToStatus`, `trelloLabelToPriority`. Réconciliation limitée aux instances dont les cartes sont déjà chargées (anti-doublon au démarrage).
- **Toggle Sync auto** : bouton dans la barre des actions Trello (mode Code) → `trelloAutoSync` (signal, **activé par défaut**). Désactivé → `onTrelloCardsChanged()` n'appelle pas `syncTrelloInlineBlock()`, le code n'est jamais modifié automatiquement. Activé → le bloc inline se met à jour quand les cartes changent

---

## `2-5-2-4-16` — [modification] Préservation du texte exact en mode Code (vB-0.279)

- **Principe** : en mode Code, la saisie de l'utilisateur n'est plus réécrite/normalisée par la reconstruction. Le texte exact (lignes vides multiples, espaces de fin, `#` seul, indentation) est conservé tel que tapé.
- **Mécanisme** : un drapeau `localCodeSavePending` est armé dans `saveAll()` (vue document, hors focus) à l'émission du save, et **libéré uniquement à la fin du cycle** quand le `@Input saveStatus` repasse à `'idle'`/`'error'`. Quand le `@Input files` revient avec la nouvelle structure, `ngOnChanges` calcule `preserveCodeBuffer` (mode `edit`, hors focus, `hasStructuralChange`, sans `markersFixed`, drapeau actif) et **n'écrase pas** `unifiedContent`/textarea avec `reconstructFromSections()`.
- **Pourquoi pas un drapeau one-shot ni un délai fixe** : le parent (`processSectionsChange`) appelle `loadFiles()` **plusieurs fois** par cycle de save (création, fichiers additionnels, synchro d'ordre) → plusieurs émissions de `files`, le tout pendant `saveStatus === 'saving'`. Un one-shot consommé à la 1ʳᵉ émission, ou une fenêtre temporelle fixe (ex. 6 s) trop courte pour un save serveur lent, laissaient une émission tardive reconstruire et **réordonner** les sections. Lier la garde à `saveStatus` couvre tout le cycle quelle que soit sa durée.
- **Restructuration conservée** : les dossiers/sections sont toujours créés/renommés/supprimés côté parent (`processSectionsChange`). Seul le texte affiché est préservé ; `recomputeAll()` remappe les ranges sur le buffer conservé.
- **Changements externes** : un changement structurel ne provenant pas de la saisie Code (renommage/suppression via sidebar, drag, collaboration) garde `localStructuralSavePending = false` → reconstruction normale (le code reflète le changement).
- **Navigation préservée** : comme le buffer peut diverger de l'ordre des fichiers, `recomputeRanges` associe les titres aux dossiers **dans l'ordre du buffer** (voir `2-5-2-4-11`) → cliquer une section dans la sidebar focus bien la bonne section dans la zone Code.
- **Réordonnancement de sections dans le code → menu + dossiers physiques** : changer l'ordre des `###` directement dans le code réordonne les dossiers de section sans toucher au texte. Côté parent (`processSectionsChange`, étape 7), `applySectionFolderOrder()` regroupe les `folderId` par parent dans l'ordre d'apparition dans le document et met à jour `folder.order` (clé de tri du menu sidebar **et** de `buildDocSections`), persisté via `updateStructure()` + `loadFiles()`. Le menu et les dossiers physiques suivent le code ; l'ordre fichiers == ordre buffer rétablit la cohérence (plus de divergence à terme).
- **Limite connue** : au rechargement du projet, le contenu est reconstruit depuis les fichiers → la version normalisée s'affiche (le texte exact n'est pas persisté verbatim).

---

## `2-5-2-4-17` — [modification] Système double fichier : Markdown propre + jumeau stylisé (vB-0.283)

Objectif : garder un `contenu.md` **propre** (Markdown standard uniquement) pour l'IA, et déporter les styles non-markdown (couleur, surlignage, taille, soulignage, alignement) dans un **jumeau `contenu-css.md`**.

- **Invariant** : `stripStyleMarkdown(contenu-css.md)` == `contenu.md` (texte affiché identique). Utilitaires dans `apps/projets/src/app/pages/projet-editor/content-style.util.ts` : `stripStyleMarkdown`, `mergeCleanIntoStyled`, `cssTwinName`, `isCssTwinName`.
- **Master = stylisé** : le buffer (`unifiedContent`) provient du jumeau `-css.md` (`buildDocSections`). Le Markdown standard (`**`, `*`, `#`, listes, liens, code) reste dans le contenu ; seul le HTML de style va dans le jumeau.
- **Images en Markdown standard** (vB-0.284) : dans le fichier propre (`contenu.md`, vu par l'IA en mode Code), les marqueurs `{{IMG:id}}` sont convertis en image Markdown `![alt](nom-fichier)` (chemin = nom du fichier image, situé dans le dossier de la section ; alt = légende ou nom sans extension). Géré par `stripStyleMarkdown(md, imgResolver)` (résolveur `cleanImgResolver` côté zone et parent). Le jumeau stylisé garde `{{IMG:id}}` ; le round-trip est assuré par `mergeCleanIntoStyled` (mapping ligne clean ↔ styled).
- **Styles markdown-compatibles toujours en Markdown** : gras `**…**`, italique `*…*`, barré `~~…~~` sont écrits en **Markdown dans les deux fichiers** (jamais en `<b>`/`<span style="font-weight">`). `normalizeStyledMarkdown` convertit toute balise `<b>/<strong>/<i>/<em>/<s>/<del>` en Markdown avant écriture du jumeau et au chargement. Le `-css.md` n'ajoute du HTML que pour les styles **sans** équivalent Markdown (couleur, surlignage, taille, soulignage, alignement). Exemple : `<span style="color:purple">**gras**</span>`.
- **Lecture / réconciliation IA→app** : si `contenu.md` (propre) diverge de `strip(jumeau)` (édition externe par l'IA), `buildDocSections` fusionne via `mergeCleanIntoStyled` (texte IA prioritaire, styles conservés sur les lignes inchangées).
- **Écriture** : à chaque sauvegarde, `contenu.md = strip(styled)` et `contenu-css.md = styled`. Auto-save : côté parent (`processSectionsChange` + `saveCssTwin`). « Partager » : côté zone (`writeSectionStyled`, publish des deux fichiers). Création/orphelins : le jumeau est exclu des fichiers additionnels et jamais supprimé comme orphelin.
- **Fusion ligne par ligne** : les lignes inchangées gardent leur style, les lignes modifiées/ajoutées repassent en texte brut (si le nombre de lignes diverge → styles abandonnés, invariant préservé).
- **Toggle « Markdown propre / Avec style »** (`showCssInCode`) : en mode Code, vue **lecture seule du Markdown propre** par défaut (`.ed-clean-view` = `codeCleanView` = `strip(unifiedContent)`) ; bascule pour afficher/éditer le contenu stylisé (textarea + miroir habituels).
- **Sidebar** : `contenu.md` et `*-css.md` sont masqués de l'arborescence.
- **Tableaux/éléments riches stylés** : restent gérés par le MO Array (style en base), hors périmètre du double fichier.

---

## `2-5-2-4-13` — [modification] États

| État | Description |
|------|-------------|
| Mode normal | Textarea pleine largeur |
| Mode focus | Seule la section sélectionnée visible |
| Dirty | Badge orange dans la barre d'info (bas de zone) |
| Saving | Spinner |
| Erreur upload image | Toast rouge |
| Sections repliées | Indicateur `[...]` sur la ligne repliée |
| Slash menu ouvert | Menu flottant au curseur |
| Section verrouillée | Barre Annuler/Partager visible |
| Barre cross-mode | Barre persistante si switch de mode avec pending |
| Lecture seule FTP | `[readonly]` sur textarea si section en cours de sync |
| Présence d'un autre user sur la section active | **Non bloquant** : bannière ambre "X édite aussi cette section" (Code) / badge "Édité par X" (Visu) — la frappe reste possible pour les deux utilisateurs. Getters `isActiveSectionLockedByOther` (affichage uniquement) / `activeSectionOtherEditorName` / `isTrelloInstanceLocked` / `isArrayInstanceLocked` / `isStructNodeLocked` |

---

## `2-5-2-4-18` — Suppression d'image par effacement de la ligne {{IMG:id}}

- **Déclenchement** : l'utilisateur efface manuellement la ligne `{{IMG:id}}` dans la textarea Code → `onTextareaInput` → `scheduleSave` → `saveAll` → `reconcileImageLifecycle(content)`
- **Détection** : toute image de `this.files` non référencée par un `{{IMG:id}}` dans le contenu (et hors `recentlyAddedImageIds` / `pendingLocalImages`) est candidate à la suppression
- **Suppression physique** (cohérente avec `deleteImageUnified`) :
  - Projet **backup** : différée au Partager via `pendingVisuDeletions` (le contenu publié référence encore l'image — un `deleteFile` immédiat échouerait) + garde `recentlyDeletedImageIds`
  - Projet **local** : `svc.deleteFile` immédiat
- **Réconciliation inverse** : une image redevenue référencée (couper/coller, undo, ré-ajout) est retirée de `recentlyDeletedImageIds` / `pendingVisuDeletions` et restaurée dans `allImages`
- **Garde anti-réapparition** : `recentlyDeletedImageIds` (durable) empêche `buildDocSections` de ré-injecter l'image tant que son nœud subsiste dans `this.files`

---

## `2-5-2-4-19` — Identifiant stable de section `{{SID:folderId}}`

- **Format** : chaque heading porte en fin de ligne un marqueur `{{SID:<folderId>}}` (ex. `## Présentation {{SID:c7e0205f-…}}`) qui lie de façon **stable** la section à son dossier physique, indépendamment du nom et de l'ordre.
- **Origine** : dérivé du dossier par `buildDocSections` (`composeHeading(level, name, folderId)`) → présent après chaque reconstruction (`reconstructFromSections`). Les projets sans SID sont **migrés automatiquement** au premier chargement.
- **Visibilité** : visible en mode Code (buffer brut, comme `{{IMG:}}`/`{{TRELLO:}}`) mais **atténué** (opacité réduite) dans le mirror ; **masqué** en modes Structure et Édition.
- **Rôle anti-régression** : `parseContent` et `recomputeRanges` résolvent le `folderId` **prioritairement par SID** (puis chemin slugifié, puis nom). Le renommage d'un titre ou le réordonnancement ne perd plus le lien section↔dossier et ne crée plus de dossier parasite.

---

## `2-5-2-4-20` — Re-parentage automatique sur changement d'imbrication

- **Principe** : insérer/déplacer un titre en mode Code modifie l'imbrication markdown des sections suivantes → leurs dossiers physiques sont **déplacés** en conséquence (`processSectionsChange` → `moveFolder`).
- **Exemple** : insérer un `## H2` au milieu d'une suite de `### H3` → les H3 **suivants** deviennent enfants du nouveau H2 ; les H3 **au-dessus** restent rattachés à l'ancien H2.
- **Mécanique** : pour chaque section identifiée par son `{{SID}}`, le parent textuel (imbrication courante) est comparé au parent physique ; en cas de différence → `moveFolder(folderId, targetParentId)`. Tri parents→enfants ; promotion en racine → ajout à `outil.rootFolderIds`.
- **Robustesse** : l'identité étant garantie par le SID, le déplacement ne provoque jamais de recréation/suppression. Déclenché même sans autre changement structurel (`needsReparent` dans `hasStructural`).
- **Résolution du parent** : le parent textuel est la section précédente de niveau **strictement inférieur** le plus proche (pas forcément `level-1`), avec réinitialisation des niveaux plus profonds. Gère les sauts de niveau (ex. insérer un H1 entre des H3).
- **Normalisation de niveau** : le niveau d'affichage d'un titre = sa **profondeur** dans l'arbre de dossiers (`buildDocSections`, `level = depth`). Conséquence : insérer un H1 au milieu de H3 → les H3 suivants, devenus enfants directs du H1, sont automatiquement **remontés en H2** (profondeur 2), uniquement dans la nouvelle section. Les titres au-dessus du H1 sont inchangés.

---

## `2-5-2-4-21` — Annuler / Refaire (Ctrl+Z / Ctrl+Y) en mode Code

- **Boutons** : `undo` et `redo` (icônes Material) en **première position** dans la barre de style (mode Code, vue « Avec style »). Bouton Annuler grisé si pile vide, Refaire grisé si rien à refaire.
- **Raccourcis** : Ctrl+Z → annuler, Ctrl+Y (ou Ctrl+Shift+Z) → refaire. Interceptés dans `onTextareaKeydown`.
- **Pile custom** (`codeUndoStack` / `codeRedoStack`) : captures de `{ content, selStart, selEnd }`, max 200 entrées.
  - **Avant chaque action toolbar** (`insertAt`, `codeClearFormat`) : snapshot immédiat (`pushCodeUndoSnapshot`).
  - **Frappe au clavier** : snapshot debounce 800 ms (`scheduleCodeSnapshot` dans `onTextareaInput`).
  - Toute action annulée alimente `codeRedoStack` et vice-versa ; le Redo est effacé dès une nouvelle action.
- **Restauration** : `applyCodeSnapshot` → `unifiedContent = snap.content`, `ta.value = snap.content`, repositionnement du curseur, `recomputeAll()`, `scheduleSave()`.

---

## `2-5-2-4-22` — [modification] Save auto 2 s — brouillon local (jamais partagé)

- **Précondition** : projet ouvert en mode Code, section existante avec contenu connu.
- **Action** : taper du texte dans la textarea, attendre 2 s sans autre interaction.
- **Résultat attendu** : `scheduleSave()` déclenche `saveAll()` → `sectionsChange` → `processSectionsChange` → `PUT /api/file-projects/:name/files/:id/draft` (table `projet_local_draft`, propre à l'utilisateur courant) — **aucune version BDD `projet_content_version` n'est créée**, aucun autre utilisateur ne voit ce texte. Badge "Non sauvegardé" disparaît (contenu bien en brouillon local), badge de présence ambre "modifications locales" apparaît côté sidebar pour les autres.
- **À vérifier** : la valeur du brouillon (`GET .../files/:id/draft`) correspond exactement à ce qui a été tapé. Aucun caractère perdu. `projet_content_version` reste inchangée tant que "Enregistrer et partager" n'est pas cliqué.
- **Composants:** `projet-editor-zone.component.ts`, `projet-editor.component.ts`, `project-files.service.ts`, `server/server-data.js`

---

## `2-5-2-4-23` — [modification] Save forcé Ctrl+S (brouillon local)

- **Précondition** : texte tapé, timer 2 s non encore écoulé (zone dirty).
- **Action** : appuyer Ctrl+S.
- **Résultat attendu** : `forceSave()` → `unfoldAll()` → `saveAll()` immédiat, sans attendre les 2 s. Badge disparaît. Contenu écrit en brouillon local (`.../draft`), pas en version BDD.
- **À vérifier** : le timer scheduleSave existant est annulé (`clearTimeout`) pour éviter un double save. Le brouillon local correspond à l'état au moment de Ctrl+S.
- **Composants:** `projet-editor-zone.component.ts`, `projet-editor.component.ts`

---

## `2-5-2-4-24` — [SYNC] Race condition : frappe pendant un save en cours

- **Précondition** : user tape, le timer 2 s déclenche `saveAll()` → `processSectionsChange` est en cours (HTTP PUT lent).
- **Action** : user continue de taper pendant que `isSaving = true`.
- **Résultat attendu** : `onSectionsChange` met le nouveau batch dans `pendingSections` (overwrite). À la fin du save en cours, `pendingSections` est consommé → un second save démarre avec le dernier état. Aucun caractère tapé entre les deux saves n'est perdu.
- **Résultat à redouter** : si l'utilisateur tape beaucoup entre deux saves, une seule émission `pendingSections` est gardée (la dernière). C'est le comportement attendu car `unifiedContent` reflète toujours l'état courant.
- **À vérifier** : après les deux saves successifs, la BDD correspond à l'état final affiché dans la textarea.
- **Composants:** `projet-editor.component.ts`

---

## `2-5-2-4-25` — [modification] [SYNC] Réception SSE content_update pendant frappe — buffer local préservé

- **Précondition** : deux users ouvrent le même projet. User A est en train de taper (texte non sauvegardé).
- **Action** : user B sauvegarde une modification sur une section différente → user A reçoit un SSE `content_update` pour ce fichier.
- **Résultat attendu** : `patchNodeContent` met à jour `files` avec le nouveau contenu du fichier de user B. `getFileStructureKey` ne change pas (même IDs) → `hasStructuralChange = false` → `reconstructFromSections()` ne s'exécute PAS → le buffer de user A (`unifiedContent`) est préservé intégralement.
- **Résultat à redouter** : `recomputeMirrorLines` tourne (appelé depuis `recomputeAll` dans ngOnChanges) et pourrait trouver des marqueurs IMG orphelins si `allImages` est désynchronisé → `saveAll()` appelé immédiatement avec le buffer courant → risque d'overwrite du contenu de user B. Vérifier que `recentlyAddedImageIds` protège correctement.
- **À vérifier** : après réception SSE, le texte que user A était en train de taper est toujours visible dans la textarea sans aucune perte.
- **Composants:** `projet-editor-zone.component.ts`, `projet-editor.component.ts`

---

## `2-5-2-4-26` — [SYNC] Réception SSE structurel pendant frappe — reconstruction et localCodeSavePending

- **Précondition** : user A est en mode Code, en train de taper. User B crée/supprime une section (changement structurel).
- **Action** : user A reçoit le SSE → `files` change → `hasStructuralChange = true`.
- **Résultat attendu** : si `localCodeSavePending = true` (save de user A en cours) → `preserveCodeBuffer = true` → reconstruction bloquée → buffer de user A intact. Si `localCodeSavePending = false` → reconstruction depuis `docSections` → texte de user A visible dans la zone remplacé par la version serveur.
- **Règle absolue** : quand `localCodeSavePending = true`, aucun SSE structurel ne peut écraser le buffer.
- **À vérifier** : seul un reload explicite (Ctrl+R ou bouton Rafraîchir) doit reconstruire depuis le serveur quand `localCodeSavePending = true`.
- **Composants:** `projet-editor-zone.component.ts`

---

## `2-5-2-4-27` — [SYNC] Mode Focus + save — fusion correcte dans le document complet

- **Précondition** : user clique sur section "Introduction" → mode focus activé. `fullContentBackup` = document complet. `unifiedContent` = seul le contenu de "Introduction".
- **Action** : user modifie le texte dans la textarea focusée, puis blur ou Ctrl+S.
- **Résultat attendu** : `saveAll()` fusionne `unifiedContent` (section modifiée) dans `fullContentBackup` aux bonnes lignes (`focusedLineStart`, `focusedOriginalLineCount`). `contentToParse = fullContentBackup` → parseContent → sections correctes → processSectionsChange écrit uniquement le fichier de la section "Introduction". Le reste du document n'est pas modifié.
- **Résultat à redouter** : si `focusedOriginalLineCount` est incorrect (désynchronisé par une insertion de lignes via MO ou cleanup), la splice peut décaler et corrompre le document.
- **À vérifier** : après sortie du focus (clic sur une autre section), le document complet est cohérent — la section "Introduction" a le nouveau texte, les autres sections sont intactes.
- **Composants:** `projet-editor-zone.component.ts`

---

## `2-5-2-4-28` — [modification] [SYNC] Mode Focus + SSE autre section — fullContentBackup non mis à jour (risque)

- **Précondition** : user A en mode focus sur section "Intro". User B modifie la section "Conclusion" et sauvegarde.
- **Action** : user A reçoit SSE `content_update` pour le fichier de "Conclusion".
- **Résultat attendu actuel** : `patchNodeContent` met à jour `files["Conclusion"]`. `hasStructuralChange = false` → pas de reconstruction. `fullContentBackup` contient ENCORE l'ancienne version de "Conclusion". Quand user A sort du focus et sauvegarde, il écrase "Conclusion" avec l'ancienne version (perdu les changements de user B).
- **Règle absolue (à implémenter)** : en mode focus, le `fullContentBackup` DOIT être mis à jour section par section quand un SSE content_update arrive pour une section hors focus.
- **À vérifier** : ce scénario est reproductible et constitue un bug avéré. Tester avec projets backup (multi-user).
- **Composants:** `projet-editor-zone.component.ts`, `projet-editor.component.ts`

---

## `2-5-2-4-29` — [modification] [SYNC] Insertion d'un MO Prompt — fence créée, instance DB, MOID injecté

- **Précondition** : section existante en mode Code.
- **Action** : ouvrir la liste des Prompts → créer un nouveau Prompt → confirmer.
- **Résultat attendu** : fence `` ```PROMPT: NomPrompt {{MOID:uuid}} `` insérée dans le document à la position du curseur. Instance DB créée via `megaOutilsSvc.createInstance()`. `ensurePromptInstancesFromContent()` ne recrée pas de doublon. Sidebar affiche le nœud `PR: NomPrompt`.
- **À vérifier** : après save (2s), le fichier `prompt-NomPrompt.md` existe dans le dossier de la section. La fence est parsée comme `additionalFile` dans `parseContent()`. Rechargement → fence toujours présente, MOID intact.
- **Composants:** `projet-editor-zone.component.ts`, `projet-editor.component.ts`

---

## `2-5-2-4-30` — [modification] [SYNC] Exécution Prompt → résultat inséré sans effacer le bloc PROMPT

- **Précondition** : section avec un bloc `` ```PROMPT: Mon Prompt ``` `` en mode Code.
- **Action** : exécuter le prompt → résultat reçu → `onPromptInsert()` → `upsertPromptResultSection()`.
- **Résultat attendu** : une sous-section `PR-Res Mon Prompt` (dossier enfant, titre un niveau SOUS le dossier du prompt) est insérée À L'INTÉRIEUR du dossier du prompt, après le bloc prompt. Le bloc `` ```PROMPT: ... ``` `` original reste intact dans le document. L'ancienne section résultat (si elle existait, y compris une ancienne section sœur) est retirée et remplacée. `currentEditSource = 'ia-prompt-result'` → log indique la source IA.
- **Consigne de niveau de titre dynamique** : avant l'exécution, le system prompt envoyé à l'IA inclut une consigne `FORMAT DES TITRES` (via `promptResultStartHeadingLevel(folderId)` → input `startHeadingLevel` de la popup) indiquant le niveau markdown auquel démarrer les titres = niveau de `PR-Res` + 1, plafonné à 6, **dynamique** selon la profondeur du prompt. Le livrable est ainsi généré au bon niveau dès le départ ; `demoteHeadings` reste un filet de sécurité idempotent (delta = 0 si l'IA respecte la consigne). Ex. : prompt dans un dossier niveau 3 → PR-Res niveau 4 → IA démarre au niveau 5 (`#####`).
- **Règle absolue** : un bloc `` ```PROMPT: ... ``` `` ne peut jamais être effacé par `upsertPromptResultSection()` ni par `reconcileTrelloLifecycle()` ni par `reconcileDeletedMoFiles()`.
- **À vérifier** : après le save, les deux sections sont présentes en BDD : la section prompt ET la section résultat. Ré-exécuter le prompt → l'ancienne section résultat est remplacée, le prompt est intact. La consigne `FORMAT DES TITRES` est visible dans le system prompt envoyé (zone « prompt envoyé » de la popup) avec le bon niveau de départ.
- **Composants:** `projet-editor-zone.component.ts`, `prompt-execution-popup.component.ts`

---

## `2-5-2-4-31` — [modification] [SYNC] Exécution Workflow → livrable + MOs créés — cohérence document

- **Précondition** : section avec un bloc WORKFLOW configuré.
- **Action** : exécuter le workflow → valider le livrable et sélectionner des MOs → `onWorkflowMaterialize()`.
- **Résultat attendu** : `upsertPromptResultSection()` insère le livrable. Les MOs sélectionnés (Trello, Array) sont créés avec leur fence dans le document. `currentEditSource = 'ia-workflow-result'` (ou 'ia-prompt-result' car `upsertPromptResultSection` le pose). Sections structurellement cohérentes.
- **À vérifier** : document après save contient : le bloc WORKFLOW intact, la section résultat, les fences MO. Sidebar reflète les nouveaux nœuds. Pas de duplication au rechargement.
- **Composants:** `projet-editor-zone.component.ts`

---

## `2-5-2-4-32` — [modification] [SYNC] Suppression MO via sidebar → fence retirée, aucun texte utilisateur perdu

- **Précondition** : section avec un bloc `` ```TRELLO: Mon Board ``` `` et du texte utilisateur avant et après.
- **Action** : supprimer le fichier `TL: Mon Board` depuis la sidebar (bouton supprimer).
- **Résultat attendu** : `reconcileDeletedMoFiles()` détecte la disparition du nœud → `removeFenceByMoid(moid)` retire uniquement la fence du document → le texte utilisateur avant/après la fence est intégralement préservé. Un save système est déclenché (`currentEditSource = 'system-cleanup'`). Instance DB supprimée si aucune autre copie.
- **Résultat à redouter** : `removeFenceByMoid` prend trop de lignes (fermeture fence mal détectée) et supprime du texte hors fence.
- **À vérifier** : après suppression, le document ne contient plus la fence TRELLO mais tout le reste est intact. Sidebar ne montre plus le nœud Trello. Log `system-cleanup` présent.
- **Composants:** `projet-editor-zone.component.ts`

---

## `2-5-2-4-33` — [SYNC] Undo/Redo — contenu restauré, save déclenché

- **Précondition** : user a tapé du texte et effectué des actions toolbar (insertion titre, gras, etc.).
- **Action** : Ctrl+Z plusieurs fois → Ctrl+Y pour refaire.
- **Résultat attendu** : `applyCodeSnapshot()` restaure `unifiedContent` à l'état du snapshot (pile max 200). `scheduleSave()` est appelé → save 2s. La textarea affiche le contenu restauré. Le miroir se met à jour. Les ranges sont recalculés.
- **À vérifier** : après plusieurs undo/redo alternés, le contenu en BDD correspond bien au snapshot appliqué (aucune accumulation d'états intermédiaires). La pile redo est vidée dès qu'une nouvelle frappe intervient.
- **Composants:** `projet-editor-zone.component.ts`

---

## `2-5-2-4-34` — [SYNC] Passage de mode Edit→Visu→Structure — contenu préservé à chaque transition

- **Précondition** : document avec plusieurs sections et un MO Trello.
- **Action** : taper du texte en mode Code → passer en mode Visu → passer en mode Structure → revenir en mode Code.
- **Résultat attendu** : à chaque changement de mode, `saveAll()` est appelé si `unifiedContent !== lastSavedContent`. Retour en mode Code : le contenu affiché correspond à ce qui était en mode Code avant le basculement. Aucun texte perdu dans aucune direction.
- **À vérifier** : les fences MO (TRELLO, ARRAY, PROMPT) survivent aux aller-retours entre modes. La structure de dossiers en BDD est cohérente avec ce qui était affiché en Code.
- **Composants:** `projet-editor-zone.component.ts`

---

## `2-5-2-4-35` — [modification] [SYNC] Nettoyage système (markersFixed, moidsFixed, moidInjected) — pas d'effacement utilisateur

- **Précondition** : projet ouvert, présence de marqueurs IMG ou fences MO sans MOID.
- **Action** : chargement du projet → `ngOnChanges` → `fixImageMarkersInSections()`, `fixStaleFenceMoids()`, `injectMoidIntoLegacyFences()` s'exécutent.
- **Résultat attendu** : les corrections système (ajout MOID, déplacement IMG) ne modifient que les lignes concernées. Tout le texte utilisateur autour est intact. `currentEditSource = 'system-cleanup'` → log identifie la source.
- **Risque connu — markersFixed** : si `markersFixed = true`, `preserveCodeBuffer = false` même si `localCodeSavePending = true`. Cela force une reconstruction qui peut écraser le buffer utilisateur. Ce cas doit être testé avec un upload d'image pendant une frappe active.
- **Règle absolue** : aucune opération système automatique ne peut supprimer ou modifier du texte utilisateur en dehors des lignes de fence MO ou des marqueurs `{{IMG:id}}`.
- **À vérifier** : comparer le document avant/après le nettoyage ligne par ligne — seules les lignes attendues changent.
- **Composants:** `projet-editor-zone.component.ts`

---

## `2-5-2-4-36` — [SYNC] Déplacement de section (sidebar drag & drop) — contenu préservé, re-parentage correct

- **Précondition** : projet avec au moins 3 sections dont une avec du texte riche (MO Trello inclus).
- **Action** : drag & drop d'une section dans la sidebar pour la déplacer sous une autre section.
- **Résultat attendu** : `processSectionsChange` détecte le `needsReparent` → `moveFolder()` appelle l'API. `applySectionFolderOrder()` met à jour les `order` des dossiers. La zone préserve le buffer (`localCodeSavePending`) si un save était en cours. Le contenu de la section déplacée est intégral après rechargement.
- **Résultat à redouter** : la reconstruction depuis `reconstructFromSections()` après le `loadFiles()` pourrait réordonner les sections différemment si `buildDocSections` lit un ordre de fichiers différent de ce que l'utilisateur a défini visuellement.
- **À vérifier** : après rechargement, l'ordre affiché en Code et dans la sidebar correspond à ce qui a été défini par le drag. Le texte de toutes les sections est intact.
- **Composants:** `projet-editor-zone.component.ts`, `projet-editor.component.ts`

---

## `2-5-2-4-37` — [modification] [SYNC] Multi-users : édition simultanée même section — brouillons locaux indépendants + présence

- **Précondition** : user A et user B ont le même projet ouvert, même section active, textes différents localement. Aucun des deux n'est bloqué en lecture seule.
- **Action** : les deux tapent en même temps sur la même section. Chacun a son propre brouillon local (table `projet_local_draft`, clé `project_id+node_id+user_id` — aucune écriture ne peut écraser celle de l'autre) et voit une bannière/badge de présence multi-utilisateurs "X édite aussi cette section" (Code) / "Édité par X" (Visu), issue du registre `projet_section_lock` (PK composite `node_id+locked_by_id`, upsert + heartbeat ~20s, event SSE `presence`).
- **Résultat attendu** : la frappe n'écrit JAMAIS `projet_content_version` automatiquement — seul le brouillon local de chacun est mis à jour. Aucun conflit ne peut survenir tant qu'aucun des deux n'a cliqué "Enregistrer et partager". Au clic de l'un des deux, une vraie version BDD immuable est créée (comparaison `baseVersionId` vs dernière version BDD). Si l'autre clique ensuite avec un `baseVersionId` périmé → 409 → panneau de fusion (voir `2-5-2-4-40`).
- **Règle absolue** : aucune perte silencieuse — toute tentative de sauvegarde en conflit (y compris la version écartée) est conservée dans `projet_content_version` avec `origin='conflict-mine'`, jamais supprimée. Le brouillon local n'est purgé qu'après validation réussie ou résolution de conflit.
- **À vérifier** : après résolution du conflit (fusion ou choix rapide), les deux users voient le même contenu et leurs brouillons locaux respectifs ont été supprimés. La zone Historique (`2-5-2-8-13`) liste bien les versions `checkpoint`/`conflict-mine`/`merge` créées pendant le scénario.
- **Composants:** `projet-editor-zone.component.ts`, `projet-editor.component.ts`, `libs/portail-core/data-access/src/lib/projet-collab.service.ts`, `server/server-data.js`

---

## `2-5-2-4-38` — [modification] [SYNC] Purge orpheline d'image dans recomputeMirrorLines — garde recentlyAddedImageIds

- **Précondition** : user upload une image dans une section. Le fichier image est créé en BDD mais pas encore dans `this.files` (loadFiles en cours).
- **Action** : `recomputeMirrorLines()` s'exécute (suite à une frappe ou un ngOnChanges) avant que `loadFiles()` n'ait propagé le nouveau nœud.
- **Résultat attendu** : le marqueur `{{IMG:newId}}` est dans `recentlyAddedImageIds` → `orphanIndexes` ne l'inclut pas → le marqueur n'est PAS supprimé du document → `saveAll()` n'est pas déclenché intempestivement.
- **Résultat à redouter** : si `recentlyAddedImageIds` n'est pas correctement renseigné, le marqueur est traité comme orphelin → supprimé de `unifiedContent` → `saveAll()` immédiat → image perdue dans le document.
- **À vérifier** : après que `loadFiles()` se termine et que `files` contient le nœud image, `allImages` est mis à jour et le marqueur reste intact. L'image s'affiche correctement dans le miroir.
- **Composants:** `projet-editor-zone.component.ts`

---

## `2-5-2-4-39` — Vue assemblée lecture seule (sans section sélectionnée)

- **Précondition** : mode Code, aucune section sélectionnée dans la sidebar (`activeNodeId = null`).
- **Action** : user tente de cliquer dans la textarea ou de taper du texte.
- **Résultat attendu** : textarea en `readonly` → aucune modification possible. Un overlay "Sélectionnez une section dans la barre latérale pour l'éditer" est visible. Les handles de section restent cliquables pour entrer en focus.
- **Résultat à redouter** : l'overlay s'affiche même quand une section est sélectionnée, bloquant l'édition.
- **À vérifier** : cliquer sur une section dans la sidebar → overlay disparaît, textarea devient éditable (focus mode actif). Cliquer sur "Racine" (désélection) → overlay réapparaît.
- **Composants:** `projet-editor-zone.component.html`

---

## `2-5-2-4-40` — [modification] [SYNC] Détection de conflit réel (HTTP 409, version BDD) + fusion ligne à ligne

- **Précondition** : user A et user B ouvrent le même projet. User B modifie localement puis clique "Enregistrer et partager" sur la section "Intro" (voir `2-5-2-4-37`). User A avait chargé le fichier avant la validation de B et édite encore en brouillon local.
- **Action** : quand user A clique à son tour "Enregistrer et partager", `PUT /files/:id` envoie `x-base-version-id: <versionId chargé au départ>`. Le serveur compare (transaction `SELECT ... FOR UPDATE`) à la dernière version BDD réelle du fichier — elle a changé (B a validé entre-temps).
- **Résultat attendu** : serveur répond HTTP 409 avec `{ error:'conflict', base:{versionId}, server:{versionId, content, authorName, createdAt}, mine:{content} }` (aucune écriture BDD). Côté client : panneau ambre "Conflit — {auteur} a modifié ce fichier entre-temps" avec 2 boutons rapides ("Garder ma version" / "Utiliser la version du serveur") **et** en dessous une vue 3 panneaux (`ProjetDiffComponent` réutilisé, `leftLabel="Version serveur"` / `rightLabel="Ma version"`) permettant de composer une fusion ligne à ligne (`←`/`→` par ligne) avant de cliquer "Appliquer dans l'éditeur".
- **Bouton Synchro** : dès qu'un checkpoint d'un autre utilisateur arrive (SSE `version_saved`) sur la section active, une bannière indigo "Synchro" apparaît **avant même** qu'un conflit ne survienne — cliquer dessus ouvre le même écran de fusion sans attendre un 409.
- **Résolution** : `POST /files/:id/resolve-conflict {baseVersionId, folderId, mineContent, mergedContent}` insère 2 versions immuables (`origin:'conflict-mine'` = tentative écartée préservée, puis `origin:'merge'` = nouvelle tête) — jamais de perte, jamais d'écrasement silencieux.
- **Résultat à redouter** : la réponse 409 est ignorée → perte silencieuse (ne doit plus se produire : le composant capture systématiquement le 409 et ouvre le panneau).
- **À vérifier** : choisir "Utiliser la version du serveur" ou "Garder ma version" → résolution immédiate. Cherry-pick quelques lignes puis "Appliquer" → le contenu fusionné est sauvegardé et visible par les deux utilisateurs (SSE `content_update`).
- **Composants:** `projet-editor.component.ts`, `projet-editor.component.html`, `components/projet-diff/projet-diff.component.ts`, `server/server-data.js`, `project-files.service.ts`

---

## `2-5-2-4-41` — [SYNC] Queue SSE contentUpdate pendant cycle de sauvegarde

- **Précondition** : user A sauvegarde (`isSaving = true`). Simultanément, user B modifie un autre fichier → SSE `content_update` arrive côté user A.
- **Action** : `contentUpdate$` reçoit l'événement SSE pendant que `processSectionsChange` est en cours.
- **Résultat attendu** : le patch SSE est mis en queue dans `pendingSSEPatches[]` (pas appliqué immédiatement). Dès que `processSectionsChange` se termine, la queue est drainée → `patchNodeContent` appliqué pour chaque entrée en attente. Le buffer de frappe de user A n'est jamais touché.
- **Résultat à redouter** : le patch SSE est appliqué pendant `processSectionsChange` → `oldContentMap` est stale → `trackContentUpdate` logue un faux diff.
- **À vérifier** : en mode 2 onglets, user A sauvegarde une longue section (>500ms), user B modifie une autre section → les modifications de B sont bien visibles chez A après sa sauvegarde, sans perte de texte.
- **Composants:** `projet-editor.component.ts`

---

## `2-5-2-4-42` — [SYNC] SSE structure_update sur move-folder → rechargement automatique

- **Précondition** : user A et user B ont le même projet ouvert. User A déplace un dossier dans la sidebar.
- **Action** : `POST /api/file-projects/:name/move-folder` réussit → serveur envoie SSE `structure_update { type: 'move', folderId, targetParentId }` à tous les clients sauf user A.
- **Résultat attendu** : user B reçoit `structureUpdate$` → `autoPullAndRefresh()` → sidebar de user B se met à jour automatiquement, le dossier est visible à sa nouvelle position.
- **Résultat à redouter** : user B ne voit pas le changement avant de recharger manuellement la page.
- **À vérifier** : tester avec 2 onglets : déplacer un dossier dans l'onglet 1, observer que l'onglet 2 met à jour sa sidebar en moins de 2 secondes sans rechargement manuel.
- **Composants:** `server/server-data.js` (route move-folder), `projet-editor.component.ts` (subscribeToCollabEvents)

---

## `2-5-2-4-43` — [SYNC] Garde MOID : la synchro ne supprime jamais un prompt/MO dont l'instance est vivante

- **Précondition** : section contenant un prompt (`prompt-NOM.md` avec `{{MOID:id}}`), instance vivante en DB.
- **Action** : renommer le prompt en Mode Code (ou tout événement qui fait disparaître transitoirement la fence du buffer parsé) → `processSectionsChange` étape 6 voit `prompt-NOM.md` non matché par nom dans `additionalFiles`.
- **Résultat attendu** : avant suppression, on extrait le `{{MOID:id}}` du contenu du fichier et on vérifie `megaOutilInstances()`. Si l'instance `id` est vivante → suppression **bloquée** (log `Suppression bloquée : fichier MO ... instance encore vivante`). Le fichier prompt survit → à la reconstruction (`buildDocSections`), la fence est réinjectée dans le contenu.
- **Cas legacy (sans MOID)** : fichier `prompt-/trello-/array-` sans `{{MOID}}` lisible → protégé si une instance homonyme vivante existe.
- **Résultat à redouter** : sans la garde, le renommage supprime le fichier prompt comme orphelin → bloc PROMPT et instance perdus (bug réel observé projet « cours d'anglais »).
- **Suppression explicite préservée** : `deletePromptInstance` supprime d'abord l'instance DB → l'instance n'est plus vivante → la garde laisse passer la suppression du fichier (comportement attendu).
- **À vérifier** : renommer un prompt en Code → le bloc PROMPT reste présent après save + reload. Supprimer explicitement le prompt via sidebar → le fichier est bien supprimé.
- **Composants:** `projet-editor.component.ts`

---

## `2-5-2-4-44` — [modification] Collage de markdown pré-formaté : re-leveling auto des titres + popup de prévisualisation

- **Précondition** : curseur dans un dossier de niveau 2 (Mode Code) ou section visu de niveau 2. Presse-papier = texte markdown commençant par `# Titre` (H1) avec sous-niveaux.
- **Action** : coller (Ctrl+V) → `onTextareaPaste` (Code) ou `onVisuSectionPaste` (visu).
- **Résultat attendu** : `relevelMarkdownHeadings` détecte le plus haut titre (H1) et décale tous les titres pour que le plus haut devienne niveau cible + 1 (ici niveau 3). Au lieu d'insérer directement, un **popup de prévisualisation** (`pastePreview`) s'ouvre avec **deux stratégies au choix** : « Recaler les niveaux de titres » (comportement décrit ci-dessus, par défaut) ou « Créer une section intermédiaire » (`wrapMarkdownInIntermediateSection`) — englobe le texte collé sous un nouveau titre intermédiaire (niveau cible + 1, titre éditable dans un champ dédié, aperçu recalculé en direct) sans toucher aux niveaux du texte importé au-delà de son propre recalage sous ce nouveau titre. Le popup affiche la section cible, le niveau cible, le décalage appliqué (ex: « +2 ») et le texte final dans une zone éditable.
- **Validation** : bouton « Coller » (`confirmPastePreview`) → insertion effective de la stratégie choisie (`applyCodePaste` / `applyVisuPaste`), `parseContent` crée les sous-menus (y compris la nouvelle section intermédiaire le cas échéant) ; bouton « Annuler » (`cancelPastePreview`) → rien n'est inséré, quelle que soit la stratégie sélectionnée. Le texte de l'aperçu est modifiable avant de coller.
- **Niveau cible** : Mode Code = niveau du dernier titre avant le curseur (fence-aware, `sectionLevelBeforeOffset`) ; Mode visu = `sec.level`, insertion en fin de contenu direct de la section (avant les enfants).
- **Sans titres** : si le presse-papier ne contient aucun `^#{1,6}`, collage natif préservé (texte brut en Code, texte riche en visu) — pas de `preventDefault`, pas de popup.
- **Titres sans espace** : la détection (`parseHeadingLine`) tolère les titres écrits sans espace après les `#` (ex: `#1. Préparation` autant que `## Objectif`). Ils sont comptés dans le calcul du plus haut niveau ET recalés. En sortie, l'espace est **normalisé** (`### 1. Préparation`) pour que `parseContent` crée bien le sous-menu.
- **Résultat à redouter (bug corrigé)** : (1) sans re-leveling, un H1 collé dans un dossier niveau 2 devient un dossier racine → hiérarchie cassée → texte supprimé à la reconstruction ; (2) un titre `#1.` sans espace était ignoré → niveau le plus haut détecté faux (décalage +1 au lieu de +2) et titre non recalé ; (3) presse-papier avec fins de ligne Windows (`\r\n`, ex: copié depuis Word/un export) → `parseHeadingLine` ne matchait plus aucun titre (le `.` des regex JS exclut `\r`) → `relevelMarkdownHeadings` retournait le texte tel quel (aucun décalage visible dans l'aperçu) alors que le badge « décalage » affichait quand même une valeur incohérente. **Fix** : normalisation `\r\n?` → `\n` dès la lecture du presse-papier dans `onTextareaPaste`/`onVisuSectionPaste`, avant tout calcul.
- **À vérifier** : coller un document multi-niveaux (y compris titres `#1.` sans espace, et avec fins de ligne `\r\n`) dans un dossier niveau 2 → le popup s'affiche avec le décalage +2, tous les titres recalés et espacés, « Coller » insère les titres en sous-sections (niveau 3+), le menu reflète la nouvelle arborescence, le texte est intégralement présent ; « Annuler » ne touche à rien.
- **Composants:** `projet-editor-zone.component.ts`, `projet-editor-zone.component.html`

---

## `2-5-2-4-45` — [modification] Exécution IA : watchdog timeout (anti-blocage infini)

- **Précondition** : exécuter un prompt (workflow guidé ou direct) via un provider dont le CLI peut hang (ex: antigravity/agy gemini-3-pro).
- **Action** : la génération démarre (`AiExecuteService.startExecution` → SSE `/api/mega-outils/prompt/execute-stream` → executor port 3002 spawn `agy`/`claude`).
- **Résultat attendu** : si le process CLI ne se termine pas dans `AI_EXEC_TIMEOUT_MS` (défaut 5 min), l'executor le tue (SIGTERM puis SIGKILL) et émet `error` + `end` → le client reçoit `error$` → le popup workflow quitte l'état `generating` (plus de spinner infini). Filet serveur : `apiReq.setTimeout` (max + 30s) si l'executor devient injoignable.
- **Spécificité agy** : agy n'écrit pas sur stdout (sortie fichier pollée) → impossible de détecter l'inactivité via stdout → le watchdog borne la **durée totale**, pas l'inactivité.
- **Résultat à redouter (bug corrigé)** : sans watchdog, un CLI qui hang ne ferme jamais le process → aucun `complete` SSE → popup bloqué indéfiniment sur « Génération du livrable… ».
- **À vérifier** : un prompt qui hang finit par afficher une erreur claire (timeout) au lieu de tourner sans fin ; un prompt normal (réponse < timeout) se termine normalement.
- **Statut périodique agy** : agy n'écrivant pas sur stdout, le serveur émet toutes les 5s un `ai-log`/`info` (« agy en cours… Xs — N octets reçus » ou « en attente de la réponse du modèle ») → visibilité dans le Journal IA. Si agy se termine sans rien écrire → alerte `stderr` (vérifier install/auth agy ou utiliser Claude).
- **Composants:** `electron/executor/server-executor.js`, `server/server-data.js`

---

## `2-5-2-4-46` — Workflow guidé : journal IA en direct (surveillance des échanges)

- **Précondition** : exécuter un prompt en workflow guidé (popup `PromptWorkflowPopupComponent`).
- **Action** : démarrer le cadrage puis la génération du livrable.
- **Résultat attendu** : un panneau « Journal IA » s'affiche, horodaté, montrant : la requête envoyée (`logRequest` → SYSTEM+USER tronqués + provider/modèle), le flux `log$` (info/stdout/stderr coloré), et la réponse reçue (taille + durée). Plafonné à 400 lignes, repliable, bouton Vider. Persiste à travers les vagues de cadrage et la génération.
- **Cas agy** : agy n'écrivant pas sur stdout, le journal montre au moins les lignes `info` de l'executor (« Executing Antigravity CLI… ») + la requête → l'utilisateur voit que l'exécution est lancée même sans stdout.
- **Résultat à redouter (avant correctif)** : le popup n'affichait que `accumulated()` (stdout) → vide avec agy → aucune visibilité sur les échanges.
- **À vérifier** : pendant la génération, le journal liste les événements en temps réel ; en cas d'erreur/timeout, la ligne `stderr` rouge apparaît.
- **Composants:** `prompt-workflow-popup.component.ts`

---

## `2-5-2-4-47` — Workflow guidé : réponses du formulaire transmises à l'IA (toutes les voies)

- **Précondition** : prompt en workflow guidé, l'IA a renvoyé un formulaire de cadrage, l'utilisateur le remplit.
- **Action A — « Envoyer les réponses »** : `submit()` → `submitted` → `onFormSubmitted` → push transcript → vague de cadrage suivante (`buildClarifyUser` inclut `[Échanges de cadrage précédents]`) jusqu'à `===PRÊT===` ou `maxWaves` (5).
- **Action B — « Générer le livrable maintenant »** : `onSecondary()` → `secondary` émet la `FormEntry` → `onForceGenerate(entry)` pousse les réponses dans le transcript AVANT `startGenerate` → `buildGenerateUser` inclut `[Réponses de cadrage]`.
- **Résultat attendu** : dans les deux cas, la requête de génération (vérifiable dans le Journal IA) est plus longue que le prompt initial (réponses incluses). L'IA reçoit les réponses et produit un livrable cohérent.
- **Résultat à redouter (bug corrigé)** : le bouton secondaire émettait un événement vide → réponses perdues → requête de génération identique au prompt initial (même nombre de caractères) → l'IA génère sans le cadrage utilisateur.
- **À vérifier** : remplir le form, cliquer « Générer le livrable maintenant » → le Journal IA montre `[Réponses de cadrage]` dans la requête de génération.
- **Composants:** `form-execution-popup.component.ts`, `prompt-workflow-popup.component.ts`

---

## `2-5-2-4-48` — Exécution IA : gros prompts via jobId (POST prepare, anti-URL trop longue)

- **Précondition** : exécuter un prompt volumineux en workflow guidé — système ~8000 car. (méta-prompt de génération) + demande + état du projet inclus dans la phase de génération du livrable.
- **Action** : valider le formulaire de cadrage → la génération démarre. `AiExecuteService.startExecution` (et `executeOnce`) appellent d'abord `prepareJob` → `POST /api/mega-outils/prompt/execute-prepare` (corps JSON, sans limite de taille) qui renvoie un `jobId`, puis ouvrent l'EventSource sur `…/execute-stream?jobId=…&token=…` (URL courte).
- **Résultat attendu** : le flux SSE s'établit, le Journal IA affiche les retours (« agy en cours… » / stdout Claude), le livrable est généré et passe en aperçu. Annulation pendant la préparation gérée via `AbortController` (pas d'erreur fantôme).
- **Résultat à redouter (bug corrigé)** : en passant système+user+état dans les query params d'un GET, l'URL dépassait la limite d'en-tête HTTP → la requête n'atteignait jamais le serveur, aucun flux SSE, aucun log « agy en cours… », timer bloqué indéfiniment sur « Génération du livrable… » sans interaction IA visible.
- **À vérifier** : un prompt court ET un prompt très long aboutissent tous deux ; couper la connexion pendant « Génération » affiche bien une erreur exploitable.
- **Composants:** `libs/portail-core/data-access/src/lib/ai-execute.service.ts`, `server/server-data.js`

---

## `2-5-2-4-49` — [modification] Insertion du résultat de prompt : sous-dossier « PR-Res {nom} » dans le dossier du prompt (prompt jamais perdu)

- **Précondition** : un prompt (MO) exécuté via workflow guidé ou exécution directe, dont le dossier parent peut porter le nom « Pr - {nom} ».
- **Action** : valider le livrable → `upsertPromptResultSection()` insère le résultat comme sous-section (titre un niveau sous le dossier du prompt) À L'INTÉRIEUR du dossier du prompt, après le bloc prompt.
- **Résultat attendu** : le titre de la section résultat est « PR-Res {nom} » (libellé/slug distincts du dossier « Pr - {nom} » qui contient le prompt). Dans la sidebar, « PR-Res {nom} » apparaît comme dossier enfant du dossier du prompt, juste après le nœud « PR: {nom} » (et non plus comme dossier sœur au même niveau). Au rechargement/save : aucune fusion, le prompt n'est pas perdu, pas de duplication. Écriture/lecture/info/suppression partagent `promptResultLabel()` + `promptResultHeadingRe()` (source unique) qui matche aussi les anciens noms (« Résultat — {nom} », « Résultat du prompt », « Pr - {nom} ») et migre une ancienne section sœur vers la nouvelle position enfant.
- **Résultat à redouter (bug corrigé)** : nommer le résultat « Pr - {nom} » (identique au dossier parent, même niveau) produisait le même slug → dans `recomputeRanges` les deux titres ne pouvaient matcher qu'un seul `docSection` (`usedDocSections`) → section résultat orpheline, contenu fusionné/perdu (contenu.md vide) et **disparition du prompt** à la sauvegarde.
- **À vérifier** : exécuter un prompt nommé « Ideation » dans un dossier « Pr - Ideation » → après insertion et rechargement, le prompt reste visible et la section « PR-Res Ideation » apparaît comme enfant du dossier, après le prompt, avec le livrable.
- **Composants:** `projet-editor-zone.component.ts`

---

## `2-5-2-4-50` — [modification] Cours vivant : un seul dossier « PR-Res {nom} » dans le dossier du prompt, séances en sous-dossiers (contenu non vide)

- **Précondition** : un prompt produisant un livrable de cours structuré (≥1 titre `## Séance N` + `## Bilan`) → `isLivingCourseDeliverable()` vrai → `materializeLivingCourse()`.
- **Action** : valider le livrable.
- **Résultat attendu** : création d'UN dossier « PR-Res {nom} » (enfant du dossier prompt, à l'intérieur, après lui) contenant une sous-section/sous-dossier par bloc (Bilan + chaque Séance), chacun **avec son contenu** (cours + QCM en inline). Agenda → vrais événements + liste lisible ; Trello/Array → instances live (folderId = dossier du prompt), fences inline. Persistance via `unifiedContent` + `scheduleSave` (chemin fiable). Ré-exécution idempotente : l'ancien wrapper « PR-Res {nom} » est remplacé (y compris une ancienne position en section sœur).
- **Résultat à redouter (bug corrigé)** : l'ancienne implémentation créait un dossier séparé par bloc via `createFolder`/`updateFile` ; les `updateFile` échouaient silencieusement (`.catch`) → **tous les dossiers vides** et dispersés au lieu d'un dossier unique.
- **À vérifier** : exécuter un prompt « cours de maths » → un seul dossier « PR-Res … » avec Séance 1..N + Bilan remplis (pas de dossiers vides) ; les événements agenda et boards Trello/Array sont créés.
- **Composants:** `projet-editor-zone.component.ts`

---

## `2-5-2-4-51` — [modification] Bouton unique "Enregistrer et partager" (validation manuelle, plus d'auto-checkpoint)

- **Précondition** : au moins une section a des modifications locales non partagées (brouillon local, badge ambre).
- **Action** : clic sur "Enregistrer et partager" (mode Code, Visu, Structure ou menu contextuel section de la sidebar — quatre points d'entrée, tous passent désormais par `writeSectionStyled` avec `baseVersionId` systématiquement transmis).
- **Résultat attendu** : si aucune modification concurrente (baseVersionId à jour) → insertion directe d'une version BDD immuable (`projet_content_version`), déclenchement git/FTP si le projet est configuré (fusion des deux dans le même clic), brouillon local supprimé, badge ambre disparaît. Si une modification concurrente existe → 409 → écran de fusion (`2-5-2-4-40`), aucune perte.
- **Résultat à redouter (bugs corrigés)** : (1) avant cette modification, les chemins de publication (Code/Visu/Structure/menu contextuel section) appelaient `updateFile` sans `baseVersionId` → aucune détection de conflit n'était jamais possible sur ce chemin, une publication pouvait écraser silencieusement la dernière version BDD d'un autre utilisateur ; (2) l'acquisition de présence/verrou (`activeEntityLocks`, `collab.lockNode`) et l'affichage du bouton étaient conditionnés à `backupType` (projets git/FTP uniquement) — un projet sans sauvegarde externe n'avait donc **aucun moyen** de valider ses brouillons vers la BDD partagée, même partagé avec un autre utilisateur ; retiré cette condition partout (mode Code/Visu/Structure, upload/suppression d'image) ; (3) l'en-tête `x-base-version-id` manquait dans la liste `allowedHeaders` de la config CORS serveur → toute requête PUT l'utilisant échouait silencieusement côté navigateur (`Failed to fetch`, invisible côté serveur) — corrigé.
- **À vérifier** : publier une section depuis chacun des 4 points d'entrée avec un `baseVersionId` volontairement périmé (un autre user a validé entre-temps) → le panneau de conflit s'ouvre systématiquement, jamais d'écrasement silencieux. Vérifier aussi sur un projet **sans** git/FTP configuré : taper du texte → badge de présence + bouton "Enregistrer et partager" apparaissent dans le menu contextuel de la section → clic → version BDD créée, brouillon purgé.
- **Composants:** `projet-editor-zone.component.ts`, `projet-editor.component.ts`, `projet-editor.component.html`, `projet-sidebar.component.html`, `server/server-data.js`

---

## `2-5-2-4-52` — [modification] Mode tchat : rendu riche, formulaires interactifs, MO détectés, persistance

- **Précondition** : un MO Prompt existe dans une section (mode Code ou Édition).
- **Action** : à la création (popup "Nouveau Prompt"), choisir le 3ᵉ mode "Mode tchat" (au lieu de Normal/Guidé) → ligne `MODE: chat` ajoutée dans le fence `` ```PROMPT: ... ``. Depuis un Prompt existant, le sélecteur de mode dans l'en-tête du board (`prompt-board.component.ts`, `[mode]`/`(modeChange)`) permet de basculer entre Normal/Guidé/Tchat via `setPromptMode()`. Cliquer "Exécuter" sur un Prompt en mode tchat → `openPromptExecutePopup()` détecte `parsed.mode === 'chat'` → `openChatPopup()` → ouvre `app-prompt-chat-popup` (thème émeraude) au lieu du popup normal/workflow.
- **Résultat attendu** : le popup affiche IA/modèle + le premier message (prompt de la section), avec écran de saisie des variables `{{...}}` si le prompt en contient, et une bannière "Reprendre" si une conversation précédente existe pour ce Prompt (voir persistance ci-dessous). Au clic "Démarrer le tchat", le premier message est envoyé via `AiExecuteService.startExecution()` (même mécanisme que les 2 autres modes — pas de session CLI persistante : chaque tour relance `claude`/`agy` à froid avec tout l'historique reconstruit en texte, `PromptChatPopupComponent.buildTranscriptText()`) et la réponse streame dans la conversation, **rendue en markdown** (`marked.parse()` + `DomSanitizer`, classe `.chat-md`) au lieu de texte brut. L'utilisateur peut ensuite répondre librement via le composer (textarea + "Envoyer", Entrée = envoyer / Maj+Entrée = retour à la ligne) : chaque nouveau tour renvoie l'intégralité de l'historique, donc l'IA garde le contexte des échanges précédents.
- **MegaOutils détectés** : chaque réponse IA est passée à `detectMoFences()` (fences `` ```TRELLO/ARRAY/FORM/CHART/AGENDA: Nom``` `` — même détection que le mode Guidé, factorisée dans `libs/portail-core/data-access/src/lib/mo-fence-parser.util.ts`). Si des fences sont détectées, une barre "MegaOutils détectés" apparaît sous la bulle (checkbox + icône + résumé par MO, aperçu SVG immédiat pour `CHART` via `app-chart-board`) ; bouton "Ajouter au projet" → `materializeMo()` émet `(materialize)` → `onChatMaterialize()` (dans `projet-editor-zone.component.ts`) réutilise **directement** `materializeMegaOutilsFromContent()` (même pipeline que le mode Guidé : crée les vraies instances Trello/Array, vrais événements Agenda). Le tchat reste ouvert après matérialisation (contrairement au Guidé qui se ferme).
- **Formulaire interactif** : si la réponse IA contient un formulaire (fence `` ```FORM:``` `` ou texte libre reconnu par `parseChoiceForm()` — grammaire `**Label**` + `- [ ] Option`/`- ( ) Option` (QCM) ou `**Label**` + ligne `_____` seule (question ouverte texte libre, nouveau)), et qu'il s'agit du **dernier** message IA, `app-form-execution-popup` s'ouvre en overlay avec de vrais inputs (checkbox/radio/textarea selon le type). À la validation, les réponses **pré-remplissent le composer** (`Label : réponse` par ligne) pour relecture — **pas d'envoi automatique**, l'utilisateur clique "Envoyer" lui-même.
- **Bouton "Copier la dernière réponse → Coller en édition"** : inchangé — actif dès qu'il y a au moins un message IA. Émet `insertAsSection` avec le texte de la dernière réponse IA → `onChatInsertRequested()` ouvre le **popup d'import existant** (`pastePreview`, cf. `2-5-2-4-44`) ciblé sur le dossier du Prompt. Le popup tchat **ne se ferme pas**.
- **Persistance** : chaque message (user/ai) est sauvegardé en fire-and-forget dans les tables `mega_outil_prompt_chat_sessions`/`mega_outil_prompt_chat_messages` (une session créée au premier message, `MegaOutilsService.createChatSession()`/`appendChatMessage()`). À l'ouverture d'un Prompt en mode tchat, si une session existe pour cette instance, une bannière "Reprendre" permet de recharger la conversation complète (`resumeSession()`, MO redétectés à l'identique depuis le texte).
- **Prompt structuré actif par défaut** (Admin › Mega-outils › Prompt) : bloc "Mode tchat — format structuré", pré-rempli d'un méta-prompt directif par défaut (`DEFAULT_CHAT_STRUCTURED_PROMPT`, appliqué automatiquement si l'admin n'a rien surchargé, même mécanisme de fallback que les méta-prompts du workflow guidé). Concaténé en 3ᵉ position du system prompt (`chatStructuredPrompt`), il impose à l'IA le format reconnu pour chaque question posée (`**Label**` + `_____`/`- [ ]`/`- ( )`) et rappelle les syntaxes de fences (TRELLO/ARRAY/AGENDA/CHART). Testé avec le prompt "Pose moi des questions afin d'établir un profil professionnel." → l'IA produit systématiquement le format reconnu, le formulaire HTML s'affiche automatiquement.
- **À vérifier** : créer un Prompt en mode tchat, démarrer, envoyer 2-3 messages avec markdown/formulaire/fences de test, vérifier le rendu riche, la matérialisation des MO, le round-trip formulaire, la persistance (fermer/rouvrir → bannière Reprendre → conversation identique). Changer le mode d'un Prompt existant via le sélecteur du board (Normal ↔ Guidé ↔ Tchat) → la ligne `MODE:` du fence est mise à jour en conséquence, sans toucher au reste du bloc.
- **Composants:** `prompt-chat-popup.component.ts`, `prompt-board.component.ts`, `prompt-workflow-popup.component.ts`, `form-execution-popup.component.ts`, `mo-fence-parser.util.ts`, `prompt-admin.component.ts`, `projet-editor-zone.component.ts`, `projet-editor-zone.component.html`, `server/server-data.js`

---

## `2-5-2-4-53` — [modification] Popups de lancement Prompt : attente liste IA + toggle prompts de config

- **Message d'attente IA/Modèle** (`prompt-execution-popup.component.ts` mode Normal, `prompt-workflow-popup.component.ts` mode Guidé, `prompt-chat-popup.component.ts` mode Tchat) : tant que `providers()` est vide (liste des IA/modèles pas encore reçue de l'executor, `ConfigService.cliConfig().modelsList`), les 2 selects IA/Modèle sont remplacés par un message « En attente de la liste des IA disponibles… » avec icône animée. Dès qu'au moins un provider est disponible, les selects apparaissent normalement.
- **Toggle "Utiliser les prompts de configuration"** (`prompt-workflow-popup.component.ts` et `prompt-chat-popup.component.ts` uniquement — pas le mode Normal, qui n'a pas de méta-prompt de mode) : case à cocher sur l'écran de lancement (`useConfigPrompts`, cochée par défaut). Décochée : le prompt de base global (Admin › Mega-outils › Prompt › Base) ET le méta-prompt du mode (cadrage+génération pour Guidé, format structuré pour Tchat) ne sont plus injectés dans le system prompt envoyé à l'IA — seul le `SYSTEM:` propre à la section (écrit directement dans le fence du Prompt) reste appliqué. Permet de tester un Prompt sans l'influence des prompts globaux configurés en admin, sans avoir à les vider en base à chaque fois.
- **À vérifier** : décocher le toggle dans le popup Tchat/Guidé, lancer, vérifier via le journal IA (mode Guidé) ou en constatant le comportement de l'IA que le prompt de base/méta-prompt n'a pas été envoyé. Recocher → comportement habituel restauré. Tester avec un exécuteur pas encore chargé (rechargement de page juste avant d'ouvrir le popup) pour voir le message d'attente.
- **Composants:** `prompt-execution-popup.component.ts`, `prompt-workflow-popup.component.ts`, `prompt-chat-popup.component.ts`

---

## `2-5-2-4-54` — [modification] Mode "Tchat libre" : conversation brute, sans MO ni prompts de config, sans rendu HTML

- **Précondition** : un MO Prompt existe dans une section (mode Code ou Édition).
- **Action** : à la création (popup "Nouveau Prompt"), choisir le 4ᵉ mode "Tchat libre" (sous Normal/Guidé/Tchat) → ligne `MODE: freechat` ajoutée dans le fence `` ```PROMPT: ... ``. Depuis un Prompt existant, le sélecteur de mode du board (`prompt-board.component.ts`, `[mode]`/`(modeChange)`, option `freechat`, badge violet) permet de basculer vers ce mode via `setPromptMode()`. Cliquer "Exécuter" → `openPromptExecutePopup()` détecte `parsed.mode === 'freechat'` → `openFreeChatPopup()` → ouvre `app-prompt-freechat-popup` (nouveau composant, thème violet) au lieu des popups Normal/Guidé/Tchat.
- **Différence avec le mode Tchat structuré (`2-5-2-4-52`)** : ce mode n'appelle **aucun** mécanisme MO — pas d'injection du prompt de base global ni d'un méta-prompt configuré en admin (seul le `SYSTEM:` propre à la section, s'il existe, est transmis, sans toggle "Utiliser les prompts de configuration" car il n'y a rien à activer/désactiver), pas de détection de fences MegaOutils (`detectMoFences()` non appelé), pas de formulaire interactif (`parseChoiceForm()` non appelé), pas de persistance de session en base (aucun appel à `MegaOutilsService.createChatSession()`/`appendChatMessage()`, donc pas de bannière "Reprendre"). Les réponses IA sont affichées en **texte brut** (`whitespace-pre-wrap`), sans passer par `marked.parse()` ni `DomSanitizer.bypassSecurityTrustHtml()`.
- **Résultat attendu** : le popup affiche IA/modèle + le premier message (prompt de la section), avec écran de saisie des variables `{{...}}` si le prompt en contient. Au clic "Démarrer le tchat", le message part via `AiExecuteService.startExecution()` (même pattern à froid que les autres modes : chaque tour renvoie tout l'historique reconstruit en texte, `PromptFreeChatPopupComponent.buildTranscriptText()`). L'utilisateur répond librement via le composer (textarea + "Envoyer", Entrée = envoyer / Maj+Entrée = retour à la ligne).
- **Seule action de sortie** : bouton "Copier la dernière réponse → Coller en édition" (actif dès qu'il y a au moins un message IA) — émet `insertAsSection` avec le texte brut de la dernière réponse → `onFreeChatInsertRequested()` ouvre le **popup d'import existant** (`pastePreview`, cf. `2-5-2-4-44`) ciblé sur le dossier du Prompt. Le popup tchat libre **ne se ferme pas**.
- **À vérifier** : créer un Prompt en mode Tchat libre, démarrer, envoyer 2-3 messages (y compris avec du markdown ou des fences MO dans la réponse IA) → vérifier qu'aucune mise en forme n'est appliquée (texte brut affiché tel quel, fences visibles telles quelles) et qu'aucune barre "MegaOutils détectés" n'apparaît. Copier la dernière réponse → popup d'import s'ouvre normalement. Changer le mode d'un Prompt existant via le sélecteur du board vers/depuis "Tchat libre" → la ligne `MODE: freechat` du fence est mise à jour en conséquence, sans toucher au reste du bloc.
- **Composants:** `prompt-freechat-popup.component.ts`, `prompt-board.component.ts`, `projet-editor-zone.component.ts`, `projet-editor-zone.component.html`
