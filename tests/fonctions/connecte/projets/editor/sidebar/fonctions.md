# Éditeur › Sidebar (Zone 3) — Fonctions métier

<!-- worganic:meta updatedAt="2026-06-21T19:52:06.229Z" updatedBy="Antigravity CLI (agy) / Gemini 3 Pro" -->

---

## `2-5-2-2-1` — Arborescence des fichiers

- Affichage de l'arbre hiérarchique dossiers/fichiers/images (en excluant contenu.md et les fichiers -css.md)
- Icônes spécifiques selon le type (dossier ouvert/fermé, fichier Markdown, image, image imbriquée)
- Expand/Collapse dossier via clic sur le chevron ou le dossier
- Auto-expand récursif des dossiers parents lors de la sélection d'un fichier
- Sélection d'un nœud émettant l'événement fileSelect
- Formatage personnalisé pour l'affichage des noms des Trello (TL: NOM) et Tableaux (AR: NOM)
- Gestion des classes et états visuels du nœud actif (activeFileId) et du survol en drag-and-drop
- Affichage des images imbriquées sous leur document parent
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

---

## `2-5-2-2-2` — Indicateurs de collaboration

- Affichage d'un cadenas vert si la section est verrouillée par l'utilisateur courant
- Affichage d'un cadenas rouge avec tooltip (nom + heure) si verrouillé par un tiers
- Affichage d'un cadenas jaune avec texte de la section en rouge/orange si modifications locales en attente non partagées
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

## `2-5-2-2-4` — Création de dossier

- Déclenchement via option "Nouvelle section" du menu contextuel
- Affichage d'un champ de saisie inline sous le parent sélectionné
- Validation du nom via Enter : envoi de la requête POST /api/file-projects/{name}/folders avec outilSlug et parentId
- Création physique du répertoire et d'un fichier contenu.md vide à l'intérieur
- Annulation via Escape pour réinitialiser la saisie
- Règle d'unicité du nom (récupère le dossier existant en cas de doublon)
- Enregistrement de la création dans l'historique d'annulation (Undo)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

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

## `2-5-2-2-7` — Suppression

- Déclenchement via option "Supprimer" du menu contextuel
- Affichage d'un modal de confirmation de suppression
- Clic sur "Supprimer" : envoi de DELETE /api/file-projects/{name}/files/{id} ou DELETE /api/file-projects/{name}/folders/{id}
- Clic sur "Annuler" : fermeture du modal
- Règle : suppression physique récursive sur disque de la ressource et de ses enfants
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

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

## `2-5-2-2-9` — Menu contextuel (clic droit)

- Affichage d'un menu contextuel au clic droit avec options dépendant de la sélection
- Options pour les dossiers : Nouvelle section, Nouveau fichier, Renommer, Supprimer, Monter/Descendre, Supprimer le titre, Ajout MO Trello, Ajout MO Tableau, options de verrous
- Options pour les fichiers : Renommer, Supprimer, options de verrous
- Options de verrous dynamiques (Partager, Annuler, Déverrouiller, Verrouiller, ou Affichage info verrou)
- Fermeture du menu lors d'un clic à l'extérieur (document:click)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

---

## `2-5-2-2-10` — Verrous de collaboration (projets avec backup)

- Pose de verrou : requête POST /api/collab/{projetId}/nodes/{nodeId}/lock avec identifiants utilisateur
- Libération de verrou : requête DELETE /api/collab/{projetId}/nodes/{nodeId}/lock
- Détermination des statuts isLockedByMe, isLockedByOther et isLocalPending
- Récupération et formattage des détails de verrou (qui et quand) dans le tooltip
- Verrouillage automatique lors de la prise de focus en édition d'une section
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `libs/portail-core/data-access/src/lib/projet-collab.service.ts`, `server/server-data.js`

---

## `2-5-2-2-13` — Système d'outils (vB-0.249+)

- Clic sur le titre du projet ouvrant le popup flottant "Ajouter un outil"
- Options actives dans le popup : Edition, Tests, Agenda (option Code désactivée et marquée bientôt)
- Clic en dehors du popup provoquant sa fermeture
- Liste des outils actifs affichée avec icône et libellé
- Chevron d'extension permettant de plier/déplier les root folder IDs associés à chaque outil
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

## `2-5-2-2-15` — Changer le niveau d'une section (menu contextuel sidebar)

- Action "Monter d'un niveau" / "Descendre d'un niveau" sur un dossier depuis le menu contextuel
- Monter : remonte le niveau et récupère les sections suivantes en tant qu'enfants
- Descendre : place le nœud sous sa sœur précédente en tant qu'enfant
- Modification des caractères heading (#) dans le Markdown de la section
- Conditions de disponibilité canPromoteNode et canDemoteNode (profondeur max de sous-arbre <= 4)
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

## `2-5-2-2-18` — Historisation et annulation des actions (Undo)

- Enregistrement dans l'historique des actions utilisateur (création de fichier, dossier et renommage de fichier) via WoActionHistoryService
- Déclaration du statut annulable (undoable) et de la payload de rollback (undoAction)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `libs/portail-core/data-access/src/lib/wo-action-history.service.ts`
