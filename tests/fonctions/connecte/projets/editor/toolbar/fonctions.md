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

## `2-5-2-3-4` — Onglets de mode d'édition

- Mode Code : clic sur l'onglet "Code" (<> Code) passe au mode 'edit' affichant la zone textarea Markdown
- Mode Structure : clic sur l'onglet "Structure" (arborescence) passe au mode 'structure' affichant la structure hiérarchique
- Mode Edition : clic sur l'onglet "Edition" (mode WYSIWYG) passe au mode 'visu' affichant le contenu HTML éditable en ligne
- Onglet actif : l'onglet correspondant au mode courant est mis en surbrillance avec la classe ed-mode-tab--active
- Toggle de vue (Mode Code) : bouton "Markdown propre / Avec style" à droite de la barre d'onglets permet de basculer la vue et d'activer showCssInCode()
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
- Compteur d'instances : affiche le nombre d'instances actives pour chaque type de Mega-outil à côté de leur nom
- Liste d'instances : cliquer sur un type de Mega-outil affiche horizontalement la liste scrollable des instances de ce type
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
- Liaison Mockup : clic sur "Liaison" ouvre la popup de sélection des mockups du projet, clic sur un mockup existant insère sa liaison
- Validation des formulaires : vérification de la non-vacuité du nom et gestion d'erreurs d'unicité (ex: mockupNameError)
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
- Affichage mode Structure : panneau bas amber listant les instances de prompt de la section en lecture seule
- Popup d'exécution : sélecteur IA à gauche (Claude / AGY (Gemini)) + modèles filtrés à droite ; affichage du prompt de base global (collapsable, badge "global") + system prompt de la section
- Variables `{{x}}` : si le prompt contient des variables, l'état variable-fill affiche un formulaire de substitution avant l'envoi
- Streaming : exécution via `GET /api/mega-outils/prompt/execute-stream` (EventSource SSE) ; tous les providers passent par l'executor local port 3002 ; AGY utilise un fichier de sortie pollé toutes les 1500ms (agy ne streame pas sur stdout Windows) ; événements nommés : ai-log {stream, text}, ai-error, complete, run-failed ; journal de log coloré par type (stderr rouge, info amber, stdout gris)
- Insertion : état validating propose "Insérer" (place le résultat dans une section markdown « Résultat du prompt » via `upsertPromptResultSection`), "Copier" et "Re-exécuter" ; les `>` en début de ligne sont retirés
- Section « Résultat du prompt » : titre créé un niveau SOUS la section qui contient le prompt (`headingLevel = sectionLevel + 1`, cap ####), inséré juste après le fence PROMPT ; les titres du résultat sont décalés (`demoteHeadings`) pour rester sous ce titre (titres dans des fences ``` ignorés) ; une nouvelle exécution remplace la section résultat précédente (idempotent)
- Suppression : bouton corbeille dans l'en-tête de l'ancien bloc « Résultat IA » (résultats stockés en fence `===RÉSULTAT===`) → `clearPromptResult` ; les nouveaux résultats sont en section et se suppriment via l'édition normale
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

## `2-5-2-3-19` — [modification] Mega-outil Prompt : Mode guidé (workflow IA cadrage → formulaire → MegaOutils)

- Activation : case « Mode guidé » à la création d'un Prompt → insère `MODE: guided` dans le fence ; détecté par `parsePromptFence` (champ `mode`)
- Bascule sur card : chip « Mode guidé » / badge « Guidé » cliquable sur la card prompt-board (output `toggleGuided`) → `setPromptGuided` ajoute/retire la ligne `MODE: guided` dans le fence ; permet de convertir un prompt existant sans le recréer
- Lancement : bouton « Exécuter » d'un prompt guidé ouvre `PromptWorkflowPopupComponent` (au lieu de la popup d'exécution simple) ; charge les 3 prompts globaux (base + cadrage + génération) via `getPromptGlobalConfig`
- Phase cadrage : l'IA reçoit le méta-prompt de cadrage (system) + la demande (user) et répond par un formulaire Markdown ; parsé en questions, affiché via `app-form-execution-popup` réutilisé (bouton secondaire « Générer le livrable maintenant »)
- Plusieurs vagues : après chaque envoi de réponses, une nouvelle vague de cadrage est lancée ; l'IA peut répondre `===PRÊT===` pour passer à la génération, ou l'utilisateur force la génération ; limite `maxWaves` (défaut 5)
- Phase génération : méta-prompt de génération (system) + demande + transcript des réponses (user) → livrable Markdown contenant des fences MegaOutils (TRELLO/ARRAY/FORM)
- Aperçu + validation : détection des fences MO du livrable (`detectMos`) avec résumé (cartes / lignes×colonnes / questions) et cases à cocher ; bouton « Insérer dans la section »
- Matérialisation : `materializeMegaOutilsFromContent` place le livrable (fences non cochés retirés) dans une section « Résultat du prompt » via `upsertPromptResultSection` (titres décalés sous le titre), crée les instances Trello (cartes BDD via `parseTrelloBodyCards` + `createTrelloCard`) et Array (grille BDD via `deserializeArrayGrid` + `updateArrayGrid`) ; les Form sont rendus par balise (pas d'instance)
- Persistance : le cadrage (transcript des réponses) est archivé en tête de la section « Résultat du prompt » sous un bloc **Cadrage** ; le brut reste visible en mode Code
- Config : méta-prompts cadrage + génération stockés en BDD (`mega_outil_prompt_config` clés `workflow_clarify_prompt` / `workflow_generate_prompt`), éditables dans Admin › Mega-outils › Prompt ; valeurs par défaut servies par le serveur si absentes
- **Priorité:** important
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/prompt-workflow-popup/prompt-workflow-popup.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/form-execution-popup/form-execution-popup.component.ts`, `libs/shared/ui/src/lib/mega-outils/prompt/prompt-board.component.ts`, `libs/shared/ui/src/lib/mega-outils/prompt/prompt-admin.component.ts`, `libs/portail-core/data-access/src/lib/mega-outils.service.ts`, `libs/portail-core/data-access/src/lib/mega-outils.models.ts`, `server/server-data.js`
