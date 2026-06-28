# Éditeur › Toolbar — Fonctions métier

<!-- worganic:meta updatedAt="2026-06-21T20:01:59.106Z" updatedBy="Antigravity CLI (agy) / Gemini 3 Pro" -->

---

## `2-5-2-3-1` — Navigation

- Retour : clic sur le bouton de retour de la toolbar appelle goBack() et navigue vers l'historique précédent via Location.back
- Retour Portail : le mini-header supérieur (worg-mini-header) fournit un lien retour direct vers le portail (environment.portailUrl)
- Home : clic sur le logo (icône rocket) redirige vers la route /home du portail
- Projets : clic sur le lien "Projets" dans le fil d'Ariane redirige vers la route /projets
- Breadcrumb : affichage du fil d'Ariane "Projets > {nom projet}" avec le nom du projet non éditable dans la toolbar
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-toolbar/projet-toolbar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-toolbar/projet-toolbar.component.html`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.html`

---

## `2-5-2-3-2` — Indicateurs de statut de sauvegarde

- Statut "Sauvegardé" (idle/saved) : badge vert avec icône check_circle affiché en bas de l'éditeur
- Statut "Non sauvegardé" (dirty) : badge orange cliquable avec icône save affiché en bas de l'éditeur
- Statut "Sauvegarde…" (saving) : message jaune avec icône animate-spin progress_activity affiché en bas de l'éditeur
- Statut "Erreur" (error) : message rouge avec icône error affiché en bas de l'éditeur
- Clic sur "Non sauvegardé" : déclenche forceSave() qui déplie les sections (unfoldAll()) et effectue une sauvegarde immédiate (saveAll())
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-3` — Badges de backup et état de synchronisation

- Backup FTP - Inactif (idle) : affichage du badge cyan simple "FTP" en bas de l'éditeur
- Backup FTP - En cours (syncing) : affichage du badge bleu animé "Sync FTP X/Y" avec progression en pourcentage et spinner tournant
- Backup FTP - Terminé (done) : affichage du badge cyan "FTP à jour" avec icône dns
- Backup FTP - Erreur (error) : affichage du badge rouge "FTP — erreur sync" avec icône dns
- Backup GitHub : affichage du badge violet "GitHub" avec icône code si configuré
- Backup GitLab : affichage du badge orange "GitLab" avec icône merge si configuré
- Backup Google Drive : affichage du badge vert "Drive" avec icône add_to_drive si configuré
- Aucun backup : pas de badge affiché
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-4` — [modification] Onglets de mode d'édition

- Mode Code : clic sur l'onglet "Code" (<> Code) passe au mode 'edit' affichant la zone textarea Markdown
- Mode Structure : clic sur l'onglet "Structure" (arborescence) passe au mode 'structure' affichant la structure hiérarchique
- Mode Edition : clic sur l'onglet "Edition" (mode WYSIWYG) passe au mode 'visu' affichant le contenu HTML éditable en ligne
- Onglet actif : l'onglet correspondant au mode courant est mis en surbrillance avec la classe ed-mode-tab--active
- Toggle de vue (Mode Code) : bouton "Markdown propre / Avec style" à droite de la barre d'onglets permet de basculer la vue et d'activer showCssInCode()
- Bascule externe : l'Input `modeRequest` ({ mode, token }) déclenche `setMode` sans clic (ex: agenda « Ouvrir la séance » → mode Edition). Le token force le re-déclenchement même mode identique.
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-5` — Barre de formatage (mode Code, vue stylisée)

- Affichage conditionnel : la barre de formatage est visible uniquement en mode Code lorsque showCssInCode() est activé
- Style de base : boutons Gras (**texte**), Italique (*texte*), Souligné (<u>texte</u>), Barré (~~texte~~) insèrent les marqueurs correspondants au curseur
- Menu Titres : menu déroulant permet d'insérer un paragraphe ou des titres de niveau H1 à H4 (\n# à \n####)
- Listes et blockquote : boutons insèrent les marqueurs de liste à puces (-), liste ordonnée (1.), cases à cocher (- [ ]), citation (>), ou bloc de code ()
- Lien et Image : boutons insèrent un lien markdown via popup codeLink() et ouvrent le téléversement d'image via triggerImageUpload()
- Mise en forme HTML : boutons insèrent les balises HTML d'alignement style="text-align:...", de taille style="font-size:...", de couleur style="color:..." ou surlignage style="background:..."
- Effacer la mise en forme : bouton codeClearFormat() nettoie les marqueurs Markdown/HTML de la sélection
- Extras Code (droite) : boutons pour insérer un bloc de code vide, un tableau markdown 2x2, ou un séparateur horizontal (---)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-11` — Ouverture du dossier local de section

- Visibilité : bouton "Dossier" visible dans tous les modes à droite de la barre d'onglets de l'éditeur
- Clic bouton : appelle openSectionFolder() qui identifie la section active (ou ancre courante) et appelle le service ProjectFilesService
- Requête API : envoi d'une requête POST /api/file-projects/:name/open-folder avec le folderId résolu par safeProjectPath
- Ouverture OS : le serveur ouvre le dossier dans l'explorateur natif (explorer.exe / open / xdg-open)
- Gestion d'erreur : retour du code HTTP 404 avec message d'erreur si la section n'est pas clonée localement
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `libs/portail-core/data-access/src/lib/project-files.service.ts`, `server/server-data.js`

---

## `2-5-2-3-6` — Bandeau de modifications en attente (Collaboration)

- Modifications Code (mode Code) : si showCodePublishBar ou showCrossModePendingBar est vrai, affiche une alerte statique signalant les modifications en cours sans bouton d'action
- Modifications Structure (mode Structure) : si structureHasPending() est vrai, affiche une alerte avec les boutons "Annuler" et "Partager mes modifications"
- Clic Annuler Structure : restaure l'état structurel précédent via cancelStructureEdit()
- Clic Partager Structure : publie les changements de structure au serveur via publishStructureEdit() et broadcast SSE
- Mode Preview : aucun bandeau n'est affiché (les actions d'annulation ou de partage de modifications de preview sont déportées sur la sidebar)
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-7` — Indicateurs d'état et surcouches visuelles

- Surbrillance mode actif : onglet correspondant surligné en haut
- Indicateurs de sauvegarde en bas de page : badge vert (Saved), badge orange (Dirty), badge jaune avec spinner (Saving), rouge (Error)
- Indicateurs FTP en bas de page : bleu animé (Syncing), cyan (Done), rouge (Error), cyan simple (Idle)
- Bandeau pending : fond bleu/violet pour modifications locales en attente en bas de l'éditeur
- Overlay de publication : écran de blocage flou avec spinner jaune progress_activity lors de la publication/téléversement d'image
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-8` — [modification] Barre Mega-outils

- Onglets de types de Mega-outils : affichage de quatre boutons interactifs pour Trello (bleu), Mockup (violet), Tableau (lime, qui correspond à Array) et Prompt (amber)
- Compteur d'instances : affiche le nombre **total** d'instances du projet pour chaque type (Trello, Array, Mockup et Prompt) — même comportement pour tous, le compteur Prompt utilise `promptInstances` (toutes), cohérent avec la sidebar
- Liste d'instances : cliquer sur un type de Mega-outil affiche horizontalement la liste scrollable de **toutes** les instances de ce type (y compris Prompt)
- Sélection d'instance : clic sur une instance de Mega-outil émet megaOutilSelect et navigue vers la section ou fichier où elle est intégrée (trelloNavigate)
- Clic "Nouveau" : ouvre la popup de création pour le type d'outil sélectionné (Trello, Tableau, Mockup ou Prompt)
- Clic "Liaison" (Mockup uniquement) : ouvre la popup permettant d'associer un Mockup existant à la section courante
- Interrupteur "Sync auto" (Trello uniquement) : active/désactive la synchronisation automatique des cartes de colonne Trello dans le code markdown
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-9` — Menus déroulants de la barre de formatage (mode Preview)

- Style de bloc : menu déroulant (icône title) propose Paragraphe (applyVisuFormat avec formatBlock et P) et les titres H1 à H4
- Couleur de texte : menu déroulant Swatch (lettre A soulignée) propose la palette de couleurs pastilles (foreColor)
- Surlignage : menu déroulant Swatch (icône highlighter) propose la palette de couleurs de fond pastilles (hiliteColor)
- Comportement d'ouverture/fermeture : ouverture via mousedown avec preventDefault pour conserver la sélection de texte courante, fermeture au clic extérieur
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-10` — Création de section au point de coupe du curseur

- Déclenchement : en mode Preview (Edition), sélectionner H1 à H4 dans le style de bloc ou via slash command ouvre le dialogue de création de titre
- Calcul du point de coupe : computeVisuCursorInsertLine() identifie le bloc sous le curseur et calcule la ligne d'insertion exacte dans le contenu direct
- Dialogue worg-title-create-dialog : affiche le titre prérempli (texte sélectionné) et le parent de section calculé selon la hiérarchie du niveau
- Insertion : confirmation du dialogue appelle createTitleSection() qui insère un heading markdown avec le niveau (ex: ### Titre) à la ligne d'insertion
- Réorganisation parent : le parent exécute processSectionsChange, crée le dossier physique, réorganise l'ordre et re-parente les sous-sections
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-12` — [modification] Création de Mega-outil via popup

- Nouveau Trello : clic sur "Nouveau" en mode Trello ouvre showTrelloPopup, saisie du nom, création et insertion du marqueur [trello:nom]
- Nouveau Tableau (Array) : clic sur "Nouveau" en mode Tableau ouvre showArrayPopup, saisie du nom, création et insertion du marqueur de tableau
- Nouveau Mockup : clic sur "Nouveau" en mode Mockup ouvre showMockupPopup, validation du nom unique, création et insertion du marqueur {{MOCKUP:id}}
- Nouveau Prompt : clic sur "Nouveau" en mode Prompt (uniquement en mode Code) ouvre showPromptPopup, saisie du nom, création du fichier prompt-NOM.md et insertion du bloc ```PROMPT: NOM```
- Unicité du nom Prompt : un nom déjà utilisé par un autre Prompt du projet (comparaison slugifiée, `promptNameExists`) est refusé → message « Ce nom de Prompt existe déjà » (promptNameError) sous le champ, pas de création ; l'erreur se réinitialise à la saisie
- Liaison Mockup : clic sur "Liaison" ouvre la popup de sélection des mockups du projet, clic sur un mockup existant insère sa liaison
- Validation des formulaires : vérification de la non-vacuité du nom et gestion d'erreurs d'unicité (ex: mockupNameError, promptNameError)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-13` — Import et insertion de fichiers d'images

- Déclenchement : clic sur le bouton image de la barre de formatage appelle triggerImageUpload(), mémorisant le dossier actif et activant l'input file caché
- Validation fichier : vérification du format (jpeg, png, gif, webp, svg, bmp) et de la taille maximale autorisée (1 Mo) avec message imageUploadError si invalide
- Import serveur : envoi du fichier au serveur via le service uploadImage et ajout du nœud d'image à allImages
- Insertion automatique : insère le marqueur {{IMG:nodeId}} à l'emplacement du curseur dans le document unifié
- Historique & sauvegarde : enregistrement de l'action dans l'historique d'annulation (woHistory.track), exécution immédiate de saveAll() et passage en état localDirty = true
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

---

## `2-5-2-3-14` — Sécurité FTP - Avertissement de désynchronisation

- Condition : si isActiveSectionUnsynced est vrai (la section active est en cours de synchronisation avec le serveur FTP distant)
- Affichage : affiche une bannière d'information bleue en haut de la zone d'édition "Synchronisation FTP en cours — lecture seule jusqu'à la mise à jour"
- Blocage de saisie : les zones d'éditions du corps de section et les boutons d'action d'édition/formatage sont verrouillés
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-15` — Menu contextuel et modification des liens hypertextes (mode Preview)

- Détection : le focus ou le clic sur un lien hypertexte dans une section éditable en mode Preview ouvre le menu flottant visuLinkMenu
- Actions du menu : propose de suivre le lien dans un nouvel onglet, de modifier le lien, ou de le supprimer
- Popup d'édition : modifier le lien ouvre showLinkEditPopup, permet de saisir la nouvelle URL et met à jour l'attribut href du lien sur validation
- Suppression de lien : l'action supprimer retire la balise lien <a> tout en conservant son contenu textuel brut
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-16` — Raccourcis clavier par commande Slash (mode Preview)

- Détection de saisie : en mode Preview, taper le caractère "/" dans un élément de texte éditable déclenche detectVisuSlash()
- Menu de suggestions : affiche à la position du curseur le menu d'insertion flottant worg-slash-command-menu
- Filtrage de commandes : la liste des commandes suggérées est dynamiquement filtrée selon la saisie de l'utilisateur (visuSlash.query)
- Sélection au clavier : flèches Haut/Bas pour naviguer entre les commandes, Échap pour fermer, Entrée pour valider
- Insertion et nettoyage : la validation supprime automatiquement le "/" saisi et insère le bloc ou le formatage correspondant (ex: note info, tableau 2x2, mockup, trello, citation)
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/slash-command-menu/slash-command-menu.component.ts`

---

## `2-5-2-3-17` — [modification] Mega-outil Prompt : affichage et exécution

- Affichage mode Code : le bloc ` ```PROMPT: NOM ` est affiché en texte brut ; la ligne d'ouverture est colorée en amber
- Affichage mode Edition : `app-prompt-board` est rendu inline avec header amber, system prompt collapsable, user prompt avec variables `{{x}}` colorées et bouton ▶ Exécuter ; le texte brut du bloc est supprimé du rendu HTML (strip regex PROMPT dans buildVisuSectionHtml)
- Affichage au focus du fichier prompt-NOM (Édition) : cliquer le fichier « PR: NOM » dans le menu affiche le board via `previewPromptInstanceId` (comme Array/Trello avec `previewArrayInstanceId`/`previewTrelloInstanceId`) ; le fichier prompt-NOM est exclu de `singleFileVisuPreview` pour ne pas être rendu en markdown brut
- Affichage mode Structure : panneau bas amber listant les instances de prompt de la section en lecture seule
- Popup d'exécution : sélecteur IA à gauche (Claude / AGY (Gemini)) + modèles filtrés à droite ; affichage du prompt de base global (collapsable, badge "global") + system prompt de la section
- Variables `{{x}}` : si le prompt contient des variables, l'état variable-fill affiche un formulaire de substitution avant l'envoi
- Streaming : exécution via `GET /api/mega-outils/prompt/execute-stream` (EventSource SSE) ; tous les providers passent par l'executor local port 3002 ; AGY utilise un fichier de sortie pollé toutes les 1500ms (agy ne streame pas sur stdout Windows) ; événements nommés : ai-log {stream, text}, ai-error, complete, run-failed ; journal de log coloré par type (stderr rouge, info amber, stdout gris)
- Insertion : état validating propose "Insérer" (place le résultat dans une section markdown « Pr - NomPrompt » via `upsertPromptResultSection`), "Copier" et "Re-exécuter" ; les `>` en début de ligne sont retirés
- Section résultat : nommée `Pr - NomPrompt` au MÊME niveau hiérarchique que la section du prompt (section sœur, insérée juste après la fin de la section parente) ; date d'exécution en italique `_Exécuté le JJ/MM/AAAA à HH:MM_` insérée juste après le heading ; les titres du livrable sont décalés (`demoteHeadings`, min level = sectionLevel+1) ; une nouvelle exécution remplace la section précédente (idempotent, migre aussi les anciens résultats en sous-section) ; la section résultat reçoit automatiquement un `{{SID:id}}` stable lors du premier rechargement et devient un vrai dossier de l'arborescence ; le regex de détection accepte le suffixe `{{SID:...}}`
- Suppression : bouton corbeille dans l'en-tête de l'ancien bloc « Résultat IA » (résultats stockés en fence `===RÉSULTAT===`) → `clearPromptResult` ; les nouveaux résultats sont en section et se suppriment via `deletePromptResult` (cascade MO+agenda)
- Historique : chaque exécution est enregistrée en base (table mega_outil_prompt_history) et visible dans PromptAdminComponent
- Prompt de base global : configurable dans Admin › Mega-outils › Prompt ; stocké en BDD (table mega_outil_prompt_config) ; combiné avec le system prompt de section à l'exécution
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/prompt-execution-popup/prompt-execution-popup.component.ts`, `libs/shared/ui/src/lib/mega-outils/prompt/prompt-board.component.ts`, `apps/projets/src/app/pages/projet-editor/services/projet-prompt-execute.service.ts`, `libs/shared/ui/src/lib/mega-outils/prompt/prompt-admin.component.ts`, `server/server-data.js`

---

## `2-5-2-3-18` — [modification] Mega-outil Form : formulaires interactifs

- Fence ` ```FORM: Nom du formulaire ` dans le markdown ; syntaxe : `* **Question :**` pour les groupes, `  * [ ] Option` pour les cases à cocher (checkbox), `  * ( ) Option` pour les boutons radio, `______` dans le texte d'une option pour un champ texte conditionnel
- Affichage mode Code : bloc brut ; les réponses sont visibles en dessous avec le marqueur `===RÉPONSES===`
- Affichage mode Edition : `app-form-board` avec header bleu, preview des questions en lecture seule (icônes checkbox/radio), bouton "Remplir", compteur de réponses et section stats (barre de progression par option) si au moins une réponse
- Popup d'exécution : `app-form-execution-popup` avec les vraies cases à cocher / boutons radio ; champ texte conditionnel affiché sous l'option cochée si `hasDetail` ; bouton "Envoyer" désactivé tant qu'aucune réponse
- Stockage : réponses enregistrées à l'intérieur du fence avec marqueur `===RÉPONSES===`, chaque entrée délimitée par `---` au format `date | utilisateur` + lignes `Question : réponse(s)` (multi-sélection séparée par ` ; `)
- Création : popup "Nouveau Formulaire" via le bouton "Nouveau" de la barre MO (type actif = form) ; insère un fence FORM avec deux options placeholder
- Auto-détection : tout bloc de formulaire en markdown brut (question `* **…:**` suivie d'options `[ ]`/`( )`, hors fence) est automatiquement encadré dans une balise ` ```FORM: Formulaire N ` à l'entrée du mode Edition (`autoConvertRawForms`), le rendant interactif sans action ; idempotent (un bloc déjà encadré n'est pas re-détecté)
- Rendu basé sur la balise : les forms sont détectés via le marqueur ` ```FORM: NOM ` dans le texte de la section (pas via une instance DB), ce qui permet de rendre aussi les formulaires auto-convertis ; `docSections.textContent` est synchronisé depuis `unifiedContent` (`syncDocSectionsTextFromContent`) pour un affichage immédiat sans attendre la sauvegarde
- Stats : pour chaque option, comptage du nombre de sélections parmi toutes les réponses avec barre de progression proportionnelle ; les options à champ libre (`______`) sont matchées sur le préfixe avant le champ
- **Priorité:** important
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/form-execution-popup/form-execution-popup.component.ts`, `libs/shared/ui/src/lib/mega-outils/form/form-board.component.ts`, `libs/portail-core/data-access/src/lib/mega-outils.models.ts`

---

## `2-5-2-3-19` — [modification] Mega-outil Prompt : Mode guidé (workflow IA cadrage → formulaire → MegaOutils adaptatifs)

- Activation : case « Mode guidé » à la création d'un Prompt → insère `MODE: guided` dans le fence ; détecté par `parsePromptFence` (champ `mode`)
- Bascule sur card : chip « Mode guidé » / badge « Guidé » cliquable sur la card prompt-board (output `toggleGuided`) → `setPromptGuided` ajoute/retire la ligne `MODE: guided` dans le fence ; permet de convertir un prompt existant sans le recréer
- Lancement : bouton « Exécuter » d'un prompt guidé ouvre `PromptWorkflowPopupComponent` (au lieu de la popup d'exécution simple) ; charge les 3 prompts globaux (base + cadrage + génération) via `getPromptGlobalConfig`
- Phase cadrage : l'IA reçoit le méta-prompt de cadrage (system) + la demande (user) et répond par un formulaire Markdown ; parsé en questions, affiché via `app-form-execution-popup` réutilisé (bouton secondaire « Générer le livrable maintenant »)
- Réponse sans formulaire : si la réponse de cadrage ne contient PAS de formulaire exploitable (et pas de `===PRÊT===`), ce n'est PAS une erreur → le workflow enchaîne directement sur la génération du livrable (`startGenerate`). Le mode guidé fonctionne donc avec ET sans formulaire. L'état `error` n'est plus déclenché par l'absence de formulaire, uniquement par un échec d'exécution/connexion (message générique « Une erreur est survenue pendant l'exécution. »)
- Plusieurs vagues : après chaque envoi de réponses, une nouvelle vague de cadrage est lancée ; l'IA peut répondre `===PRÊT===` pour passer à la génération, ou l'utilisateur force la génération ; limite `maxWaves` (défaut 5)
- Phase génération : méta-prompt de génération (system) + demande + transcript des réponses (user) → livrable Markdown contenant des fences MegaOutils (TRELLO/ARRAY/FORM/CHART/AGENDA)
- Aperçu + validation : détection des fences MO du livrable (`detectMos`) avec résumé (cartes / lignes×colonnes / questions / événements) et cases à cocher ; icônes distinctes par type (kanban / tableau / formulaire / graphique / calendrier) ; bouton « Insérer dans la section »
- Matérialisation : `materializeMegaOutilsFromContent` place le livrable dans une section « Résultat du prompt » via `upsertPromptResultSection`, crée Trello (cartes BDD) et Array (grille BDD) ; Form/Chart = rendu par balise ; AGENDA = vrais événements créés via `AgendaOutilService.createEvent` puis fence remplacé par liste Markdown lisible
- Ré-exécution adaptative : à la relance d'un prompt guidé, `buildTrainingStateContext(folderId)` assemble l'état courant du dossier (réponses des formulaires + tableaux de suivi avec données) et l'injecte comme `[État actuel du projet]` dans `buildGenerateUser()` ; l'IA adapte le plan au lieu de repartir de zéro
- Projets dans le temps — TYPE A (formation/apprentissage) : cadrage demande durée/fréquence/évaluation/priorités ; génération produit planning (Array), agenda (AGENDA), exercices par thème (Form), suivi des notes (Array + formules =AVG), progression (CHART live)
- Projets dans le temps — TYPE B (opérationnel : business plan, immobilier, création…) : cadrage demande jalons/contraintes/KPIs ; génération produit planning adapté (Array colonnes contextuelles), jalons agenda (AGENDA), suivi de KPIs ou budget (Array), Trello d'avancement, formulaires de validation ; NE génère PAS d'exercices ni de suivi des notes
- Réinitialisation des méta-prompts : bouton « Réinitialiser » dans Admin › Mega-outils › Prompt → appel `DELETE /api/mega-outils/prompt/config/workflow` supprime la surcharge BDD et recharge les defaults serveur dans les textareas
- Persistance : le cadrage (transcript des réponses) est archivé en tête de la section « Résultat du prompt » sous un bloc **Cadrage** ; le brut reste visible en mode Code
- Config : méta-prompts cadrage + génération stockés en BDD (`mega_outil_prompt_config` clés `workflow_clarify_prompt` / `workflow_generate_prompt`), éditables dans Admin › Mega-outils › Prompt ; valeurs par défaut servies par le serveur si absentes
- Suppression cascade du résultat : bouton « Supprimer le résultat » (icône `delete_sweep`) affiché sous la carte prompt en mode Edition quand une section « Résultat du prompt » existe (`getPromptResultSectionText`) ; confirmation requise ; `deletePromptResult` supprime en cascade : instances Trello/Array dont le nom est dans la section, événements agenda matchant les lignes `- **date** — Titre`, puis retire la section du markdown
- **Priorité:** important
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/prompt-workflow-popup/prompt-workflow-popup.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/form-execution-popup/form-execution-popup.component.ts`, `libs/shared/ui/src/lib/mega-outils/prompt/prompt-board.component.ts`, `libs/shared/ui/src/lib/mega-outils/prompt/prompt-admin.component.ts`, `libs/portail-core/data-access/src/lib/mega-outils.service.ts`, `libs/portail-core/data-access/src/lib/mega-outils.models.ts`, `server/server-data.js`

---

## `2-5-2-3-20` — [modification] Mega-outil Chart : graphique de progression

- Fence ` ```CHART: Titre du graphique ` dans le markdown
- Mode source live : `source: Nom du tableau | col: Nom de la colonne` → résout les valeurs depuis la grille d'un tableau ARRAY du même dossier ; se met à jour automatiquement quand l'utilisateur saisit des données
- Mode inline : lignes `Label: valeur` pour des données statiques
- Affichage mode Code : bloc brut avec les paramètres
- Affichage mode Edition : `app-chart-board` avec SVG line chart (courbe + points + aire remplie + grille), axe Y auto-calibré (5 graduations), labels axe X, stats min/max/dernière valeur en header
- Strip HTML : le fence est retiré du rendu HTML brut (`buildVisuSectionHtml`) comme les autres MO ; rendu par composant Angular
- Matérialisation depuis workflow guidé : CHART n'a pas d'instance DB, laissé en fence ; les données vives sont lues depuis `visuArrayGrids`
- **Priorité:** important
- **Composants:** `libs/shared/ui/src/lib/mega-outils/chart/chart-board.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `libs/portail-core/data-access/src/lib/mega-outils.models.ts`, `libs/shared/ui/src/index.ts`

---

## `2-5-2-3-21` — [modification] Mega-outil Agenda : événements calendrier depuis le workflow guidé

- Fence ` ```AGENDA: Nom ` dans le livrable généré par le workflow guidé ; format des lignes : `YYYY-MM-DD | HH:MM-HH:MM | Titre | Description optionnelle`
- Matérialisation : `materializeAgendaFence` parse les lignes, crée de vrais événements via `AgendaOutilService.createEvent` avec `groupId` (UUID unique par fence) et `groupName` (nom du prompt) ; déduplication par titre+startDate ; erreurs silencieuses par événement
- Remplacement de la fence : après création, remplacé par un commentaire HTML `<!-- agenda-group:UUID agenda-name:NomPrompt -->` suivi d'une liste lisible `- **YYYY-MM-DD HH:MM–HH:MM** — Titre`
- Groupes dans l'agenda : les événements d'une même fence partagent le même `groupId` ; la popup affiche la section « Famille » (nom du prompt, compteur, navigation précédent/suivant, suppression de tous les événements liés via `DELETE /agenda/group/:groupId`)
- Indicateur visuel : icône 🔗 `link` en vue semaine sur les événements appartenant à un groupe
- Suppression cascade améliorée : `deletePromptResult` extrait le `groupId` du commentaire HTML et appelle `deleteEventGroup` ; fallback titre+date pour anciens événements sans groupId
- Lien séance (cours vivant) : un événement dont le titre commence par « Séance » (`isSeanceEvent`) affiche un bouton « Ouvrir la séance » dans sa popup ; émet `navigateToSection` ; le parent `onAgendaNavigateToSection` retrouve le dossier par titre (`findFolderByTitleLike`, match exact/préfixe puis par numéro de séance), bascule sur l'outil propriétaire et scrolle vers la section
- **Priorité:** important
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/outils/agenda/agenda-outil.component.ts`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.html`, `libs/portail-core/data-access/src/lib/agenda-outil.service.ts`, `libs/portail-core/data-access/src/lib/agenda-outil.models.ts`, `server/server-data.js`

---

## `2-5-2-3-22` — [modification] Cours vivant : structure Bilan général + séances datées

- Déclenchement : workflow guidé d'un prompt Type A (formation/apprentissage) ; piloté par le méta-prompt de génération serveur (`DEFAULT_WORKFLOW_GENERATE_PROMPT`)
- Section pilotage : le livrable contient en premier un titre `## 📊 Bilan général et suivi du cours` regroupant Planning (ARRAY), Agenda (AGENDA), Suivi des notes (ARRAY colonnes Séance|Date|Note|Max|%|Moyenne, Note/% laissées vides), Progression (CHART source: Suivi des notes)
- Sections séances : un titre `## Séance N — YYYY-MM-DD : Thème` par séance (devient un dossier navigable), contenant le cours et un `FORM: QCM Séance N`
- Règle de liaison : le titre de chaque séance est identique au titre de son événement agenda (permet le lien agenda → séance)
- Séparation stricte : les MO de pilotage vont uniquement dans le Bilan, le QCM uniquement dans sa séance
- **Priorité:** important
- **Composants:** `server/server-data.js`

---

## `2-5-2-3-23` — [modification] Correction automatique des QCM par l'IA (cours vivant)

- Déclenchement : à la soumission d'un formulaire dont le nom contient « QCM » (`onFormSubmit` → `maybeAutoCorrectQcm`), si un tableau « Suivi des notes » existe dans le projet (signale un cours vivant)
- Exécution IA one-shot : `AiExecuteService.executeOnce` ouvre une EventSource indépendante du flux streamé partagé et résout le texte complet (n'interfère pas avec les popups) ; provider/modèle pris dans `cliConfig().headerSelection`
- Prompt de correction : système demande un format strict `===NOTE=== n/m` + `===CORRECTION===` (markdown sans fence) ; user = questions + options + réponses de l'élève
- Insertion correction : `insertQcmCorrectionIntoSeance` place un bloc « 📝 Correction IA » (note + détail) sous le QCM dans le dossier de la séance, encadré par des marqueurs HTML `<!-- qcm-correction:NOM -->` (idempotent : remplace une correction précédente)
- Mise à jour des notes : `updateNotesRowForQcm` remplit la ligne du tableau « Suivi des notes » correspondant à la séance (match par numéro de séance, sinon 1re ligne sans note) ; colonnes Note/Max remplies ; `updateArrayGrid` + sync inline + `recomputeAll` → le CHART de progression se met à jour automatiquement
- Indicateur visuel : badge « Correction IA en cours… » sous le formulaire pendant le traitement (`qcmCorrecting`)
- **Priorité:** important
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `libs/portail-core/data-access/src/lib/ai-execute.service.ts`, `server/server-data.js`

---

## `2-5-2-3-24` — [modification] Mega-outil Prompt : stabilité d'identité et déplacement (parité Trello/Array)

- Identité par nom : un Prompt est identifié par le nom de sa fence ` ```PROMPT: NOM ` (→ fichier physique `prompt-NOM`), comme Trello (` ```TRELLO: NOM `) et Array (` ```ARRAY: NOM `)
- Résolution de section : `resolvePromptFolderId` déduit la section réelle d'un Prompt depuis la position de son bloc dans `docSections` (fallback `inst.folderId`)
- Déplacement = déplacement (pas copie) : `recomputePromptSections` (appelé depuis `recomputeContentPromptIds`) met à jour `folderId` de l'instance et persiste via `updateInstance` quand le bloc change de section → le board ne reste pas dupliqué dans la section d'origine
- Le fichier lié suit le bloc : `healPromptSectionOnOpen` détecte un bloc ` ```PROMPT: NOM ` présent sans fichier `prompt-NOM` dans le dossier ouvert et force une ré-extraction (save) pour recréer le fichier à la bonne place
- Anti-doublon : `cleanupOrphanPromptInstances` supprime au chargement toute instance Prompt sans bloc ni fichier correspondant (scan `files` + contenu) → plus d'instances fantômes qui gonflent le compteur
- Backfill : `ensurePromptInstancesFromContent` crée au chargement une instance DB pour tout bloc ` ```PROMPT: NOM ` (ou fichier `prompt-NOM` hérité) sans instance → garantit instances ↔ fichiers 1:1
- Compteur cohérent : toutes les vues (badge barre MO, liste d'instances scrollable, vue « Liste des prompts ») s'appuient sur `promptInstances` (toutes les instances du projet, comme Trello/Array) → même nombre de PR partout, identique à la sidebar, stable après navigation/rechargement
- Nom de section dans la liste : `recomputePromptSections` alimente la map `promptSections()` (folderId + nom du dossier) ; la carte de la « Liste des prompts » affiche le vrai nom de section et navigue via `goToPromptSection`
- Navigation depuis la barre MO : `selectMegaOutil` gère le type prompt (focus du fichier `prompt-NOM` en mode Code via `findPromptFileNode`, sinon la section)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

---

## `2-5-2-3-25` — [modification] Identité unique des MO par marqueur `{{MOID:id}}`

- Marqueur d'identité : chaque fence MO porte l'ID unique de son instance en fin d'en-tête (` ```ARRAY: Nom {{MOID:uuid}} `), calqué sur `{{SID:folderId}}` des sections. Visible en Code brut, masqué en Structure/Édition (le bloc y est rendu en board, pas en texte). Périmètre : Trello, Array, Prompt
- Helpers centralisés : `splitFenceHeader` (nom/MOID), `composeFenceHeader`, `stripMoidMarkers`, `findFenceOpenLine` (résolution MOID-first, fallback nom legacy), `fenceHasInstance`, `removeFenceForInstance`
- Injection à la création : `confirmTrelloPopup`/`confirmArrayPopup`/`confirmPromptPopup` et `createMoInVisuSection` insèrent ` {{MOID:inst.id}} ` dans l'en-tête
- Migration au chargement : `injectMoidIntoLegacyFences` ajoute le MOID aux fences héritées (liaison à l'instance la plus ancienne de même type+nom), un seul `saveAll` ; idempotent au rechargement
- Déduplication : `dedupeMoInstancesByMoid` supprime les instances d'un même (type+nom) non référencées par un `{{MOID:id}}` dans le contenu ou un fichier → collapse les doublons hérités (ex. 3 instances « Mon Tableau » pour 1 fence → 1)
- 1 board par fence : `recomputeContent{Trello,Array,Prompt}Ids` filtrent via `fenceHasInstance` (MOID) → l'Édition ne rend plus le board en double
- Robustesse : sync inline (Trello/Array), extraction fichier `type-NOM`, `cleanupOrphan*`, `ensure*`, `heal*`, `reconcile*` rendus MOID-aware (strip du MOID pour le nom de fichier, regex tolérant ` {{MOID:..}} ` avant le `\n`). Pas de perte de données Array (grille récupérée depuis le corps de la fence)
- Suppression depuis le menu = suppression totale : `reconcileDeletedMoFiles` (suivi des fichiers MO par **id de nœud** → MOID via `computeMoFiles`, insensible au renommage) détecte qu'un fichier MO a disparu → retire sa fence du document par MOID (`removeFenceByMoid`) et supprime l'instance DB **seulement si plus aucun fichier ne porte ce MOID** (sinon une copie subsiste ailleurs). S'exécute **aussi en mode focus** (opère sur la section focalisée, `saveAll` fusionne dans le document complet) → la synchro (heal/ensure/reconstruct) ne recrée plus l'entrée
- Pas de double stockage : l'extraction retire désormais les fences `PROMPT` de `contenu.md` (comme `TRELLO`/`ARRAY`) → le fichier `prompt-NOM` est la source unique, plus de fence résiduelle inline qui ressuscitait le MO supprimé
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`
