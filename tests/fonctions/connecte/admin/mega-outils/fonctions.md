# Admin › Méga-outils — Fonctions métier

Composants : `AdminMegaOutilsComponent` (portail) + `TrelloAdminComponent`, `MockupAdminComponent`, `ArrayAdminComponent`, `PromptAdminComponent` (`@portail/shared-ui`)
Vue : gestion globale des méga-outils (Trello, Mockup, Tableau, Prompt), toutes instances tous projets confondus. Form est listé pour information mais n'a pas d'instances partagées (voir `2-1-7-10`).

---

## `2-1-7-1` — Liste des instances Trello

- Charge toutes les instances via `getAllTrelloBoards()` (`GET /api/mega-outils/trello/all`)
- Chaque instance affiche : nom, cartes (avec aperçu par colonne), et infos de liaison
- Bouton "Rafraîchir" recharge la liste

---

## `2-1-7-2` — Infos de liaison (badges cliquables)

- **Menu** : libellé fixe `projets` (module où vit le méga-outil) → lien `openInEditor({ projectId })`
- **Projet** : `projectName` résolu côté serveur via `COALESCE(frank_projects.title, file_project_meta.display_name)` (JOIN `COLLATE utf8mb4_unicode_ci`) → lien `openInEditor({ projectId })`
- **Section** : `folderName` (résolu via `findNodeById(config.structure, folder_id)`) → lien `openInEditor({ projectId, folderId })` ; "Sans section" (non cliquable) si `folder_id` null
- `folder_id` est synchronisé en base par l'éditeur (voir `2-1-7-7`) à partir de la position réelle du marqueur `{{TRELLO:id}}`
- Chaque badge est un `<button>` qui ouvre la partie correspondante dans l'éditeur projets (voir `2-1-7-3`)
- Date de création

---

## `2-1-7-3` — Liens directs vers l'éditeur

- `@Output() openInEditor({ projectId, folderId?, outilId? })` (bouton "Éditeur" + badges menu/projet/section)
- Le wrapper portail construit l'URL via `navigateToProjets('projets/{projectId}?section={folderId}&outil={outilId}')` (params ajoutés seulement si présents)
- L'éditeur lit le queryParam `section` → `activeNodeId`/`highlightNodeId` (déplie la sidebar via `expandToNode` jusqu'au dossier) + scroll
- L'éditeur lit le queryParam `outil` → `activeOutilId.set(outil)` pour sélectionner le menu utilisé

---

## `2-1-7-4` — Gestion des cartes

- Bouton "Gérer les cartes" déplie un `<app-trello-board>` embarqué (CRUD complet : ajout, édition, déplacement, suppression de carte)
- Cartes compactes : titre avec césure des mots (`break-words` + `overflow-wrap:anywhere`, `min-w-0`) → aucun ascenseur horizontal
- Clic sur le **corps** de la carte → agrandissement inline (`expandedCardId`) : description tronquée (`line-clamp-4`) + boutons Détail / Modifier / Supprimer
- Clic sur le **titre** → popup modale (`modalCardId`) affichant tout le contenu : titre, statut, priorité, description longue (`whitespace-pre-wrap`, scrollable), créateur/date, avec Modifier (édition dans la popup) et Supprimer
- `openCardEdit` ouvre la popup directement en mode édition depuis l'expand inline
- Synchro temps réel héritée du board (voir `2-5-2-5-16`)
- `deletable=false` sur le board embarqué : la suppression de l'instance se fait via le bouton dédié de la ligne

---

## `2-1-7-5` — Suppression d'une instance

- Bouton "Supprimer" → confirmation inline → `deleteInstance(id)` (`DELETE /api/mega-outils/instances/:id`)
- Supprime l'instance + ses cartes en BDD ; diffuse `trello_update` (action `instance_delete`)

---

## `2-1-7-6` — États

| État | Description |
|------|-------------|
| Chargement | "Chargement…" |
| Aucune instance | "Aucune instance Trello." |
| Instance repliée | En-tête + infos + aperçu colonnes |
| Instance dépliée | Board complet pour gérer les cartes |
| Confirmation suppression | Boutons Confirmer/Annuler inline |

---

## `2-1-7-7` — Synchronisation du folder_id (section)

- L'instance ne stocke pas toujours sa section à la création (`folder_id` peut être null)
- Côté éditeur projets, `recomputeTrelloSections()` résout la section réelle via la position du marqueur `{{TRELLO:id}}` puis appelle `updateInstance(id, { folderId })` si elle diffère du `folder_id` stocké
- Endpoint `PATCH /api/mega-outils/instances/:id` accepte `name` et/ou `folderId` (UPDATE dynamique)
- L'en-tête du `<app-trello-board>` affiche le nom de la section via l'`@Input() sectionName` (badge bleu, icône `tag`)

---

## `2-1-7-8` — [modification] Accordéon par type (Trello / Mockup / Tableau / Prompt / Form)

- **Composant :** `AdminMegaOutilsComponent` (portail), liste `types: MoTypeDef[]` (id, label, description, icône, classes de couleur, `hasInstances`)
- La liste « Types disponibles » est cliquable : chaque ligne est un bouton accordéon (signal `expanded`, un seul type ouvert à la fois — cliquer sur l'autre ferme le premier)
- Replié par défaut à l'ouverture de la page (page courte) ; déplié, affiche en dessous le composant d'instances correspondant (`<app-trello-admin>`, `<app-mockup-admin>`, `<app-array-admin>` ou `<app-prompt-admin>` selon le type — sélection via `@switch (t.id)`), monté/démonté à chaque bascule (rechargement des données à chaque ouverture). Le type `form` affiche à la place une note explicative (voir `2-1-7-10`)
- Chevron `expand_more`/`expand_less` reflète l'état

---

## `2-1-7-9` — [modification] Prompt : configuration des prompts en onglets par mode

- **Composant :** `PromptAdminComponent` (`@portail/shared-ui`), dans le panneau Prompt de l'accordéon `2-1-7-8`
- Les 3 blocs de configuration (Prompt système de base, méta-prompts du Workflow guidé, format structuré du Mode tchat), auparavant empilés et toujours visibles, sont regroupés dans un accordéon « Configuration des prompts » (signal `configExpanded`, replié par défaut)
- Une fois déplié : barre d'onglets par mode — **Base** / **Mode guidé** / **Mode tchat** (signal `activeConfigTab`), un seul panneau affiché à la fois
- Chaque panneau garde ses actions Sauvegarder/Réinitialiser inchangées (voir `POST /api/mega-outils/prompt/config`, `DELETE .../workflow`, `DELETE .../chat`)

---

## `2-1-7-10` — [modification] Mockup, Tableau : listing des instances + Form (pas d'instances partagées)

- **Mockup** (`MockupAdminComponent`, `getAllMockups()` → `GET /api/mega-outils/mockup/all`) et **Tableau** (`ArrayAdminComponent`, nouveau composant, `getAllArrayBoards()` → `GET /api/mega-outils/array/all`) suivent exactement le même patron que Trello (`2-1-7-1` à `2-1-7-6`) : en-tête instance avec badges menu/projet/section cliquables (lien vers l'éditeur), bouton « Ouvrir »/« Éditer » qui déplie le board embarqué (`<app-mockup-board>` / `<app-array-board>`, `deletable=false`), suppression avec confirmation inline.
- **Form** n'a pas de section « Toutes les instances » : contrairement aux 4 autres types, un formulaire (cadrage du mode Guidé, question ouverte du mode Tchat) n'est **jamais persisté** comme ligne dans `mega_outil_instances` — `materializeMegaOutilsFromContent()` ignore explicitement `type === 'form'` (comme `chart`/`agenda`). Il vit uniquement dans le texte de la section qui l'a généré, il n'y a donc rien à lister depuis l'admin. Une note explicative remplace le listing.
- **Composants:** `admin-mega-outils.component.ts`, `mockup-admin.component.ts`, `array-admin.component.ts`, `mega-outils.service.ts`, `server/server-data.js`

---

## `2-1-7-11` — [modification] Fix critique : résolution projet/section dans Prompt/Array/Mockup « Toutes les instances »

- **Symptôme :** les sections « Toutes les instances » de Prompt et Tableau affichaient « Aucune instance » malgré des lignes réelles en base (ex. 5 Prompts, 1 Tableau dans des projets existants).
- **Cause :** les endpoints `GET /api/mega-outils/{prompt,array}/all` (et le nouveau `/mockup/all` avant correction) faisaient un `LEFT JOIN frank_project_nodes f ON f.id = i.folder_id` — cette table **n'a jamais existé** (les sections/dossiers sont stockées en JSON dans `file_project_meta.structure`, pas dans une table SQL normalisée). La requête levait une erreur SQL (500), avalée silencieusement côté Angular (`catch { /* silencieux */ }` dans `reload()`) → liste vide sans aucun message d'erreur visible.
- **Fix :** les 3 endpoints utilisent désormais le même patron que `/trello/all` (seul endpoint correct à l'origine) : `COALESCE(frank_projects.title, file_project_meta.display_name)` pour le nom de projet (jointure SQL directe), et `getProjectConfig(project_id)` + `findNodeById(cfg.structure, folder_id)` pour le nom de section (résolution JS depuis le JSON de structure, avec un cache par projet pour éviter de recharger la config à chaque ligne).
- **À vérifier :** ouvrir Admin › Méga-outils, déplier Prompt et Tableau → les instances existantes apparaissent avec leur vrai nom de projet et de section, chaque badge section navigue bien vers la bonne section dans l'éditeur projets.
- **Composants:** `server/server-data.js`
