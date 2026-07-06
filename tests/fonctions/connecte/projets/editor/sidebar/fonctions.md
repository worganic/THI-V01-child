# Éditeur › Sidebar (Zone 3) — Fonctions métier

<!-- worganic:meta updatedAt="2026-06-21T19:52:06.229Z" updatedBy="Antigravity CLI (agy) / Gemini 3 Pro" -->

---

## `2-5-2-2-1` — [modification] Arborescence des fichiers

- Affichage de l'arbre hiérarchique dossiers/fichiers/images (en excluant contenu.md et les fichiers -css.md)
- Icônes spécifiques selon le type (dossier ouvert/fermé, fichier Markdown, image, image imbriquée)
- Expand/Collapse dossier via clic sur le chevron ou le dossier
- Auto-expand récursif des dossiers parents lors de la sélection d'un fichier
- Sélection d'un nœud émettant l'événement fileSelect
- Formatage personnalisé pour l'affichage des noms des Trello (TL: NOM), Tableaux (AR: NOM) et Prompts (PR: NOM) via `nodeDisplayName` ; les fences ```PROMPT: NOM sont extraites en fichiers physiques `prompt-NOM` par `parseContent` (même mécanisme que Trello/Array)
- Gestion des classes et états visuels du nœud actif (activeFileId) et du survol en drag-and-drop
- Affichage des images imbriquées sous leur document parent
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

---

## `2-5-2-2-2` — [modification] Indicateurs de collaboration

- Affichage d'un cadenas vert si la section est verrouillée par l'utilisateur courant
- Affichage d'un cadenas rouge (icône `lock`) avec tooltip (nom + heure) si un seul autre utilisateur édite la section ; icône `groups` si plusieurs autres utilisateurs sont présents simultanément, tooltip listant chacun avec son heure de début
- Affichage d'un cadenas jaune avec texte de la section en rouge/orange si modifications locales en attente non partagées (brouillon local propre à l'utilisateur, jamais partagé tant que "Enregistrer et partager" n'a pas été cliqué)
- Affichage d'une icône forum clignotante/pulsante (badge conversation) si la section possède des commentaires
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `libs/portail-core/data-access/src/lib/projet-collab.service.ts`

---

## `2-5-2-2-3` — Indicateurs FTP (projets avec backup FTP)

- Affichage d'un fond ambré sur les lignes des dossiers dont le statut FTP est inconnu (unknown)
- Affichage d'une icône de synchronisation animée en bleu (spinning) en statut syncing
- Affichage d'une icône d'erreur rouge en statut error
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

---

## `2-5-2-2-4` — [modification] Création de dossier

- Déclenchement via option "Nouvelle section" du menu contextuel
- Affichage d'un champ de saisie inline sous le parent sélectionné
- Validation du nom via Enter : envoi de la requête POST /api/file-projects/{name}/folders avec outilSlug et parentId
- Création physique du répertoire et d'un fichier contenu.md vide à l'intérieur
- Annulation via Escape pour réinitialiser la saisie
- Règle d'unicité du nom (récupère le dossier existant en cas de doublon)
- Enregistrement de la création dans l'historique d'annulation (Undo)
- **[modification] Suppression automatique de dossier désactivée (incidents répétés)** : `processSectionsChange` (réconciliation texte↔structure) détectait les dossiers "orphelins" (dont elle ne retrouve plus le titre correspondant dans le texte) et les supprimait automatiquement. Deux incidents réels successifs sur le projet « cours d'anglais » : (1) suppression massive de 36 dossiers/65 fichiers à partir d'un contenu partiel/obsolète (2026-07-05) — un premier garde-fou à seuil avait été ajouté (`MAX_DELETE_RATIO`/`MAX_DELETE_ABSOLUTE`) ; (2) malgré ce garde-fou, des dossiers Prompt isolés (« Pr - Questions », « Pr - Tchat », « Pr - Test Tchat ») supprimés quelques secondes après leur création — un orphelin isolé ne déclenchant jamais le seuil (considéré comme une suppression manuelle normale). Décision : la réconciliation ne supprime plus **jamais** aucun dossier automatiquement, quelle que soit la situation — seule la suppression manuelle via la corbeille de la sidebar (`ProjetSidebarComponent.confirmDelete`, action explicite avec confirmation) reste possible. La détection reste loguée (`console.warn`) pour le diagnostic, sans effet réel.
- **[modification] Renommage automatique par devinette de position retiré (3e incident, cause racine)** : au-delà de la suppression, `processSectionsChange` contenait une seconde logique dite de "renommage par position hiérarchique" — quand un dossier "orphelin" (sans `{{SID}}` retrouvé dans le texte) et une "section non matchée" du même niveau sous le même parent coexistaient, ils étaient appariés par simple **position d'index** dans leurs listes respectives, dès que les comptes coïncidaient, sans aucune garantie qu'ils se correspondent réellement. C'est cette logique — pas la suppression — qui causait le 3e incident observé : supprimer un Prompt placé dans « Pr - Questions » pendant que « Pr - Ideation » existe au même niveau faisait apparaître le contenu à tort dans « Pr - Ideation » (appariement erroné → contenu écrit dans le mauvais fichier, effet visuel de "copie"/déplacement non demandé). Cette logique appelait aussi `pendingFolderNames.delete()` sur le mauvais dossier, levant à tort sa protection anti-suppression (ce qui avait déjà permis au 2e incident de contourner le premier correctif). Retirée entièrement : seul le renommage par `{{SID}}` explicite (identifiant stable, zéro devinette) reste actif. Un renommage de titre tapé à la main sans SID crée désormais un nouveau dossier au lieu de renommer l'existant (le dossier "orphelin" reste inoffensif en l'état, plus jamais fusionné/déplacé/supprimé à tort) — compromis assumé : sûreté des données plutôt que confort d'édition.
- **À vérifier** : créer un dossier, y ajouter un Prompt/Trello/Array quelques secondes ou minutes après, sauvegarder plusieurs fois → le dossier n'est jamais supprimé ni son contenu déplacé automatiquement, quel que soit le délai. Supprimer un Prompt placé dans un dossier ayant un frère au même niveau (ex. « Pr - Questions » à côté de « Pr - Ideation ») → le contenu du frère (« Pr - Ideation ») n'est jamais modifié ni "copié".
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`

---

## `2-5-2-2-5` — Création de fichier

- Déclenchement via option "Nouveau fichier" du menu contextuel
- Affichage d'un champ de saisie inline
- Validation du nom via Enter : envoi de la requête POST /api/file-projects/{name}/files avec outilSlug et parentId
- Création physique du fichier Markdown
- Annulation via Escape
- Enregistrement de la création dans l'historique d'annulation (Undo)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

---

## `2-5-2-2-6` — Renommage

- Déclenchement via option "Renommer" du menu contextuel
- Saisie inline pré-remplie avec le nom actuel (sans extension .md pour les fichiers)
- Validation via Enter : envoi d'une requête PATCH /api/file-projects/{name}/files/{id} pour les fichiers ou PATCH /api/file-projects/{name}/folders/{id} pour les dossiers
- Annulation via Escape
- Enregistrement du renommage dans l'historique d'annulation (Undo) pour les fichiers
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

---

## `2-5-2-2-7` — [modification] Suppression

- Déclenchement via option "Supprimer" du menu contextuel
- Affichage d'un modal de confirmation de suppression
- Clic sur "Supprimer" : envoi de DELETE /api/file-projects/{name}/files/{id} ou DELETE /api/file-projects/{name}/folders/{id}
- Clic sur "Annuler" : fermeture du modal
- **[modification] Corbeille (soft-delete)** : la ressource (et ses enfants pour un dossier) n'est plus supprimée physiquement — elle est déplacée vers `.trash/<horodatage>-<id>/` (jamais commité vers le remote git) et un snapshot restaurable est conservé 30 jours en base (`projet_trash_entry`). Restaurable depuis l'onglet Historique → groupe "Corbeille" (voir `2-5-2-8-14`) ou via le bouton "Annuler" (↺) de l'entrée de suppression dans la timeline.
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `server/modules/projet-git.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

---

## `2-5-2-2-8` — Drag & Drop

- Glisser-déposer de nœuds dans l'arborescence (dossier interdit de drop sur un fichier)
- Visualisation en direct de la position de drop cible (before, after, inside)
- Drop : émission de dragDrop avec les nœuds et positions
- Envoi des requêtes POST /api/file-projects/{name}/move-file ou POST /api/file-projects/{name}/move-folder
- Mise à jour physique des fichiers, réorganisation dans config.json et rafraîchissement de l'arbre
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

---

## `2-5-2-2-9` — [modification] Menu contextuel (clic droit)

- Affichage d'un menu contextuel au clic droit avec options dépendant de la sélection
- Options pour les dossiers : Nouvelle section, Nouveau fichier, Renommer, Supprimer, Monter/Descendre, Supprimer le titre, Ajout MO Trello, Ajout MO Tableau, options de verrous
- Options pour les fichiers : Renommer, Supprimer, options de verrous
- Options de verrous dynamiques (Partager, Annuler, Déverrouiller, Verrouiller, ou Affichage info verrou)
- Fermeture du menu lors d'un clic à l'extérieur (document:click)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

---

## `2-5-2-2-10` — [modification] Présence multi-utilisateurs (projets avec backup)

- Pose de présence : requête POST /api/collab/{projetId}/nodes/{nodeId}/lock avec identifiants utilisateur — insère désormais UNE LIGNE PAR UTILISATEUR (table `projet_section_lock`, clé primaire composite `node_id + locked_by_id`), plusieurs utilisateurs peuvent donc être présents simultanément sur le même nœud
- Libération de présence : requête DELETE /api/collab/{projetId}/nodes/{nodeId}/lock?userId=... — ne retire que la ligne de l'utilisateur courant
- `ProjetCollabService.locks` est une `Map<string, LockInfo[]>` (liste de présences par nœud, plus une seule) ; `getPresences(nodeId)`/`getOtherEditors(nodeId)` exposent la liste complète/filtrée
- Détermination des statuts isLockedByMe, isLockedByOther (basés sur `.some()` sur la liste) et isLocalPending
- Événement SSE `presence` : rediffuse l'état complet des présences sur un nœud à chaque (dé)verrouillage ou balayage TTL (en plus de `lock`/`unlock` conservés)
- Récupération et formattage des détails de présence (qui et depuis quand, un ou plusieurs noms) dans le tooltip (`getLockTooltip`) — badge sidebar bascule sur l'icône `groups` quand plusieurs autres utilisateurs sont présents
- Verrouillage automatique lors de la prise de focus en édition d'une section
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `libs/portail-core/data-access/src/lib/projet-collab.service.ts`, `server/server-data.js`

---

## `2-5-2-2-13` — [modification] Système d'outils (vB-0.249+)

- Clic sur le titre du projet ouvrant le popup flottant "Ajouter un outil"
- Options actives dans le popup : Edition, Tests, Agenda (option Code désactivée et marquée bientôt)
- Clic en dehors du popup provoquant sa fermeture
- Liste des outils actifs affichée avec icône et libellé
- Chevron d'extension permettant de plier/déplier les root folder IDs associés à chaque outil (sauf agenda → liste d'événements, voir `2-5-2-2-19`)
- Clic sur le nom d'un outil : émission de outilSelect pour adapter la zone centrale
- Création d'un outil via POST /api/file-projects/{name}/outils
- Rangement physique des fichiers sous le répertoire propre à l'outil (edition, tests, agenda)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

---

## `2-5-2-2-11` — Bouton réduire/rouvrir

- Bascule de l'état zone5Collapsed pour masquer/afficher la sidebar
- Mode réduit limitant la largeur et n'affichant que la bande gauche des icônes
- Mode étendu affichant l'ensemble de l'arborescence
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

---

## `2-5-2-2-12` — États

- Gestion graphique de l'arbre vide (bouton créer dossier, message)
- Surlignage du nœud actif selon son type (vert pour fichier, bleu/doré pour dossier)
- Input de saisie inline désactivant temporairement les autres actions
- Affichage visuel des indicateurs de verrous (icônes et couleurs de cadenas)
- Guidage visuel pour le drag-and-drop
- Panneau réduit affichant uniquement les icônes
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

---

## `2-5-2-2-14` — Bouton "Liste des trellos"

- Affiché en bas de la sidebar si trelloCount > 0
- Badge avec le décompte des instances Trello de l'outil
- Clic émettant trelloListClick pour ouvrir la vue liste de Trello dans la zone centrale
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

---

## `2-5-2-2-15` — [modification] Changer le niveau d'une section (menu contextuel sidebar)

- Action "Monter d'un niveau" / "Descendre d'un niveau" sur un dossier depuis le menu contextuel
- Monter : remonte le niveau et récupère les sections suivantes en tant qu'enfants
- Descendre : place le nœud sous sa sœur précédente en tant qu'enfant
- Modification des caractères heading (#) dans le Markdown de la section
- Conditions de disponibilité canPromoteNode et canDemoteNode (profondeur max de sous-arbre <= 6)
- Émission de nodeLevelChange vers la zone d'édition pour appliquer le traitement
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

---

## `2-5-2-2-16` — Supprimer le titre en gardant le texte (menu contextuel sidebar)

- Action "Supprimer le titre (garder le texte)" sur un dossier
- Suppression de la ligne de heading (#) et fusion du texte de la section dans la section supérieure
- Condition de disponibilité canMergeTitle (section précédente ou parente requise)
- Prise en charge de la sortie du mode focus et réinjection du contenu avant fusion
- Émission de titleMerge pour déléguer l'opération à la zone d'édition
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

---

## `2-5-2-2-17` — Bouton "Liste des mockups"

- Affiché en bas de la sidebar si mockupCount > 0
- Badge avec le décompte des maquettes/mockups présents dans l'outil
- Clic émettant mockupListClick pour ouvrir la vue liste de maquettes dans la zone centrale
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.html`

---

## `2-5-2-2-18` — [modification] Historisation et annulation des actions (Undo)

- Enregistrement dans l'historique des actions utilisateur (création de fichier, dossier, renommage de fichier **et suppression de fichier/dossier**) via WoActionHistoryService
- Déclaration du statut annulable (undoable) et de la payload de rollback (undoAction)
- **[modification]** : la suppression de fichier **et de dossier** est désormais tracée et `undoable: true` (auparavant `undoable: false` pour les fichiers, et pas tracée du tout pour les dossiers) — l'`undoAction` pointe vers la route de restauration depuis la corbeille (`POST /api/file-projects/:name/trash/:trashId/restore`, voir `2-5-2-2-7` et `2-5-2-8-14`)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`, `libs/portail-core/data-access/src/lib/wo-action-history.service.ts`

---

## `2-5-2-2-19` — [modification] Liste des événements de l'agenda dans la sidebar

- Un outil de type **agenda** n'affiche PAS de dossiers (root folders) mais la **liste de ses événements** sous son en-tête une fois déplié
- Événements triés par date de début croissante ; chaque ligne montre une pastille couleur, le titre et la date (`formatAgendaEventDate` : « 29 juin 2026 · 10:00 », sans heure si allDay)
- État vide : « Aucun événement »
- Chargement indépendant via `AgendaOutilService.getEvents` (l'outil agenda n'est monté que s'il est actif) ; rechargé sur changement d'`outils`/`projectName` et après une modif dans l'agenda (`reloadAgendaEvents` appelée par le parent sur `eventsChanged`)
- Clic sur un événement : émet `agendaEventSelect({ outilId, event })` → le parent active l'outil agenda et ouvre l'événement (voir agenda `2-5-2-10-6`)
- **Priorité:** majeure
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`, `libs/portail-core/data-access/src/lib/agenda-outil.service.ts`

---

## `2-5-2-2-20` — Poignées de redimensionnement (arbre du projet + volet Conversation)

- **Précondition** : éditeur de projet ouvert (n'importe quel mode).
- **Action** : glisser la fine poignée verticale (`cursor-col-resize`) située (1) entre l'arbre de fichiers et la zone d'édition, ou (2) entre la zone d'édition et le volet Conversation/Historique (Zone 5).
- **Résultat attendu** : la largeur du panneau suit le curseur en direct (`ProjetSidebarComponent.treeWidth` / `ProjetEditorComponent.zone5Width`, signaux liés en `[style.width.px]`, mis à jour via `@HostListener('document:mousemove')` pendant le drag). Bornes : arbre 180–480px (défaut 224px = `w-56`), volet Conversation 240–640px (défaut 320px = `w-80`). Le relâchement (`document:mouseup`) persiste la largeur dans `localStorage` (`wo-sidebar-tree-width` / `wo-zone5-width`) ; elle est restaurée telle quelle à la prochaine ouverture du projet (tant que le `localStorage` du navigateur n'est pas vidé).
- **Résultat à redouter** : `localStorage` indisponible (navigation privée stricte) → lecture/écriture entourées d'un `try/catch` silencieux, la largeur retombe simplement sur la valeur par défaut sans erreur.
- **À vérifier** : glisser chaque poignée dans les deux sens jusqu'aux bornes (180/480 pour l'arbre, 240/640 pour Conversation) → le panneau ne dépasse jamais ces limites. Recharger la page → les deux largeurs sont conservées. Volet Conversation réduit (`zone5Collapsed`) → sa poignée disparaît (pas de redimensionnement d'un volet invisible).
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.html`

---

## `2-5-2-2-21` — Enregistrer/Annuler une section + choix "avec sous-sections"

- **Précondition** : une section (dossier) porte des modifications locales non partagées (`isLocalPending`), et/ou au moins une de ses sous-sections en porte aussi.
- **Action** : clic droit sur la section dans l'arbre.
- **Résultat attendu — la section elle-même est modifiée** (`isLocalPending(node.id)` vrai) : deux boutons distincts apparaissent, "Enregistrer cette section" (`publishSection(node, false)`) et, si au moins une sous-section est aussi modifiée (`hasPendingDescendants(node)` vrai), "Enregistrer + sous-sections" (`publishSection(node, true)`). Idem côté annulation : "Annuler cette section" (`cancelSection(node, false)`) / "Annuler + sous-sections" (`cancelSection(node, true)`).
- **Résultat attendu — seules des sous-sections sont modifiées** (la section elle-même ne l'est pas) : seuls les boutons "Enregistrer les sous-sections" / "Annuler les sous-sections" apparaissent (cascade uniquement, rien à faire sur la section elle-même) — évite d'avoir à ouvrir et publier chaque sous-section modifiée une par une.
- **Mécanisme** : `ProjetSidebarComponent.hasPendingDescendants(node)` parcourt récursivement `node.children` et teste `collab.isLocalPending(id)` sur chaque descendant (dossier ou fichier). `publishSection`/`cancelSection` transmettent `includeDescendants` à `ProjetCollabService.requestPublishSection/requestCancelSection(sectionId, includeDescendants)`, qui l'embarque dans le payload de `publishSectionRequest$`/`cancelSectionRequest$` (`{ sectionId, includeDescendants }`). La zone d'édition (`projet-editor-zone.component.ts`) le reçoit et l'applique dans `collectSectionPublishIds(sectionId, includeDescendants)` (voir `2-5-2-4-9`) : `includeDescendants=false` limite le périmètre à la section seule (+ ses propres entités granulaires verrouillées), `includeDescendants=true` (comportement par défaut, inchangé) ajoute tous les descendants `isLocalPending`.
- **À vérifier** : éditer une section ET une de ses sous-sections (deux brouillons locaux distincts) → clic droit sur la section parente affiche les 4 boutons ; "Enregistrer cette section" ne publie QUE le parent (la sous-section reste avec son cadenas) ; "Enregistrer + sous-sections" publie les deux et retire les deux cadenas. Éditer uniquement une sous-section (parent intact) → clic droit sur le parent n'affiche que "Enregistrer/Annuler les sous-sections" (pas de variante "cette section").
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `libs/portail-core/data-access/src/lib/projet-collab.service.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`
