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
- **Partager / Annuler depuis le menu de la section** (vB-0.279) : les actions sont déclenchées depuis le **menu contextuel de la sidebar** (voir `2-5-2-2-9`, `2-5-2-2-21`), et non plus depuis une barre en bas de zone. La zone écoute `collab.publishSectionRequest$` / `cancelSectionRequest$` (payload `{ sectionId, includeDescendants }`, abonnement `takeUntilDestroyed` dans le constructeur) → `publishSection(sectionId, includeDescendants)` / `cancelSection(sectionId, includeDescendants)`.
  - **Portée choisie par l'utilisateur** (`2-5-2-2-21`) : `includeDescendants` (par défaut `true`) détermine si l'action porte sur la section seule ou sur la section **+ ses sous-sections modifiées**. `collectSectionPublishIds(sectionId, includeDescendants)` = `{ sectionId }` ∪ (si `includeDescendants`) descendants (`getDescendantFolderIds`) qui sont `isLocalPending` ∪ dossiers des entités granulaires verrouillées dans le périmètre retenu (la section seule si `includeDescendants=false`, tout le sous-arbre sinon). Les sous-sections **non modifiées** ne sont jamais écrites (pas de `publish=true` superflu).
  - **`publishSection(sectionId, includeDescendants = true)`** : indépendant du mode/focus. Calcule `publishFolderIds` (section seule ou sous-arbre selon `includeDescendants`) et capture les entités verrouillées **avant** le flush, reconstruit le document si focus, parse, écrit avec `publish=true` les fichiers dont `folderId ∈ publishFolderIds`, exécute les suppressions d'images différées, puis `releaseSectionsPending()` + `unlockNode()` pour chaque dossier.
  - **`cancelSection(sectionId, includeDescendants = true)`** : restaure chaque section du périmètre retenu depuis `codeSectionSnapshots` (remplacement par plage via `sectionRanges`, **du bas vers le haut** pour préserver les indices de ligne), restaure les images annulées, `recomputeAll()` + `saveAll()`, puis `releaseSectionsPending()` + `unlockNode()`.
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

## `2-5-2-4-19` — [modification] Identifiant stable de section `{{SID:folderId}}`

- **Format** : chaque heading porte en fin de ligne un marqueur `{{SID:<folderId>}}` (ex. `## Présentation {{SID:c7e0205f-…}}`) qui lie de façon **stable** la section à son dossier physique, indépendamment du nom et de l'ordre.
- **Origine** : dérivé du dossier par `buildDocSections` (`composeHeading(level, name, folderId)`) → présent après chaque reconstruction (`reconstructFromSections`). Les projets sans SID sont **migrés automatiquement** au premier chargement.
- **Visibilité** : visible en mode Code (buffer brut, comme `{{IMG:}}`/`{{TRELLO:}}`) mais **atténué** (opacité réduite) dans le mirror ; **masqué** en modes Structure et Édition.
- **Rôle anti-régression** : `parseContent` et `recomputeRanges` résolvent le `folderId` **prioritairement par SID** (puis chemin slugifié, puis nom). Le renommage d'un titre ou le réordonnancement ne perd plus le lien section↔dossier et ne crée plus de dossier parasite.
- **[modification] Garde anti-corruption contre un délimiteur de bloc orphelin (bug corrigé)** : `parseContent` (pré-scan `codeFencePreScan`/`blockPreScan`), `recomputeRanges` et `parseStructureNodes` détectaient les blocs `` ``` ``/`'`/`` ` ``/`^` en cherchant le **prochain délimiteur fermant trouvé n'importe où dans tout le document**, sans limite de section. Un délimiteur ouvrant resté **orphelin** (résidu de contenu corrompu, jamais fermé — ex. un `` ``` `` seul dans le contenu.md d'un dossier) s'appariait donc à tort avec la fermeture d'un fence complètement différent plus loin dans le document (ex. celle du fence PROMPT d'un dossier frère), transformant tout l'intervalle en un faux "bloc de fichier" qui rendait invisibles les titres de section à l'intérieur — leur texte brut (titre + `{{SID:...}}` inclus) se retrouvait alors absorbé comme contenu ordinaire du dossier courant à chaque sauvegarde, une corruption qui **grandissait à chaque cycle** tant que le délimiteur orphelin n'était pas nettoyé (bug réel observé, incident « cours d'anglais_v2 » : les dossiers frères d'un dossier Prompt semblaient se supprimer/copier les uns dans les autres). Corrigé (`isSuspiciousLineSpan`/`isSuspiciousBlock`) : un bloc/fence dont l'intervalle contient une ligne de titre de section réelle (`#### Nom {{SID:id}}`) est désormais **rejeté** (jamais traité comme un bloc valide) — une vraie fence de contenu ne contient jamais cette syntaxe interne réservée.
- **À vérifier** : un `` ``` `` orphelin (jamais fermé) dans le contenu propre d'un dossier n'avale plus les titres des dossiers frères qui suivent — ceux-ci restent détectés normalement, leur contenu n'est jamais absorbé par le dossier contenant le délimiteur orphelin.

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
- **[modification] Action** : depuis la suppression des popups (voir `2-5-2-7-12`), le mode Normal ne place plus automatiquement le résultat dans une section "PR-Res" — la réponse IA apparaît dans la conversation (onglet Conversation), et l'utilisateur choisit explicitement soit "Copier vers l'édition" (import générique via `pastePreview`), soit "Ajouter au projet" si la réponse contient des fences MO détectées (`materializeRequested` → `materializeFromConversation()` → `upsertPromptResultSection()`, mécanisme ci-dessous inchangé). Les modes Guidé/Tchat/Tchat libre passent systématiquement par la matérialisation quand des MO sont détectés.
- **Résultat attendu (quand `upsertPromptResultSection()` est appelée)** : une sous-section `PR-Res Mon Prompt` (dossier enfant, titre un niveau SOUS le dossier du prompt) est insérée À L'INTÉRIEUR du dossier du prompt, après le bloc prompt. Le bloc `` ```PROMPT: ... ``` `` original reste intact dans le document. L'ancienne section résultat (si elle existait, y compris une ancienne section sœur) est retirée et remplacée. `currentEditSource = 'ia-prompt-result'` → log indique la source IA.
- **Consigne de niveau de titre dynamique** : avant l'exécution, le system prompt envoyé à l'IA inclut une consigne `FORMAT DES TITRES` (`promptDeliverableHeadingInstruction()`, portée depuis l'ancienne popup dans `libs/portail-core/data-access/src/lib/prompt-system-composer.util.ts`, calculée une fois via `promptResultStartHeadingLevel(folderId)` au lancement — `PromptLaunchContext.startHeadingLevel`) indiquant le niveau markdown auquel démarrer les titres = niveau de `PR-Res` + 1, plafonné à 6, **dynamique** selon la profondeur du prompt. Le livrable est ainsi généré au bon niveau dès le départ ; `demoteHeadings` reste un filet de sécurité idempotent (delta = 0 si l'IA respecte la consigne). Ex. : prompt dans un dossier niveau 3 → PR-Res niveau 4 → IA démarre au niveau 5 (`#####`).
- **Règle absolue** : un bloc `` ```PROMPT: ... ``` `` ne peut jamais être effacé par `upsertPromptResultSection()` ni par `reconcileTrelloLifecycle()` ni par `reconcileDeletedMoFiles()`.
- **À vérifier** : après le save, les deux sections sont présentes en BDD : la section prompt ET la section résultat (si matérialisation). Ré-exécuter le prompt → l'ancienne section résultat est remplacée, le prompt est intact.
- **Composants:** `projet-editor-zone.component.ts`, `projet-conversation.component.ts`, `prompt-system-composer.util.ts`

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

> [modification] `applyConflictResolution()` (partagée avec `2-5-2-4-57`) a gagné une branche `isLiveConflict` — le chemin `else` (conflit réel 409) documenté ci-dessous n'a pas changé de logique, mais la fonction ayant été modifiée, une re-vérification rapide est recommandée.

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

## `2-5-2-4-44` — [modification] Collage de markdown pré-formaté : re-leveling auto des titres + popup de prévisualisation (+ exception fence MO)

- **Précondition** : curseur dans un dossier de niveau 2 (Mode Code) ou section visu de niveau 2. Presse-papier = texte markdown commençant par `# Titre` (H1) avec sous-niveaux.
- **Action** : coller (Ctrl+V) → `onTextareaPaste` (Code) ou `onVisuSectionPaste` (visu).
- **Résultat attendu** : `relevelMarkdownHeadings` détecte le plus haut titre (H1) et décale tous les titres pour que le plus haut devienne niveau cible + 1 (ici niveau 3). Au lieu d'insérer directement, un **popup de prévisualisation** (`pastePreview`) s'ouvre avec **deux stratégies au choix** : « Recaler les niveaux de titres » (comportement décrit ci-dessus, par défaut) ou « Créer une section intermédiaire » (`wrapMarkdownInIntermediateSection`) — englobe le texte collé sous un nouveau titre intermédiaire (niveau cible + 1, titre éditable dans un champ dédié, aperçu recalculé en direct) sans toucher aux niveaux du texte importé au-delà de son propre recalage sous ce nouveau titre. Le popup affiche la section cible, le niveau cible, le décalage appliqué (ex: « +2 ») et le texte final dans une zone éditable.
- **Validation** : bouton « Coller » (`confirmPastePreview`) → insertion effective de la stratégie choisie (`applyCodePaste` / `applyVisuPaste`), `parseContent` crée les sous-menus (y compris la nouvelle section intermédiaire le cas échéant) ; bouton « Annuler » (`cancelPastePreview`) → rien n'est inséré, quelle que soit la stratégie sélectionnée. Le texte de l'aperçu est modifiable avant de coller.
- **Niveau cible** : Mode Code = niveau du dernier titre avant le curseur (fence-aware, `sectionLevelBeforeOffset`) ; Mode visu = `sec.level`, insertion en fin de contenu direct de la section (avant les enfants).
- **Sans titres** : si le presse-papier ne contient aucun `^#{1,6}`, collage natif préservé (texte brut en Code, texte riche en visu) — pas de `preventDefault`, pas de popup.
- **Titres sans espace** : la détection (`parseHeadingLine`) tolère les titres écrits sans espace après les `#` (ex: `#1. Préparation` autant que `## Objectif`). Ils sont comptés dans le calcul du plus haut niveau ET recalés. En sortie, l'espace est **normalisé** (`### 1. Préparation`) pour que `parseContent` crée bien le sous-menu.
- **Résultat à redouter (bug corrigé)** : (1) sans re-leveling, un H1 collé dans un dossier niveau 2 devient un dossier racine → hiérarchie cassée → texte supprimé à la reconstruction ; (2) un titre `#1.` sans espace était ignoré → niveau le plus haut détecté faux (décalage +1 au lieu de +2) et titre non recalé ; (3) presse-papier avec fins de ligne Windows (`\r\n`, ex: copié depuis Word/un export) → `parseHeadingLine` ne matchait plus aucun titre (le `.` des regex JS exclut `\r`) → `relevelMarkdownHeadings` retournait le texte tel quel (aucun décalage visible dans l'aperçu) alors que le badge « décalage » affichait quand même une valeur incohérente. **Fix** : normalisation `\r\n?` → `\n` dès la lecture du presse-papier dans `onTextareaPaste`/`onVisuSectionPaste`, avant tout calcul.
- **À vérifier** : coller un document multi-niveaux (y compris titres `#1.` sans espace, et avec fins de ligne `\r\n`) dans un dossier niveau 2 → le popup s'affiche avec le décalage +2, tous les titres recalés et espacés, « Coller » insère les titres en sous-sections (niveau 3+), le menu reflète la nouvelle arborescence, le texte est intégralement présent ; « Annuler » ne touche à rien.
- **[modification] Exception : collage à l'intérieur d'un fence MegaOutil** : si le curseur (Mode Code) se trouve entre les délimiteurs \`\`\`…\`\`\` d'un MO (Prompt, Trello, Array, Form, Chart, Agenda — ex. dans le corps `Votre prompt ici.` d'un Prompt), coller un texte contenant des titres markdown ne déclenche **plus** le recalage ni le popup de prévisualisation : `isOffsetInsideFence(start)` détecte la position et laisse le collage natif se produire (texte brut inséré tel quel, aucun `preventDefault`). Le contenu d'un MO a sa propre structure, indépendante du document — ses éventuels titres n'ont pas vocation à devenir des sections. Aucun impact sur le menu principal dans tous les cas : `parseContent`/`recomputeRanges` excluent déjà (avant ce fix comme après) tout heading situé à l'intérieur d'un bloc \`\`\`…\`\`\` de la construction de l'arborescence des dossiers — seul le comportement du popup de collage change ici.
- **À vérifier (nouveau)** : placer le curseur dans le corps d'un Prompt (entre `SYSTEM:`/`---` et le \`\`\` fermant) et coller un texte contenant des `#`/`##` → aucun popup, texte inséré tel quel sans recalage ; le menu (sidebar) ne montre aucune nouvelle section issue de ce texte, avant et après sauvegarde/rechargement.
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

## `2-5-2-4-46` — [modification] Workflow guidé : journal IA en direct — retiré (non porté dans la conversation embarquée)

- **Ancien comportement (retiré)** : le popup `PromptWorkflowPopupComponent` affichait un panneau « Journal IA » horodaté (requête SYSTEM+USER tronqués, flux `log$` info/stdout/stderr coloré, réponse reçue) — utile notamment pour voir qu'agy travaillait bien malgré l'absence de sortie stdout.
- **Nouveau comportement** : ce panneau de surveillance n'a **pas été porté** dans la conversation embarquée (`2-5-2-7-12`) — simplification assumée pour le premier jet de cette fonctionnalité, l'utilisateur ne voit que le texte qui streame progressivement (`promptStreamingText`), sans détail SYSTEM/USER/logs bruts. Amélioration possible à ajouter ultérieurement si le besoin de diagnostic se fait sentir (ex. cas agy sans sortie stdout, où seul le curseur clignotant serait visible sans texte tant que l'agent n'a rien renvoyé).
- **Composants:** voir `2-5-2-7-12`.

---

## `2-5-2-4-47` — [modification] Workflow guidé : réponses du formulaire transmises à l'IA (toutes les voies)

- **Précondition** : prompt en mode Guidé lancé dans l'onglet Conversation (`2-5-2-7-12`), l'IA a renvoyé un formulaire de cadrage (message taggé `isCadrageForm`), l'utilisateur le remplit via `<app-form-execution-popup [inline]="true">`.
- **Action A — « Envoyer les réponses »** : `onFormSubmitted(entry)` → `onCadrageFormSubmitted()` → ajoute un message utilisateur avec les réponses formatées → vague de cadrage suivante (`sendPromptTurn(..., buildPromptTranscriptText(instanceId), 'clarify')`, qui renvoie tout l'historique du fil taggé, réponses incluses) jusqu'à `===PRÊT===` ou `MAX_CADRAGE_WAVES` (5).
- **Action B — « Générer le livrable maintenant »** : `onFormSecondary(entry)` → `onForceGenerateFromCadrage(entry)` → pousse les réponses comme message utilisateur AVANT `sendPromptTurn(..., 'generate')` → `buildGenerateUserPrompt()` inclut tout le transcript (réponses comprises) + `[État actuel du projet]`.
- **Résultat attendu** : dans les deux cas, le prompt utilisateur envoyé à la génération contient les réponses de cadrage (transcript complet du fil, plus long que le prompt initial). L'IA reçoit les réponses et produit un livrable cohérent.
- **À vérifier** : remplir le formulaire de cadrage inline, cliquer « Générer le livrable maintenant » → le livrable généré reflète les réponses saisies (comparer avec/sans réponses sur un prompt de test).
- **Composants:** `form-execution-popup.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-conversation/projet-conversation.component.ts`

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

## `2-5-2-4-52` — [modification] Mode tchat : remplacé par la conversation embarquée (plus de popup)

- **Ancien comportement (retiré)** : un popup dédié `app-prompt-chat-popup` (rendu markdown, MO détectés, formulaire interactif, sessions BDD `mega_outil_prompt_chat_sessions`/`_messages` avec bannière "Reprendre"/bouton "Effacer l'historique").
- **Nouveau comportement** : cliquer "Exécuter" sur un Prompt en mode Tchat ne fait plus apparaître aucun popup — la conversation se lance directement dans l'onglet Conversation (zone 5), dans le même fil que le chat général de la section. Rendu markdown, MO détectés (checkbox + matérialisation), formulaire interactif et bouton "Copier vers l'édition" sont conservés, mais rendus en ligne dans ce fil plutôt que dans un popup. La persistance passe désormais par le fichier JSON par section existant (tagué `promptInstanceId`/`mode`) — les anciennes tables BDD `mega_outil_prompt_chat_sessions`/`_messages` (et leur bannière "Reprendre"/bouton "Effacer") ne sont plus utilisées par ce flux.
- **Détail complet et procédure de test** : voir `2-5-2-7-12` (Éditeur › Zone 5 — Conversation IA).
- **Composants:** voir `2-5-2-7-12`.

---

## `2-5-2-4-53` — [modification] Popups de lancement Prompt : remplacés (attente IA + toggle prompts déjà couverts par l'onglet Conversation)

- **Ancien comportement (retiré)** : chacun des 4 popups (Normal/Guidé/Tchat/Tchat libre) affichait son propre message d'attente "liste des IA" et son propre toggle "Utiliser les prompts de configuration".
- **Nouveau comportement** : il n'y a plus de popup ni de sélecteur IA/modèle dédié par Prompt — l'onglet Conversation a son propre sélecteur de modèle (déjà existant, `2-5-2-7-4`), utilisé tel quel pour les conversations Prompt. Le toggle "Utiliser les prompts de configuration" n'a pas été repris dans cette première version (simplification assumée : les prompts de base/méta sont toujours appliqués) — amélioration possible à ajouter ultérieurement si besoin.
- **Détail complet** : voir `2-5-2-7-12`.
- **Composants:** voir `2-5-2-7-12`.

---

## `2-5-2-4-54` — [modification] Mode "Tchat libre" : remplacé par la conversation embarquée (plus de popup)

- **Ancien comportement (retiré)** : un popup dédié `app-prompt-freechat-popup`, conversation brute sans MO ni prompts de config, sans rendu HTML.
- **Nouveau comportement** : cliquer "Exécuter" sur un Prompt en mode Tchat libre bascule vers l'onglet Conversation comme les 3 autres modes. La différence de comportement (aucun prompt de base/méta injecté, seulement le `SYSTEM:` de la fence) est conservée via `composeSystemPrompt({mode:'freechat', ...})`, qui retourne toujours `fenceSystemPrompt` seul quel que soit `useConfigPrompts`. Le rendu markdown reste actif dans la conversation (gated sur `promptInstanceId`, pas sur le mode) — contrairement à l'ancien popup qui affichait du texte brut ; seule la composition du system prompt distingue encore ce mode des 3 autres.
- **Détail complet et procédure de test** : voir `2-5-2-7-12`.
- **Composants:** voir `2-5-2-7-12`.

---

## `2-5-2-4-55` — Résilience hors-ligne du brouillon local (retry + garde de fermeture)

- **Précondition** : coupure réseau (ou requête `PUT .../draft` en échec) pendant la frappe.
- **Action** : la frappe continue normalement (le buffer Angular reste en mémoire) ; en arrière-plan, `ProjectFilesService.saveDraft()` retente automatiquement avec un backoff exponentiel (1s→2s→4s→8s→16s→30s, ~6 tentatives, jusqu'à ~1min cumulée) avant d'abandonner.
- **Résultat attendu** : tant qu'au moins un fichier reste en échec (`ProjetCollabService.unsavedSince`), une bannière discrète "Non sauvegardé depuis Xs" s'affiche (ambre à 10s, rouge à 60s) et la fermeture d'onglet est bloquée par une confirmation navigateur (`beforeunload`). Au retour de connexion (event `online`), un nouvel essai est déclenché immédiatement pour les fichiers restés en échec (`onlineRestored$` → `retryUnsavedDrafts()`), sans attendre la prochaine frappe.
- **Limite assumée (v1)** : file d'attente en mémoire seulement, pas d'IndexedDB — un refresh de page ou une fermeture forcée pendant une coupure prolongée peut perdre les frappes non retentées (le `beforeunload` réduit ce risque sans l'éliminer).
- **À vérifier** : couper le réseau (DevTools offline) pendant l'édition → bannière "Non sauvegardé" apparaît après ~10s → rétablir le réseau → la bannière disparaît sans action utilisateur (retry automatique) et sans perte de texte.
- **Composants:** `libs/portail-core/data-access/src/lib/project-files.service.ts`, `libs/portail-core/data-access/src/lib/projet-collab.service.ts`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-update-banner/projet-update-banner.component.ts`, `projet-update-banner.component.html`

---

## `2-5-2-4-56` — Checkpoint des fichiers additionnels (Prompt/Trello/Array/docs annexes) à la publication

- **Précondition** : une section contient au moins un fichier additionnel (bloc Prompt/Trello/Array ou document annexe) modifié.
- **Action** : clic sur "Enregistrer et partager" (n'importe lequel des points d'entrée : Code, cross-mode, `publishSection`, mode focus).
- **Résultat attendu** : `writeSectionStyled` checkpointe désormais aussi chaque fichier additionnel (`updateFile(..., publish:true, checkpoint:true)`) en plus du fichier principal et de son jumeau CSS. Auparavant, ces fichiers ne transitaient que par le brouillon privé (`projet_local_draft`), jamais promus en version BDD partagée (`projet_content_version`) — invisibles aux autres utilisateurs tant qu'aucune autre action ne les touchait, et absents de l'historique de versions.
- **À vérifier** : modifier le contenu d'un bloc Prompt/Trello dans une section, cliquer "Enregistrer et partager" → l'onglet Historique → "Versions de cette section" (`2-5-2-8-13`) liste désormais aussi une version pour ce fichier additionnel.
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

---

## `2-5-2-4-57` — [SYNC] Conflit live : incrustation non-bloquante de la publication d'un autre utilisateur (carte flottante)

- **Précondition** : user A édite une section (brouillon local divergent en cours, `isLocalPending`). User B publie ("Enregistrer et partager") une modification sur cette **même** section pendant que le brouillon de A est encore ouvert (donc **avant** toute tentative de sauvegarde de A — différent du conflit HTTP 409 réactif de `2-5-2-4-40`, qui ne se déclenche qu'*au moment* où A publie).
- **Action** : le SSE `content_update` de B est intercepté côté A par `ProjetIncomingChangeService` (au lieu du patch silencieux habituel) dès lors qu'un brouillon local divergent existe pour cette section. Une carte flottante ambre apparaît **sans toucher au texte de A ni à sa numérotation de lignes** : positionnée juste sous le heading en mode Code (`.ed-conflict-card`, calque `.ed-overlay`) et sous le titre de section en mode Édition/Visu (`.visu-conflict-card`), avec 3 actions : **Insérer**, **Voir le diff complet**, **Rejeter**.
- **Insérer** : fusion automatique 3-voies (`mergeThreeWay`, pivot sur la version commune "avant" — pas sur "après" comme `computeTriDiff` — pour ne jamais faire ressortir en double une ligne que A n'a pas touchée) entre le texte affiché de A, la version de B et leur ancêtre commun (`base_version_id` de la version de B, pas le `fileVersion` local de A qui peut être stale). Résultat inséré directement dans le buffer de A (splice ligne à ligne, pas de remplacement de plage naïf), save immédiat déclenché, carte résolue. Aucun appel à la route `resolve-conflict` (elle ne déclenche jamais de publish git/FTP) — le prochain "Enregistrer et partager" normal de A publie avec `baseVersionId` désormais à jour, sans 409.
- **Voir le diff complet** : réutilise l'écran de fusion manuelle existant (`<app-projet-diff>`, 3 panneaux Actuel/Version serveur/Ma version, cherry-pick ligne à ligne `←`/`→`) via une entrée synthétique — capture le texte réellement affiché à l'écran (heading inclus, frappe de A comprise) **avant** que `<app-edition-outil>` ne soit démonté par `conflictState`. "Appliquer dans l'éditeur" route vers la fusion locale (`patchFileContent` + `saveDraft`, heading retiré avant persistance), jamais vers `resolve-conflict`.
- **Rejeter** : A garde son texte tel quel (aucun contenu de B intégré), seul son `fileVersion` local est aligné sur celui de B — décision explicite plutôt qu'un écrasement silencieux, qui évite un faux conflit HTTP 409 au prochain "Enregistrer et partager".
- **Blocage à la publication** : tant que la carte n'est pas résolue (Insérer/Voir le diff/Rejeter), `writeSectionStyled` refuse de publier CE fichier (erreur `incomingConflictBlocked`, toast explicite listant les 3 actions possibles) — et si plusieurs sections sont publiées en un seul lot (`publishSectionsBatch`, ex: Structure ou cross-mode), **une seule** section en conflit non résolu bloque la publication de **tout le lot** (aucune publication partielle).
- **Découvrabilité** : `ProjetUpdateBannerComponent` distingue les conflits live (bannière ambre dédiée, bouton "Voir" qui active la section concernée) des mises à jour normales (bannière neutre existante, bouton "Mettre à jour").
- **Résultat à redouter** : carte qui reste affichée après résolution (fuite de state), heading dupliqué comme ligne de corps après Insérer/Appliquer (désalignement heading vs corps entre les 2 sources de contenu), ou perte silencieuse de la frappe de A pendant la fusion.
- **À vérifier** : 2 sessions (A et B) sur le même projet, B publie sur une section que A édite → carte visible côté A sans interruption de frappe ni décalage de lignes. Insérer → fusion correcte + save immédiat. Voir le diff → panneaux corrects, Appliquer route en local (pas d'appel réseau vers `resolve-conflict`). Rejeter → texte de A intact, publication suivante réussit sans 409. Tenter "Enregistrer et partager" sans résoudre → publication bloquée avec message explicite.
- **Composants:** `apps/projets/src/app/pages/projet-editor/services/projet-incoming-change.service.ts`, `apps/projets/src/app/pages/projet-editor/utils/compute-tri-diff.ts` (`mergeThreeWay`), `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts` (+ `.html`/`.scss`), `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`, `apps/projets/src/app/pages/projet-editor/outils/edition/edition-outil.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-update-banner/projet-update-banner.component.ts` (+ `.html`/`.scss`)

---

## `2-5-2-4-58` — [modification] Antigravity supporté sur `/execute-file-prompt` (IA sur un fichier)

- **Précondition** : provider actif = Antigravity (agy), utilisateur lance un prompt IA ciblant un fichier (ex: `ProjetAiEditService`, mention `@ia` dans une conversation Prompt).
- **Bug corrigé** : `/execute-file-prompt` (executor Electron, port 3002) bloquait systématiquement Antigravity avec une erreur `"Antigravity not supported for file prompts"`, quel que soit le prompt — la fonctionnalité IA était totalement inutilisable avec ce provider sur ce chemin.
- **Action** : la route spawn désormais `agy` directement (`resolveAgyPath()`, pas de `cmd.exe`, mêmes arguments que `/execute-prompt`). Comme `agy -p` n'écrit jamais sur stdout pour une réponse purement textuelle (seule une modification de fichier produit une sortie — cf. `2-5-2-4-45`), le prompt envoyé à agy lui demande explicitement d'écrire sa réponse complète dans un fichier relais temporaire (`os.tmpdir()`) plutôt que de répondre dans le chat ; l'executor relit ce fichier une fois le process terminé, le stream en SSE `stdout` comme pour Claude, puis le supprime. Timeout dur (`AI_EXEC_TIMEOUT_MS`, 5 min par défaut) en filet si agy hang sans jamais écrire.
- **Résultat attendu** : un prompt IA sur un fichier avec Antigravity retourne le contenu généré normalement, sans erreur, sans laisser de fichier temporaire résiduel.
- **À vérifier** : sélectionner Antigravity comme provider actif, lancer un prompt de génération de contenu sur un fichier (ex: demander un tableau) → réponse reçue normalement dans l'UI, pas de message "not supported".
- **Composants:** `electron/executor/server-executor.js`

---

## `2-5-2-4-59` — Clic droit sur une sélection → "Envoyer au prompt"

- **Précondition** : texte sélectionné dans le `textarea` du mode Code.
- **Action** : clic droit sur la sélection ouvre un menu contextuel réduit à "Envoyer au prompt" (au lieu du menu natif) — colle le texte en chip au-dessus de la saisie de la conversation et active le mode IA.
- **Détail complet et procédure de test** : voir `2-5-2-7-16`.
- **Composants:** voir `2-5-2-7-16`.
