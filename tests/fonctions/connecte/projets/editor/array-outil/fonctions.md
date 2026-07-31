# Éditeur › Méga-Outil Array (Tableur) — Fonctions métier

Composant : `ArrayBoardComponent` — panneau bas dans tous les modes

---

## `2-5-2-11-1` — Création d'une instance Array

- **Déclenchement** : bouton "Array" dans la barre Mega-Outils → popup
- **Nom** : champ texte modifiable (défaut "Mon Tableau")
- **Validation** : `confirmArrayPopup()` → `createInstance({ type: 'array', name, folderId })`
- **Résultat** : instance créée en BDD, `megaOutilCreated` émis vers le parent

---

## `2-5-2-11-2` — Affichage du panneau tableur

- **Visibilité** : panneau bas affiché dans les 3 modes (Code, Structure, Preview) dès qu'une instance Array est associée à la section active
- **Résolution** : `contentArrayIds` = instances dont `folderId` correspond au `activeNodeId` courant
- **Réduction** : bouton toggle `arrayPanelCollapsed`

---

## `2-5-2-11-3` — Édition des cellules

- **Sélection** : clic simple → cellule sélectionnée (outline ring vert)
- **Edition inline** : double-clic ou F2 → `<input>` inséré dans la cellule
- **Validation** : Enter (ligne suivante), Tab (colonne suivante), Shift+Tab (colonne précédente)
- **Annuler** : Escape → annule sans sauvegarder
- **Persistance** : `PATCH /api/mega-outils/array/:id/cell` → SSE `array_update` broadcasted

---

## `2-5-2-11-11` — [modification] Affichage stylisé en mode Preview

- **Déclenchement** : passage en mode Preview (visu)
- **Chargement** : `loadAllVisuArrayGrids()` charge toutes les grilles manquantes via API, puis reconstruit les sections visu
- **Rendu** : le bloc `'array` est remplacé par `<div class="visu-array-wrap">` contenant un `<table class="visu-array-table">` HTML
- **Styles inline** : `background-color`, `color`, `font-weight`, `font-style`, `text-align` appliqués depuis `cell.style` de chaque cellule
- **Formules** : `cell.computed` affiché si disponible, sinon `cell.value`
- **Réactivité** : `onArrayGridChanged` met à jour le cache et reclenche `buildVisuSections()`
- **Dark mode** : bordures adaptées via `.dark .visu-array-wrap`

---

## `2-5-2-11-4` — Formules

- **Syntaxe** : `=FUNC(range)` ou `=A1+B2`
- **Fonctions** : `SUM`, `AVG`, `COUNT`, `MAX`, `MIN`
- **Références** : `A1` → row=0, col=0 ; range `A1:C3`
- **Affichage** : valeur `computed` affichée ; formule brute visible en mode édition
- **Mode Preview** : lecture seule, résultats évalués uniquement
- **Mode construction** : taper `=` active le mode formule ; cliquer une autre cellule insère sa référence (ex: `B2`) dans l'input à la position curseur sans fermer l'édition ; les cellules référencées sont surlignées en bleu ; Enter valide et calcule le résultat
- **Ré-édition** : double-clic sur une cellule avec formule affiche la formule brute dans l'input pour modification

---

## `2-5-2-11-5` — Ajout / suppression lignes et colonnes

- **Ajouter ligne** : bouton "+ Ligne" en bas du tableau → `POST .../addRow`
- **Ajouter colonne** : bouton "+" dans l'en-tête des colonnes → `POST .../addCol`
- **Supprimer ligne** : icône ✕ à droite de chaque ligne, ou menu contextuel
- **Supprimer colonne** : menu contextuel → `DELETE .../col/:col`
- **Minimum** : 1 ligne et 1 colonne obligatoires

---

## `2-5-2-11-6` — Redimensionnement colonnes / lignes

- **Colonne** : drag handle sur le bord droit de l'en-tête → `PUT .../grid` (colWidths)
- **Ligne** : drag handle sur le bord bas du numéro de ligne → `PUT .../grid` (rowHeights)
- **Minimum** : 40px

---

## `2-5-2-11-7` — Styles de cellules, lignes et colonnes (menu contextuel)

- **Déclenchement** : clic droit sur une cellule
- **Style cellule** : Gras, Italique, Aligner gauche/centre/droite, Couleur fond, Couleur texte
- **Style ligne** : Fond ligne, Texte ligne → applique à toutes les cellules de la ligne via `PUT /grid`
- **Style colonne** : Fond colonne, Texte colonne → applique à toutes les cellules de la colonne
- **Fix** : `stopPropagation` sur le menu empêche la fermeture au clic du color picker
- **Persistance** : `style` stocké dans `cells[row][col].style` en JSON MySQL

## `2-5-2-11-10` — Copier / Couper / Coller

- **Déclenchement** : menu contextuel (clic droit) ou raccourcis clavier Ctrl+C / Ctrl+X / Ctrl+V
- **Copier** : stocke la cellule (valeur + style) dans le signal `clipboard`
- **Couper** : stocke la cellule + efface la source après collage
- **Coller** : applique la valeur et le style de la cellule copiée/coupée à la cellule sélectionnée
- **Raccourcis** : Ctrl+C/X/V uniquement quand une cellule est sélectionnée et non en édition

---

## `2-5-2-11-12` — Format code complet + sync bidirectionnelle

- **Format du bloc `'array`** : une ligne par cellule non-vide + entêtes de config
  - `cols:w1,w2,...` → largeurs de colonnes (px)
  - `rows:h1,h2,...` → hauteurs de lignes (px)
  - `A1:valeur` → cellule simple
  - `A1:=SUM(B1:B3)|bold|center|bg=#ff0000|color=#ffffff` → formule + styles
- **Propriétés style** : `bold`, `italic`, `center`, `right`, `left`, `bg=#hex`, `color=#hex`
- **Sync grille → code** : `serializeArrayGrid()` produit ce format dans `saveArrayCsvFile()`
- **Sync code → grille** : `saveAll()` appelle `syncArrayCodeToGrid()` qui détecte les changements dans le bloc `'array` et pousse via `updateArrayGrid()`
- **Dedup** : `lastArrayCodeFromGrid` empêche la boucle grille→code→grille

---

## `2-5-2-11-8` — Synchronisation avec le fichier 'array' (mode Code)

- **Déclenchement** : après chaque modification de grille (`gridChanged`)
- **Format** : Markdown table dans le bloc `'array\n...\n'` du contenu unifié
- **Fichier persisté** : `array` (sans extension) dans le dossier de la section
- **Mise à jour en mémoire** : `existingFile.content` → `docSections` → `unifiedContent` → textarea + miroir rafraîchis

---

## `2-5-2-11-9` — SSE temps réel multi-utilisateurs

- **Event** : `array_update` reçu via SSE → `arrayUpdate$` Subject → rechargement de la grille
- **Scope** : tous les collaborateurs du projet voient les modifications en live

---

## `2-5-2-11-13` — Vue propre (lecture) par défaut en mode Édition/Visu + bascule vers la grille éditable

- **Précondition** : un MO Tableau est affiché en mode Édition/Visu (aperçu standalone `previewArrayInstanceId` ou inline dans une section) — **pas** en mode Structure, qui garde la grille éditable telle quelle sans bascule (scope confirmé avec l'utilisateur).
- **Action** : `@Input() defaultCleanView` (nouveau, `false` par défaut — Structure ne le passe pas, comportement inchangé) fait démarrer `ArrayBoardComponent` en `viewMode() === 'clean'` au lieu de `'grid'`.
- **Résultat attendu** : table HTML sobre (1ère ligne = en-tête via `<thead>`, lignes suivantes en `<tbody>`, valeurs via `displayValue()` donc formules déjà évaluées) — pas de lettres de colonnes A/B/C, pas de gouttière de numéros de ligne, pas de bandeau nom/icône. Un petit bouton crayon (coin haut-droit, opacité 0.55 par défaut → 1 au survol — visible sans avoir à deviner où survoler) bascule vers la grille éditable actuelle (bandeau "🔲 Nom du tableau" + icône œil pour revenir en vue propre, lettres A/B/C, redimensionnement, "+ Ligne", tout inchangé).
- **Résultat à redouter** : bouton crayon invisible/non découvrable (bug corrigé — opacité 0 par défaut initialement, remontée à 0.55), perte de la capacité d'édition (le bouton crayon doit toujours permettre de revenir à la grille complète), ou apparition de la bascule en mode Structure (elle ne doit apparaître que si `defaultCleanView` est passé par le composant parent).
- **À vérifier** : ouvrir une section avec un MO Tableau en mode Édition → vue propre par défaut, bouton crayon visible sans survoler → cliquer → grille éditable complète (identique à l'ancien comportement) → cliquer l'icône œil → retour vue propre. Mode Structure : toujours la grille éditable, aucun bouton de bascule.
- **Composants:** `libs/shared/ui/src/lib/mega-outils/array/array-board.component.ts`, `apps/appli-projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-11-14` — [modification] Bouton "Envoyer au prompt" (vue propre)

- **Précondition** : MO Tableau affiché en vue propre (`defaultCleanView`, `2-5-2-11-13`), mode Édition.
- **Action** : 3ᵉ bouton (icône bulle, à gauche des boutons Supprimer/Afficher en mode éditable, coin haut-droit) → `ArrayBoardComponent.sendToPromptClick()` sérialise le tableau entier en table markdown (`toMarkdownTable()`, méthode d'export déjà existante — 1ère ligne = en-tête, valeurs déjà évaluées via `displayValue()`) et émet `sendToPrompt`. `ProjetEditorZoneComponent.onArraySendToPrompt()` résout la section contenant l'instance (`resolveArrayFolderId()`) et relaie via le **même circuit** que la sélection de texte (`sendSelectionToPrompt`, `2-5-2-7-16`) : le tableau est traité comme du texte simple, aucune duplication de logique.
- **Résultat attendu** : identique à "Envoyer au prompt" sur une sélection de texte — bascule sur l'onglet Conversation, active la section du tableau, colle la table markdown en chip au-dessus de la saisie, active le mode IA.
- **[modification] Instance d'origine mémorisée** : le payload emporte désormais aussi `sourceInstanceId` (l'id de l'instance Array source), propagé jusqu'au message IA (`Message.contextReplace.sourceInstanceId`) — permet à "Remplacer" (`2-5-2-11-15`) de mettre à jour cette instance précise plutôt que d'en créer une nouvelle.
- **Composants:** `libs/shared/ui/src/lib/mega-outils/array/array-board.component.ts`, `apps/appli-projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `.html` — détail complet du circuit partagé : voir `2-5-2-7-16`.

---

## `2-5-2-11-15` — "Remplacer"/"Copier" sur un MegaOutil détecté (résultat "Envoyer au prompt")

- **Précondition** : message IA résultant d'un "Envoyer au prompt" sur un tableau (`2-5-2-11-14`) ou sur une sélection de texte, dont la réponse contient un MegaOutil détecté (carte "MegaOutils détectés", `hasContextReplace(msg)` vrai — cf. `2-5-2-7-16`).
- **Action** : sur cette carte, les boutons habituels "Déjà ajouté"/"Ajouter au projet" et "Copier vers..." sont remplacés par **"Remplacer"** et **"Copier"** (`ProjetConversationComponent.replaceMoWithResult()`/`copyMoToClipboard()`) :
  - **"Remplacer"** → `ProjetEditorZoneComponent.replaceMoInSection()` : si `sourceInstanceId` connu et du même type (`array`), met à jour la grille de cette instance **en place** (`getArrayGrid()` + `deserializeArrayGrid()` + `updateArrayGrid()`, même fusion `{...base, ...partial}` que le reste du composant) — aucune nouvelle instance, aucun marqueur dupliqué, le widget affiché se rafraîchit avec les nouvelles valeurs à la même position dans le document. Sinon (type non pris en charge ou instance d'origine inconnue), matérialise ce MO comme un nouveau MegaOutil dans la section d'origine (`materializeMoIntoSection`, même comportement que "Ajouter au projet").
  - **"Copier"** → mémorise le MO dans `ProjetEditorZoneComponent.clipboard` (`{ kind: 'mo', value: mo }`) — le bouton affiche un retour visuel bref ("Copié !"). Collage ensuite via **clic droit → "Coller"** n'importe où dans l'éditeur (Code ou Édition) : `pasteClipboardClick()` détecte `clip.kind === 'mo'` et appelle `materializeMoIntoSection()` sur la section du point de clic — **jamais** d'insertion de code brut (fence `​```ARRAY...`​``` littéral) contrairement à un texte simple copié : le tableau collé est un vrai widget MO designé, avec sa propre instance BDD.
- **Résultat à redouter** : coller un MO donne du texte brut au lieu d'un widget (bug à surveiller si `pasteClipboardClick()` traite `kind: 'mo'` comme `kind: 'text'`) ; "Remplacer" crée une instance dupliquée au lieu de mettre à jour en place (si `sourceInstanceId` absent ou mal propagé depuis `2-5-2-11-14`/`2-5-2-7-16`).
- **À vérifier** : "Envoyer au prompt" sur un tableau → réponse avec MO détecté → "Remplacer" → le tableau affiché à l'endroit d'origine change de valeurs, sans doublon. "Copier" sur un MO → clic droit ailleurs (Code ou Édition, avec et sans sélection) → "Coller" → un vrai tableau (widget, boutons Supprimer/Modifier) apparaît, pas du texte `​```ARRAY...` brut.
- **Composants:** `apps/appli-projets/src/app/pages/projet-editor/components/projet-conversation/projet-conversation.component.ts`, `.html`, `apps/appli-projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `.html`, `apps/appli-projets/src/app/pages/projet-editor/outils/edition/edition-outil.component.ts`, `apps/appli-projets/src/app/pages/projet-editor/projet-editor.component.ts`, `.html`
