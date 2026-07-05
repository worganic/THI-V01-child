# Éditeur › Zone 5 — Conversation IA — Fonctions métier

Composant : `ProjetConversationComponent`  
Position : panneau inférieur, onglet "Conversation"  
Contexte : lié à la section active (`activeNodeId`)

---

## `2-5-2-7-1` — Chargement de l'historique

- **Déclenchement** : changement de `sectionId` (nœud actif dans la sidebar)
- **Requête** : GET `/api/conversations/{sectionId}/history` → `{ messages: Message[] }`
- **Affichage** : messages chronologiques, bulles colorées (user = droite, IA = gauche)
- **Indicateur conversations existantes** : la sidebar affiche une bulle sur les nœuds ayant des conversations → `conversationIds Set`

---

## `2-5-2-7-2` — Envoi d'un message

- **Saisie** : input texte en bas du panel
- **Envoi** : Enter ou bouton envoyer
- **Mode normal** (pas IA) : message utilisateur enregistré, réponse attendue
- **Mode IA** (`iaMode = true` ou préfixe `@ia`) : déclenche `sendAiEdit()`
- **Streaming SSE** : réponse IA en temps réel caractère par caractère
- **Emit** : `conversationAdded` avec sectionId → sidebar met à jour `conversationIds`

---

## `2-5-2-7-3` — Toggle mode IA

- **Bouton** : `toggleIaMode()` → `iaMode.set(!iaMode())`
- **Mode IA actif** : badge coloré sur le bouton, préfixe `@ia` automatique aux messages
- **Mode IA inactif** : messages normaux (sans traitement IA)

---

## `2-5-2-7-4` — Sélection du modèle IA

- **Bouton** : `toggleModelSelect()` → affiche/masque le selecteur
- **Modèles disponibles** : `allModels = computed([...claude, ...gemini])` depuis `ConfigService`
- **Sélection** : clic sur un modèle → `selectedModel.set(model)`
- **Modèle actif** : `activeModel = selectedModel() || config.headerSelection.model`
- **Affichage** : nom du modèle actif dans le bouton

---

## `2-5-2-7-5` — Inclusion de l'historique dans le contexte IA

- **Bouton** : `toggleHistory()` → `includeHistory.set(!includeHistory())`
- **Activé** : les messages précédents de la conversation sont envoyés comme contexte à l'IA
- **Désactivé** : seul le message courant est envoyé (contexte minimal)

---

## `2-5-2-7-6` — Suggestion d'édition IA (`@ia`)

- **Envoi** : POST `/api/conversations/{sectionId}/ai-edit` avec `{ prompt, model, includeHistory }`
- **Réponse** : diff de modification du contenu de la section
- **Contexte section** : `fileContent` = contenu direct de `contenu.md` ; sous-sections ajoutées dans `systemInstructions` si présentes
- **Affichage dans la conversation** : message IA avec le diff proposé
- **Barre "Accepter/Annuler"** (via `ProjetAiEditService`) :
  - Affichée dans l'éditeur principal au-dessus de la zone de code
  - **Accepter** : `onAcceptAiEdit()` → `aiEditService.acceptEdit()` → contenu mis à jour
  - **Annuler** : `onCancelAiEdit()` → `aiEditService.rejectEdit()`
- **Diff visuel** : `ProjetAiDiffComponent` → affiche avant/après côte à côte

---

## `2-5-2-7-7` — Gestion de la section sans contenu

- **Section sans conversation** : message "Aucune conversation" + invitation à démarrer
- **Pas de sectionId** : champ désactivé, message "Sélectionnez une section"

---

## `2-5-2-7-9` — Popup informations IA du projet

- **Bouton** : icône `info` dans la barre d'outils, actif si `iaInstructions` configurées
- **Contenu** :
  - Modèle actif (valeur + label)
  - Niveau 1 — Instruction globale (doc par défaut catégorie "Instructions IA")
  - Niveau 2 — Instructions du projet (`iaInstructions`)
  - Niveau 3 — Section sélectionnée : nom + aperçu + badge "document entier" si option active
  - Niveau 4 — Rappel prompt (saisi dans la textarea ci-dessous)
  - **Options** : toggle "Inclure le document entier" + toggle "Inclure l'historique"
  - **Textarea** : saisie du prompt + bouton Envoyer (Entrée = envoi, Maj+Entrée = nouvelle ligne)
- **Même comportement** que l'input principal → appelle `sendAiEdit(message)` identique
- **Mise à jour automatique** : la section se rafraîchit à chaque changement de `sectionId` ou `files`

---

## `2-5-2-7-11` — Option "Inclure le document entier"

- **Signal** : `includeFullDocument = signal(false)`
- **Activé** : `collectAllSectionsContent(files)` récupère tout le document → injecté dans `systemInstructions` avec la mention de la section ciblée
- **Désactivé** : comportement standard (section seule + sous-sections si présentes)
- **Indicateur** : `◈ Document entier en contexte` dans la barre d'outils
- **Toggle** : disponible dans le popup IA ET via `toggleFullDocument()` (extensible)

---

## `2-5-2-7-10` — Popup prompt complet par message IA

- **Bouton** : icône `receipt_long` + label "Prompt" sous chaque réponse IA, visible uniquement pour les messages envoyés dans la session courante
- **Déclenchement** : clic → `openPromptInfo(msg.promptContext)`
- **Contenu** :
  - Modèle utilisé
  - Niveau 1 — Instruction globale (état au moment de l'envoi)
  - Niveau 2 — Instructions du projet (état au moment de l'envoi)
  - Niveau 3 — Section : nom + contenu direct + sous-sections si présentes
  - Niveau 4 — Prompt exact de l'utilisateur
- **Stockage** : `PromptContext` attaché à `Message.promptContext` (non persisté en BDD)

---

## `2-5-2-7-12` — [modification] Exécution d'un MO Prompt dans la conversation (remplace les popups)

- **Précondition** : un MO Prompt existe dans une section (mode Code ou Édition), quel que soit son mode (`MODE:` simple/guided/chat/freechat).
- **Action** : clic sur "Exécuter" du board (`PromptBoardComponent`) → `ProjetEditorZoneComponent.launchPromptInConversation(instanceId)` analyse la fence (`parsePromptFence`, inchangé) et émet `@Output() launchPromptConversation` avec un `PromptLaunchContext` (`{instanceId, instanceName, folderId, systemPrompt, userPrompt, variables, mode, currentState, startHeadingLevel, token}`).
- **Résultat attendu** : **aucun popup ne s'ouvre**, quel que soit le mode. L'événement remonte via `EditionOutilComponent` jusqu'à `ProjetEditorComponent.onLaunchPromptConversation()`, qui (1) navigue vers la section du Prompt si elle n'est pas déjà active (`activeNodeId`/`highlightNodeId`/`scrollToNodeId`, même mécanisme que `onTrelloNavigate`), (2) bascule `zone5Tab` sur `'conversation'` et déplie le panneau (`zone5Collapsed.set(false)`), (3) transmet le contexte à `ProjetConversationComponent` via `[launchPrompt]`.
- **Variables `{{var}}`** : si le prompt en contient, une carte "Variables à remplir" s'affiche **dans le fil de la conversation** (pas de popup, pas une zone séparée — elle scrolle avec le reste des messages) — un `<input>` par variable, bouton "Continuer" qui résout les `{{var}}` puis lance la conversation.
- **Un seul fil par section** : les échanges du Prompt s'ajoutent au **même** fil de conversation que le chat général/Mode IA existant (`ConversationService`, fichier JSON par section) — chaque message est tagué `promptInstanceId`/`promptInstanceName`/`mode` (champs optionnels ajoutés à `Message`, persistés par le serveur). Plusieurs Prompts dans la même section partagent donc le même fil, chacun identifiable par son tag.
- **Composition du system prompt selon le mode** (`composeSystemPrompt()`, `libs/portail-core/data-access/src/lib/prompt-system-composer.util.ts`) : Normal = base + SYSTEM: de la fence ; Tchat = base + SYSTEM: + prompt structuré tchat ; Guidé = base + SYSTEM: + méta-prompt de cadrage (phase clarify) ou de génération (phase generate) ; Tchat libre = SYSTEM: de la fence uniquement, jamais de prompt de base/méta.
- **Mode Guidé — cadrage en ligne** : la phase de cadrage (`===PRÊT===`, `parseChoiceForm`) est identique à l'ancien popup, mais rendue comme suite de messages : un message IA taggé `isCadrageForm: true` + `cadrageWave: N` déclenche l'affichage de `<app-form-execution-popup [inline]="true">` **directement dans la bulle du message IA concerné** (`@if (activeForm()?.message === msg)` à l'intérieur de la boucle `@for` des messages, pas une zone séparée en dehors du conteneur scrollable) ; la soumission ajoute un message utilisateur avec les réponses formatées et relance le cadrage (vague suivante) ou la génération (`maxWaves = 5`, ou bouton "Générer le livrable maintenant").
- **[modification] Un seul scroll pour toute la conversation** : le formulaire de cadrage/FORM et la carte "Variables à remplir" étaient initialement rendus dans un bloc à part entre la liste des messages et le composeur (`flex-shrink-0`, hors du conteneur `overflow-y-auto`) — ce bloc développait son propre ascenseur interne quand le contenu était haut (ex. formulaire à 5 questions), donnant l'impression de deux zones de défilement superposées. Corrigé : les deux sont désormais rendus **à l'intérieur** du conteneur scrollable des messages (le formulaire dans la bulle du message IA qui l'a produit, la carte variables à la suite du dernier message) — un seul ascenseur pour toute la conversation, comme une bulle normale.
- **Tous modes deviennent conversationnels** : après le premier échange, plus d'auto-fermeture (contrairement aux anciens popups Normal/Guidé) — le composeur principal reste actif ; tant qu'une conversation Prompt est active (`activePromptLaunch`), les messages tapés lui sont adressés (voir bandeau "En conversation avec « Nom » (mode)" + bouton "Terminer" qui rend le composeur au chat général/Mode IA).
- **MegaOutils détectés** : chaque réponse IA d'un message taggé `promptInstanceId` passe par `detectMoFences()` → carte "MegaOutils détectés" en ligne sous le message (checkbox + résumé), bouton "Ajouter au projet (sélection)" par message pour matérialiser tous les MO cochés d'un coup → `materializeRequested` émis vers le parent → `EditionOutilComponent.materializeFromConversation()` → `ProjetEditorZoneComponent.materializeMegaOutilsFromContent()` (inchangé : Trello/Array réels, Agenda réel, livrable inséré via `upsertPromptResultSection`).
- **[modification] Accordéon d'aperçu + ajout individuel par MegaOutil** : chaque ligne de MO (hors FORM) a un bouton accordéon (`isMoExpanded(msg, mo)`/`toggleMoExpanded()`, clé `${timestamp}::${type}::${name}`) qui affiche un aperçu en lecture seule des données qui seront ajoutées — tableau HTML pour ARRAY (`parseArrayTable()`), colonnes/cartes pour TRELLO (`parseTrelloPreview()`), liste d'événements pour AGENDA (`parseAgendaPreview()`), `<app-chart-board>` pour CHART (inchangé, ex-conditionné à `mo.selected`, maintenant à l'accordéon) — ces 3 nouveaux parsers sont des fonctions pures dans `mo-fence-parser.util.ts`, pas de dépendance BDD. Chaque ligne a aussi son propre bouton "Ajouter au projet" (`materializeSingleMo(msg, moIndex)`).
- **[modification] État "Déjà ajouté" + navigation vers la section résultat** : une fois un MO matérialisé (individuellement ou via la sélection groupée), il **reste affiché** dans la carte (au lieu d'être retiré) et son bouton devient "Déjà ajouté" (`mo.materializedSectionId`, champ optionnel sur `MaterializedMoPreview`, état de session non persisté — redevient "Ajouter au projet" au rechargement de page). `ProjetEditorZoneComponent.materializeFromConversation()` retourne désormais le `folderId` de la section "PR-Res {nom}" créée/mise à jour (recherché dans `docSections` par `folderName === promptResultLabel(nom)` après `recomputeAll()`), relayé via `EditionOutilComponent` jusqu'à `ProjetEditorComponent.onMaterializeRequested()` (devenu asynchrone) qui rappelle `conversationPanel.markMosMaterialized(messageKey, selectedMos, sectionId)` (ViewChild, identification des MO par `type+name` puisqu'ils n'ont pas d'ID stable propre). Cliquer "Déjà ajouté" émet `navigateToSectionRequested` → `ProjetEditorComponent.onNavigateToSection()` (même mécanisme que `onTrelloNavigate` : `activeNodeId`/`highlightNodeId`/`scrollToNodeId`). Le bouton groupé "Ajouter au projet (sélection)" ne s'affiche plus que s'il reste au moins un MO coché non déjà ajouté (`hasMaterializableMos()`).
- **[modification] Formulaires FORM (hors cadrage)** : en mode Tchat/Tchat libre/Normal, une fence/texte FORM détecté sur le **dernier** message IA s'affiche aussi via `<app-form-execution-popup [inline]="true">`, dans la bulle de ce message (même mécanisme que le cadrage). La soumission envoie désormais **directement** les réponses à l'IA (comme `continuePromptConversation()` : `appendPromptMessage` + `sendPromptTurn`), sans pré-remplir le composeur — la conversation Prompt reste active ("en mode IA"), condition `activePromptLaunch?.instanceId === active.message.promptInstanceId`. Si la conversation Prompt n'est plus active (ex. bouton "Terminer" cliqué entre-temps), filet de sécurité : pré-remplit le composeur comme avant pour relecture manuelle.
- **Rendu markdown** : `marked.parse()` + `DomSanitizer`, appliqué uniquement aux messages taggés `promptInstanceId` (le chat général/Mode IA reste en texte brut, hors périmètre de ce chantier).
- **[modification] Texte brut masqué par défaut quand un MO est affiché (accordéon)** : dès qu'un message IA produit un widget MO (`messageHasMoWidget(msg)` — carte "MegaOutils détectés" via `msg.mos`, ou formulaire actif via `activeForm()`), son texte markdown rendu est masqué par défaut (remplacé par « Réponse de l'IA masquée — voir le MegaOutil ci-dessous ») pour ne montrer que le MO, évitant la duplication visuelle (ex. les questions d'un formulaire non-fencé apparaissaient à la fois en texte brut ET dans le formulaire interactif). Bouton accordéon (chevron `expand_more`/`expand_less`) à côté de "Copier" bascule `isRawTextExpanded(msg)` (état par message, clé = `timestamp`) pour ré-afficher le texte complet à la demande.
- **[modification] Texte d'introduction de l'IA toujours affiché avant le MO masqué** : quand l'IA écrit du texte libre avant les questions/le MO (ex. « Voici l'analyse mise à jour de votre profil professionnel... »), ce texte n'est **pas** masqué par l'accordéon — `messageIntroText(msg)` l'extrait et l'affiche en rendu markdown au-dessus du placeholder « Réponse masquée », avant la carte MO/le formulaire. Si l'accordéon est déplié, l'intro n'est pas dupliquée (déjà incluse dans le texte complet affiché).
- **[modification] Texte libre avant/entre/après les blocs structurés, jamais perdu** : un message peut contenir, dans un ordre quelconque, un texte d'intro, des fences MO (ex. ARRAY + TRELLO d'un livrable mis à jour), une phrase de transition, puis un formulaire de suivi non-fencé — ou l'inverse. `structuredRanges(msg)` calcule les plages `[start,end)` consommées par les MO (1er au dernier fence de `msg.mos`) et par le formulaire non-fencé actif (`formCharSpanFor()`, bornes précises du 1er au dernier ligne de question/option détectée, indépendant de `parseChoiceForm` qui n'expose pas ces bornes), triées par position. `messageIntroText()` (avant la 1re plage), `messageMiddleText()` (entre les 2 plages, si les 2 types sont présents) et `messageOutroText()` (après la dernière plage) sont chacun affichés en rendu markdown à leur emplacement (au-dessus de la carte MO, entre la carte MO et le formulaire, en dessous du formulaire) quand l'accordéon "réponse brute" est replié — auparavant seule l'intro était extraite, et uniquement en confondant les deux types de plage (le texte entre les fences et le formulaire, ou après le formulaire, disparaissait entièrement, avalé par le placeholder « Réponse masquée »). `splitFormIntro()` (devenu inutile) a été retiré de `mo-fence-parser.util.ts`. Une question isolée en texte libre (non en gras) n'est jamais interprétée comme un champ de formulaire — seule la grammaire `**Label**` déclenche une coupure.
- **[modification] Fiabilité de la détection ARRAY** : l'IA produisait parfois un tableau en texte brut (colonnes alignées sans `|`, sans fences \`\`\`ARRAY:\`\`\`), non reconnu par `detectMoFences()` (regex stricte sur les fences) → affiché comme texte markdown au lieu d'un MO Tableau. Le bullet ARRAY de `DEFAULT_CHAT_STRUCTURED_PROMPT` (`server/server-data.js`) a été rendu aussi explicite que celui des questions/formulaires : exemple complet avec fence ouvrant/fermant + ligne de séparation `| --- | --- |` + consigne négative explicite. Aucun override BDD (`mega_outil_prompt_config.chat_structured_prompt`) trouvé pour ce projet — le défaut code est bien celui utilisé en pratique.
- **"Copier vers l'édition"** : bouton sur **chaque** message IA taggé `promptInstanceId` (pas seulement le dernier) → `copyToEditionRequested` → `EditionOutilComponent.insertTextIntoEdition()` → `ProjetEditorZoneComponent.insertTextIntoEdition()` (ex-`openPastePreviewForText`, devenu public) → ouvre le popup d'import existant (`pastePreview`, cf. `2-5-2-4-44`), inchangé.
- **IA/modèle** : ceux déjà sélectionnés dans l'onglet Conversation (`activeModel`/`activeProvider`, dérivé du modèle choisi) — aucun sélecteur dédié par Prompt.
- **Persistance** : sessions BDD `mega_outil_prompt_chat_sessions`/`_messages` (ancien mode Tchat) et les 4 popups **abandonnés** — remplacés intégralement par le fichier JSON par section existant, enrichi des champs `promptInstanceId`/`promptInstanceName`/`mode`/`mos`/`cadrageWave`/`isCadrageForm`. Persiste au reload (MO/cadrage redessinés depuis les données stockées).
- **À vérifier** : exécuter chacun des 4 modes → aucun popup, bascule + navigation section OK. Guidé : formulaire cadrage en ligne → matérialisation OK. Tchat : plusieurs tours, MO sur message non-dernier, matérialisation OK. Tchat libre : aucun prompt de base envoyé. Copier vers l'édition sur 2 messages différents. Rechargement de page → tout réapparaît identique. 2 Prompts dans la même section → même fil, tags distincts.
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-conversation/projet-conversation.component.ts`, `.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `.html`, `apps/projets/src/app/pages/projet-editor/outils/edition/edition-outil.component.ts`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`, `.html`, `libs/portail-core/data-access/src/lib/conversation.service.ts`, `libs/portail-core/data-access/src/lib/prompt-launch-context.model.ts`, `libs/portail-core/data-access/src/lib/prompt-system-composer.util.ts`, `libs/portail-core/data-access/src/lib/mo-fence-parser.util.ts`, `apps/projets/src/app/pages/projet-editor/components/form-execution-popup/form-execution-popup.component.ts`, `server/server-data.js`

---

## `2-5-2-7-13` — Suppression de toute la conversation d'une section

- **Précondition** : une section est active (`activeNodeId`), onglet Conversation affiché (le bouton n'apparaît pas sur l'onglet Historique).
- **Action** : bouton icône poubelle dans l'en-tête du panneau (à droite du nom/icône de la section active, `ProjetEditorComponent` template, bloc "Titre du noeud actif") → confirmation inline (Confirmer/Annuler, même pattern que la suppression d'un board) → `ProjetEditorComponent.deleteConversation()`.
- **Résultat attendu** : `ConversationService.deleteConversation(sectionId)` → `DELETE /api/conversations/:sectionId` (supprime le fichier JSON de la conversation côté serveur, s'il existe). Au succès : `ProjetConversationComponent.clearConversationLocal()` (appelé via `@ViewChild(ProjetConversationComponent) conversationPanel`) vide `messages`, réinitialise l'état de conversation Prompt active (`activePromptLaunch`, `awaitingPromptVars`, `formDismissedMessageKey`, `promptSending`, `promptStreamingText`, `inputMessage`) → affichage immédiat "Aucun message pour cette section". `sidebar.loadConversations()` rafraîchit aussi l'indicateur de conversation existante sur le nœud dans l'arborescence.
- **Portée** : supprime **tout** le fil de la section — chat général "Mode IA" ET tous les échanges MO Prompt confondus (un seul fichier par section, cf. `2-5-2-7-12`), pas de suppression sélective par Prompt.
- **À vérifier** : cliquer la poubelle → Confirmer → conversation vidée immédiatement dans l'UI ; recharger la page → toujours vide (suppression bien persistée côté serveur, pas seulement locale). Cliquer Annuler → aucune suppression, la conversation reste intacte.
- **Composants:** `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`, `.html`, `apps/projets/src/app/pages/projet-editor/components/projet-conversation/projet-conversation.component.ts`, `libs/portail-core/data-access/src/lib/conversation.service.ts`, `server/server-data.js`

---

## `2-5-2-7-8` — États

| État | Description |
|------|-------------|
| Chargement historique | Spinner |
| Conversation vide | Message d'invitation |
| Pas de section active | Input désactivé |
| Envoi en cours | Bouton désactivé, spinner |
| Streaming IA | Texte qui s'écrit progressivement |
| Mode IA actif | Badge coloré sur bouton |
| Sélecteur modèle ouvert | Dropdown visible |
| Diff IA proposé | Barre Accepter/Annuler dans l'éditeur |
| Erreur IA | Message d'erreur dans la conversation |
