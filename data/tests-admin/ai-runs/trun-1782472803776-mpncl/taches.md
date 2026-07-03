Liste des fonctions à tester (244) :

### 2-1-1-1 — Identique à la page Config autonome (Page: Admin › Config — Fonctions métier)
Ce composant est le même que celui accessible via `/config`.  
Se référer à `connecte/config/fonctions.md` pour la liste complète des fonctions.

### 2-1-1-2 — Spécificités du contexte admin (Page: Admin › Config — Fonctions métier)
- **Accès** : uniquement via l'onglet "Config" du panneau admin
- **Portée** : les modifications s'appliquent à l'instance globale
- **Droits étendus** : l'admin voit les clés API et les configs sensibles
- **Mise à jour des coûts modèles** : bouton "Rafraîchir coûts" → POST `/api/admin/update-models-costs`

### 2-1-2-1 — Chargement des données (Page: Admin › Déploiements — Fonctions métier)
- **Liste déploiements** : GET `/api/admin/deployments`
- **Statut version** : GET `/api/version/check` → `{ upToDate, localVersion, latestDeployment }`
- **État Git local** : GET `/api/admin/git-local` → infos branche, derniers commits
- **Statut Git** : GET `/api/admin/git-status` → fichiers modifiés, staged, untracked
- **Commits de branche** : GET `/api/admin/branch-commits` → liste des commits sur la branche courante

### 2-1-2-2 — Affichage liste des déploiements (Page: Admin › Déploiements — Fonctions métier)
- **Colonnes** : version, date, type commit (FIX/AMELIORATION/MERGE), titre, branche, IA utilisée, scope, fichiers modifiés
- **Badges colorés** :
  - Type commit : FIX (rouge), AMELIORATION (vert), MERGE (bleu)
  - Scope : portail, server, electron, data (couleurs distinctes)
- **Ligne highlight** : déploiement correspondant à la version main actuelle
- **Expand/collapse** : clic sur une ligne → affiche description complète, liste fichiers, mods
- **Format version** : extrait depuis `commitName` (regex `[FIX|AMELIORATION|MERGE]`)

### 2-1-2-3 — Filtres (Page: Admin › Déploiements — Fonctions métier)
- **Par type de commit** : FIX | AMELIORATION | MERGE
- **Par IA** : provider utilisé (claude, gemini, etc.)
- **Par branche** : branche Git source
- **Liste déroulante** : valeurs uniques extraites de la liste des déploiements
- **Combinaison** : les 3 filtres s'appliquent simultanément (`computed: filteredDeployments`)

### 2-1-2-4 — Création d'un déploiement (Page: Admin › Déploiements — Fonctions métier)
- **Ouverture modal** : clic "Nouveau déploiement" → `openDeployForm()`
- **Champs** :
  - version (ex: `B-0.231`)
  - commitName (titre complet du commit)
  - description (Markdown)
  - filesModified (multiline → converti en tableau)
  - scope, features, ai, model
- **Soumission** : POST `/api/admin/deployments`
- **Succès** : modal fermée, liste rechargée

### 2-1-2-5 — Migration versions legacy (Page: Admin › Déploiements — Fonctions métier)
- **Déclenchement** : clic "Migrer versions" → `migrateVersions()`
- **Action** : POST `/api/admin/migrate-versions`
- **Après migration** : rechargement versions + déploiements
- **État** : indicateur `migrating` pendant l'opération, résultat affiché (`migrateResult`)

### 2-1-2-6 — Indicateur version main (Page: Admin › Déploiements — Fonctions métier)
- **Affichage** : badge "À jour" si `versionStatus.upToDate === true`
- **Alerte** : badge rouge si version locale ≠ dernière version en BDD
- **Versions affichées** : version locale (depuis `version.json`) et version BDD (depuis déploiements)

### 2-1-2-7 — Informations Git (Page: Admin › Déploiements — Fonctions métier)
- **Branche courante** : affichée dans l'en-tête de la section Git
- **Commits récents** : liste des derniers commits avec hash, message, date
- **Fichiers modifiés** : liste des fichiers en staged/unstaged/untracked
- **Statut propre/dirty** : indicateur visuel si working tree propre

### 2-1-2-8 — États (Page: Admin › Déploiements — Fonctions métier)
| État | Description |
|------|-------------|
| Chargement | Spinners sur chaque section |
| Erreur | Messages d'erreur par section |
| Filtres actifs | Badge indicateur sur les dropdowns |
| Version à jour | Badge vert |
| Version outdated | Badge rouge/alerte |
| Migration en cours | Spinner + bouton désactivé |
| Modal ouverte | Formulaire création déploiement |

### 2-1-7-1 — Liste des instances Trello (Page: Admin › Méga-outils — Fonctions métier)
- Charge toutes les instances via `getAllTrelloBoards()` (`GET /api/mega-outils/trello/all`)
- Chaque instance affiche : nom, cartes (avec aperçu par colonne), et infos de liaison
- Bouton "Rafraîchir" recharge la liste

### 2-1-7-2 — Infos de liaison (badges cliquables) (Page: Admin › Méga-outils — Fonctions métier)
- **Menu** : libellé fixe `projets` (module où vit le méga-outil) → lien `openInEditor({ projectId })`
- **Projet** : `projectName` résolu côté serveur via `COALESCE(frank_projects.title, file_project_meta.display_name)` (JOIN `COLLATE utf8mb4_unicode_ci`) → lien `openInEditor({ projectId })`
- **Section** : `folderName` (résolu via `findNodeById(config.structure, folder_id)`) → lien `openInEditor({ projectId, folderId })` ; "Sans section" (non cliquable) si `folder_id` null
- `folder_id` est synchronisé en base par l'éditeur (voir `2-1-7-7`) à partir de la position réelle du marqueur `{{TRELLO:id}}`
- Chaque badge est un `<button>` qui ouvre la partie correspondante dans l'éditeur projets (voir `2-1-7-3`)
- Date de création

### 2-1-7-3 — Liens directs vers l'éditeur (Page: Admin › Méga-outils — Fonctions métier)
- `@Output() openInEditor({ projectId, folderId?, outilId? })` (bouton "Éditeur" + badges menu/projet/section)
- Le wrapper portail construit l'URL via `navigateToProjets('projets/{projectId}?section={folderId}&outil={outilId}')` (params ajoutés seulement si présents)
- L'éditeur lit le queryParam `section` → `activeNodeId`/`highlightNodeId` (déplie la sidebar via `expandToNode` jusqu'au dossier) + scroll
- L'éditeur lit le queryParam `outil` → `activeOutilId.set(outil)` pour sélectionner le menu utilisé

### 2-1-7-4 — Gestion des cartes (Page: Admin › Méga-outils — Fonctions métier)
- Bouton "Gérer les cartes" déplie un `<app-trello-board>` embarqué (CRUD complet : ajout, édition, déplacement, suppression de carte)
- Cartes compactes : titre avec césure des mots (`break-words` + `overflow-wrap:anywhere`, `min-w-0`) → aucun ascenseur horizontal
- Clic sur le **corps** de la carte → agrandissement inline (`expandedCardId`) : description tronquée (`line-clamp-4`) + boutons Détail / Modifier / Supprimer
- Clic sur le **titre** → popup modale (`modalCardId`) affichant tout le contenu : titre, statut, priorité, description longue (`whitespace-pre-wrap`, scrollable), créateur/date, avec Modifier (édition dans la popup) et Supprimer
- `openCardEdit` ouvre la popup directement en mode édition depuis l'expand inline
- Synchro temps réel héritée du board (voir `2-5-2-5-16`)
- `deletable=false` sur le board embarqué : la suppression de l'instance se fait via le bouton dédié de la ligne

### 2-1-7-5 — Suppression d'une instance (Page: Admin › Méga-outils — Fonctions métier)
- Bouton "Supprimer" → confirmation inline → `deleteInstance(id)` (`DELETE /api/mega-outils/instances/:id`)
- Supprime l'instance + ses cartes en BDD ; diffuse `trello_update` (action `instance_delete`)

### 2-1-7-6 — États (Page: Admin › Méga-outils — Fonctions métier)
| État | Description |
|------|-------------|
| Chargement | "Chargement…" |
| Aucune instance | "Aucune instance Trello." |
| Instance repliée | En-tête + infos + aperçu colonnes |
| Instance dépliée | Board complet pour gérer les cartes |
| Confirmation suppression | Boutons Confirmer/Annuler inline |

### 2-1-7-7 — Synchronisation du folder_id (section) (Page: Admin › Méga-outils — Fonctions métier)
- L'instance ne stocke pas toujours sa section à la création (`folder_id` peut être null)
- Côté éditeur projets, `recomputeTrelloSections()` résout la section réelle via la position du marqueur `{{TRELLO:id}}` puis appelle `updateInstance(id, { folderId })` si elle diffère du `folder_id` stocké
- Endpoint `PATCH /api/mega-outils/instances/:id` accepte `name` et/ou `folderId` (UPDATE dynamique)
- L'en-tête du `<app-trello-board>` affiche le nom de la section via l'`@Input() sectionName` (badge bleu, icône `tag`)

### 2-1-6-1 — Liste et gestion des projets (Page: Admin — Projets)
- Affichage de tous les projets en tableau (titre, auteur, statut, date)
- Bouton rafraîchir la liste
- Ouverture d'un projet dans l'app Projets
- Modification du titre et du statut d'un projet
- Suppression d'un projet (confirmation inline)

### 2-1-6-2 — Instructions IA par projet (édition libre) (Page: Admin — Projets)
- Ouverture du panneau IA depuis le bouton `psychology` dans le tableau
- Saisie libre d'instructions système dans la textarea
- Indicateur de longueur et état actif/inactif
- Sauvegarde des instructions dans le champ `iaInstructions` du projet
- Effacement des instructions (champ vide = pas d'override)

### 2-1-6-3 — Bibliothèque d'instructions IA (depuis Documents) (Page: Admin — Projets)
- Accès via l'onglet "Instructions IA" dans Admin Projets
- Création automatique de la catégorie "Instructions IA" dans Documents si absente
- Affichage de tous les documents de la catégorie "Instructions IA"
- Prévisualisation tronquée du contenu (120 premiers caractères)
- Bouton "Gérer dans Documents" : navigation vers la page Documents
- Rafraîchissement de la liste
- État vide avec call-to-action vers la page Documents

### 2-1-6-4 — Application d'une instruction à un projet (Page: Admin — Projets)
- Bouton "Appliquer à un projet" par instruction dans la liste
- Modal de sélection du projet cible (dropdown)
- Confirmation → copie du `text` du document dans `iaInstructions` du projet
- Remplacement des instructions existantes du projet
- Fermeture automatique de la modal après succès

### 2-1-6-5 — Chargement d'une instruction dans la modale IA (Page: Admin — Projets)
- Bouton "Charger depuis la bibliothèque" dans la modale IA du projet
- Picker inline collapsible affichant les docs "Instructions IA"
- Chargement lazy (uniquement si aucun doc en cache)
- Sélection d'un doc → son contenu est chargé dans la textarea
- L'utilisateur peut modifier le contenu avant de sauvegarder
- Fermeture du picker après sélection

### 2-1-5-1 — Navigation par onglets + Onglet Cahier de recette (Page: Admin › Tests — Fonctions métier)
- **Barre d'onglets** : Cahier de recette (`checklist`) / Exécution (`play_circle`) / Résultats (`bar_chart`) / Historique (`history`) / Site Map (`account_tree`).
- **URL par sous-onglet** : chaque onglet a une URL directe — `/admin/tests/cahier`, `/admin/tests/execution`, `/admin/tests/resultats`, `/admin/tests/historique`, `/admin/tests/sitemap`. Navigation par URL directe ou via le navigateur (retour arrière) possible.
  - L'onglet actif est souligné (border + texte primary).
  - À l'activation : Exécution initialise les défauts IA ; Résultats charge la matrice (GET `/api/admin/tests/matrix`).
- **Bouton "Rafraîchir le référentiel"** (en haut à droite, toutes vues) : POST `/api/admin/tests/functions/refresh` → invalide le cache serveur puis recharge.
- **Onglet Cahier de recette** : référentiel des fonctions testables affiché en **arbre hiérarchique** (catégorie → sous-catégorie → section), chargé via GET `/api/admin/tests/functions`.
  - **Hiérarchie & tri** : arbre reconstruit depuis les chemins des `fonctions.md`. Les nœuds sont triés **numériquement par ID hiérarchique** en pré-ordre (`1`, `1-1`, `2`, `2-1`, `2-1-1`, …). L'ID d'un nœud intermédiaire est déduit du `folderId` d'une feuille descendante (segments tronqués à la profondeur du nœud).
  - **Accordéon** : au 1er niveau seules les catégories racines (`1` non-connecte, `2` connecte) sont visibles ; clic sur un nœud déplie/replie ses enfants. Boutons globaux "Tout ouvrir" / "Tout fermer".
  - **Recherche** (champ avec icône loupe) : filtre l'arbre sur le libellé, le `pageTitle`, l'`ID` et le contenu des fonctions (insensible aux accents/casse). **Autocomplétion** : dropdown de max 8 suggestions (icône d'état + ID + section + page) ; clic → applique la section comme filtre. Bouton ✕ pour vider.
  - **Filtre d'état** : `Toutes` / `Testées` / `Non testées` / `En erreur` (KO) / `À retester` — masque les sections/fonctions hors critère. Le filtre `À retester` affiche uniquement les fonctions dont le heading contient le tag `[modification]` (champ `needsRetest: true`), indiquant que le code source a été modifié depuis le dernier test.
  - **Favoris** : bouton étoile (`star`/`star_border`) sur chaque section feuille → (dé)marque en favori (POST `/api/admin/tests/favorites { folderId, favorite }`, persistant). Chip filtre **« Favoris »** (★) pour n'afficher que les sections favorites. Chargé via GET `/api/admin/tests/favorites`.
  - Quand une recherche ou un filtre est actif, l'arbre se déplie automatiquement sur les résultats ; message "Aucun résultat" si vide.
  - **Surcharge « afficher toute la section »** : sous un filtre actif, une section feuille n'affiche que ses fonctions correspondantes. **Cliquer sur le titre de la section** bascule l'affichage de **toutes** ses fonctions (malgré le filtre) ; re-cliquer ré-applique le filtre (`onCahierNodeClick` → `toggleSectionFull`, signal `forceFullPaths`). Badge bleu **« Tout »** affiché tant que la surcharge est active. Réinitialisé automatiquement dès que le filtre/recherche change.
  - **Nœud** : chevron, badge ID cliquable (copie), icône (`folder`/`folder_open` pour une catégorie, `description` pour une section feuille), nom (`pageTitle` ou nom du dossier), compteur de fonctions, bouton "Lancer un test sur cette section" (sur une feuille → pré-coche la section + bascule Exécution), bouton "Ouvrir le dossier local" (POST `/api/admin/tests/open-folder { path }`).
  - **Tableau des fonctions** (déplié sur une section feuille) : colonnes `#` / `Action / Titre` / `ID` / `Étapes` / `Priorité` / `État`.
    - Action / Titre : libellé de la fonction (`section`) + résumé (1re ligne du contenu).
    - ID : badge cliquable → copie dans le presse-papiers.
    - Étapes : nombre de puces (`- …`) du contenu markdown.
    - **Priorité** : `mineur` (jaune) / `critique` (orange) / `bloquant` (rouge), **éditable** via un select → POST `/api/admin/tests/function-priority { itemId, priority }` (réécrit la ligne `- **Priorité:**` du fonctions.md). Voir `2-1-5-12`.
    - État : dernier résultat décidé (`OK` vert / `KO` rouge / `non testé`) + date du dernier test.
  - **Clic sur une ligne de fonction** : déplie le contenu markdown complet (liste des tâches, via `renderContent`).
- **Croisement avec les résultats** (`2-1-5-8`) : les nœuds et lignes sont colorés selon les derniers résultats (matrice GET `/api/admin/tests/matrix`).

### 2-1-5-2 — Onglet Exécution — campagne en cours (runner OK/KO/ND) (Page: Admin › Tests — Fonctions métier)
- **Périmètre** : le run ne couvre que les fonctions des sections sélectionnées (filtrage par `activeRun.results`).
- **En-tête** : "Campagne en cours — testeur (— nom)", progression `X% (A/B)`, indicateur de sauvegarde, bouton "Annuler", bouton "Terminer le test".
- **Bouton "Annuler"** : confirmation d'abandon → DELETE du run (voir `2-1-5-6`).
- **Barre de progression** : s'incrémente à chaque item décidé (OK ou KO).
- **Groupes de fonctions** : organisés par `pageTitle` + badge `folderId`.
- **Par item** :
  - Badge ID cliquable (copie presse-papiers via `navigator.clipboard`).
  - Libellé de la section, dépliable → contenu markdown des tâches.
  - **État du dernier test précédent** (à gauche des boutons) : pastille `OK`/`KO` (verte/rouge) + label « préc. », issue du dernier run décidé **hors run en cours** (`funcPrevious` = `funcLatest` excluant `activeRun.id`). Absente si la fonction n'a jamais été testée. La matrice est rechargée au lancement du run pour fiabiliser cet historique.
    - **Sous la pastille** : nom du **testeur** (icône `person` ; `IA` + icône `smart_toy` pour un run automatique) + **date** du test (`testedAt` réel si dispo), et, si le run était une **campagne**, son **nom** (icône `campaign`). Infobulle complète au survol (statut + testeur + date + campagne).
  - **Flèche de tendance** entre l'état précédent et la décision en cours (`resultTrend`) : `trending_up` vert si **corrigé** (KO→OK), `trending_down` rouge si **régression** (OK→KO).
  - 3 boutons : **OK** (vert) / **KO** (rouge) / **ND** (gris).
  - Si KO → champ note optionnel.
- **Auto-save** : debounce 2 s → PUT `/api/admin/tests/runs/:id { results }`.
- **Bouton "Terminer le test"** : sauvegarde + `status:'completed'` → recharge runs + matrice → bascule sur l'onglet Résultats.

### 2-1-5-3 — Onglet Résultats — matrice runs × fonctions (Page: Admin › Tests — Fonctions métier)
- **Chargement** : GET `/api/admin/tests/matrix` → tous les runs (ordre chronologique) avec leurs résultats (statut, note, date).
- **Barre d'outils** : « Tout ouvrir / Tout fermer » (accordéon des sections), filtre **« KO uniquement »** (ne garde que les lignes/sections avec au moins un KO), **légende** (OK/KO/·/—).
- **Tableau matrice** (en-têtes collants, 1re colonne collante) :
  - **Colonnes = runs / campagnes** : badge **CAMPAGNE** + nom si campagne, date courte, mode (`IA` / testeur), ratio `OK/décidées`, **score global** coloré (vert ≥80, ambre ≥50, rouge <50), suppression au survol (DELETE `/api/admin/tests/runs/:id`).
  - **Lignes = fonctions groupées par section** :
    - Ligne section **cliquable** (accordéon) : nom + folderId + compteur + **verdict de section** par run (voir `2-1-5-12` : vert = valide ✓ / rouge = invalide ✗ + %, infobulle = raison), et **MAJ** (date + IA).
    - Ligne fonction : pastille **couleur de priorité** + libellé + cellule par run → **OK** / **KO** (icône note si présente) / `·` (non décidé) / `—` (non couvert). **Infobulle** par cellule : statut + note + date.
- **Seuils d'invalidation** éditables dans la barre d'outils (voir `2-1-5-12`).
- **Filtrage** : seules les sections réellement couvertes par au moins un run sont affichées.
- **Vide** : "Aucune campagne exécutée." si aucun run ; "Aucune ligne KO." si le filtre KO ne renvoie rien.

### 2-1-5-4 — IDs de fonctions (Page: Admin › Tests — Fonctions métier)
- **Format ID** : `{dossierID}-{N}` où `dossierID` vient de `_registry.json` (ex: `2-5-2-3`) et `N` est séquentiel dans le fichier.
- **Badge ID cliquable** : copie l'ID dans le presse-papiers (utile pour référencer une fonction à tester via IA).
- **Registre** : `tests/fonctions/_registry.json` — source de vérité pour les IDs de dossiers.

### 2-1-5-5 — États (Page: Admin › Tests — Fonctions métier)
| État | Description |
|------|-------------|
| Chargement fonctions | Spinner (onglet Cahier / sélection sections) |
| Aucune fonction | Message + invitation à rafraîchir |
| Item déplié (Cahier) | Contenu markdown des tâches affiché |
| Campagne en cours | En-tête + barre de progression + boutons OK/KO/ND |
| Auto-save | Indicateur "Sauvegarde…" |
| Note KO visible | Input texte sous l'item KO |
| Chargement matrice | Spinner (onglet Résultats) |
| Matrice vide | "Aucune campagne exécutée." |
| Run IA en cours | Bannière indigo + journal live |

### 2-1-5-6 — Onglet Exécution — configuration de lancement & confirmations (Page: Admin › Tests — Fonctions métier)
- **Configuration inline** (visible tant qu'aucune campagne n'est en cours) :
  - **Type** : `Test ponctuel` (1 run = 1 colonne) ou `Campagne`.
    - Campagne : sélecteur `Nouvelle campagne` (+ nom) ou **campagne ouverte existante** (`openCampaigns` = runs `isCampaign` in_progress). Permet de tester des sections **petit à petit** et de les regrouper dans **une seule colonne** de résultats.
  - **Toggle mode** : Automatique (IA) / Manuel (testeur).
  - **Catégories à tester** : chips de sections testables + chip "Toutes (N)" ; sélection multiple (compteur de fonctions couvertes).
  - **Commentaire** (test ponctuel) : transmis comme `name` du run.
  - **Mode Manuel** : champ "Nom du testeur" + bouton "Démarrer le test / la campagne / Ajouter à la campagne".
  - **Mode IA** : voir `2-1-5-7` + bouton "Lancer l'analyse IA / Ajouter à la campagne (IA)".
- **Création** : POST `/api/admin/tests/runs { tester, name, folderIds, isCampaign?, [mode/aiProvider/aiModel/prompt] }`.
- **Ajout à une campagne** : POST `/api/admin/tests/runs/:id/add-sections { folderIds }` — ajoute les fonctions des sections (en `pending`, sans réinitialiser l'existant), rouvre le run. En IA, seules les fonctions **pending** sont testées (ajout incrémental).
- **Runner campagne** : boutons "Enregistrer (ajouter d'autres sections)" (`saveAndExit` : enregistre, garde la campagne ouverte, recale la cible) et "Clôturer la campagne" (`completeRun`).
- **Popup de confirmation** (annulation / suppression) :
  - **Annuler un test en cours** : abandon = DELETE du run.
  - **Supprimer un run** (depuis la matrice) : DELETE.
  - Boutons : "Retour" (annule) / "Abandonner" ou "Supprimer" (confirme).

### 2-1-5-7 — Mode automatique (test IA via Claude Code + Browser MCP) (Page: Admin › Tests — Fonctions métier)
- **Toggle Manuel / Automatique (IA)** dans la configuration de l'onglet Exécution.
- **Mode IA** :
  - **Sélecteur IA** : providers CLI agentiques actifs dans admin/config (Claude Code, Antigravity) — depuis `ConfigService.cliConfig().availableProviders` (type `cli`).
  - **Sélecteur Modèle** : `modelsList[baseId]` du provider choisi.
  - **Mémorisation du choix** : tout changement de provider ou de modèle (formulaire d'exécution, popup de génération, popup nouvelle section) est **persisté** via `ConfigService.saveHeaderSelection(provider, model)` (`headerSelection`, partagé avec le sélecteur IA du header). Tous les formulaires IA se ré-initialisent depuis ce choix (`onAiModelChange` / `onGenModelChange` / `onCsModelChange` + `persistAiSelection`), de sorte que la dernière IA/modèle utilisée est proposée par défaut au prochain test.
  - **Consignes éditables** (textarea) : intro du prompt, modifiable.
  - **Format de retour imposé** (lecture seule) : exemple `@@TEST_RESULT@@{"itemId":…,"status":"ok|ko|nd","note":…}` pour un retour constant.
  - **Lancer l'analyse IA** : POST `/runs { mode:'ai', aiProvider, aiModel, prompt, folderIds }`.
- **Exécution** : `GET /api/admin/tests/runs/:id/ai-stream` (SSE, auth `?token=`) construit le prompt (consignes + format imposé + liste des fonctions), appelle l'executor local `/execute-prompt` (Claude Code / agy pilotent le navigateur via l'extension **Browser MCP**), parse les lignes `@@TEST_RESULT@@`, persiste chaque résultat et ré-émet en SSE (`start`, `case-result`, `ai-log`, `complete`, `ai-error`, `run-failed`).
- **Deux mécanismes de capture selon le provider** :
  - **Claude** : émet les `@@TEST_RESULT@@` sur **stdout** → le serveur parse le flux stdout de l'executor.
  - **Antigravity (`agy`)** : `agy -p` n'écrit **jamais** sur stdout (print mode = modifications de fichiers). Le serveur écrit un **fichier de tâches** (lu par agy) + un **fichier de sortie** sous `data/tests-admin/ai-runs/<runId>/`, envoie un prompt directif (agy ÉCRIT les `@@TEST_RESULT@@` dans le fichier via son outil d'écriture), et **poll ce fichier** toutes les 1,5 s pour émettre les `case-result`. L'executor spawn agy **directement** (pas `cmd /c`, chemin résolu via `where agy`), `cwd` = racine projet. Voir aussi le CLI `tests/run-recette-cli.js` (même approche).
- **Retours en direct (`ai-log`)** : tout le stdout/stderr/info de l'IA (hors lignes sentinelles) est forwardé en temps réel via l'événement SSE `ai-log` `{ stream, text }`.
- **Runner IA** (onglet Exécution) : bannière « L'IA teste… (X/Y) » + spinner pendant `aiRunning`, résultats remplis **progressivement** ; à la fin → « Tests IA terminés — à revoir » (revue manuelle puis Terminer).
- **Journal live** (panneau « Retours en direct de l'IA », collapsible) : affiche au fil de l'eau les lignes `ai-log`, les verdicts (`case-result`) et les messages début/fin/erreur. Coloration par flux, auto-scroll, borné à 500 lignes, compteur, réinitialisé à chaque lancement.
- **Résultats** : badge mode `IA` sur les colonnes de runs automatiques dans la matrice.
- **Pré-requis** : extension **Browser MCP** installée + enregistrée auprès de Claude Code (`claude mcp add`), onglet de l'app **connecté** relié à Browser MCP, executor (port 3002) lancé.
- **Champs run** : `mode:'ai'`, `aiProvider`, `aiModel`, `aiState` (`idle|running|done|error`), `prompt`.

### 2-1-5-8 — Cahier de recette — couleurs d'après les derniers résultats (Page: Admin › Tests — Fonctions métier)
- **Source** : `GET /api/admin/tests/matrix` (chargé à l'init et à l'ouverture du Cahier).
- **Dernier état par fonction** (`funcLatest`) : pour chaque fonction, le dernier résultat **décidé** (OK/KO) tous runs confondus, avec sa date (le plus récent par `startedAt`). Un résultat `pending` n'écrase pas un état décidé.
- **Agrégat par nœud** (`cahierStats`) : chaque fonction remonte sur tous ses chemins ancêtres → par section ET par catégorie : `total`, `ok`, `ko`, `untested` (jamais décidé), `pct` = OK/(OK+KO), `lastDate`.
- **Couleur d'un nœud** : **rouge** si ≥1 fonction KO, **vert** si tout décidé est OK, **gris** si rien testé. Rendu : liseré gauche + fond teinté de l'en-tête.
- **Bloc état dans l'en-tête** : `pct%` (coloré), `X OK / Y KO`, badge `Z non testé(s)`, date du dernier test (`jj/mm hh:mm`).
- **Ligne de fonction** : fond teinté (vert/rouge/neutre) + colonne **État** (`OK`/`KO`/`non testé`) + date du dernier test.

### 2-1-5-9 — Cahier de recette — génération/mise à jour des fonctions par IA (Page: Admin › Tests — Fonctions métier)
- **Bouton par section** (icône `auto_fix_high`, à côté de Lancer/Ouvrir) sur chaque section feuille → ouvre un popup.
- **Popup** : sélecteur IA (providers CLI agentiques de admin/config), sélecteur Modèle, consignes éditables, **case « Récupérer les composants liés à chaque fonction »**, journal live, boutons Annuler/Fermer + « Lancer la mise à jour ».
- **Composants liés** : si l'option est cochée, l'IA renseigne le champ `components` de chaque proposition. À l'application, le serveur écrit une ligne \`- **Composants:** \`chemin\`, …\` sous la fonction ; au scan, \`extractFunctionComponents\` les reparse → champ \`components[]\`, **affiché en chips** sous le titre dans le Cahier (`2-1-5-1`). Paramètre SSE \`components=1|0\`.

### 2-1-5-10 — Revue & validation des propositions avant migration (Page: Admin › Tests — Fonctions métier)
- **Déclenchement** : à la fin de la génération IA (`2-1-5-9`), un popup de revue s'ouvre avec la liste des propositions.
- **En-tête** : compteurs `+ajouts`, `modifs`, `suppr.`, `inchangées`.
- **Par proposition** : badge `op` coloré (Ajout vert / Modif ambre / Suppr rouge / Inchangée gris), badge ID (`nouveau` si ajout), libellé, chips composants, et **case à cocher** (sauf inchangées). Dépliable :
  - **Modif** : vue **Avant / Après** côte à côte (contenu rendu).
  - **Ajout / Suppr** : contenu de la fonction.
- **Sélection** : ajouts/modifs/suppressions cochés par défaut ; l'utilisateur décoche ce qu'il refuse. Compteur de changements sélectionnés.
- **Appliquer** : le client construit la liste finale (ordre existant + modifs/suppressions validées + ajouts validés) → POST `/api/admin/tests/apply-functions { folderId, functions }`.
- **Historique** : chaque application est enregistrée (`2-1-5-11`) et listée dans l'onglet Historique.
- **Endpoint application** : `POST /api/admin/tests/apply-functions { folderId, functions, updatedBy, changes }` réécrit le `fonctions.md` (`writeFonctionsMd` : conserve le titre `#`, assigne les nouveaux IDs en continuant après le max, normalise la ligne Composants), invalide le cache, renvoie les fonctions à jour. Le Cahier recharge fonctions + couleurs.
- **Objectif** : l'IA analyse le **code** de la section (composants Angular, templates, routes serveur) et **propose** la liste cible des fonctions à tester (ajouts/corrections/suppressions), en respectant le **système d'IDs** existant (format `## \`{folderId}-{N}\` — Libellé`, tiret long, pas de renumérotation, IDs supprimés non réattribués). **Aucune écriture directe** du `fonctions.md`.
- **Endpoint proposition** : `GET /api/admin/tests/generate-functions-stream?folderId=&provider=&model=&prompt=&components=&token=` (SSE). Résout `folderId`→path via `_registry.json`, prépare un fichier de sortie `data/tests-admin/gen-runs/<id>/proposals.json`, construit un prompt demandant à l'IA d'**écrire un tableau JSON** (liste cible : `id` réutilisé si existant, omis si nouveau, `section`, `tasks`, `components?`), appelle l'executor local `/execute-prompt` (`cwd` = racine), streame (`start`, `ai-log`, `ai-error`, `complete`, `run-failed`). À la fin, lit le JSON et calcule le **diff** vs l'existant (`computeFunctionProposals`) → `op` = `add|modify|delete|unchanged`, renvoyé dans `complete.proposals`.
- **Popup de revue** (`2-1-5-10`) : avant migration, l'utilisateur valide chaque ajout/modif/suppression.
- Fonctionne avec Claude Code et Antigravity (tous deux écrivent le fichier JSON).

### 2-1-5-11 — Onglet Historique des mises à jour du référentiel (Page: Admin › Tests — Fonctions métier)
- **Onglet « Historique »** (icône `history`) : liste, du plus récent au plus ancien, chaque **application** de mise à jour des fonctions (générations IA validées).
- **Source** : `GET /api/admin/tests/functions-history` (fichier `data/tests-admin/functions-history.json`). Une entrée est créée à chaque `apply-functions` ayant au moins un changement.
- **Par entrée** : date, section (`pageTitle` + `folderId`), IA (`updatedBy`), badges de compteurs (+ajouts `green` / ~modifs `amber` / −suppr `red`). **Dépliable** : listes détaillées des fonctions ajoutées / modifiées / supprimées, chacune avec **badge de priorité** (couleur), ID, libellé et une **explication courte** (ajout : résumé ; modification : ce qui a changé — libellé/tâches/composants/priorité avant→après ; suppression : ancien résumé). Total après mise à jour.
- **Diff** : fourni par le client à l'application (`changes` = added/modified/deleted avec `priority` + `explanation`), persisté tel quel.
- **Échange IA complet** : chaque entrée issue d'une génération conserve le **prompt envoyé** (`aiPrompt`) et la **réponse brute de l'IA** (`aiResponse`), affichés dans un bloc dépliable « Échange IA complet (prompt + réponse) » — utile pour vérifier que l'IA renvoie bien les infos demandées (dont la priorité). Transmis par le SSE `complete` de la génération (`prompt`, `rawResponse`) puis au POST apply.

### 2-1-5-12 — Priorité des fonctions & validation des sections (Page: Admin › Tests — Fonctions métier)
- **Priorité par fonction** : `mineur` / `critique` / `bloquant`, stockée dans le `fonctions.md` (ligne `- **Priorité:** …`), parsée (`extractFunctionPriority`) en champ `priority`.
  - **Renseignée par l'IA** lors de la génération (champ `priority` du JSON de propositions, voir `2-1-5-9`) — le prompt impose d'évaluer fonction par fonction avec exemples (connexion/inscription/paiement/sauvegarde = `bloquant`, etc.) ; le serveur normalise les synonymes FR/EN (`normalizePriority`).
  - **Éditable manuellement** dans le Cahier (select par fonction) → POST `/api/admin/tests/function-priority`.
- **Validation d'une section (onglet Résultats)** — par section et par run :
  - **1 bloquant KO ⇒ section invalide** (quel que soit le reste).
  - sinon **% de critiques KO > seuil critique** (défaut 15%) ⇒ invalide.
  - sinon **% de mineurs KO > seuil mineur** (défaut 40%) ⇒ invalide.
  - sinon valide (si au moins une fonction décidée ; sinon « non testée »).
- **Seuils modifiables** dans la barre d'outils de l'onglet Résultats (2 champs %), persistés : GET/POST `/api/admin/tests/settings { critiqueThreshold, mineurThreshold }`.
- **Affichage** : la cellule de score de section devient verte (✓ valide) ou rouge (✗ invalide) avec le %, infobulle = raison de l'invalidation.

### 2-1-5-14 — Créer une nouvelle section de tests avec l'IA (Page: Admin › Tests — Fonctions métier)
- **Bouton "Nouvelle section"** (indigo, icône `add_circle`) dans la barre en haut à droite d'Admin › Tests, visible en permanence (tous onglets).
- **Popup "Nouvelle section de tests"** : formulaire de création avant génération IA.
  - **Section parente** : dropdown listant tous les nœuds de `cahierTree()` (catégories et sections existantes), libellé indenté (`csNodeLabel`) incluant `fullPath`. Option "— Racine —" pour créer au premier niveau.
  - **Nom de section** (`slug`, `font-mono`) : kebab-case, normalisé à la soumission (`trim + lowercase + replace(/[^a-z0-9-]/g, '-')`).
  - **Titre de la page** : libellé affiché dans le cahier de recette.
  - **Objectif / précisions** : champ libre ajouté automatiquement au prompt de base lors de la génération.
  - **Provider IA + Modèle** : sélecteurs identiques à ceux du popup de génération (pré-remplis depuis `headerSelection` d'admin/config).
  - **Checkbox "Composants liés"** : idem génération classique.
  - **Bouton "Créer & Générer avec l'IA"** : désactivé si slug ou titre vide ou provider absent. Spinner pendant la création.
  - **Annuler** : fermeture sans modification (bouton ✕ ou "Annuler" ; interdit si `csRunning`).
- **Flux de création** (`confirmCreateSection()`) :
  1. POST `/api/admin/tests/create-section { parentPath, slug, pageTitle }` → crée le dossier `tests/fonctions/<parentPath>/<slug>/`, un `fonctions.md` minimal, et une entrée dans `_registry.json` (ID hiérarchique calculé : enfant suivant du parent, ou prochain ID racine si pas de parent).
  2. Recharge le référentiel (`refreshFunctions()`).
  3. Pré-remplit le popup de génération (`showGenPopup`) avec : `folderId`, `pageTitle`, provider/modèle choisis, prompt = `defaultCreateSectionInstructions()` + objectif utilisateur.
  4. Ferme le popup de création et ouvre le popup de génération existant.
- **Serveur POST `/api/admin/tests/create-section`** :
  - Valide `slug` (regex `[a-z0-9-]+`), `pageTitle` requis.
  - Vérifie l'unicité du chemin dans le registry (409 si doublon).
  - Exige que `parentPath` soit dans le registry (400 sinon).
  - Calcule le prochain ID (max des frères + 1, ou 1 si aucun frère).
  - Crée dossier + `fonctions.md` (`# <pageTitle>\n`) + met à jour `_registry.json` (trié numériquement).
  - Enregistre le `folderId` dans `tests/fonctions/_user-created.json` (tableau JSON persistant).
  - Invalide `_functionItemsCache` (côté serveur).
- **Tag "Personnalisée"** (badge violet, icône `person_add`) affiché sur les sections créées via ce flux :
  - `scanAllFunctions()` lit `_user-created.json` et injecte `userCreated: true` sur chaque `FunctionItem` du dossier concerné.
  - Badge visible dans le **Cahier** (nœud feuille), dans l'onglet **Résultats** (en-tête de groupe matrice) et l'onglet **Exécution** (en-tête de groupe runner).
  - Méthode `isSectionUserCreated(folderId)` : retourne `true` si au moins un item de ce dossier a `userCreated: true`.

### 2-1-5-15 — Détection automatique des fonctions à retester après modification de code (Page: Admin › Tests — Fonctions métier)
- **Déclencheur** : après chaque modification de code (composant Angular, service, template, route Express) par Claude Code, le système vérifie si le fichier modifié est référencé dans les tests pré-programmés.
- **Sources de détection** :
  - **Méthode exacte** : lignes `- **Composants:** …` dans les `fonctions.md` contenant le nom ou chemin du fichier modifié.
  - **Méthode structurelle** : table de correspondance Composant → `fonctions.md` dans CLAUDE.md.
- **Tag `[modification]`** : ajouté par Claude Code directement dans le heading `##` du `fonctions.md` concerné, entre le tiret long et le libellé.
  - Format : `## \`2-5-2-3-4\` — [modification] Onglets de mode`
  - Non dupliqué si déjà présent.
- **Champ serveur** : `parseFonctionsMd` détecte `[modification]` après le tiret long → expose `needsRetest: true` et retire le tag du libellé affiché. `writeFonctionsMd` réinjecte le tag tant que `needsRetest` reste vrai (survie aux éditions de priorité et aux générations IA `apply-functions`).
- **Retrait automatique** : `PUT /api/admin/tests/runs/:id` appelle `clearModificationTagForItems(itemIds)` pour chaque fonction décidée (OK/KO) → le tag disparaît du heading. Il reste donc tant que la section n'a pas été retestée.
- **Filtre "À retester"** dans l'onglet Cahier de recette (5e chip d'état) : voir `2-1-5-1`. N'affiche que les fonctions `needsRetest: true`.
- **Visuel** : badge ambre **« Modification »** (icône `edit_note`) affiché (1) sur l'en-tête de nœud de section si ≥1 fonction enfant a `needsRetest` (`isSectionNeedsRetest(folderId)`), et (2) devant le libellé de chaque fonction taguée dans le tableau (`item.needsRetest`).

### 2-1-5-13 — Onglet Site Map graphique (Page: Admin › Tests — Fonctions métier)
- **5e onglet "Site Map"** (`account_tree`) dans la barre Admin › Tests.
- **Modèle métier à 3 niveaux (V2)** : **Page** (zone `role=page` : écran réel, URL + composant lié) ▸ **Section** (zone `role=section` : header / menu / content / aside / footer + composant lié) ▸ **Élément** (nœud `elType` : lien / bouton / formulaire / widget, rattaché à une section via `groupId`). Les **relations** (liaisons) relient n'importe quels éléments/sections/pages. Boutons toolbar **« Page »** / **« Zone »** ; **« Ajouter une section »** (volet page) ; **« Ajouter un élément »** par type (volet section). Volets enrichis : rôle, type de section, URL, composant lié, liste des sections (page) / éléments (section). Couleurs des éléments par type (lien indigo / bouton émeraude / form ambre / widget violet). Schéma de disposition versionné (`v3`) : les anciennes dispositions incompatibles sont ignorées.
- **Carte SVG interactive** avec pan/zoom.
  - **Groupes encadrés** (pointillés colorés, label) = parties du système : `Public :4202`, `App connectée :4202` (menu Documents · Projets · Admin), `Admin` (onglets, réservé admin), `App Projets :4203`, `Outils & widgets embarqués`.
  - **Nœuds cliquables** par page : fond coloré selon le type (`public` sky / `protected` indigo / `admin` ambre / `projets` émeraude / `widget` violet), label + URL + badge port.
  - **Structure réelle du menu** : les entrées de navigation (Documents, Projets→:4203, Historique conditionnel, Config, Déploiements, Admin) sont des nœuds dans le groupe « App connectée ».
  - **Onglets Admin réels** (ordre du registry) en nœuds dans le groupe Admin : Projets, Utilisateurs, Déploiement, Config, Thème, Méga-outils, Mémo, Outils, Tests.
  - **Onglets internes** affichés sous l'URL pour les pages tabulées (Éditeur de projet, onglet Tests).
  - **Arêtes dirigées** (Bézier) : navigation `connexion` (vert), `cross-app` (orange), `nav` (indigo) ; **relations fonctionnelles** en pointillés violet (`relation`) entre éléments — ex : `Méga-outils → Éditeur de projet` (Trello instancié dans l'admin, utilisé dans l'éditeur), `Outils → widgets` (visibilité TchatIA/Tickets/Cahier), `Outils → Historique` (active l'entrée de menu), `Config (admin) → Config (user)` (même composant), `Admin Projets → Liste projets`.
- **Zoom et déplacement** :
  - **Molette** : zoom in/out (min 15%, max 250%).
  - **Cliquer-glisser** sur le fond : pan.
  - **Barre d'outils** : boutons `−` / `+` / reset (`center_focus_strong`), % de zoom courant.
- **Mode plein écran** :
  - Bouton toolbar **« Plein écran »** (`fullscreen`) → la Site Map occupe toute la fenêtre via un overlay fixe (`fixed inset-0 z-[100]`) qui masque le header, la navigation Admin et les sous-onglets Tests ; seule la barre d'outils de la Site Map reste visible. La carte s'agrandit (`calc(100vh - 90px)`).
  - En plein écran, le bouton devient **« Mode normal »** (`fullscreen_exit`, état actif surligné) → revient à l'affichage standard intégré à la page Admin.
  - Les popups de la Site Map (Versions, Mise à jour par IA, Revue des propositions, Confirmation) restent **utilisables en plein écran** : elles sont rendues au-dessus de l'overlay (`z-[130]` > overlay `z-[120]`).
- **Organisation automatique** :
  - Bouton toolbar **« Organiser »** (`grid_view`) → recalcule TOUTE la disposition de façon **récursive et emboîtée** : zones conteneurs (`role:"zone"`) ▸ pages ▸ sections ▸ éléments. Les sous-groupes d'une zone sont placés en grille (retour à la ligne sur `ZONE_MAXW`), la zone se dimensionne automatiquement sur son contenu ; **les sections d'une page sont réparties en plusieurs colonnes** (retour à la ligne quand une colonne dépasse `SEC_MAX_COL_H` ≈ 520 px → page compacte et lisible au lieu d'une longue colonne unique), les éléments empilés dans leur section, toutes les tailles ajustées et espacées.
  - **Robustesse (anti-chevauchement)** : `smSectionsOf` prend l'union des sections rattachées par `parentId` ET de celles géométriquement contenues (sans parentId) → aucune section oubliée. Les **sections orphelines** (sans rattachement valide à une page) sont placées comme blocs de premier niveau dans la grille, et les **éléments non rattachés** (groupId vide/invalide) sont rangés en grille sous la carte → jamais de chevauchement même si l'IA a omis un `parentId`/`groupId`.
  - Volet d'une zone : bouton **« Organiser cette zone »** → réorganise UNIQUEMENT cette zone (garde sa position, range récursivement son contenu — sous-pages/sections/éléments —, ajuste sa taille).
  - Après une **mise à jour par IA** : si scopée à une zone → seule cette zone est réorganisée ; sinon → toute la carte.
  - **Prompt IA orienté organisation** : le prompt envoyé à l'IA (côté serveur `buildSitemapUpdatePrompt`) décrit le modèle ZONE conteneur ▸ PAGE ▸ SECTION ▸ ÉLÉMENT et impose une carte claire/aérée : regrouper les pages d'un même domaine dans des zones conteneurs (`parentId`), chaîner la hiérarchie (`parentId`/`groupId`), créer les sections manquantes, relier les domaines par des liaisons. **Granularité des sections** : peu de sections larges (1 à 4 par page), une section = aire structurelle (menu/content/header…) et JAMAIS une section par onglet/fonction (les onglets sont des éléments `link` dans une seule section « Onglets »). Rattachement obligatoire à une page existante via son `id` exact (ex : `pg-admin`). La hiérarchie produite par l'IA est rendue lisible par l'auto-layout récursif multi-colonnes.
- **Déplacement des nœuds (drag & drop)** :
  - Glisser un nœud le repositionne ; les **liaisons suivent** le déplacement en temps réel (positions recalculées).
  - Un clic sans mouvement (< 3px) ouvre/ferme le volet de détails ; au-delà, c'est un déplacement.
  - La disposition (nœuds + zones) est **persistée en localStorage** (`wo_sitemap_layout_v2`) et survit au rechargement.
  - Bouton **« Disposition »** (`restart_alt`) dans la barre d'outils : restaure la disposition par défaut (nœuds + zones).
- **Déplacement & redimensionnement des zones (groupes)** :
  - Glisser la **bordure** (le contour réagit, l'intérieur reste libre pour le pan) ou l'**étiquette** de la zone la déplace ; **tous les nœuds internes suivent** du même delta.
  - **Poignée de redimensionnement** (coin bas-droit, `nwse-resize`) : agrandit/réduit la zone (min 160×120 px). Les nœuds ne bougent pas au redimensionnement.
- **Multi-sélection & alignement de nœuds ET zones/sections** :
  - **Ctrl/Maj+clic** ajoute/retire un nœud **ou une zone/section** (clic sur sa bordure ou son étiquette) de la multi-sélection (contour cyan épais). Un clic simple réinitialise la sélection. Nœuds et zones peuvent être mélangés dans la même sélection.
  - Glisser un nœud déjà multi-sélectionné **déplace tout le groupe** ensemble.
  - **Barre d'alignement** (visible dès 2 boîtes sélectionnées, nœuds et/ou zones) : aligner gauche / centre vertical / droite, haut / milieu horizontal / bas ; **répartir** horizontalement/verticalement (dès 3 boîtes) ; **largeur** : réduire (`−`) / agrandir (`+`), **« Même largeur »** (uniformise sur la plus étroite) ; bouton « Effacer la sélection ».
  - **Aligner une zone entraîne son contenu** : déplacer une section/zone par alignement ou répartition déplace aussi du même delta ses nœuds internes et ses zones imbriquées (la section reste cohérente).
- **Largeur d'un élément** : le volet d'un élément propose « Réduire » / « Agrandir » la largeur (pas de 20 px, min 80 px), avec la largeur courante affichée.
- **Édition des liaisons (arêtes)** :
  - Clic sur une liaison la sélectionne (halo cyan) et ouvre un volet d'édition.
  - **Côté d'accroche** de chaque extrémité (départ / arrivée) : haut / bas / gauche / droite ; par défaut, choix automatique selon la position des nœuds.
  - **Courbure** : boutons « − Courber » / « Courber + » ou glisser la **poignée cyan** au milieu de la liaison (décalage perpendiculaire des points de contrôle).
  - **Libellé** et **type** (nav / auth / cross-app / relation) éditables dans le volet.
  - **Toute liaison est pleinement éditable et supprimable** (base ou personnalisée) : la liste complète des liaisons est persistée (`edgesAll`), donc une liaison d'origine peut être supprimée (elle ne réapparaît pas au rechargement) puis recréée via le mode « Liaison ».
  - Bouton **« Tracé automatique »** : réinitialise l'arête (supprime ses overrides).
  - Côtés + courbure sont **persistés** dans la disposition (`wo_sitemap_layout_v2`, clé `edges`).
- **Ajout de zones, inclusion, liaisons (édition de la carte)** :
  - Bouton **« Zone »** : ajoute une nouvelle zone (sélectionnée → volet d'édition : libellé, couleur dans une palette, suppression). Les zones de base ne sont pas supprimables.
  - **Inclusion d'un élément** : déposer un nœud à l'intérieur d'une zone le rattache à cette zone (`groupId`) → il suit ses déplacements. La plus petite zone contenant le centre l'emporte (nesting).
  - **Inclusion d'une zone** : déplacer une zone déplace aussi les zones entièrement contenues et leurs nœuds.
  - Les **poignées des zones** (bordure cliquable, étiquette, redimensionnement) sont rendues dans une **couche interactive au-dessus des arêtes et des nœuds** : une zone imbriquée reste sélectionnable/déplaçable même quand des liaisons la traversent.
  - Bouton **« Liaison »** (mode) : cliquer la source (surbrillance rose) puis la cible crée une nouvelle liaison (éditable / supprimable). Une extrémité peut être **un nœud OU une zone** → on peut relier nœud↔zone, zone↔zone, zone↔nœud. La géométrie des arêtes est calculée sur la « boîte » de l'élément (nœud ou zone) et suit ses déplacements/redimensionnements.
  - **Ciblage facile d'une zone** : en mode liaison, toute la surface de la zone est cliquable comme extrémité (les nœuds restent prioritaires au-dessus) ; on n'est pas obligé de viser la bordure ou l'étiquette.
  - Zones et liaisons personnalisées sont **persistées** (`customGroups`, `customEdges`) ; le bouton « Disposition » les supprime (retour à l'état par défaut).
- **Disposition partagée (serveur)** :
  - La disposition complète (positions/zones/liaisons/overrides) est enregistrée **côté serveur** (`data/tests-admin/sitemap-layout.json`) via `PUT /api/admin/tests/sitemap-layout` (débouncé ~600 ms), et chargée au démarrage via `GET …/sitemap-layout` → **tous les admins voient les mêmes modifications**.
  - Le localStorage (`wo_sitemap_layout_v2`) sert de **cache local / repli hors-ligne**.
  - La réinitialisation (« Disposition ») est elle aussi partagée (écrit l'état par défaut côté serveur).
- **Versions (snapshots) de la Site Map** :
  - Bouton **« Versions »** (`history`) → popup de gestion des versions.
  - **Enregistrer l'état actuel** sous un nom → snapshot complet de la disposition courante (bouton « Nouvelle »).
  - **Mettre à jour la dernière version** : bouton « Mettre à jour la dernière version (« nom ») » → écrase le contenu de la version la plus récente avec l'état courant (endpoint `PUT /api/admin/tests/sitemap-versions/:id`). Disponible uniquement pour la dernière version enregistrée.
  - **Liste** des versions (nom, date, auteur).
  - **Charger** une version (`restore`) : l'applique à la carte et la diffuse comme disposition courante (partagée).
  - **Supprimer** une version.
  - Stockage serveur : `data/tests-admin/sitemap-versions.json` ; endpoints `GET / POST / GET :id / DELETE :id` sur `/api/admin/tests/sitemap-versions`.
- **Créer une version par IA (mise à jour automatique)** :
  - Bouton **« Créer une version par IA »** (dans le popup Versions) → popup de config : choix **IA** + **modèle** (providers CLI) et consignes éditables.
  - L'IA lit la **Site Map actuelle** + le **code réel** (routes, composants, onglets) + **`data/histoModif.json`**, puis écrit un JSON d'**opérations** (ajout / modification / suppression) sur les **nœuds, zones et liaisons**.
  - **Popup de revue** : chaque proposition est cochable (badge op + type, before→after, justification) → rien n'est appliqué sans validation.
  - À l'application : ops cochées appliquées (placement auto des nouveaux éléments), diffusion (`persistLayout`) **et** enregistrement automatique d'une version **« MAJ IA — <date> »**.
  - Serveur : `POST /api/admin/tests/sitemap-update/prepare` (écrit le run) + `GET …/sitemap-update-stream` (SSE, exécute l'agent CLI via l'executor port 3002). Prérequis : executor lancé + provider CLI actif.
  - **Restreint à une zone** : le volet d'édition d'une zone propose **« Nouvelle version par IA (cette zone) »** → même flux restreint au périmètre de la page : ses **sections** (zones contenues) et leurs **éléments**, plus les **liaisons** impliquant ces éléments/sections. Le prompt liste les sections existantes (id + libellé) et impose : rattacher chaque élément au `groupId` de la **section** adaptée (pas la page), créer la section manquante si besoin (réutilisable via id temporaire dans la même réponse), et créer les **liaisons**. Côté application : passe 1 = création des zones (mapping id temporaire → id réel, nouvelles sections placées DANS la page), passe 2 = éléments rattachés à leur section + liaisons résolues. Version créée : `MAJ IA (<zone>) — <date>`.
- **Créer / lancer un test depuis un nœud** (volet de détails) :
  - **« Lancer »** (vert, `play_circle`) sur chaque section de test liée → pré-sélectionne la section et bascule sur l'onglet Exécution.
  - **« Créer une section de test ici »** (indigo, `add`) → ouvre le popup de création pré-rempli (section parente = chemin du nœud, titre/slug d'après le label).
- **Carte en pleine largeur** : la zone SVG occupe toute la largeur disponible ; le volet de détails s'affiche en **overlay** (coin haut-droit) au clic sur un nœud, sans réduire la largeur de la carte.
- **Lisibilité des liaisons** : chaque arête est tracée avec un **halo sombre** sous le trait coloré (la liaison reste lisible quand elle survole un nœud), une courbure de Bézier plus ample, et son libellé posé **sur la courbe** (point à t=0.5) dans une pastille bordée de la couleur de l'arête.
- **Volet latéral** (clic sur un nœud) :
  - **Titre éditable** : champ « Titre » modifiant le libellé du nœud (persisté dans la disposition, override `label`).
  - Label, URL, badges (type + port), description (rôle dans le parcours).
  - Liste des **composants Angular** réels du nœud.
  - Liste des **onglets** (si page tabulée).
  - Liste des **chemins du cahier de recette** associés.
  - Bouton « Ouvrir la page » (`http://localhost:<port><url>`) ou mention « Widget embarqué » si pas de route propre.
- **Filtre par section du cahier de recette** :
  - Dropdown listant toutes les sections (mêmes données que l'onglet Exécution).
  - Section sélectionnée → nœuds liés mis en surbrillance (autres en opacité réduite) + chip avec ✕.
  - **Bouton "Voir seulement cette section"** : masque les nœuds/groupes non liés à la section.
- Composants : `AdminTestsComponent` (onglet `sitemap`), données par défaut `SM_BASE_GROUPS`, `SM_BASE_NODES`, `smEdges` dans le TS ; signaux `smGroups`/`smNodes` pour la disposition éditable (à maintenir à jour avec les routes/onglets réels).

### 2-1-3-1 — Gestion du thème global (Page: Admin › Thème — Fonctions métier)
- **Sélection du thème** : dark | light | pink
- **Aperçu en temps réel** : le thème s'applique immédiatement à l'interface
- **Persistance** : stocké dans `localStorage` et propagé via `ConfigService`
- **Thèmes disponibles** :
  - `dark` : fond sombre, texte clair (défaut)
  - `light` : fond clair, texte sombre
  - `pink` : thème rose

### 2-1-3-2 — Branding / Personnalisation (Page: Admin › Thème — Fonctions métier)
- **Modification couleurs primaires** : palette de couleurs de l'interface
- **Logo** : upload ou sélection du logo de l'application
- **Nom de l'application** : éditable via `APP_BRANDING` token
- **Thème child** : chargé depuis `data/child/theme.json`
- **Variables CSS** : `--btn-text-color`, couleurs de surface, bordures, etc.

### 2-1-3-3 — Aperçu (Page: Admin › Thème — Fonctions métier)
- **Rendu live** : les changements de couleur sont visibles immédiatement
- **Reset** : bouton pour revenir aux valeurs par défaut

### 2-1-3-4 — États (Page: Admin › Thème — Fonctions métier)
| État | Description |
|------|-------------|
| Thème dark actif | Fond sombre, indicateur actif |
| Thème light actif | Fond clair, indicateur actif |
| Thème pink actif | Fond rose, indicateur actif |
| Sauvegarde | Confirmation visuelle |

### 2-1-4-1 — Chargement (Page: Admin › Utilisateurs — Fonctions métier)
- **Liste des utilisateurs** : GET `/api/auth/users` au chargement de l'onglet
- **État chargement** : indicateur spinner pendant la requête
- **État erreur** : message si la requête échoue

### 2-1-4-2 — Affichage liste (Page: Admin › Utilisateurs — Fonctions métier)
- **Colonnes affichées** : username, email, rôle (admin/user), date de création, dernière connexion
- **Indicateur "connexion ancienne"** : badge si `lastLogin` > 5 jours
- **Format date** : locale `fr-FR` (JJ/MM/AAAA HH:MM)
- **Compteur** : nombre total d'utilisateurs affiché dans le badge de l'onglet

### 2-1-4-3 — Création d'un utilisateur (Page: Admin › Utilisateurs — Fonctions métier)
- **Ouverture modal** : clic bouton "Nouvel utilisateur" → `openNewUserModal()`
- **Champs** : username (requis), email (requis, format email), mot de passe (requis), rôle (user|admin)
- **Validation** : tous les champs requis, email unique
- **Soumission** : POST `/api/auth/register` puis si rôle admin : PUT `/api/auth/users/{id}` `{ role: 'admin' }`
- **Succès** : modal fermée, liste rechargée, action tracée dans WoActionHistory
- **Erreur** : message d'erreur dans la modal

### 2-1-4-4 — Édition d'un utilisateur (Page: Admin › Utilisateurs — Fonctions métier)
- **Ouverture** : clic "Modifier" sur une ligne → `openEditUser(user)` → populate le formulaire
- **Champs modifiables** : username, email, rôle, mot de passe (optionnel)
- **Soumission** : PUT `/api/auth/users/{id}`
- **Succès** : modal fermée, liste rechargée, action tracée dans WoActionHistory
- **Erreur** : message dans la modal

### 2-1-4-5 — Suppression d'un utilisateur (Page: Admin › Utilisateurs — Fonctions métier)
- **Déclenchement** : clic "Supprimer" → `confirmDeleteUser(id)` → modal de confirmation
- **Confirmation** : message "Êtes-vous sûr ?" avec bouton confirmer
- **Suppression** : DELETE `/api/auth/users/{id}`
- **Succès** : liste rechargée, action tracée dans WoActionHistory
- **Règle** : impossible de supprimer son propre compte

### 2-1-4-6 — États (Page: Admin › Utilisateurs — Fonctions métier)
| État | Description |
|------|-------------|
| Chargement | Spinner, liste masquée |
| Erreur chargement | Message d'erreur, bouton réessayer |
| Liste vide | Message "Aucun utilisateur" |
| Modal création ouverte | Formulaire visible |
| Modal édition ouverte | Formulaire pré-rempli |
| Modal suppression | Confirmation requise |
| Sauvegarde en cours | Bouton désactivé |

### 2-2-1 — Thème (Page: Configuration — Fonctions métier)
- Changement de thème au clic sur le bouton : cycle entre dark, light et pink (toggleTheme)
- Persistance du thème sélectionné dans le localStorage
- Application immédiate de la classe CSS correspondante sur l'élément <html> (dark ou dark+pink)
- Changement d'icône dynamique sur le bouton en fonction du thème (dark_mode, light_mode, favorite)
- **Composants:** `apps/portail/src/app/pages/user/config/config.component.ts`, `apps/portail/src/app/pages/user/config/config.component.html`

### 2-2-2 — Clés API (Page: Configuration — Fonctions métier)
- Affichage/masquage de la section des clés au clic sur le toggle d'activation globale (toggleApiKeys)
- Saisie de la clé API Gemini et activation via sa checkbox dédiée
- Affichage/masquage en clair de la clé API Gemini en cliquant sur le bouton de visibilité
- Saisie de la clé API Claude et activation via sa checkbox dédiée
- Affichage/masquage en clair de la clé API Claude en cliquant sur le bouton de visibilité
- Chargement initial des clés et de leur état d'activation via GET /api/config/keys
- Persistance des clés lors de la sauvegarde manuelle via POST /api/config/keys au format imbriqué { gemini: { key, active }, claude: { key, active } }
- **Composants:** `apps/portail/src/app/pages/user/config/config.component.ts`, `apps/portail/src/app/pages/user/config/config.component.html`, `server/server-data.js`

### 2-2-3 — Configuration CLI IA (Page: Configuration — Fonctions métier)
- Affichage/masquage de la section des outils CLI au clic sur son toggle global (toggleCliIa)
- Activation/désactivation d'un fournisseur CLI (Antigravity ou Claude) via sa checkbox dédiée (toggleProvider)
- Activation de tous les modèles d'un fournisseur CLI par défaut lors de son activation
- Désactivation automatique et décochage de tous les modèles d'un fournisseur CLI s'il est désactivé
- Activation/désactivation individuelle des modèles disponibles pour chaque fournisseur (toggleModel)
- Tri automatique des modèles d'un fournisseur par coût total décroissant (sortModelsByCost)
- Affichage d'un badge indiquant la source des modèles disponibles : "API" (direct) ou "Fallback" (statique)
- Récupération rapide de l'état d'installation via GET /api/cli-check-only?force=true
- Récupération complète des versions installées, dates de dernière mise à jour et modèles via GET /api/cli-status
- Affichage d'un spinner de chargement individuel par fournisseur lors des vérifications
- Affichage d'une alerte bloquante si le serveur executor sur le port 3002 n'est pas disponible, avec bouton pour réessayer (loadCliStatus)
- Sauvegarde automatique immédiate de la configuration lors du basculement d'un fournisseur ou d'un modèle (saveKeys)
- **Composants:** `apps/portail/src/app/pages/user/config/config.component.ts`, `apps/portail/src/app/pages/user/config/config.component.html`, `libs/portail-core/data-access/src/lib/config.service.ts`, `electron/executor/server-executor.js`

### 2-2-4 — Outils externes (activation/désactivation) (Page: Configuration — Fonctions métier)
- Affichage/masquage de la zone IA dans le header de l'application via son toggle dédié (toggleHeaderIa)
- Activation/désactivation de l'Historique des actions dans la navigation principale via son toggle dédié (toggleWoActionHistoryNav)
- Enregistrement immédiat dans l'historique d'actions (tracking de l'action toggle pour 'woActionHistoryNav')
- Sauvegarde et propagation de l'état de l'historique de navigation via le signal global configService.saveNavItems
- Chargement initial et envoi des configurations des outils secondaires (tickets, recette, tchat, actions) lors de la sauvegarde manuelle
- **Composants:** `apps/portail/src/app/pages/user/config/config.component.ts`, `apps/portail/src/app/pages/user/config/config.component.html`, `libs/portail-core/data-access/src/lib/config.service.ts`, `server/server-data.js`

### 2-2-5 — Mise à jour des coûts modèles (admin) (Page: Configuration — Fonctions métier)
- Déclenchement de la mise à jour des coûts par fournisseur au clic sur le bouton "Mettre à jour les coûts" via POST /api/admin/update-models-costs
- Rechargement automatique de l'état local du CLI concerné après mise à jour des coûts (loadCliStatus)
- Affichage des coûts en tokens d'entrée (In) et de sortie (Out) en dollars par million de tokens pour chaque modèle
- Affichage de la date et heure de dernière mise à jour des coûts formatée au format local français (formatDate)
- **Composants:** `apps/portail/src/app/pages/user/config/config.component.ts`, `apps/portail/src/app/pages/user/config/config.component.html`, `server/server-data.js`

### 2-2-6 — Sauvegarde (Page: Configuration — Fonctions métier)
- Sauvegarde automatique en arrière-plan sur les actions rapides de toggles de CLI (saveKeys avec isAutoSave = true)
- Déclenchement d'une sauvegarde manuelle complète de tous les champs via le bouton "Sauvegarder" (saveKeys)
- Transition d'états de sauvegarde gérée par la variable saveStatus (idle -> saving -> success ou error)
- Désactivation du bouton de sauvegarde et affichage d'un spinner pendant l'enregistrement
- Affichage d'un badge de confirmation vert avec message personnalisé pendant 3 secondes après un succès, puis retour à l'état initial (idle)
- Affichage d'un message d'erreur rouge pendant 3 secondes en cas d'échec de la requête
- Propagation immédiate des modifications aux signaux de configService en local pour réactivité UI
- Mise à jour conjointe de la configuration utilisateur en BDD (table users) et du fichier global conf.json pour la version et outils activés
- **Composants:** `apps/portail/src/app/pages/user/config/config.component.ts`, `apps/portail/src/app/pages/user/config/config.component.html`, `libs/portail-core/data-access/src/lib/config.service.ts`, `server/server-data.js`

### 2-2-7 — États (Page: Configuration — Fonctions métier)
- État de chargement initial : spinners affichés pour chaque fournisseur CLI tant que le chargement n'est pas terminé (cliConfigLoaded/cliStatusLoaded)
- État section clés masquée : les champs de clé API ne sont pas rendus si apiKeysEnabled est désactivé
- État section CLI masquée : toute la section de configuration des CLI n'est pas rendue si cliIaEnabled est désactivé
- État fournisseur inactif : badge du statut d'installation affiché en grisé et modèles affichés avec opacité réduite (40%) si non installé
- État modèle désactivé : case à cocher non cochée pour les modèles exclus de la visibilité du header
- État serveur executor indisponible : bandeau d'alerte rouge avec message d'Electron non démarré et bouton Réessayer
- État sauvegarde en cours : bouton "Sauvegarder" désactivé avec spinner
- État sauvegarde OK : badge vert de confirmation avec message de succès visible pendant 3 secondes
- État erreur sauvegarde : badge rouge avec message d'erreur visible pendant 3 secondes
- **Composants:** `apps/portail/src/app/pages/user/config/config.component.ts`, `apps/portail/src/app/pages/user/config/config.component.html`

### 2-2-8 — Version de l'application (Page: Configuration — Fonctions métier)
- Affichage de la version courante de l'application chargée depuis conf.json (via GET /api/config/keys)
- Modification de la version via le champ de saisie de texte dédié dans la section Général
- Persistance du numéro de version dans le fichier conf.json global lors d'une sauvegarde manuelle (POST /api/config/keys)
- **Composants:** `apps/portail/src/app/pages/user/config/config.component.ts`, `apps/portail/src/app/pages/user/config/config.component.html`, `server/server-data.js`

### 2-3-1 — Chargement (Page: Déploiements — Fonctions métier)
- **Requêtes parallèles** : Lance en parallèle les appels GET `/api/version/check` et GET `/api/admin/deployments` à l'initialisation du composant
- **Statut de version** : Récupère la version locale (`localVersion`), le statut `upToDate`, le dernier déploiement (`latestDeployment`) et la branche courante (`currentBranch`)
- **Échec silencieux du statut** : L'échec du chargement du statut de version (`/api/version/check`) est ignoré silencieusement sans bloquer le reste de l'affichage
- **Liste des déploiements** : Récupère l'historique des 100 derniers déploiements via GET `/api/admin/deployments` avec en-tête `Authorization: Bearer <token>` si le token `frankenstein_token` est présent dans le localStorage
- **Autorisation requise** : Renvoie une erreur 403 si l'utilisateur n'a pas le rôle `admin` sur l'API des déploiements
- **Guard d'accès** : Vérifie que l'accès à la route `/deployments` est protégé par `authGuard` côté client Angular
- **Composants:** `apps/portail/src/app/pages/user/deployments/deployments.component.ts`, `server/server-data.js`, `apps/portail/src/app/base-routes.ts`

### 2-3-2 — Affichage (Page: Déploiements — Fonctions métier)
- **Bannière de statut** : Affiche une bannière jaune "Ce poste est à jour — v<localVersion>" avec icône succès si à jour, ou rouge "Mise à jour requise — ce poste est en v<localVersion>, la dernière version est v<latestVersion>" avec icône d'avertissement
- **Détails du dernier déploiement** : Affiche le titre du commit, la date de déploiement (formatée le DD/MM/YYYY à HH:mm) et le nom de l'auteur du dernier déploiement dans la bannière s'il est disponible
- **Tableau des déploiements** : Affiche la liste des déploiements du plus récent au plus ancien (limité aux 100 derniers)
- **Mise en valeur de la version actuelle** : La ligne correspondant à la version actuelle (`localVersion`) a un fond jaune et affiche un badge jaune "actuel"
- **Badge type commit** : Affiche le type court (`FIX` en rouge, `AME` aux couleurs du thème primaire, `MRG` en violet) extrait du titre du commit par `extractCommitType()` et `shortCommitType()`
- **Badges de scope et features** : Affiche les scopes concernés avec des couleurs distinctes (frankenstein : primaire, server : vert, electron : violet, data : orange, autres : gris) et liste les features associées (préfixées par ●) obtenues via `getScopedRows()`
- **Compatibilité des formats de features** : Gère via `getScopedRows()` l'association directe (`scope:feature1|feature2`) ainsi que l'ancien format positionnel (index à index)
- **Titre du commit** : Affiche le titre nettoyé via `extractCommitTitle()` sans les métadonnées de type de commit (remplace ` - [TYPE] - ` par ` - `)
- **Date et auteur** : Affiche la date de déploiement formatée en locale française (DD/MM/YYYY HH:mm) et le nom de l'auteur du déploiement
- **Composants:** `apps/portail/src/app/pages/user/deployments/deployments.component.ts`, `apps/portail/src/app/pages/user/deployments/deployments.component.html`

### 2-3-3 — Navigation (Page: Déploiements — Fonctions métier)
- **Retour** : Un clic sur le bouton retour (icône `arrow_back`) redirige vers la page d'administration `/admin` avec le paramètre de requête `tab=deploiement`
- **Composants:** `apps/portail/src/app/pages/user/deployments/deployments.component.html`, `apps/portail/src/app/base-routes.ts`

### 2-3-4 — États (Page: Déploiements — Fonctions métier)
- **Chargement** : Affiche un spinner (`progress_activity` animé) lorsque les données sont en cours de récupération (`loading() === true`)
- **Version à jour** : Affiche le statut "Ce poste est à jour" avec un fond jaune/orange très clair
- **Version obsolète** : Affiche le statut "Mise à jour requise" avec un fond rouge très clair
- **Statut absent** : La bannière de statut supérieure n'est pas affichée du tout si la requête `/api/version/check` n'a pas encore abouti ou a échoué
- **Liste vide** : Affiche le message "Aucun déploiement enregistré" si la liste des déploiements est vide
- **Erreur** : Affiche un bloc d'erreur rouge contenant le message d'erreur si la requête d'historique échoue (ex: 403 "Admin requis" ou erreur réseau)
- **Composants:** `apps/portail/src/app/pages/user/deployments/deployments.component.ts`, `apps/portail/src/app/pages/user/deployments/deployments.component.html`

### 2-3-5 — Rafraîchissement (Page: Déploiements — Fonctions métier)
- **Bouton de rafraîchissement** : Présence d'un bouton avec l'icône `refresh` à côté du titre du tableau
- **Rechargement manuel** : Un clic sur le bouton relance la fonction `loadDeployments()` pour récupérer à nouveau uniquement la liste des déploiements
- **Non-réévaluation du statut** : Le clic sur rafraîchir n'appelle pas à nouveau `loadVersionStatus()`
- **Réinitialisation des erreurs** : Le clic efface le message d'erreur précédent et repasse l'état en chargement
- **Composants:** `apps/portail/src/app/pages/user/deployments/deployments.component.ts`, `apps/portail/src/app/pages/user/deployments/deployments.component.html`

### 2-3-6 — Vérification de version côté serveur (Page: Déploiements — Fonctions métier)
- **Lecture du fichier de version local** : Lit le fichier `version.json` à la racine pour obtenir la version locale. Si le fichier contient un BOM UTF-8 (0xFEFF), il est retiré avant parsing
- **Récupération du dernier déploiement** : Recherche le dernier enregistrement dans la table `app_deployments` où la branche est 'main', vide, ou NULL, ordonné par date décroissante
- **Calcul du statut de mise à jour** : Détermine que le poste est à jour (`upToDate: true`) si aucun déploiement n'est trouvé en base ou si la version du dernier déploiement correspond à la version locale
- **Détermination de la branche Git** : Exécute de façon synchrone `git branch --show-current` à la racine du projet avec un timeout de 2 secondes pour renvoyer la branche courante (repli sur 'main' en cas d'erreur)
- **Composants:** `server/server-data.js`, `version.json`

### 2-4-1-1 — Gestion des actions (Page: Outils › Actions IA (Orchestrateur) — Fonctions métier)
- **Création** : nouvelle action avec prompt IA et configuration
- **Édition** : modification d'une action existante
- **Suppression** : avec confirmation

### 2-4-1-2 — Exécution batch (Page: Outils › Actions IA (Orchestrateur) — Fonctions métier)
- **Lancement** : `runActions()` → exécution séquentielle ou parallèle des prompts
- **Branch Git** : chaque exécution peut créer une branche dédiée
- **Commit automatique** : résultats commités sur la branche
- **Logs** : affichage en temps réel des sorties

### 2-4-1-3 — Historique (Page: Outils › Actions IA (Orchestrateur) — Fonctions métier)
- **Liste** : historique des exécutions avec statut et résultats
- **Détail** : clic → voir les logs et résultats complets

### 2-4-1-4 — États (Page: Outils › Actions IA (Orchestrateur) — Fonctions métier)
| État | Description |
|------|-------------|
| Désactivé | Non visible si désactivé dans config |
| CLI non installé | Message + lien installation |
| Exécution en cours | Logs en temps réel |
| Terminé avec succès | Badge vert |
| Erreur | Badge rouge + détail |

### 2-4-2-1 — Gestion des campagnes de test (Page: Outils › Cahier de Recette — Fonctions métier)
- **Création** : nouvelle campagne avec titre et description
- **Édition** : modification d'une campagne existante
- **Suppression** : avec confirmation
- **Liste** : affichage de toutes les campagnes avec statut (en attente, en cours, terminé, erreur)

### 2-4-2-2 — Cas de test (Page: Outils › Cahier de Recette — Fonctions métier)
- **Ajout** : nouveau cas de test dans une campagne (titre, description, étapes)
- **Variables** : définition de variables substituables dans les prompts IA
- **Ordre** : réorganisation des cas de test

### 2-4-2-3 — Exécution des tests (Page: Outils › Cahier de Recette — Fonctions métier)
- **Lancement** : `runCampaign(campaignId)` → exécution séquentielle des cas de test
- **Exécution IA** : chaque cas envoyé au provider IA configuré
- **Résultats** : statut par cas (succès/échec), réponse IA, temps d'exécution
- **Rapport** : synthèse globale à la fin de la campagne

### 2-4-2-4 — États (Page: Outils › Cahier de Recette — Fonctions métier)
| État | Description |
|------|-------------|
| Désactivé | Non visible si désactivé dans config |
| Aucune campagne | Message + bouton créer |
| Campagne en cours | Barre de progression, cas en cours surligné |
| Test réussi | Badge vert |
| Test échoué | Badge rouge + détail erreur |
| Rapport disponible | Synthèse cliquable |

### 2-4-3-1 — Conversation (Page: Outils › Tchat IA — Fonctions métier)
- **Envoi message** : saisie + Enter → streaming SSE
- **Réponse IA** : affichage progressif caractère par caractère
- **Historique** : conversation conservée pendant la session

### 2-4-3-2 — Sélection du modèle (Page: Outils › Tchat IA — Fonctions métier)
- **Provider** : Claude ou Gemini
- **Modèle** : liste depuis `ConfigService.cliConfig().modelsList`
- **Persistance** : modèle sélectionné mémorisé

### 2-4-3-3 — États (Page: Outils › Tchat IA — Fonctions métier)
| État | Description |
|------|-------------|
| Tchat désactivé | Pas visible (ConfigService) |
| Sans clé API | Message invitation à configurer |
| En attente réponse | Spinner |
| Streaming | Texte progressif |
| Erreur API | Message d'erreur |

### 2-4-4-1 — Capture d'écran (Page: Outils › Tickets / Signalement Bugs — Fonctions métier)
- **Déclenchement** : clic bouton "Capturer l'écran" → `html2canvas` sur `document.body`
- **Rendu** : screenshot de la page courante en image PNG
- **Affichage** : aperçu dans le widget

### 2-4-4-2 — Annotation (Page: Outils › Tickets / Signalement Bugs — Fonctions métier)
- **Canvas interactif** : dessiner sur le screenshot avec la souris
- **Outils** : crayon, couleur, épaisseur
- **Effacer** : bouton reset

### 2-4-4-3 — Soumission d'un ticket (Page: Outils › Tickets / Signalement Bugs — Fonctions métier)
- **Champs** : titre, description, sévérité (low/medium/high/critical)
- **Screenshot** : attaché automatiquement (base64)
- **Envoi** : POST `/api/tickets` ou stockage local
- **Confirmation** : toast "Ticket soumis"

### 2-4-4-4 — Liste des tickets (Page: Outils › Tickets / Signalement Bugs — Fonctions métier)
- **Affichage** : liste des tickets avec statut, date, sévérité
- **Filtres** : par statut (ouvert/fermé), par sévérité

### 2-4-4-5 — États (Page: Outils › Tickets / Signalement Bugs — Fonctions métier)
| État | Description |
|------|-------------|
| Désactivé | Non visible si désactivé dans config |
| Capture en cours | Spinner |
| Annotation | Canvas visible |
| Soumission | Bouton désactivé |
| Succès | Toast de confirmation |
| Erreur | Message d'erreur |

### 2-5-1-1 — Chargement (Page: Projets › Accueil — Fonctions métier)
- **Liste des projets** : GET `/api/frank/projects` au montage
- **Statut GitHub** : GET `/api/frank/projects/github-reachable` → `{ reachable: boolean }` (si au moins un projet GitHub)
- **État chargement** : spinner pendant la requête
- **Tri** : par date de mise à jour décroissante

### 2-5-1-2 — Affichage de la grille (Page: Projets › Accueil — Fonctions métier)
- **Carte projet** : titre, date création/MàJ (`JJ/MM/AAAA HH:MM`), statut (Brouillon/Publié), badge backup
- **Badges backup** : GitHub (violet), GitLab (orange), FTP (cyan), Google Drive (vert)
- **Warning GitHub offline** : badge rouge si `backupType=github` et GitHub injoignable
- **Menu actions** : clic bouton actions → Modifier | Copier | Ouvrir dossier | Supprimer

### 2-5-1-3 — Création d'un projet (Page: Projets › Accueil — Fonctions métier)
- **Ouverture modal** : clic "Nouveau projet" → `openNewModal()`
- **Champs** : titre (requis), description (optionnel)
- **Soumission** : POST `/api/frank/projects`
- **Succès** : navigation vers éditeur `/projets/{id}`, action tracée (WoActionHistory)
- **Erreur** : message dans la modal
- **Fermeture** : Escape ou clic hors modal

### 2-5-1-4 — Édition inline titre/description (Page: Projets › Accueil — Fonctions métier)
- **Déclenchement** : clic "Modifier" → `startEdit(project)`
- **Champs éditables** : titre, description
- **Sauvegarde** : clic "Sauvegarder" ou Enter → PUT `/api/frank/projects/{id}`
- **Annulation** : Escape → `cancelEdit()`
- **Validation** : titre non vide requis
- **Succès** : liste rechargée, action tracée

### 2-5-1-5 — Copie d'un projet (Page: Projets › Accueil — Fonctions métier)
- **Déclenchement** : clic "Copier" → `openCopyModal(project)`
- **Champ** : nouveau titre (pré-rempli avec "Copie de {titre}")
- **Soumission** : POST `/api/frank/projects/{id}/copy`
- **Succès** : navigation vers le nouveau projet, action tracée
- **Erreur** : message dans la modal

### 2-5-1-6 — Ouverture du dossier projet (Page: Projets › Accueil — Fonctions métier)
- **Déclenchement** : clic icône dossier
- **Action** : ouvre le dossier `data/projets/{id}/` dans l'explorateur de fichiers via Electron IPC

### 2-5-1-7 — Suppression d'un projet (Page: Projets › Accueil — Fonctions métier)
- **Déclenchement** : clic "Supprimer" → `confirmDelete(id)` → confirmation modale
- **Confirmation** : bouton rouge "Supprimer définitivement"
- **Suppression** : DELETE `/api/frank/projects/{id}`
- **Succès** : liste rechargée, action tracée
- **Règle** : action irréversible (pas d'undo)

### 2-5-1-8 — Recherche fulltext (F4) (Page: Projets › Accueil — Fonctions métier)
- **Raccourci** : F4 → `ProjetSearchComponent` s'ouvre
- **Recherche** : fulltext dans le contenu de tous les projets via `SearchService`
- **Résultats** : liste de sections avec extrait du contenu correspondant
- **Navigation** : clic résultat → `/projets/{id}?section={sectionId}`
- **Fermeture** : Escape

### 2-5-1-9 — Navigation vers l'éditeur (Page: Projets › Accueil — Fonctions métier)
- **Clic sur une carte** : navigate `/projets/{id}`
- **Clic sur le titre** : idem
- **Double-clic sur titre en mode édition** : mode édition inline

### 2-5-1-10 — États (Page: Projets › Accueil — Fonctions métier)
| État | Description |
|------|-------------|
| Chargement | Spinner centré |
| Liste vide | Message "Aucun projet" + bouton créer |
| GitHub offline | Badge warning sur projets GitHub |
| Modal création ouverte | Formulaire visible |
| Mode édition inline | Champs texte visibles sur la carte |
| Modal copie ouverte | Champ nouveau titre |
| Modal suppression | Double confirmation |
| Sauvegarde en cours | Bouton désactivé |

### 2-5-2-10-1 — Onglet Semaine (Page: Éditeur › Outil Agenda — Fonctions métier)
- **Grille horaire** : colonne heures (0h-23h) + 7 colonnes jours (Lun-Dim), hauteur fixe de 56px par heure
- **En-tête jours** : nom court du jour + numéro du jour, date courante surlignée en primary
- **Navigation** : boutons ◀/▶ changent la semaine affichée, bouton "Aujourd'hui" revient à la semaine courante
- **Période** : label dynamique en en-tête (ex: "9 – 15 juin 2026")
- **Événements** : blocs colorés positionnés par heure (top + height calculés depuis startDate/endDate)
- **Clic sur cellule** : ouvre le popup de création avec la date et l'heure pré-remplies
- **Clic sur événement** : ouvre le popup d'édition avec les données de l'événement

### 2-5-2-10-2 — Onglet Mois (Page: Éditeur › Outil Agenda — Fonctions métier)
- **Grille calendrier** : 7 colonnes (L à D) × 4-6 lignes selon le mois, avec en-tête jours semaine
- **Jours hors mois** : affichés en opacité réduite (40%)
- **Jour courant** : numéro affiché dans un cercle primary
- **Navigation** : boutons ◀/▶ changent le mois, "Aujourd'hui" revient au mois courant
- **Chips événements** : max 3 chips colorées par case, libellé tronqué, mention "+N de plus" si plus de 3
- **Clic sur case** : ouvre le popup de création pré-rempli avec la date du jour (allDay activé)
- **Clic sur chip** : ouvre le popup d'édition de l'événement

### 2-5-2-10-3 — Onglet Année (Page: Éditeur › Outil Agenda — Fonctions métier)
- **Grille annuelle** : 12 colonnes (mois) × 31 lignes (jours), colonne numéros de jours à gauche
- **Jours invalides** : cellules grisées pour les jours inexistants (ex: 30 fév, 31 nov)
- **Jours avec événements** : fond coloré (couleur du premier événement du jour)
- **Navigation** : boutons ◀/▶ changent l'année, "Aujourd'hui" revient à l'année courante
- **Clic sur cellule valide** : ouvre le popup de création pré-rempli avec la date

### 2-5-2-10-4 — Popup événement (Page: Éditeur › Outil Agenda — Fonctions métier)
- **Champs** : Titre (requis), Date début, Date fin, Toute la journée (checkbox), Description, Couleur (6 choix)
- **Mode allDay** : bascule les inputs datetime en inputs date simple
- **Palette couleurs** : 6 options (indigo, émeraude, ambre, rose, ciel, violet), sélection visuelle
- **Création** : bouton "Créer" actif uniquement si titre non vide ; crée le fichier JSON dans `data/projets/{id}/agenda/`
- **Édition** : même popup, bouton "Modifier" met à jour le fichier JSON
- **Suppression** : bouton "Supprimer" (rouge) visible en mode édition ; supprime le fichier JSON
- **Fermeture** : clic en dehors du popup ou bouton ✕
- **Feedback chargement** : bouton affiche "Enregistrement..." pendant la requête

### 2-5-2-11-1 — Création d'une instance Array (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Déclenchement** : bouton "Array" dans la barre Mega-Outils → popup
- **Nom** : champ texte modifiable (défaut "Mon Tableau")
- **Validation** : `confirmArrayPopup()` → `createInstance({ type: 'array', name, folderId })`
- **Résultat** : instance créée en BDD, `megaOutilCreated` émis vers le parent

### 2-5-2-11-2 — Affichage du panneau tableur (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Visibilité** : panneau bas affiché dans les 3 modes (Code, Structure, Preview) dès qu'une instance Array est associée à la section active
- **Résolution** : `contentArrayIds` = instances dont `folderId` correspond au `activeNodeId` courant
- **Réduction** : bouton toggle `arrayPanelCollapsed`

### 2-5-2-11-3 — Édition des cellules (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Sélection** : clic simple → cellule sélectionnée (outline ring vert)
- **Edition inline** : double-clic ou F2 → `<input>` inséré dans la cellule
- **Validation** : Enter (ligne suivante), Tab (colonne suivante), Shift+Tab (colonne précédente)
- **Annuler** : Escape → annule sans sauvegarder
- **Persistance** : `PATCH /api/mega-outils/array/:id/cell` → SSE `array_update` broadcasted

### 2-5-2-11-11 — Affichage stylisé en mode Preview (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Déclenchement** : passage en mode Preview (visu)
- **Chargement** : `loadAllVisuArrayGrids()` charge toutes les grilles manquantes via API, puis reconstruit les sections visu
- **Rendu** : le bloc `'array` est remplacé par `<div class="visu-array-wrap">` contenant un `<table class="visu-array-table">` HTML
- **Styles inline** : `background-color`, `color`, `font-weight`, `font-style`, `text-align` appliqués depuis `cell.style` de chaque cellule
- **Formules** : `cell.computed` affiché si disponible, sinon `cell.value`
- **Réactivité** : `onArrayGridChanged` met à jour le cache et reclenche `buildVisuSections()`
- **Dark mode** : bordures adaptées via `.dark .visu-array-wrap`

### 2-5-2-11-4 — Formules (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Syntaxe** : `=FUNC(range)` ou `=A1+B2`
- **Fonctions** : `SUM`, `AVG`, `COUNT`, `MAX`, `MIN`
- **Références** : `A1` → row=0, col=0 ; range `A1:C3`
- **Affichage** : valeur `computed` affichée ; formule brute visible en mode édition
- **Mode Preview** : lecture seule, résultats évalués uniquement
- **Mode construction** : taper `=` active le mode formule ; cliquer une autre cellule insère sa référence (ex: `B2`) dans l'input à la position curseur sans fermer l'édition ; les cellules référencées sont surlignées en bleu ; Enter valide et calcule le résultat
- **Ré-édition** : double-clic sur une cellule avec formule affiche la formule brute dans l'input pour modification

### 2-5-2-11-5 — Ajout / suppression lignes et colonnes (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Ajouter ligne** : bouton "+ Ligne" en bas du tableau → `POST .../addRow`
- **Ajouter colonne** : bouton "+" dans l'en-tête des colonnes → `POST .../addCol`
- **Supprimer ligne** : icône ✕ à droite de chaque ligne, ou menu contextuel
- **Supprimer colonne** : menu contextuel → `DELETE .../col/:col`
- **Minimum** : 1 ligne et 1 colonne obligatoires

### 2-5-2-11-6 — Redimensionnement colonnes / lignes (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Colonne** : drag handle sur le bord droit de l'en-tête → `PUT .../grid` (colWidths)
- **Ligne** : drag handle sur le bord bas du numéro de ligne → `PUT .../grid` (rowHeights)
- **Minimum** : 40px

### 2-5-2-11-7 — Styles de cellules, lignes et colonnes (menu contextuel) (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Déclenchement** : clic droit sur une cellule
- **Style cellule** : Gras, Italique, Aligner gauche/centre/droite, Couleur fond, Couleur texte
- **Style ligne** : Fond ligne, Texte ligne → applique à toutes les cellules de la ligne via `PUT /grid`
- **Style colonne** : Fond colonne, Texte colonne → applique à toutes les cellules de la colonne
- **Fix** : `stopPropagation` sur le menu empêche la fermeture au clic du color picker
- **Persistance** : `style` stocké dans `cells[row][col].style` en JSON MySQL

### 2-5-2-11-10 — Copier / Couper / Coller (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Déclenchement** : menu contextuel (clic droit) ou raccourcis clavier Ctrl+C / Ctrl+X / Ctrl+V
- **Copier** : stocke la cellule (valeur + style) dans le signal `clipboard`
- **Couper** : stocke la cellule + efface la source après collage
- **Coller** : applique la valeur et le style de la cellule copiée/coupée à la cellule sélectionnée
- **Raccourcis** : Ctrl+C/X/V uniquement quand une cellule est sélectionnée et non en édition

### 2-5-2-11-12 — Format code complet + sync bidirectionnelle (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Format du bloc `'array`** : une ligne par cellule non-vide + entêtes de config
  - `cols:w1,w2,...` → largeurs de colonnes (px)
  - `rows:h1,h2,...` → hauteurs de lignes (px)
  - `A1:valeur` → cellule simple
  - `A1:=SUM(B1:B3)|bold|center|bg=#ff0000|color=#ffffff` → formule + styles
- **Propriétés style** : `bold`, `italic`, `center`, `right`, `left`, `bg=#hex`, `color=#hex`
- **Sync grille → code** : `serializeArrayGrid()` produit ce format dans `saveArrayCsvFile()`
- **Sync code → grille** : `saveAll()` appelle `syncArrayCodeToGrid()` qui détecte les changements dans le bloc `'array` et pousse via `updateArrayGrid()`
- **Dedup** : `lastArrayCodeFromGrid` empêche la boucle grille→code→grille

### 2-5-2-11-8 — Synchronisation avec le fichier 'array' (mode Code) (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Déclenchement** : après chaque modification de grille (`gridChanged`)
- **Format** : Markdown table dans le bloc `'array\n...\n'` du contenu unifié
- **Fichier persisté** : `array` (sans extension) dans le dossier de la section
- **Mise à jour en mémoire** : `existingFile.content` → `docSections` → `unifiedContent` → textarea + miroir rafraîchis

### 2-5-2-11-9 — SSE temps réel multi-utilisateurs (Page: Éditeur › Méga-Outil Array (Tableur) — Fonctions métier)
- **Event** : `array_update` reçu via SSE → `arrayUpdate$` Subject → rechargement de la grille
- **Scope** : tous les collaborateurs du projet voient les modifications en live

### 2-5-2-1-1 — Ouverture du drawer (Page: Éditeur › Commentaires (F6) — Fonctions métier)
- **Via F6** : raccourci clavier → ouvre le drawer pour la section active
- **Via bouton bulle** (mode Preview) : clic sur l'icône commentaires d'une section → `commentRequest.emit({ folderId, folderName })`
- **Parent** : `ProjetEditorComponent` → `commentsDrawer.set({ visible: true, folderId, folderName })`
- **Fermeture** : clic bouton × ou F6 à nouveau → `commentsDrawer.update(d => ({ ...d, visible: false }))`

### 2-5-2-1-2 — Chargement des commentaires (Page: Éditeur › Commentaires (F6) — Fonctions métier)
- **Requête** : GET `/api/file-projects/{name}/comments/{folderId}` au montage ou changement de folderId
- **Tri** : chronologique (plus ancien en premier)
- **Compteurs** : `commentCounts[folderId]` → affiché comme badge sur le bouton bulle dans la section

### 2-5-2-1-3 — Affichage (Page: Éditeur › Commentaires (F6) — Fonctions métier)
- **En-tête** : nom de la section (`folderName`)
- **Commentaires** : liste avec auteur, texte, date (format `JJ/MM/AAAA HH:MM`)
- **Propres commentaires** : bouton de suppression visible
- **Commentaires d'autres utilisateurs** : pas de bouton suppression (sauf admin)

### 2-5-2-1-4 — Ajout d'un commentaire (Page: Éditeur › Commentaires (F6) — Fonctions métier)
- **Saisie** : textarea en bas du drawer
- **Envoi** : Enter (Shift+Enter = nouvelle ligne) ou bouton envoyer
- **Requête** : POST `/api/file-projects/{name}/comments { folderId, text }`
- **Résultat** : commentaire ajouté en bas de la liste, compteur incrémenté
- **Validation** : texte non vide requis

### 2-5-2-1-5 — Suppression d'un commentaire (Page: Éditeur › Commentaires (F6) — Fonctions métier)
- **Déclenchement** : clic bouton × sur son commentaire
- **Confirmation** : inline (pas de modal)
- **Requête** : DELETE `/api/file-projects/{name}/comments/{commentId}`
- **Résultat** : commentaire retiré de la liste, compteur décrémenté

### 2-5-2-1-6 — Synchronisation temps réel (Page: Éditeur › Commentaires (F6) — Fonctions métier)
- **WebSocket** : nouvelles entrées de commentaires reçues via `ProjetCollabService`
- **Mise à jour live** : drawer rechargé si ouvert sur la même section

### 2-5-2-1-7 — États (Page: Éditeur › Commentaires (F6) — Fonctions métier)
| État | Description |
|------|-------------|
| Drawer fermé | Boutons bulles visibles au hover des sections |
| Drawer ouvert | Panneau droit visible |
| Chargement | Spinner |
| Aucun commentaire | Message "Aucun commentaire" |
| Commentaires chargés | Liste visible |
| Envoi en cours | Input désactivé, spinner |
| Badge sur section | Nombre de commentaires si > 0 |

### 2-5-2-2-1 — Arborescence des fichiers (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
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

### 2-5-2-2-2 — Indicateurs de collaboration (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Affichage d'un cadenas vert si la section est verrouillée par l'utilisateur courant
- Affichage d'un cadenas rouge avec tooltip (nom + heure) si verrouillé par un tiers
- Affichage d'un cadenas jaune avec texte de la section en rouge/orange si modifications locales en attente non partagées
- Affichage d'une icône forum clignotante/pulsante (badge conversation) si la section possède des commentaires
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `libs/portail-core/data-access/src/lib/projet-collab.service.ts`

### 2-5-2-2-3 — Indicateurs FTP (projets avec backup FTP) (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Affichage d'un fond ambré sur les lignes des dossiers dont le statut FTP est inconnu (unknown)
- Affichage d'une icône de synchronisation animée en bleu (spinning) en statut syncing
- Affichage d'une icône d'erreur rouge en statut error
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

### 2-5-2-2-4 — Création de dossier (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Déclenchement via option "Nouvelle section" du menu contextuel
- Affichage d'un champ de saisie inline sous le parent sélectionné
- Validation du nom via Enter : envoi de la requête POST /api/file-projects/{name}/folders avec outilSlug et parentId
- Création physique du répertoire et d'un fichier contenu.md vide à l'intérieur
- Annulation via Escape pour réinitialiser la saisie
- Règle d'unicité du nom (récupère le dossier existant en cas de doublon)
- Enregistrement de la création dans l'historique d'annulation (Undo)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

### 2-5-2-2-5 — Création de fichier (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Déclenchement via option "Nouveau fichier" du menu contextuel
- Affichage d'un champ de saisie inline
- Validation du nom via Enter : envoi de la requête POST /api/file-projects/{name}/files avec outilSlug et parentId
- Création physique du fichier Markdown
- Annulation via Escape
- Enregistrement de la création dans l'historique d'annulation (Undo)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

### 2-5-2-2-6 — Renommage (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Déclenchement via option "Renommer" du menu contextuel
- Saisie inline pré-remplie avec le nom actuel (sans extension .md pour les fichiers)
- Validation via Enter : envoi d'une requête PATCH /api/file-projects/{name}/files/{id} pour les fichiers ou PATCH /api/file-projects/{name}/folders/{id} pour les dossiers
- Annulation via Escape
- Enregistrement du renommage dans l'historique d'annulation (Undo) pour les fichiers
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

### 2-5-2-2-7 — Suppression (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Déclenchement via option "Supprimer" du menu contextuel
- Affichage d'un modal de confirmation de suppression
- Clic sur "Supprimer" : envoi de DELETE /api/file-projects/{name}/files/{id} ou DELETE /api/file-projects/{name}/folders/{id}
- Clic sur "Annuler" : fermeture du modal
- Règle : suppression physique récursive sur disque de la ressource et de ses enfants
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

### 2-5-2-2-8 — Drag & Drop (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Glisser-déposer de nœuds dans l'arborescence (dossier interdit de drop sur un fichier)
- Visualisation en direct de la position de drop cible (before, after, inside)
- Drop : émission de dragDrop avec les nœuds et positions
- Envoi des requêtes POST /api/file-projects/{name}/move-file ou POST /api/file-projects/{name}/move-folder
- Mise à jour physique des fichiers, réorganisation dans config.json et rafraîchissement de l'arbre
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `server/server-data.js`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

### 2-5-2-2-9 — Menu contextuel (clic droit) (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Affichage d'un menu contextuel au clic droit avec options dépendant de la sélection
- Options pour les dossiers : Nouvelle section, Nouveau fichier, Renommer, Supprimer, Monter/Descendre, Supprimer le titre, Ajout MO Trello, Ajout MO Tableau, options de verrous
- Options pour les fichiers : Renommer, Supprimer, options de verrous
- Options de verrous dynamiques (Partager, Annuler, Déverrouiller, Verrouiller, ou Affichage info verrou)
- Fermeture du menu lors d'un clic à l'extérieur (document:click)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

### 2-5-2-2-10 — Verrous de collaboration (projets avec backup) (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Pose de verrou : requête POST /api/collab/{projetId}/nodes/{nodeId}/lock avec identifiants utilisateur
- Libération de verrou : requête DELETE /api/collab/{projetId}/nodes/{nodeId}/lock
- Détermination des statuts isLockedByMe, isLockedByOther et isLocalPending
- Récupération et formattage des détails de verrou (qui et quand) dans le tooltip
- Verrouillage automatique lors de la prise de focus en édition d'une section
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `libs/portail-core/data-access/src/lib/projet-collab.service.ts`, `server/server-data.js`

### 2-5-2-2-13 — Système d'outils (vB-0.249+) (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
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

### 2-5-2-2-11 — Bouton réduire/rouvrir (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Bascule de l'état zone5Collapsed pour masquer/afficher la sidebar
- Mode réduit limitant la largeur et n'affichant que la bande gauche des icônes
- Mode étendu affichant l'ensemble de l'arborescence
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

### 2-5-2-2-12 — États (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Gestion graphique de l'arbre vide (bouton créer dossier, message)
- Surlignage du nœud actif selon son type (vert pour fichier, bleu/doré pour dossier)
- Input de saisie inline désactivant temporairement les autres actions
- Affichage visuel des indicateurs de verrous (icônes et couleurs de cadenas)
- Guidage visuel pour le drag-and-drop
- Panneau réduit affichant uniquement les icônes
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

### 2-5-2-2-14 — Bouton "Liste des trellos" (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Affiché en bas de la sidebar si trelloCount > 0
- Badge avec le décompte des instances Trello de l'outil
- Clic émettant trelloListClick pour ouvrir la vue liste de Trello dans la zone centrale
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

### 2-5-2-2-15 — Changer le niveau d'une section (menu contextuel sidebar) (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Action "Monter d'un niveau" / "Descendre d'un niveau" sur un dossier depuis le menu contextuel
- Monter : remonte le niveau et récupère les sections suivantes en tant qu'enfants
- Descendre : place le nœud sous sa sœur précédente en tant qu'enfant
- Modification des caractères heading (#) dans le Markdown de la section
- Conditions de disponibilité canPromoteNode et canDemoteNode (profondeur max de sous-arbre <= 4)
- Émission de nodeLevelChange vers la zone d'édition pour appliquer le traitement
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

### 2-5-2-2-16 — Supprimer le titre en gardant le texte (menu contextuel sidebar) (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Action "Supprimer le titre (garder le texte)" sur un dossier
- Suppression de la ligne de heading (#) et fusion du texte de la section dans la section supérieure
- Condition de disponibilité canMergeTitle (section précédente ou parente requise)
- Prise en charge de la sortie du mode focus et réinjection du contenu avant fusion
- Émission de titleMerge pour déléguer l'opération à la zone d'édition
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`

### 2-5-2-2-17 — Bouton "Liste des mockups" (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Affiché en bas de la sidebar si mockupCount > 0
- Badge avec le décompte des maquettes/mockups présents dans l'outil
- Clic émettant mockupListClick pour ouvrir la vue liste de maquettes dans la zone centrale
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.html`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.ts`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.html`

### 2-5-2-2-18 — Historisation et annulation des actions (Undo) (Page: Éditeur › Sidebar (Zone 3) — Fonctions métier)
- Enregistrement dans l'historique des actions utilisateur (création de fichier, dossier et renommage de fichier) via WoActionHistoryService
- Déclaration du statut annulable (undoable) et de la payload de rollback (undoAction)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-sidebar/projet-sidebar.component.ts`, `libs/portail-core/data-access/src/lib/wo-action-history.service.ts`

### 2-5-2-12-1 — Création standard de titre et de section en fin de zone active (Page: Projet/edition/titre)
- Ouvrir la boîte de dialogue de création de titre (H1-H4) depuis la barre d'édition sans curseur positionné dans le texte.
- Saisir un titre valide dans la boîte de dialogue et valider.
- Vérifier qu'un dossier de section avec un folderId unique est créé en BDD.
- Vérifier qu'une ligne de heading markdown avec l'identifiant stable {{SID:folderId}} est insérée à la fin de la section active.
- Vérifier que le nouveau titre s'affiche correctement dans l'arborescence de structure et la zone d'édition.
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `libs/shared/ui/src/lib/editor/title-create-dialog.component.ts`

### 2-5-2-12-2 — Création de titre au curseur avec scission de section (Page: Projet/edition/titre)
- Positionner le curseur au milieu du texte d'une section existante.
- Ouvrir le dialogue de création de titre et saisir un nouveau titre.
- Valider la création : vérifier que la section est scindée au point exact du curseur.
- Vérifier que la partie supérieure du texte reste dans la section donneuse et que la partie inférieure bascule dans la nouvelle section.
- Vérifier que la section donneuse perd son statut dirty pour empêcher le doublement de texte au re-render.
- Vérifier le déclenchement d'une sauvegarde automatique immédiate.
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-12-3 — Création de sous-section à partir de l'arborescence structurelle (Page: Projet/edition/titre)
- Faire un clic droit ou cliquer sur le bouton d'ajout '+' d'un nœud structure existant.
- Vérifier que le niveau calculé est bridé à un maximum de H4 (niveau_parent + 1).
- Vérifier que le dialogue affiche le parent d'accueil correct.
- Confirmer la création d'un titre de sous-section.
- Vérifier que la ligne de heading est correctement insérée positionnellement après la section d'ancrage et que le re-parentage s'exécute de manière cohérente.
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-12-4 — Promotion et rétrogradation de niveau d'une section (Page: Projet/edition/titre)
- Sélectionner une section dans l'éditeur ou la structure et modifier son niveau (monter ou descendre).
- Vérifier que le préfixe de heading markdown est modifié (ajout ou retrait de '#' ) tout en préservant le marqueur {{SID}} de la section.
- Vérifier que monter d'un niveau (-1) rattache automatiquement les sections suivantes de niveau plus profond comme sous-sections (normalisation en cascade).
- Vérifier que descendre d'un niveau (+1) niche la section sous son frère précédent direct.
- Vérifier que l'action est bloquée si les limites de niveau (H1 à H4) ou l'absence de frère précédent l'empêchent.
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-12-5 — Suppression d'un titre avec fusion et conservation du contenu (Page: Projet/edition/titre)
- Déclencher la suppression du titre d'une section pour fusionner avec le dessus.
- Vérifier que la ligne de heading markdown est retirée.
- Vérifier que tout le texte de la section fusionnée remonte et s'intègre sans perte dans la section précédente.
- Vérifier que le dossier physique associé au titre supprimé est détruit en BDD.
- En mode focus, vérifier que la fusion applique le changement au document complet, sort du focus et retourne à la vue globale.
- Vérifier que la fusion est désactivée et impossible pour la toute première section du document.
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-2-12-6 — Renommage direct d'un titre de section (Page: Projet/edition/titre)
- Modifier le texte d'un titre directement en mode Édition via le champ contenteditable.
- Vérifier que le nouveau texte remplace l'ancien dans le heading markdown en préservant le marqueur {{SID:folderId}}.
- Vérifier qu'au blur ou à la sauvegarde, le nom du dossier physique correspondant est mis à jour en BDD pour correspondre au nouveau libellé.
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-12-7 — Filtrage contextuel des commandes de titre du Slash Menu (Page: Projet/edition/titre)
- Ouvrir le menu slash en tapant '/' dans une section de niveau H2.
- Vérifier que le menu ne propose pas H1 et H2, n'affichant que des niveaux de sous-sections autorisées (H3, H4).
- Vérifier dans une section H1 que seuls H2, H3 et H4 sont proposés.
- Valider qu'un clic sur une commande de titre filtrée ouvre correctement le popup pré-rempli au bon niveau.
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-2-12-8 — Contrôles et validation du dialogue TitleCreateDialog (Page: Projet/edition/titre)
- Cliquer sur le backdrop (fond noir transparent) et vérifier que le dialogue ne se ferme pas.
- Taper un titre vide ou composé uniquement d'espaces et cliquer sur Créer : vérifier le blocage de la soumission et l'affichage d'un message d'erreur.
- Vérifier que l'input a automatiquement le focus à l'ouverture.
- Vérifier que la touche Échap, le bouton Annuler ou la croix (✕) ferment le dialogue sans altérer le document.
- **Priorité:** mineur
- **Composants:** `libs/shared/ui/src/lib/editor/title-create-dialog.component.ts`

### 2-5-2-9-1 — Onglet Cahier de recette (Page: Éditeur › Outil Tests — Fonctions métier)
- **Affichage des catégories** : sections en colonne unique (sans sidebar), chaque section affiche ses tests dans un tableau
- **Tableau des tests** : colonnes N° | Action/Titre | URL | Criticité (badge) | Étapes | Actions (edit/delete au hover)
- **Filtre par criticité** : chips (Tous / Bloquant / Majeur / Mineur) au-dessus du tableau, avec compteur de résultats filtrés
- **Champ URL par test** : stocké dans `TestCase.url`, visible dans le tableau et cliquable, affiché dans l'exécution manuelle
- **Création de catégorie inline** : bouton "+ Catégorie" → champ input inline → validation Enter ou bouton OK
- **Renommage de catégorie** : icône crayon (hover header) → input inline dans le header, validation Enter/blur
- **Suppression de catégorie** : icône poubelle (hover header) → tests de la catégorie archivés
- **Drag & drop catégories** : poignée drag_indicator sur header → réordonne les catégories (indicateur visuel avant/après)
- **Ajout de test par catégorie** : bouton "+" dans le header de catégorie, ou clic sur "Ajouter un test" si catégorie vide → formulaire inline dans la catégorie
- **Ajout de test global** : formulaire inline avec radio catégorie
- **Formulaire test** : titre, description, URL, criticité (boutons radio), catégorie (boutons radio), étapes
- **Édition inline** : icône crayon → formulaire inline pré-rempli avec tous les champs
- **Archivage** : icône poubelle → test passe à `status: 'archived'` (non visible)
- **Drag & drop tests** : poignée drag_indicator → réordonne au sein d'une catégorie OU déplace vers une autre catégorie (drop sur header de catégorie)
- **Section "Sans catégorie"** : affiche les tests sans `categoryId` ou dont la catégorie a été supprimée
- **Génération depuis Édition** : bouton → ouvre un picker de sections (dossiers hiérarchiques du projet, indentés par profondeur)
- **Section sélectionnée** : titre affiché à droite du bouton + bouton ✕ pour réinitialiser
- **Génération IA** : activé quand une section est sélectionnée → envoie le contenu des .md de la section à Claude Haiku → retourne une liste de tests proposés
- **Panel propositions IA** : liste de tests avec cases à cocher (tous sélectionnés par défaut), badge criticité coloré, description + nombre d'étapes
- **Sélection des tests** : "Tout sélectionner / désélectionner" + bouton "Ajouter (N)" → crée ou réutilise une catégorie au nom de la section
- **Génération depuis Mockup** : bouton (désactivé si aucun mockup) → génère 1 test par board

### 2-5-2-9-2 — Onglet Exécution (Page: Éditeur › Outil Tests — Fonctions métier)
- **Toggle Auto/Manuel** : bascule entre les deux modes d'exécution
- **Mode auto — champ URL** : saisie optionnelle d'une URL de preview pour test browser
- **Mode auto — lancement** : bouton "Lancer l'analyse IA" → stream SSE de résultats
- **Mode auto — progression** : barre de progression + compteur en temps réel
- **Mode auto — feed live** : résultats au fil de l'eau (pass/fail/pending) avec icônes colorées
- **Mode manuel — nom testeur** : champ obligatoire avant de démarrer
- **Mode manuel — démarrage** : bouton "Démarrer la campagne" → création du run côté serveur
- **Mode manuel — liste complète** : tous les tests du run affichés verticalement — complétés au-dessus (grisés, badge résultat), test actif au centre (carte active avec bordure primary), à venir en dessous (grisés à 30%)
- **Mode manuel — carte test** : affichage titre + description + URL cliquable + étapes + textarea notes + badge criticité coloré (bloquant=rouge vif, majeur=orange, mineur=jaune)
- **Mode manuel — validation** : boutons Passé / Échoué / Passer alignés à droite → passage au test suivant
- **Mode manuel — fin** : dernier test validé → message de fin

### 2-5-2-9-3 — Onglet Résultats (vue matrice) (Page: Éditeur › Outil Tests — Fonctions métier)
- **Matrice tests × exécutions** : lignes = tests groupés par catégorie, colonnes = runs triés chronologiquement (plus ancien à gauche → plus récent à droite)
- **Colonne nom tests** : sticky à gauche, affiche le titre tronqué avec un point de criticité coloré (rouge bloquant, orange majeur, jaune mineur)
- **En-tête de colonne (run)** : date dd/MM HH:mm, mode (IA ou nom testeur), score global % coloré (vert ≥80%, orange ≥50%, rouge <50%)
- **Bouton supprimer run** : icône poubelle visible au hover de l'en-tête de colonne → suppression définitive
- **Ligne catégorie** : fond légèrement différencié, affiche le nom de la catégorie + score % par run (coloré selon seuils)
- **Cellule test × run** : OK (vert, pass), KO (rouge, fail), PASSE (orange, skip), · (grisé, pending), — (grisé, non inclus dans ce run)
- **Section "Sans catégorie"** : affiche les tests sans catégorie, avec les mêmes cellules
- **État vide** : message "Aucune campagne exécutée" si aucun run

### 2-5-2-3-1 — Navigation (Page: Éditeur › Toolbar — Fonctions métier)
- Retour : clic sur le bouton de retour de la toolbar appelle goBack() et navigue vers l'historique précédent via Location.back
- Retour Portail : le mini-header supérieur (worg-mini-header) fournit un lien retour direct vers le portail (environment.portailUrl)
- Home : clic sur le logo (icône rocket) redirige vers la route /home du portail
- Projets : clic sur le lien "Projets" dans le fil d'Ariane redirige vers la route /projets
- Breadcrumb : affichage du fil d'Ariane "Projets > {nom projet}" avec le nom du projet non éditable dans la toolbar
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-toolbar/projet-toolbar.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-toolbar/projet-toolbar.component.html`, `apps/projets/src/app/pages/projet-editor/projet-editor.component.html`

### 2-5-2-3-2 — Indicateurs de statut de sauvegarde (Page: Éditeur › Toolbar — Fonctions métier)
- Statut "Sauvegardé" (idle/saved) : badge vert avec icône check_circle affiché en bas de l'éditeur
- Statut "Non sauvegardé" (dirty) : badge orange cliquable avec icône save affiché en bas de l'éditeur
- Statut "Sauvegarde…" (saving) : message jaune avec icône animate-spin progress_activity affiché en bas de l'éditeur
- Statut "Erreur" (error) : message rouge avec icône error affiché en bas de l'éditeur
- Clic sur "Non sauvegardé" : déclenche forceSave() qui déplie les sections (unfoldAll()) et effectue une sauvegarde immédiate (saveAll())
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-3-3 — Badges de backup et état de synchronisation (Page: Éditeur › Toolbar — Fonctions métier)
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

### 2-5-2-3-4 — Onglets de mode d'édition (Page: Éditeur › Toolbar — Fonctions métier)
- Mode Code : clic sur l'onglet "Code" (<> Code) passe au mode 'edit' affichant la zone textarea Markdown
- Mode Structure : clic sur l'onglet "Structure" (arborescence) passe au mode 'structure' affichant la structure hiérarchique
- Mode Edition : clic sur l'onglet "Edition" (mode WYSIWYG) passe au mode 'visu' affichant le contenu HTML éditable en ligne
- Onglet actif : l'onglet correspondant au mode courant est mis en surbrillance avec la classe ed-mode-tab--active
- Toggle de vue (Mode Code) : bouton "Markdown propre / Avec style" à droite de la barre d'onglets permet de basculer la vue et d'activer showCssInCode()
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-3-5 — Barre de formatage (mode Code, vue stylisée) (Page: Éditeur › Toolbar — Fonctions métier)
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

### 2-5-2-3-11 — Ouverture du dossier local de section (Page: Éditeur › Toolbar — Fonctions métier)
- Visibilité : bouton "Dossier" visible dans tous les modes à droite de la barre d'onglets de l'éditeur
- Clic bouton : appelle openSectionFolder() qui identifie la section active (ou ancre courante) et appelle le service ProjectFilesService
- Requête API : envoi d'une requête POST /api/file-projects/:name/open-folder avec le folderId résolu par safeProjectPath
- Ouverture OS : le serveur ouvre le dossier dans l'explorateur natif (explorer.exe / open / xdg-open)
- Gestion d'erreur : retour du code HTTP 404 avec message d'erreur si la section n'est pas clonée localement
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `libs/portail-core/data-access/src/lib/project-files.service.ts`, `server/server-data.js`

### 2-5-2-3-6 — Bandeau de modifications en attente (Collaboration) (Page: Éditeur › Toolbar — Fonctions métier)
- Modifications Code (mode Code) : si showCodePublishBar ou showCrossModePendingBar est vrai, affiche une alerte statique signalant les modifications en cours sans bouton d'action
- Modifications Structure (mode Structure) : si structureHasPending() est vrai, affiche une alerte avec les boutons "Annuler" et "Partager mes modifications"
- Clic Annuler Structure : restaure l'état structurel précédent via cancelStructureEdit()
- Clic Partager Structure : publie les changements de structure au serveur via publishStructureEdit() et broadcast SSE
- Mode Preview : aucun bandeau n'est affiché (les actions d'annulation ou de partage de modifications de preview sont déportées sur la sidebar)
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-3-7 — Indicateurs d'état et surcouches visuelles (Page: Éditeur › Toolbar — Fonctions métier)
- Surbrillance mode actif : onglet correspondant surligné en haut
- Indicateurs de sauvegarde en bas de page : badge vert (Saved), badge orange (Dirty), badge jaune avec spinner (Saving), rouge (Error)
- Indicateurs FTP en bas de page : bleu animé (Syncing), cyan (Done), rouge (Error), cyan simple (Idle)
- Bandeau pending : fond bleu/violet pour modifications locales en attente en bas de l'éditeur
- Overlay de publication : écran de blocage flou avec spinner jaune progress_activity lors de la publication/téléversement d'image
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-3-8 — Barre Mega-outils (Page: Éditeur › Toolbar — Fonctions métier)
- Onglets de types de Mega-outils : affichage de quatre boutons interactifs pour Trello (bleu), Mockup (violet), Tableau (lime, qui correspond à Array) et Prompt (amber)
- Compteur d'instances : affiche le nombre d'instances actives pour chaque type de Mega-outil à côté de leur nom
- Liste d'instances : cliquer sur un type de Mega-outil affiche horizontalement la liste scrollable des instances de ce type
- Sélection d'instance : clic sur une instance de Mega-outil émet megaOutilSelect et navigue vers la section ou fichier où elle est intégrée (trelloNavigate)
- Clic "Nouveau" : ouvre la popup de création pour le type d'outil sélectionné (Trello, Tableau, Mockup ou Prompt)
- Clic "Liaison" (Mockup uniquement) : ouvre la popup permettant d'associer un Mockup existant à la section courante
- Interrupteur "Sync auto" (Trello uniquement) : active/désactive la synchronisation automatique des cartes de colonne Trello dans le code markdown
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-3-9 — Menus déroulants de la barre de formatage (mode Preview) (Page: Éditeur › Toolbar — Fonctions métier)
- Style de bloc : menu déroulant (icône title) propose Paragraphe (applyVisuFormat avec formatBlock et P) et les titres H1 à H4
- Couleur de texte : menu déroulant Swatch (lettre A soulignée) propose la palette de couleurs pastilles (foreColor)
- Surlignage : menu déroulant Swatch (icône highlighter) propose la palette de couleurs de fond pastilles (hiliteColor)
- Comportement d'ouverture/fermeture : ouverture via mousedown avec preventDefault pour conserver la sélection de texte courante, fermeture au clic extérieur
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-3-10 — Création de section au point de coupe du curseur (Page: Éditeur › Toolbar — Fonctions métier)
- Déclenchement : en mode Preview (Edition), sélectionner H1 à H4 dans le style de bloc ou via slash command ouvre le dialogue de création de titre
- Calcul du point de coupe : computeVisuCursorInsertLine() identifie le bloc sous le curseur et calcule la ligne d'insertion exacte dans le contenu direct
- Dialogue worg-title-create-dialog : affiche le titre prérempli (texte sélectionné) et le parent de section calculé selon la hiérarchie du niveau
- Insertion : confirmation du dialogue appelle createTitleSection() qui insère un heading markdown avec le niveau (ex: ### Titre) à la ligne d'insertion
- Réorganisation parent : le parent exécute processSectionsChange, crée le dossier physique, réorganise l'ordre et re-parente les sous-sections
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-3-12 — Création de Mega-outil via popup (Page: Éditeur › Toolbar — Fonctions métier)
- Nouveau Trello : clic sur "Nouveau" en mode Trello ouvre showTrelloPopup, saisie du nom, création et insertion du marqueur [trello:nom]
- Nouveau Tableau (Array) : clic sur "Nouveau" en mode Tableau ouvre showArrayPopup, saisie du nom, création et insertion du marqueur de tableau
- Nouveau Mockup : clic sur "Nouveau" en mode Mockup ouvre showMockupPopup, validation du nom unique, création et insertion du marqueur {{MOCKUP:id}}
- Nouveau Prompt : clic sur "Nouveau" en mode Prompt (uniquement en mode Code) ouvre showPromptPopup, saisie du nom, création du fichier prompt-NOM.md et insertion du bloc ```PROMPT: NOM```
- Liaison Mockup : clic sur "Liaison" ouvre la popup de sélection des mockups du projet, clic sur un mockup existant insère sa liaison
- Validation des formulaires : vérification de la non-vacuité du nom et gestion d'erreurs d'unicité (ex: mockupNameError)
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-3-13 — Import et insertion de fichiers d'images (Page: Éditeur › Toolbar — Fonctions métier)
- Déclenchement : clic sur le bouton image de la barre de formatage appelle triggerImageUpload(), mémorisant le dossier actif et activant l'input file caché
- Validation fichier : vérification du format (jpeg, png, gif, webp, svg, bmp) et de la taille maximale autorisée (1 Mo) avec message imageUploadError si invalide
- Import serveur : envoi du fichier au serveur via le service uploadImage et ajout du nœud d'image à allImages
- Insertion automatique : insère le marqueur {{IMG:nodeId}} à l'emplacement du curseur dans le document unifié
- Historique & sauvegarde : enregistrement de l'action dans l'historique d'annulation (woHistory.track), exécution immédiate de saveAll() et passage en état localDirty = true
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `libs/portail-core/data-access/src/lib/project-files.service.ts`

### 2-5-2-3-14 — Sécurité FTP - Avertissement de désynchronisation (Page: Éditeur › Toolbar — Fonctions métier)
- Condition : si isActiveSectionUnsynced est vrai (la section active est en cours de synchronisation avec le serveur FTP distant)
- Affichage : affiche une bannière d'information bleue en haut de la zone d'édition "Synchronisation FTP en cours — lecture seule jusqu'à la mise à jour"
- Blocage de saisie : les zones d'éditions du corps de section et les boutons d'action d'édition/formatage sont verrouillés
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-3-15 — Menu contextuel et modification des liens hypertextes (mode Preview) (Page: Éditeur › Toolbar — Fonctions métier)
- Détection : le focus ou le clic sur un lien hypertexte dans une section éditable en mode Preview ouvre le menu flottant visuLinkMenu
- Actions du menu : propose de suivre le lien dans un nouvel onglet, de modifier le lien, ou de le supprimer
- Popup d'édition : modifier le lien ouvre showLinkEditPopup, permet de saisir la nouvelle URL et met à jour l'attribut href du lien sur validation
- Suppression de lien : l'action supprimer retire la balise lien <a> tout en conservant son contenu textuel brut
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`

### 2-5-2-3-16 — Raccourcis clavier par commande Slash (mode Preview) (Page: Éditeur › Toolbar — Fonctions métier)
- Détection de saisie : en mode Preview, taper le caractère "/" dans un élément de texte éditable déclenche detectVisuSlash()
- Menu de suggestions : affiche à la position du curseur le menu d'insertion flottant worg-slash-command-menu
- Filtrage de commandes : la liste des commandes suggérées est dynamiquement filtrée selon la saisie de l'utilisateur (visuSlash.query)
- Sélection au clavier : flèches Haut/Bas pour naviguer entre les commandes, Échap pour fermer, Entrée pour valider
- Insertion et nettoyage : la validation supprime automatiquement le "/" saisi et insère le bloc ou le formatage correspondant (ex: note info, tableau 2x2, mockup, trello, citation)
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/slash-command-menu/slash-command-menu.component.ts`

### 2-5-2-3-17 — Mega-outil Prompt : affichage et exécution (Page: Éditeur › Toolbar — Fonctions métier)
- Affichage mode Code : le bloc ` ```PROMPT: NOM ` est affiché en texte brut ; la ligne d'ouverture est colorée en amber
- Affichage mode Edition : `app-prompt-board` est rendu inline avec header amber, system prompt collapsable, user prompt avec variables `{{x}}` colorées et bouton ▶ Exécuter ; le texte brut du bloc est supprimé du rendu HTML (strip regex PROMPT dans buildVisuSectionHtml)
- Affichage mode Structure : panneau bas amber listant les instances de prompt de la section en lecture seule
- Popup d'exécution : sélecteur IA à gauche (Claude / AGY (Gemini)) + modèles filtrés à droite ; affichage du prompt de base global (collapsable, badge "global") + system prompt de la section
- Variables `{{x}}` : si le prompt contient des variables, l'état variable-fill affiche un formulaire de substitution avant l'envoi
- Streaming : exécution via `GET /api/mega-outils/prompt/execute-stream` (EventSource SSE, même système qu'admin/tests) ; le serveur proxy l'executor port 3002 pour Claude, et appelle l'API Gemini directement pour AGY (contourne le buffering CLI Windows) ; événements nommés : ai-log {stream, text}, ai-error, complete, run-failed ; journal de log coloré par type (stderr rouge, info amber, stdout gris)
- Validation : état validating propose "Insérer" (insère sous le bloc en blockquote), "Copier" et "Re-exécuter"
- Historique : chaque exécution est enregistrée en base (table mega_outil_prompt_history) et visible dans PromptAdminComponent
- Prompt de base global : configurable dans Admin › Mega-outils › Prompt ; stocké en BDD (table mega_outil_prompt_config) ; combiné avec le system prompt de section à l'exécution
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/prompt-execution-popup/prompt-execution-popup.component.ts`, `libs/shared/ui/src/lib/mega-outils/prompt/prompt-board.component.ts`, `apps/projets/src/app/pages/projet-editor/services/projet-prompt-execute.service.ts`, `libs/shared/ui/src/lib/mega-outils/prompt/prompt-admin.component.ts`, `server/server-data.js`

### 2-5-2-4-1 — Saisie et édition (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Textarea principale** : saisie libre du contenu Markdown unifié (toutes sections du projet)
- **Auto-save** : délai 2s après dernière frappe → `scheduleSave()` → `saveAll()`
- **Sauvegarde forcée** : clic badge "Non sauvegardé" → `forceSave()`
- **Dirty state** : `localDirty = true` dès la première frappe → emit `dirtyChange(true)`
- **Contenu unifié** : toutes les sections (`## Nom dossier`) concaténées en un seul document
- **Retour à la ligne automatique** : `white-space: pre-wrap` + `overflow-wrap: break-word` — le texte long passe à la ligne sans ascenseur horizontal; `overflow-x: hidden` sur mirror et textarea
- **Redimensionnement** : la zone s'étend dynamiquement selon la fenêtre via `:host { flex: 1; min-width: 0 }`

### 2-5-2-4-2 — Mode Focus (section sélectionnée dans la sidebar) (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Activation** : sélection d'un dossier dans la sidebar → `applyFocusByActiveNode()` → `enterFocusMode(handle)`
- **Vue focusée** : seul le contenu de la section sélectionnée est affiché dans le textarea
- **Sauvegarde du contexte** : `fullContentBackup` conserve le document complet, `focusedLineStart` et `focusedOriginalLineCount` mémorisent la position
- **Sortie de focus** : changement de mode (→ Structure/Preview) → `exitFocusMode()` → merge du contenu
- **Mode focus sur image** : si le nœud est une image, affiche le marqueur `{{IMG:id}}` uniquement

### 2-5-2-4-3 — Rendu miroir (aperçu) (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Synchronisation** : le HTML rendu suit le scroll de la textarea
- **Highlights** : sections surlignées selon `highlightNodeId`
- **Scroll auto** : `scrollToNodeId` → défile vers la section demandée
- **Rendu Markdown** : via `marked`
- **Marqueur Trello** : `{{TRELLO:id}}` est présent dans le texte brut ; le board Trello complet est affiché dans le panneau bas (voir `2-5-2-4-15`)

### 2-5-2-4-4 — Slash commands (/) (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Déclenchement** : saisie `/` en début de ligne → affiche `SlashCommandMenuComponent`
- **Options** : `/nouveau dossier`, `/nouveau fichier`, `/table`, `/code`, `/liste`, `/titre`, etc.
- **Sélection** : Enter ou clic sur l'option → insère le contenu approprié
- **Fermeture** : Escape ou clic ailleurs

### 2-5-2-4-5 — Insertion de formatage (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
Via les boutons de la toolbar (voir toolbar/fonctions.md) ou raccourcis :
- **Gras** : sélection + Ctrl+B
- **Italique** : sélection + Ctrl+I
- **Insertion à la position curseur** : les boutons H1-H4, liste, séparateur, etc.

### 2-5-2-4-6 — Gestion des images (mode Code) (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Upload** : clic bouton image (toolbar) → input file → POST `/api/file-projects/{name}/files` (multipart)
- **Types acceptés** : jpeg, jpg, png, gif, webp, svg, bmp
- **Insertion** : marqueur `{{IMG:uuid}}` inséré à la position du curseur dans le texte
- **Affichage** : rendu comme `<figure>` dans le miroir HTML
- **Erreur upload** : toast rouge avec message d'erreur (cliquable pour fermer)

### 2-5-2-4-7 — Repliage de sections (folding) (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Replier une section** : clic sur le handle de la section → `foldSection(sectionId)`
  - Contenu de la section masqué dans la textarea (indicateur `[...]`)
  - Auto-save bloqué si sections repliées
- **Déplier** : clic handle → `unfoldSection(sectionId)`
- **Déplier tout** : `unfoldAll()` → lors du changement de mode ou sortie focus

### 2-5-2-4-8 — Drag & Drop dans la zone Code (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Drag handles** : icônes de déplacement sur les sections, fichiers, images
- **Réorganisation** : glisser-déposer → repositionne dans le document Markdown
- **Sections** (dossiers) : déplacement de blocs Markdown complets
- **Fichiers additionnels** : documents secondaires dans une section
- **Images** : déplacement des marqueurs `{{IMG:id}}` entre sections

### 2-5-2-4-9 — Gestion des verrous et état "en attente" (projets backup) (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Premier keystroke dans une section** : snapshot du contenu → `codeSectionSnapshots`
- **Lock granulaire** : verrouillage de l'entité précise (fichier ou bloc)
  - `collab.lockNode(projectName, entityId)`
  - `activeEntityLocks: Set<entityId>`
- **Affichage** : badge rouge sur le nœud dans la sidebar
- **Partager / Annuler depuis le menu de la section** (vB-0.279) : les actions sont déclenchées depuis le **menu contextuel de la sidebar** (voir `2-5-2-2-9`), et non plus depuis une barre en bas de zone. La zone écoute `collab.publishSectionRequest$` / `cancelSectionRequest$` (abonnement `takeUntilDestroyed` dans le constructeur) → `publishSection(sectionId)` / `cancelSection(sectionId)`.
  - **Portée = sous-arbre** : publier/annuler une section traite la section **ET ses sous-sections modifiées** (descendants `pending`). `collectSectionPublishIds(sectionId)` = `{ sectionId }` ∪ descendants (`getDescendantFolderIds`) qui sont `isLocalPending` ∪ dossiers des entités granulaires verrouillées du sous-arbre. Les sous-sections **non modifiées** ne sont jamais écrites (pas de `publish=true` superflu).
  - **`publishSection(sectionId)`** : indépendant du mode/focus. Calcule `publishFolderIds` (sous-arbre) et capture les entités verrouillées **avant** le flush, reconstruit le document si focus, parse, écrit avec `publish=true` les fichiers dont `folderId ∈ publishFolderIds`, exécute les suppressions d'images différées, puis `releaseSectionsPending()` + `unlockNode()` pour chaque dossier.
  - **`cancelSection(sectionId)`** : restaure chaque section du sous-arbre depuis `codeSectionSnapshots` (remplacement par plage via `sectionRanges`, **du bas vers le haut** pour préserver les indices de ligne), restaure les images annulées, `recomputeAll()` + `saveAll()`, puis `releaseSectionsPending()` + `unlockNode()`.
  - **`releaseSectionsPending(folderIds, lockedEntityIds)`** : libère verrous + pending de l'ensemble de sections et de leurs entités granulaires (blocs/fichiers), nettoie `codeSectionSnapshots`, `dirtyVisuSectionIds`, `visuSectionLockSnapshot`, `editingVisuSectionId`, `cursorEntityId`.
- **Barre du bas** : ne contient plus de boutons Annuler/Partager pour le mode Code (`showCodePublishBar` / `showCrossModePendingBar` n'affichent qu'un libellé « Modifications en cours — partager via le menu de la section »). La **barre Preview** (mode visu) a été **supprimée** (vB-0.282) : partage/annulation via le menu contextuel de la section. Seule la barre Structure (`structureHasPending`) conserve ses boutons.
- **Portée du partage (mode focus, `publishCodeEdit`)** : seules les sections **réellement éditées** sont publiées et déverrouillées. `publishFolderIds` est calculé depuis `activeEntityLocks` (mappés vers leur `folderId` via `modifiedEntities`), sinon la section ciblée. Le document complet est reconstruit uniquement pour résoudre les `folderId` des sous-sections ; les sections enfants **non modifiées ne sont pas écrites** avec `publish=true`, donc elles restent verrouillées (correctif : sans ce filtre, toutes les sous-sections enfants étaient partagées + déverrouillées côté serveur)

### 2-5-2-4-10 — Snapshot pre-édition vue document (sans focus) (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Premier keystroke** (hors mode focus) : `codeDocSnapshot = lastSavedContent`
- **Annuler vue document** : restaure le snapshot entier du document
- **Partager vue document** : publie toutes les sections du document

### 2-5-2-4-11 — Sections et parsing (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Détection headings** : regex `^(#{1,4}) (.+)$` → niveaux 1-4
- **Niveaux** : `#` = niveau 1, `##` = niveau 2, `###` = niveau 3, `####` = niveau 4
- **SectionRanges** : `{ folderId, lineStart, lineEnd }` pour chaque section. Le mappage titre→`folderId` itère dans l'ordre du **buffer** (`flatHeads`, ce que l'utilisateur voit) et associe chaque titre à un `docSection` non encore consommé (level + name) — robuste même quand l'ordre du buffer diverge de l'ordre stocké des fichiers (cas de la préservation du texte en mode Code, voir `2-5-2-4-16`). Sans cette logique, une section déplacée dans le code pointait vers le mauvais dossier (focus erroné à la navigation).
- **FileRanges** : `{ fileId, lineStart, lineEnd }` pour les blocs fichiers additionnels
- **Blocs-fichiers additionnels** : délimités par une ligne commençant par `'`, `` ` `` ou `^`. Les fences de code markdown ` ``` ` sont explicitement exclues (lookahead `(?!` + 3 backticks + `)` / garde `!startsWith('```')`) → un bloc de code ` ``` … ``` ` n'est jamais interprété comme un bloc-fichier ni reformaté à la sauvegarde

### 2-5-2-4-12 — Raccourcis clavier (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
| Raccourci | Action |
|-----------|--------|
| Ctrl+S | Forcer la sauvegarde |
| Escape | Fermer menu slash commands |
| / | Ouvrir menu slash commands (si début de ligne) |
| Tab | Indentation |

### 2-5-2-4-15 — Panneau Trello en mode Code (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Affichage** : le panneau `app-trello-board` s'affiche dès que le marqueur ` ```TRELLO: NOM ` est présent dans la section active (voir `2-5-2-4-14`)
- **Synchronisation live** : le composant reste monté lors des changements de mode → les modifications (ajout/édition/déplacement de tâche) faites dans un mode sont immédiatement visibles dans les autres
- **SSE** : les mises à jour de collaborateurs (`trelloUpdate$`) sont reçues dans tous les modes puisque le board n'est jamais détruit
- **Propagation vers Code** : `@Output() cardsChanged` → `onTrelloCardsChanged` → `syncTrelloInlineBlock()` met à jour le bloc fencé inline **uniquement si le toggle Sync auto est activé** (voir `2-5-2-4-14`)

### 2-5-2-4-14 — Bloc Trello inline dans le contenu (mode Code) (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
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

### 2-5-2-4-16 — Préservation du texte exact en mode Code (vB-0.279) (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Principe** : en mode Code, la saisie de l'utilisateur n'est plus réécrite/normalisée par la reconstruction. Le texte exact (lignes vides multiples, espaces de fin, `#` seul, indentation) est conservé tel que tapé.
- **Mécanisme** : un drapeau `localCodeSavePending` est armé dans `saveAll()` (vue document, hors focus) à l'émission du save, et **libéré uniquement à la fin du cycle** quand le `@Input saveStatus` repasse à `'idle'`/`'error'`. Quand le `@Input files` revient avec la nouvelle structure, `ngOnChanges` calcule `preserveCodeBuffer` (mode `edit`, hors focus, `hasStructuralChange`, sans `markersFixed`, drapeau actif) et **n'écrase pas** `unifiedContent`/textarea avec `reconstructFromSections()`.
- **Pourquoi pas un drapeau one-shot ni un délai fixe** : le parent (`processSectionsChange`) appelle `loadFiles()` **plusieurs fois** par cycle de save (création, fichiers additionnels, synchro d'ordre) → plusieurs émissions de `files`, le tout pendant `saveStatus === 'saving'`. Un one-shot consommé à la 1ʳᵉ émission, ou une fenêtre temporelle fixe (ex. 6 s) trop courte pour un save serveur lent, laissaient une émission tardive reconstruire et **réordonner** les sections. Lier la garde à `saveStatus` couvre tout le cycle quelle que soit sa durée.
- **Restructuration conservée** : les dossiers/sections sont toujours créés/renommés/supprimés côté parent (`processSectionsChange`). Seul le texte affiché est préservé ; `recomputeAll()` remappe les ranges sur le buffer conservé.
- **Changements externes** : un changement structurel ne provenant pas de la saisie Code (renommage/suppression via sidebar, drag, collaboration) garde `localStructuralSavePending = false` → reconstruction normale (le code reflète le changement).
- **Navigation préservée** : comme le buffer peut diverger de l'ordre des fichiers, `recomputeRanges` associe les titres aux dossiers **dans l'ordre du buffer** (voir `2-5-2-4-11`) → cliquer une section dans la sidebar focus bien la bonne section dans la zone Code.
- **Réordonnancement de sections dans le code → menu + dossiers physiques** : changer l'ordre des `###` directement dans le code réordonne les dossiers de section sans toucher au texte. Côté parent (`processSectionsChange`, étape 7), `applySectionFolderOrder()` regroupe les `folderId` par parent dans l'ordre d'apparition dans le document et met à jour `folder.order` (clé de tri du menu sidebar **et** de `buildDocSections`), persisté via `updateStructure()` + `loadFiles()`. Le menu et les dossiers physiques suivent le code ; l'ordre fichiers == ordre buffer rétablit la cohérence (plus de divergence à terme).
- **Limite connue** : au rechargement du projet, le contenu est reconstruit depuis les fichiers → la version normalisée s'affiche (le texte exact n'est pas persisté verbatim).

### 2-5-2-4-17 — Système double fichier : Markdown propre + jumeau stylisé (vB-0.283) (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
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

### 2-5-2-4-13 — États (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
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
| Section verrouillée (autre user) | Lecture seule **totale** : textarea code, inputs Structure, board Trello (`readonly`), board Array, insertions toolbar/slash. Getters `isActiveSectionLockedByOther` / `isTrelloInstanceLocked` / `isArrayInstanceLocked` / `isStructNodeLocked` |

### 2-5-2-4-18 — Suppression d'image par effacement de la ligne {{IMG:id}} (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Déclenchement** : l'utilisateur efface manuellement la ligne `{{IMG:id}}` dans la textarea Code → `onTextareaInput` → `scheduleSave` → `saveAll` → `reconcileImageLifecycle(content)`
- **Détection** : toute image de `this.files` non référencée par un `{{IMG:id}}` dans le contenu (et hors `recentlyAddedImageIds` / `pendingLocalImages`) est candidate à la suppression
- **Suppression physique** (cohérente avec `deleteImageUnified`) :
  - Projet **backup** : différée au Partager via `pendingVisuDeletions` (le contenu publié référence encore l'image — un `deleteFile` immédiat échouerait) + garde `recentlyDeletedImageIds`
  - Projet **local** : `svc.deleteFile` immédiat
- **Réconciliation inverse** : une image redevenue référencée (couper/coller, undo, ré-ajout) est retirée de `recentlyDeletedImageIds` / `pendingVisuDeletions` et restaurée dans `allImages`
- **Garde anti-réapparition** : `recentlyDeletedImageIds` (durable) empêche `buildDocSections` de ré-injecter l'image tant que son nœud subsiste dans `this.files`

### 2-5-2-4-19 — Identifiant stable de section `{{SID:folderId}}` (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Format** : chaque heading porte en fin de ligne un marqueur `{{SID:<folderId>}}` (ex. `## Présentation {{SID:c7e0205f-…}}`) qui lie de façon **stable** la section à son dossier physique, indépendamment du nom et de l'ordre.
- **Origine** : dérivé du dossier par `buildDocSections` (`composeHeading(level, name, folderId)`) → présent après chaque reconstruction (`reconstructFromSections`). Les projets sans SID sont **migrés automatiquement** au premier chargement.
- **Visibilité** : visible en mode Code (buffer brut, comme `{{IMG:}}`/`{{TRELLO:}}`) mais **atténué** (opacité réduite) dans le mirror ; **masqué** en modes Structure et Édition.
- **Rôle anti-régression** : `parseContent` et `recomputeRanges` résolvent le `folderId` **prioritairement par SID** (puis chemin slugifié, puis nom). Le renommage d'un titre ou le réordonnancement ne perd plus le lien section↔dossier et ne crée plus de dossier parasite.

### 2-5-2-4-20 — Re-parentage automatique sur changement d'imbrication (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Principe** : insérer/déplacer un titre en mode Code modifie l'imbrication markdown des sections suivantes → leurs dossiers physiques sont **déplacés** en conséquence (`processSectionsChange` → `moveFolder`).
- **Exemple** : insérer un `## H2` au milieu d'une suite de `### H3` → les H3 **suivants** deviennent enfants du nouveau H2 ; les H3 **au-dessus** restent rattachés à l'ancien H2.
- **Mécanique** : pour chaque section identifiée par son `{{SID}}`, le parent textuel (imbrication courante) est comparé au parent physique ; en cas de différence → `moveFolder(folderId, targetParentId)`. Tri parents→enfants ; promotion en racine → ajout à `outil.rootFolderIds`.
- **Robustesse** : l'identité étant garantie par le SID, le déplacement ne provoque jamais de recréation/suppression. Déclenché même sans autre changement structurel (`needsReparent` dans `hasStructural`).
- **Résolution du parent** : le parent textuel est la section précédente de niveau **strictement inférieur** le plus proche (pas forcément `level-1`), avec réinitialisation des niveaux plus profonds. Gère les sauts de niveau (ex. insérer un H1 entre des H3).
- **Normalisation de niveau** : le niveau d'affichage d'un titre = sa **profondeur** dans l'arbre de dossiers (`buildDocSections`, `level = depth`). Conséquence : insérer un H1 au milieu de H3 → les H3 suivants, devenus enfants directs du H1, sont automatiquement **remontés en H2** (profondeur 2), uniquement dans la nouvelle section. Les titres au-dessus du H1 sont inchangés.

### 2-5-2-4-21 — Annuler / Refaire (Ctrl+Z / Ctrl+Y) en mode Code (Page: Éditeur › Zone 4 — Mode Code — Fonctions métier)
- **Boutons** : `undo` et `redo` (icônes Material) en **première position** dans la barre de style (mode Code, vue « Avec style »). Bouton Annuler grisé si pile vide, Refaire grisé si rien à refaire.
- **Raccourcis** : Ctrl+Z → annuler, Ctrl+Y (ou Ctrl+Shift+Z) → refaire. Interceptés dans `onTextareaKeydown`.
- **Pile custom** (`codeUndoStack` / `codeRedoStack`) : captures de `{ content, selStart, selEnd }`, max 200 entrées.
  - **Avant chaque action toolbar** (`insertAt`, `codeClearFormat`) : snapshot immédiat (`pushCodeUndoSnapshot`).
  - **Frappe au clavier** : snapshot debounce 800 ms (`scheduleCodeSnapshot` dans `onTextareaInput`).
  - Toute action annulée alimente `codeRedoStack` et vice-versa ; le Redo est effacé dès une nouvelle action.
- **Restauration** : `applyCodeSnapshot` → `unifiedContent = snap.content`, `ta.value = snap.content`, repositionnement du curseur, `recomputeAll()`, `scheduleSave()`.

### 2-5-2-5-1 — Affichage du rendu (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Sections éditables** : chaque dossier du projet est une section `<div class="visu-section-wrap">`
- **En-tête** : nom du dossier affiché en H1/H2/H3/H4 selon le niveau (non éditable)
- **Corps** : contenu Markdown rendu en HTML, éditable via `contenteditable="true"`
- **Images** : affichées dans leur contexte de section
- **Filtre** : `filteredVisuSections` — si un dossier est actif dans la sidebar → seule la section sélectionnée + enfants sont affichés
- **Zone de texte continue** (vB-0.284) : les sections ne sont plus présentées comme des cartes/zones séparées. Le rendu est une **zone de texte continue** (sections sans bordure/fond/encadré : `.visu-sec-content` borderless, `--active` transparent) ; seuls les **méga-outils incrustés** (Trello/Array/Mockup) créent une rupture visuelle. Pas de décalage par niveau (indentation supprimée). Un titre ajouté via le format H crée bien la section dans le menu/les fichiers/les autres modes (pipeline de parsing), tout en restant une seule zone affichée en Edition.
- **Badge de niveau** (vB-0.284) : un badge `H1`/`H2`/`H3`/`H4` reste affiché dans la gouttière gauche, en face de chaque titre (`.visu-sec-level`, `left: -3.2rem` dans la colonne centrée `.visu-content-wrap`)
- **Création de sous-section uniquement** (vB-0.284) : quand une section de niveau N est active, on ne peut créer qu'une section de niveau > N. Les boutons titres de la barre (H1-H4) sont **grisés** pour les niveaux ≤ N (`[disabled]="activeVisuSectionLevel >= n"`) et le slash menu masque ces niveaux (`visuSlashCommandsFiltered`). `activeVisuSectionLevel` = niveau de la section active.

### 2-5-2-5-2 — Édition inline (contenteditable) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Focus section** : clic dans le corps de la section → `onVisuSectionFocus(sectionId)`
  - Projets backup : snapshot du contenu → `visuSectionLockSnapshot`, `editingVisuSectionId.set(sectionId)`, `collab.lockNode()`
  - Projets locaux : pas de verrou, édition directe
- **Saisie** : input direct dans le HTML rendu → `onVisuSectionInput(sectionId)` → `dirtyVisuSectionIds.add(sectionId)`
- **Auto-save « live »** (vB-0.283) : à la frappe, `scheduleVisuLiveSave(sectionId)` (débounce 900 ms) convertit la section en Markdown (`commitVisuSection`) et persiste immédiatement (`saveAll` → écriture des fichiers). La section reste `dirty` et le DOM n'est pas réinitialisé (curseur préservé : `initVisuSectionHtml` ne ré-injecte pas une section dirty non vide ; le `@for` track par `sectionId` réutilise le DOM). Les fichiers se mettent donc à jour en permanence, sans changer de mode.
- **Blur** : `onVisuSectionBlur(sectionId)` → sauvegarde locale sans publier (section reste "dirty")
- **Keyboard** : Escape → ferme le menu d'insertion (si ouvert)

### 2-5-2-5-3 — Lecture seule pendant sync FTP (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Section non synchronisée** (`nodeSyncStatus = 'unknown'` + `ftpSyncGlobalStatus = 'syncing'`) :
  - Badge "Synchronisation FTP en cours…" affiché sur la section (indicatif uniquement)
  - La section reste éditable (pas de blocage depuis vB-0.231+)

### 2-5-2-5-4 — Barre de formatage permanente (haut de zone) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Affichage** : barre **toujours visible** en haut de la zone Edition (`.visu-format-toolbar--docked`, `position: sticky; top: 0`), sous la barre des méga-outils — plus de toolbar flottante au curseur (vB-0.282)
- La sélection est préservée au clic via `(mousedown)="$event.preventDefault()"` sur chaque bouton
- **Boutons (mise en forme riche, vB-0.282)** : `applyVisuFormat(command, value?)`
  - Inline : Gras, Italique, **Souligné** (`underline`), Barré
  - Titres / blocs : H1, H2, H3, Paragraphe (`formatBlock`), Citation (`BLOCKQUOTE`)
  - Listes : à puces, numérotée, **case à cocher** (`insertVisuChecklist`)
  - **Code** inline (`insertVisuInlineCode`), **Lien** (`insertVisuLink` → `createLink`) ; un **clic sur un lien** ouvre un **menu d'actions** (`visuLinkMenu`) : *Suivre le lien* (`visuLinkFollow` → `window.open(_blank)`), *Modifier le lien* (`visuLinkEdit` → **popup stylisé** `showLinkEditPopup`/`linkEditUrl` → `confirmLinkEdit` met à jour `href`), *Supprimer le lien* (`visuLinkRemove` → déballe le `<a>`, conserve le texte). Toute modif persiste la section (`persistVisuLinkChange` → commit + saveAll). (vB-0.284)
  - **Alignement** : gauche / centre / droite (`justifyLeft/Center/Right`)
  - **Taille** : Petit / Grand (`fontSize`)
  - **Couleur du texte** (`foreColor`) et **Surlignage** (`hiliteColor`) via pastilles (`visuTextColors`, `visuHighlightColors`) — `styleWithCSS` activé pour produire des `<span style>`
  - Effacer formatage (`removeFormat`)
- **Bouton « + »** : (ligne d'ajout par section) ouvre le menu d'insertion / slash
- **Fermeture** : click ailleurs ou désélection (la toolbar reste ouverte après couleur/taille pour enchaîner)

### 2-5-2-5-5 — Insertion de blocs (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- Les boutons « Ajouter un bloc » et « Insérer une image » en bas de section ont été **supprimés** (vB-0.284). L'insertion se fait via le **slash menu `/`** (voir `2-5-2-5-18`) et la **barre de style** (image, voir `2-5-2-5-6`).

### 2-5-2-5-6 — Upload d'image dans une section (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Déclenchement** : icône **image de la barre de style** → `insertVisuImageActive()` → `triggerVisuImageUpload(sectionId actif)` (vB-0.284) ; aussi via le slash `/image`. La section cible = section active (`getActiveVisuSectionId`).
- **Sélection fichier** : input file → POST `/api/file-projects/{name}/files` (multipart) → l'image est téléchargée dans le dossier de la section
- **Suppression unifiée (tous modes) → effacement du fichier** (vB-0.284) : une seule fonction `deleteImageUnified(imgId)` gère Code / Edition / Structure. Elle retire le marqueur de la vue du mode courant (Structure : `structureNodes` + `flushStructureNodes` + re-parse des tags ; Edition : figures du DOM ; markdown dans tous les cas), met à jour `allImages`, sauvegarde, puis **supprime le fichier physique** si plus aucun `{{IMG:id}}` ne subsiste. Les points d'entrée (icône/figure Edition, panneau F5, tag × Structure via `removeImageMarker`) délèguent tous à cette fonction. `reconcileImageLifecycle` (au save) reste le filet pour les marqueurs retirés au clavier en Code.
- **Résultat** :
  - Marqueur `{{IMG:uuid}}` inséré dans `unifiedContent` à la fin de la section
  - Image rendue dans le HTML
  - Si projet backup : `visuSectionLockSnapshot` + `editingVisuSectionId.set(sectionId)` + `collab.lockNode()`

### 2-5-2-5-7 — Suppression d'image dans une section (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Déclenchement** : clic bouton × sur une image → `deleteVisuImage(imgId)`
- **Action immédiate** : retrait de l'image de `allImages`, suppression du marqueur `{{IMG:id}}` de `unifiedContent`
- **En attente** : `pendingVisuDeletions.set(imgId, ...)` — suppression physique différée au "Partager"
- **Annuler** : `cancelVisuEdit()` → restaure les images annulées

### 2-5-2-5-8 — État pending et barre Annuler/Partager (projets backup) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Section avec modifications** : `dirtyVisuSectionIds.has(sectionId)` = true
- **Barre Preview visible** : `editingVisuSectionId()` non null → barre en haut de zone
- **Annuler** : `cancelVisuEdit(sectionId)` :
  - Restaure le HTML depuis `visuSectionLockSnapshot`
  - Restaure les images supprimées (depuis `pendingVisuDeletions`)
  - Libère le lock, remet `dirtyVisuSectionIds`, `editingVisuSectionId = null`
- **Partager** : `publishVisuSection(sectionId)` :
  - Convertit HTML → Markdown : `htmlSectionToMarkdown(el)`
  - `svc.updateFile(projectName, fileId, newMd, sectionId, publish=true)`
  - Exécute les suppressions d'images différées
  - Libère le lock, vide `dirtyVisuSectionIds`, `editingVisuSectionId = null`
  - Toast succès "Modifications enregistrées et partagées"

### 2-5-2-5-9 — Badges de collaboration (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **"Vous éditez cette section"** : si `editingVisuSectionId() === sec.sectionId`
- **"Modifications en attente"** : si `collab.isLocalPending(sectionId)` mais pas en focus
- **"Édité par {username}"** : si `collab.isLockedByOther(sectionId)` → section `contenteditable=false`

### 2-5-2-5-10 — Navigation dans les commentaires (F6) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Bouton bulle** : visible au hover sur chaque section
- **Clic** : emit `commentRequest({ folderId, folderName })` → ouvre le drawer F6
- **Badge compteur** : si `commentCounts[sectionId] > 0` → nombre affiché

### 2-5-2-5-11 — Preview d'un document standalone (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Déclenchement** : sélection d'un fichier Markdown dans la sidebar (pas un dossier)
- **Affichage** : `singleFileVisuPreview` → rendu HTML en lecture seule du fichier
- **Non éditable** : `class="visu-sec-content--readonly"`

### 2-5-2-5-12 — Preview d'une image (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Déclenchement** : sélection d'une image dans la sidebar
- **Affichage** : `singleImageVisuPreview` → image + options rename/delete
- **Renommer** : input inline → confirm → PATCH `/api/file-projects/{name}/files/{id}`
- **Supprimer** : bouton × → confirmation → DELETE `/api/file-projects/{name}/files/{id}`

### 2-5-2-5-13 — Panel propriétés d'image (F5) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Déclenchement** : clic sur une `<figure>` dans le rendu HTML
- **Panel** : `imagePropsPanel` → caption, alignement (left|center|right), largeur
- **Sauvegarde** : PUT attributs sur le marqueur `{{IMG:id|caption=...|align=...|width=...}}`
- **Fermeture** : clic ailleurs

### 2-5-2-5-14 — Conversion HTML → Markdown (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- `htmlSectionToMarkdown(el)` : convertit le `contenteditable` vers Markdown (via `turndown` ou équivalent)
- Préserve : gras, italique, titres H1-H6, listes, liens, images, code inline et blocs

### 2-5-2-5-15 — États (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
| État | Description |
|------|-------------|
| Sections toutes visibles | Aucun filtre actif |
| Section filtrée | Seule la section active + enfants |
| Section en édition | Focus visible, `editingVisuSectionId` défini |
| Section verrouillée par autre | `contenteditable=false`, badge rouge |
| Toolbar de formatage visible | Texte sélectionné |
| Menu insertion ouvert | Flottant sous le bouton + |
| FTP sync (indicatif) | Badge animé sur la section |
| Barre Preview visible | Annuler/Partager en haut |
| Toast succès publication | Badge vert 3s |
| Toast erreur FTP | Badge rouge 6s |
| Panel image ouvert | Panel props visible sous l'image |
| Preview standalone | Section lecture seule |
| Overlay publication | Spinner plein écran pendant `isPublishing` |

### 2-5-2-5-16 — Zone basse Trello (méga-outils, tous modes) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- Les méga-outils Trello incrustés dans le contenu (marqueur `{{TRELLO:id}}`) ne s'affichent plus inline dans le code ni dans la section Preview
- Un **panneau bas partagé** affiche les board(s) Trello présents dans le contenu courant — comportement **identique en Code, Structure et Preview**
- `contentTrelloIds` : liste calculée depuis `unifiedContent` (focus = section active ; sinon tout le contenu visible), filtrée sur les instances existantes
- Panneau à **hauteur fixe (~400px)**, **repliable** via le bouton chevron (`trelloPanelCollapsed`) ; en-tête affiche le nom du board (ou le nombre si plusieurs)
- Plusieurs boards empilés dans un corps scrollable
- Colonnes du board (À faire / En cours / Terminé / Bloqué) en pleine largeur (`flex-1`), sans ascenseur horizontal
- Suppression d'un board (corbeille) retire l'instance + le marqueur du contenu
- Masqué si aucun marqueur Trello dans le contenu courant
- **Synchro temps réel (SSE)** : toute mutation de carte/instance par un autre user diffuse `trello_update` (canal collab du projet) ; `trello-board` recharge ses cartes (filtre sur `instanceId`) et l'éditeur recharge la liste d'instances sur les actions `instance_*`. Stockage partagé en BDD (`mega_outil_instances`, `mega_outil_trello_cards`)

### 2-5-2-5-17 — Vue "Liste des trellos" (zone centrale) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- Déclenchée par le bouton sidebar (voir `2-5-2-2-14`) via l'input `showTrelloList` ; remplace le contenu de la zone centrale (tous modes)
- Grille de cartes, une par instance Trello de l'outil
- Chaque carte : nom du trello, total de cartes, aperçu du nombre de cartes par colonne (À faire / En cours / Terminé / Bloqué) chargé via `loadTrelloListCounts()` (`getTrelloCards`)
- Bouton "Aller à la section" : navigue vers la section d'origine (`inst.folderId`) via l'output `trelloNavigate` (sélection réelle + fermeture) ; désactivé si aucune section associée
- Section résolue par `recomputeTrelloSections()` via la position du marqueur `{{TRELLO:id}}` dans `docSections` (source de vérité, indépendante du mode focus), fallback sur `inst.folderId` ; stockée dans le signal `trelloSections`
- Bouton de fermeture (`closeTrelloList`) ; la liste se ferme aussi à toute sélection dans la sidebar

### 2-5-2-5-18 — Slash menu « / » en mode Edition (vB-0.282) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Déclenchement** : taper `/` (en début de mot) dans une section contenteditable → `onVisuSectionInput` appelle `detectVisuSlash(sectionId)` qui ouvre `app-slash-command-menu` (`#visuSlashMenu`, `positionFixed`) positionné au caret (rect de la sélection)
- **Filtrage** : le texte tapé après `/` alimente `visuSlash.query` ; commandes enrichies via `[commands]="visuSlashCommands"`
- **Navigation clavier** : `onVisuSectionKeydown` → ↑/↓/Entrée/Échap délèguent à `moveNext/movePrev/selectActive`
- **Commandes** : Titre 1-3, Liste à puces/numérotée, Case à cocher, Citation, Bloc de code, Séparateur, Note Info, Tableau Markdown, Image, **Trello (MO)**, **Tableau (MO)**
- **Sélection** : `onVisuSlashSelect(cmd)` retire le `/query` du DOM (`removeVisuSlashText`), persiste la section (`commitVisuSection`), puis :
  - blocs texte → `insertVisuMarkdownBlock(sectionId, snippet)` (insertion dans le contenu direct de la section + re-rendu)
  - image → `triggerVisuImageUpload(sectionId)`
  - MO → `createMoInVisuSection('trello'|'array', sectionId)` : `createInstance` (folderId = section) + carte de démarrage Trello + insertion du fence ` ```TRELLO: ` / ` ```ARRAY: `

### 2-5-2-5-19 — Édition des méga-outils en direct (vB-0.282) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Trello** : `app-trello-board` éditable (readonly uniquement si verrouillé par un autre user) ; `cardsChanged` → `onTrelloCardsChanged` → maj du fence ` ```TRELLO: ` + `recomputeAll`. **Hauteur dynamique** (vB-0.283) : `[autoHeight]="true"` → le board se dimensionne à la hauteur des tasks (pas d'étirement) et grandit/rétrécit à l'ajout/suppression (wrapper `.visu-trello-board-wrap--auto`, racine du board sans `h-full`, colonnes sans `flex-1`, zone cartes au contenu)
- **Tableau (Array)** : `app-array-board` désormais **éditable inline** (`[readonly]="isArrayInstanceLocked(ainst.id)"`, auparavant `true`) ; `gridChanged` → `onArrayGridChanged` → `syncArrayInlineBlock` met à jour le fence ` ```ARRAY: ` et `recomputeAll`
- **Mockup** : aperçu cliquable (ouvre l'éditeur), édition complète inline en backlog
- **Sync live multi-mode** : toute modification écrit dans `unifiedContent` → bascule Code/Structure reflète immédiatement le changement ; inter-utilisateurs via SSE `trello_update` / `array_update` + publication par le menu de section

### 2-5-2-5-20 — Styles avancés préservés en Markdown (vB-0.282) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- Le Markdown reste la source de vérité ; les styles non exprimables en Markdown sont conservés en **HTML inline** (rendu par `marked`)
- `nodeToMd` étendu : `<a href>` → `[texte](url)` ; `<span>`/`<font>` avec couleur/surlignage/taille → `<span style="…">` (via `preservedInlineStyle`) ; `<u>` conservé ; **alignement** de bloc (`p`/`h1-4` avec `text-align` center/right/justify) → bloc HTML autonome conservant l'`innerHTML`
- **Balises sémantiques garanties** (vB-0.282) : `applyVisuFormat` force `styleWithCSS=false` pour Gras/Italique/Souligné/Barré (→ `<b>/<i>/<u>/<s>`) et `true` pour couleur/surlignage/taille. En secours, si un `<span>` porte `font-weight`/`font-style`/`text-decoration` (cas styleWithCSS), `nodeToMd` le reconvertit en Markdown (`**`, `*`, `~~`, `<u>`). Le gras sort donc bien en `**gras**` en mode Code.
- Round-trip Edition ↔ Code stable (les styles Markdown-compatibles en `**`/`*`/`~~`/`#`/listes/liens, les autres en HTML inline `<span style>` / `<u>`)
- **Espaces hors marqueurs** (vB-0.282) : `wrapInlineMd` hisse les espaces de début/fin hors des marqueurs (`**mot ** ` invalide → `**mot** `), sinon le Markdown ne se rendrait pas et le code resterait visible en Edition. Le mode Edition n'affiche jamais le code de mise en forme (ni `**`, ni HTML), uniquement le texte formaté.

### 2-5-2-5-21 — Création de titre via popup (barre de style) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Déclenchement** : barre de style dockée → menu « titre » → H1/H2/H3/H4 → ouvre `worg-title-create-dialog` (composant partagé `libs/shared/ui`). Le slash-menu `/` redirige aussi les commandes `heading-N` vers ce popup (`openTitleDialogFromVisu`).
- **Pré-remplissage** : si du texte est sélectionné, il pré-remplit le champ titre du popup.
- **Insertion à la position du curseur** (`createTitleSection`) : le heading est inséré dans `unifiedContent` **après la section active** (`computeTitleInsertion` → `insertLine = anchor.lineEnd`), puis `saveAll()` immédiat. Le flux est **unifié avec le mode Code** : c'est `processSectionsChange` (parent) qui crée le dossier, l'ordonne selon la position dans le texte (`applySectionFolderOrder`) et re-parent les sections suivantes. Pas de `createFolder` dans la zone → le titre ne part jamais en fin de liste.
- **Position & niveau** : titre de même niveau que la section active → inséré **entre** la section active et la suivante. Titre de niveau plus haut → les sections suivantes de niveau plus profond lui sont **rattachées** (re-parentage + normalisation de niveau, identique au mode Code, voir `2-5-2-4-20`).
- **Parent affiché** : `computeTitleInsertion` calcule le parent (section précédente de niveau strictement inférieur ; niveau 1 → racine) pour l'afficher dans le popup ; le rattachement réel est dérivé de l'imbrication markdown par le parent.
- **Remplacement** : l'ancien chemin `execCommand('formatBlock', H1-4)` n'est plus utilisé pour les titres (source d'instabilité supprimée). `execCommand` reste pour gras/italique/souligné/couleur.
- **Popup** : pas de fermeture au clic backdrop (✕ / Annuler / validation Entrée). Émet `(confirm)` / `(cancel)`.

### 2-5-2-5-22 — Annuler / Refaire (Ctrl+Z / Ctrl+Y) en mode Édition (Visu) (Page: Éditeur › Zone 4 — Mode Edition — Fonctions métier)
- **Boutons** : `undo` et `redo` (icônes Material) en **première position** dans la barre de formatage permanente du mode Édition.
- **Raccourcis** : Ctrl+Z → annuler (natif contenteditable), Ctrl+Y (ou Ctrl+Shift+Z) → refaire. Ctrl+Y intercepté dans `onVisuSectionKeydown`.
- **Mécanisme** : appels `document.execCommand('undo')` / `document.execCommand('redo')` — le navigateur gère nativement l'historique des modifications sur l'élément `contenteditable`. Suivi par `markActiveVisuDirty()` + `updateVisuActiveFormats()` pour maintenir la cohérence de l'état.

### 2-5-2-6-1 — Affichage de la structure (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- **Arborescence visuelle** : liste des sections (H1-H4) avec indentation selon le niveau
- **Badges de niveau** : H1, H2, H3, H4 colorés
- **Nom de section** : éditable inline
- **Contenu** : texte principal de la section (éditable)
- **Blocs additionnels** : fichiers Markdown secondaires d'une section (éditables)
- **Marqueur Trello masqué** : `{{TRELLO:id}}` est extrait du contenu (`StructureNode.trelloMarkers`) et n'apparaît pas dans la textarea ; ré-injecté en fin de section à la sauvegarde. Le board s'affiche en zone basse (voir `2-5-2-5-16`)
- **Bloc trello.md masqué** : le fichier `trello.md` généré automatiquement (contenu des cards) est détecté comme bloc additionnel de titre "trello" (`structNodeShowBlock` retourne `false`). Les headings `##` de ce fichier ne brisent pas le parsing de structure grâce à la pré-détection des plages de blocs dans `parseStructureNodes`
- **Barre Mega-outils masquée** : en mode Structure, la barre "MEGA-OUTILS / Trello / Mockup" n'est pas affichée — seul le panel Trello/Mockup en zone basse reste visible
- **Filtre par sélection** : si un nœud est actif dans la sidebar → `filteredStructureNodes` n'affiche que la section et ses enfants

### 2-5-2-6-2 — Édition inline d'une section (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- **Focus sur le nom** : clic sur le titre d'une section → input inline
  - `applyStructLock(entityId)` → verrou si projet backup
  - Snapshot du contenu avant modification → `structEntitySnapshots`
- **Focus sur le contenu texte** : clic sur le corps → bloc **rendu formaté éditable** (contenteditable, `.struct-card__content--rich`) — identique au mode Edition : on voit le texte mis en forme, **pas le code Markdown** (vB-0.282)
  - Rendu via `structSegHtml` (marked) injecté par `initStructSegments` (ngAfterViewChecked, sans écraser la frappe) ; saisie reconvertie en Markdown par `onStructSegmentHtmlInput` (`htmlSectionToMarkdown`)
  - Lock de la même entité (`onStructSegmentFocus`)
- **Focus sur un bloc additionnel** : clic → textarea du bloc
  - Lock sur l'entité bloc (`fileId` ou `blockId`)
- **Modifications** : mises à jour dans `unifiedContent` via `structureNodes`
- **Auto-save** : `structFlushTimeout` → flush et sauvegarde après 500ms d'inactivité

### 2-5-2-6-3 — État pending (projets backup) (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- **Premier edit** : `applyStructLock(entityId)` → `structEntityLocks.add(entityId)`, `collab.addLocalPending(entityId)`, `collab.lockNode()`
- **Barre Structure** : `structureHasPending()` → visible si au moins un lock structure actif
- **Annuler** : `cancelStructureEdit()` → restaure depuis `structEntitySnapshots`, libère les locks
- **Partager** : `publishStructureEdit()` → publie toutes les entités modifiées vers le serveur distant

### 2-5-2-6-4 — Annuler une modification structure (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- **Portée** : uniquement l'entité ayant le focus (`structFocusedEntityId`)
- **Restauration** : contenu avant modification depuis `structEntitySnapshots`
- **Libération lock** : `collab.unlockNode(projectName, entityId)`, `structEntityLocks.delete(entityId)`
- **Si plus de locks** : `structureHasPending.set(false)`

### 2-5-2-6-5 — Partager (publier) les modifications structure (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- **Flush** : `flushStructureNodes()` → applique tous les changements dans `unifiedContent`
- **Parse** : `parseContent()` → reconstruit les sections avec nouveaux contenus
- **Publish** : `svc.updateFile(..., publish=true)` pour chaque section modifiée
- **Nettoyage** : libère tous les locks, vide `structEntityLocks`, `structureHasPending.set(false)`

### 2-5-2-6-6 — Insertion de blocs additionnels (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- **Nouveau document dans une section** : bouton "+" dans l'en-tête de section → nom → création
  - POST `/api/file-projects/{name}/files` dans le dossier de la section
  - Bloc inséré dans `unifiedContent` avec délimiteur `~~~NomFichier~~~`

### 2-5-2-6-7 — Règle de verrouillage (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- **Projets sans backup** : `applyStructLock` ne crée PAS de verrou — aucune UI Annuler/Partager
- **Projets avec backup** : verrou créé, barre Structure visible

### 2-5-2-6-8 — Correspondance Structure ↔ Code (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- Les modifications en mode Structure sont reflétées en temps réel dans `unifiedContent`
- Un changement de nom de section en Structure → renommage du dossier physique (via `onSectionsChange`)
- Un contenu modifié en Structure → mis à jour dans le fichier `contenu.md` correspondant

### 2-5-2-6-9 — États (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
| État | Description |
|------|-------------|
| Vue complète | Toutes les sections du projet affichées |
| Vue filtrée | Section sélectionnée + enfants uniquement |
| Section en édition | Input/textarea visible sur l'entité |
| Lock actif | Badge cadenas rouge sur la section |
| Barre Structure visible | Annuler/Partager en haut (projets backup) |
| Barre cross-mode visible | Pending Code + Structure simultanément |
| Aucune section | Message "Document vide" |

### 2-5-2-6-10 — Suppression d'image unifiée (tag Structure) (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- **Déclenchement** : clic × sur le tag image d'une section → `removeImageMarker(seg.imageId)` → `deleteImageUnified(id)`
- **Nettoyage du marqueur `{{IMG:id}}`** dans toutes les sources de vérité Structure :
  - `node.textContent` de chaque nœud
  - `node.additionalBlocks[].content` (blocs fichiers `'…'`, `` `…` ``, `^…^`) — sinon le tag persiste
  - `fullContentBackup` (backup plein quand une section est en focus) — sinon le fichier n'est jamais supprimé
- **Reconstruction** : `flushStructureNodes()` → `unifiedContent` + sauvegarde, puis `parseStructureNodes()` rafraîchit les tags
- **Suppression physique** : si plus aucune référence `{{IMG:id}}` (dans `unifiedContent` ni `fullContentBackup`) → `svc.deleteFile(projectName, imgId)` → l'image disparaît du dossier
- **Cohérence inter-modes** : le même `deleteImageUnified` est appelé depuis Code, Édition et Structure → comportement identique partout

### 2-5-2-6-11 — Création de titre via popup (Structure) (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- **Nouvelle section racine** : bouton « + Nouvelle section » en tête de la vue Structure → `openTitleDialogStructRoot()` (niveau 1, parent = racine).
- **Sous-titre** : menu contextuel d'un nœud (si `level < 4`) → « Ajouter un sous-titre » → `openTitleDialogStructChild(node)` (niveau = `node.level + 1`, parent = le nœud).
- **Création** : identique au mode Édition (`createTitleSection` insère le heading à la position d'ancrage puis `saveAll()` ; le parent crée le dossier, l'ordonne et re-parent), via le composant partagé `worg-title-create-dialog`.
- **Persistance du SID** : `parseStructureNodes` extrait le SID dans `node.sid` (titre nettoyé) ; `flushStructureNodes` le réinjecte via `composeHeading(level, title, node.sid)`. Renommer un titre en Structure renomme le dossier physique sans le perdre (matching par SID dans `processSectionsChange`).

### 2-5-2-6-12 — Changer le niveau d'une section (clic droit) (Page: Éditeur › Zone 4 — Mode Structure — Fonctions métier)
- **Déclenchement** : menu contextuel d'un nœud Structure → « Monter d'un niveau » (−1) ou « Descendre d'un niveau » (+1).
- **Sémantique = outdent / indent de plan** (le niveau = profondeur dans l'arbre) :
  - **Monter** : la section remonte d'un niveau et **récupère les sections suivantes** comme enfants ; les sections **précédentes** restent en place.
  - **Descendre** : la section se **niche sous sa sœur précédente**. Son sous-arbre suit.
- **Mécanisme** : `changeHeadingLevel(folderId, ±1)` modifie le nombre de `#` de la **ligne de heading** (marqueur `{{SID}}` préservé) puis `saveAll()` ; le re-parentage des dossiers et la normalisation de profondeur (`buildDocSections`) sont appliqués par `processSectionsChange`.
- **Disponibilité** : Monter si `level > 1` ; Descendre s'il existe un frère précédent **et** que la profondeur max du sous-arbre reste ≤ 4 (`canPromoteStructNode` / `canDemoteStructNode`).
- **Flux** : menu Structure → `changeStructNodeLevel` → `changeHeadingLevel` (direct) ; sidebar → `nodeLevelChange` → `onNodeLevelChange` → `editionOutil.changeHeadingLevel`.

### 2-5-2-7-1 — Chargement de l'historique (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
- **Déclenchement** : changement de `sectionId` (nœud actif dans la sidebar)
- **Requête** : GET `/api/conversations/{sectionId}/history` → `{ messages: Message[] }`
- **Affichage** : messages chronologiques, bulles colorées (user = droite, IA = gauche)
- **Indicateur conversations existantes** : la sidebar affiche une bulle sur les nœuds ayant des conversations → `conversationIds Set`

### 2-5-2-7-2 — Envoi d'un message (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
- **Saisie** : input texte en bas du panel
- **Envoi** : Enter ou bouton envoyer
- **Mode normal** (pas IA) : message utilisateur enregistré, réponse attendue
- **Mode IA** (`iaMode = true` ou préfixe `@ia`) : déclenche `sendAiEdit()`
- **Streaming SSE** : réponse IA en temps réel caractère par caractère
- **Emit** : `conversationAdded` avec sectionId → sidebar met à jour `conversationIds`

### 2-5-2-7-3 — Toggle mode IA (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
- **Bouton** : `toggleIaMode()` → `iaMode.set(!iaMode())`
- **Mode IA actif** : badge coloré sur le bouton, préfixe `@ia` automatique aux messages
- **Mode IA inactif** : messages normaux (sans traitement IA)

### 2-5-2-7-4 — Sélection du modèle IA (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
- **Bouton** : `toggleModelSelect()` → affiche/masque le selecteur
- **Modèles disponibles** : `allModels = computed([...claude, ...gemini])` depuis `ConfigService`
- **Sélection** : clic sur un modèle → `selectedModel.set(model)`
- **Modèle actif** : `activeModel = selectedModel() || config.headerSelection.model`
- **Affichage** : nom du modèle actif dans le bouton

### 2-5-2-7-5 — Inclusion de l'historique dans le contexte IA (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
- **Bouton** : `toggleHistory()` → `includeHistory.set(!includeHistory())`
- **Activé** : les messages précédents de la conversation sont envoyés comme contexte à l'IA
- **Désactivé** : seul le message courant est envoyé (contexte minimal)

### 2-5-2-7-6 — Suggestion d'édition IA (`@ia`) (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
- **Envoi** : POST `/api/conversations/{sectionId}/ai-edit` avec `{ prompt, model, includeHistory }`
- **Réponse** : diff de modification du contenu de la section
- **Contexte section** : `fileContent` = contenu direct de `contenu.md` ; sous-sections ajoutées dans `systemInstructions` si présentes
- **Affichage dans la conversation** : message IA avec le diff proposé
- **Barre "Accepter/Annuler"** (via `ProjetAiEditService`) :
  - Affichée dans l'éditeur principal au-dessus de la zone de code
  - **Accepter** : `onAcceptAiEdit()` → `aiEditService.acceptEdit()` → contenu mis à jour
  - **Annuler** : `onCancelAiEdit()` → `aiEditService.rejectEdit()`
- **Diff visuel** : `ProjetAiDiffComponent` → affiche avant/après côte à côte

### 2-5-2-7-7 — Gestion de la section sans contenu (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
- **Section sans conversation** : message "Aucune conversation" + invitation à démarrer
- **Pas de sectionId** : champ désactivé, message "Sélectionnez une section"

### 2-5-2-7-9 — Popup informations IA du projet (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
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

### 2-5-2-7-11 — Option "Inclure le document entier" (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
- **Signal** : `includeFullDocument = signal(false)`
- **Activé** : `collectAllSectionsContent(files)` récupère tout le document → injecté dans `systemInstructions` avec la mention de la section ciblée
- **Désactivé** : comportement standard (section seule + sous-sections si présentes)
- **Indicateur** : `◈ Document entier en contexte` dans la barre d'outils
- **Toggle** : disponible dans le popup IA ET via `toggleFullDocument()` (extensible)

### 2-5-2-7-10 — Popup prompt complet par message IA (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
- **Bouton** : icône `receipt_long` + label "Prompt" sous chaque réponse IA, visible uniquement pour les messages envoyés dans la session courante
- **Déclenchement** : clic → `openPromptInfo(msg.promptContext)`
- **Contenu** :
  - Modèle utilisé
  - Niveau 1 — Instruction globale (état au moment de l'envoi)
  - Niveau 2 — Instructions du projet (état au moment de l'envoi)
  - Niveau 3 — Section : nom + contenu direct + sous-sections si présentes
  - Niveau 4 — Prompt exact de l'utilisateur
- **Stockage** : `PromptContext` attaché à `Message.promptContext` (non persisté en BDD)

### 2-5-2-7-8 — États (Page: Éditeur › Zone 5 — Conversation IA — Fonctions métier)
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

### 2-5-2-8-1 — Chargement (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Connexion WebSocket** : lors de l'ouverture de l'éditeur → `collab.connect(projectId)`
- **Historique initial** : chargé depuis le signal `collab.history()`
- **Mises à jour temps réel** : nouvelles entrées poussées via WebSocket

### 2-5-2-8-2 — Affichage (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Groupage par jour** : entrées groupées par date (`HistoryGroup[]`)
- **Expand/collapse par jour** :
  - Aujourd'hui : ouvert par défaut
  - Jours précédents : repliés par défaut (sauf si `expandedDays` override)
  - `toggleDay(date)` → bascule
- **Format heure** : `formatTime(timestamp)` → "HH:MM"
- **Icône par type d'action** : `getActionIcon(entry)` → Material icon
- **Couleur badge** : `getIconBgColor(entry)` → vert (create), bleu (update), rouge (delete), violet (undo/redo)
- **Compteur** : nombre total d'entrées affiché dans le badge de l'onglet

### 2-5-2-8-3 — Filtrage par entité active (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Filtre automatique** : si `activeIds` est défini → `filteredEntries = computed` ne retient que les entrées pour ces IDs
- **Activation** : sélection d'un nœud dans la sidebar → `activeIds` mis à jour
- **Vue complète** : aucun filtre → tout l'historique du projet affiché

### 2-5-2-8-4 — Entrées en état "pending" (édition en cours) (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Source** : `collab.pending()` → `PendingEditInfo[]`
- **Affichage** : entrées grisées avec label "en cours d'édition" ou "sauvegarde…"
- **State** : `editing` (frappe en cours) | `saving` (envoi serveur)
- **Username** : affiché pour identifier qui est en train d'éditer

### 2-5-2-8-5 — Clic sur une entrée (voir le diff) (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Déclenchement** : `onEntryClick(entry)` → emit `entryClick`
- **Parent** : `ProjetEditorComponent` → `diffEntry.set(entry)`
- **Vue diff** : `ProjetDiffComponent` s'affiche → remplace temporairement la zone d'édition
- **Lazy load** : si `beforeState`/`afterState` non chargés → `collab.fetchEntry(id)` → GET pour charger le diff complet
- **Fermeture diff** : bouton "Fermer" → `closeDiff()` → `diffEntry.set(null)` → retour à l'éditeur

### 2-5-2-8-9 — Annulation d'une modification (undo simple) (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Déclenchement** : bouton `undo` (icône `undo`) visible au hover sur les entrées `undoable && !undone`
- **Action** : `undoEntry(entry)` → `woHistory.undo(id)` → POST `/api/wo-action-history/:id/undo`
- **Réponse serveur** : `{ restored: { nodeId, content } }` → émis via `(restored)` au parent → patch `files` + incrément `restoreToken` → reconstruction de la zone éditeur (mode focus préservé)
- **Grisage** : événement SSE `entries_undone` (vérité serveur) → la collab marque l'entrée `undone` → grisée + boutons retirés. Survit aux rechargements (`undoable`/`undone` renvoyés par la route de chargement)
- **Nouvelle entrée** : le serveur crée et diffuse (SSE `history`) une entrée "Annulation : ..." elle-même `undoable` (réapplique l'`afterState`) → permet d'annuler l'annulation
- **Résultat** : le contenu du fichier est restauré à `beforeState`; l'éditeur se met à jour automatiquement

### 2-5-2-8-10 — Retour à une ancienne version (undo cascade) (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Déclenchement** : bouton `history` (icône `history`) visible au hover → confirmation inline affichée
- **Confirmation** : message + boutons "Annuler" / "Confirmer le retour"
- **Action** : `confirmCascade(entry)` → `woHistory.undoCascade(id)` → POST `/api/wo-action-history/:id/undo-cascade`
- **Périmètre** : uniquement le même fichier/entité (`entity_id`), toutes les modifications plus récentes non encore annulées
- **Feedback** : spinner, toutes les entrées concernées marquées "annulé" localement
- **Résultat** : le fichier revient à l'état juste avant la modification cible; une entrée récapitulative est créée dans l'historique

### 2-5-2-8-11 — Badge IA (actionType ai-update) (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Source** : modifications IA acceptées via `onAcceptAiEdit()` dans `ProjetEditorComponent`
- **Icône** : `auto_awesome` (violet)
- **Couleur** : fond `bg-violet-500/20`, texte `text-violet-400`
- **Undoable** : oui — le `beforeState` est le contenu original avant la modification IA
- **Annulable** : via undo simple ou cascade comme toute autre modification

### 2-5-2-8-12 — Vue diff 3 panneaux avec sélection de lignes (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Déclenchement** : clic sur une entrée `update` ou `ai-update` dans l'historique → `ProjetDiffComponent` s'affiche en remplacement de la zone éditeur
- **Panneau Actuel (gauche)** : contenu en cours du fichier (`diffCurrentContent` computed depuis `files`), lignes modifiées surlignées en bleu
- **Panneau Avant (milieu)** : `beforeState.content` de l'entrée d'historique, diff LCS vs afterState, bouton `←` au hover sur chaque ligne
- **Panneau Après (droite)** : `afterState.content`, bouton `→` au hover sur chaque ligne
- **Cherry-pick** : clic `←` ou `→` copie la ligne dans la copie de travail (`workingLines[]`), badge bleu sur la ligne modifiée
- **Réinitialiser** : restaure `workingLines` depuis `currentContent`
- **Appliquer dans l'éditeur** : `emit(workingLines.join('\n'))` → parent patch `files` + `restoreToken` + `updateFile` serveur + entrée "Fusion manuelle" dans l'historique (`undoable: true`)

### 2-5-2-8-6 — Suppression de l'historique (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Ouverture** : `openClear()` → modal de confirmation avec `clearOpen.set(true)`
- **Scope** :
  - `mine` : supprimer uniquement mes propres entrées
  - `all` : supprimer tout l'historique (admin seulement)
- **Compteur** : `clearTargetCount` → nombre d'entrées qui seront supprimées
- **Confirmation** : `confirmClear()` → POST `/api/collab/clear-history { projectId, scope, entityIds? }`
- **Après suppression** : liste rechargée, modal fermée

### 2-5-2-8-7 — Affichage du diff (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
- **Composant** : `ProjetDiffComponent`
- **Données** : `entry.beforeState` et `entry.afterState`
- **Vue** : côte à côte avant/après, lignes ajoutées/supprimées surlignées
- **Fermeture** : bouton × ou clic "Retour"

### 2-5-2-8-8 — États (Page: Éditeur › Zone 5 — Historique — Fonctions métier)
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

### 2-5-3-1 — Mise en forme du texte en mode Visu (Édition Visuelle) (Page: Prrojet/Edition/bar de style)
- Sélectionner du texte en mode Visu (contenteditable) et cliquer sur les boutons de style de caractère : Gras (B), Italique (I), Souligné (U) ou Barré (S)
- Vérifier l'application correcte du format (balises HTML <b>, <i>, <u>, <s> ou styles sémantiques équivalents)
- Vérifier que l'état d'activation des boutons de la barre de style reflète la mise en forme du texte sous le curseur
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-3-2 — Mise en forme du texte en mode Code (Édition Markdown/HTML) (Page: Prrojet/Edition/bar de style)
- Cliquer sur un bouton de style ("Gras", "Italique", "Souligné", "Barré") sans sélection textuelle : vérifier l'insertion des marqueurs Markdown/HTML correspondants et l'activation du mode collant (bouton allumé)
- Sélectionner du texte dans le textarea et appliquer un style : vérifier que la sélection est entourée des marqueurs appropriés (`**`, `*`, `<u>`, `~~`)
- Tester le nettoyage de formatage via le bouton d'effacement de la mise en forme sur la sélection
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-3-3 — Insertion de titres et création de sections (Page: Prrojet/Edition/bar de style)
- Ouvrir le menu déroulant des titres de bloc dans les deux modes (Visu et Code)
- En mode Visu, sélectionner un niveau de titre (H1 à H4) : valider l'ouverture du dialogue de création de titre/section avec le texte pré-rempli
- Valider la création effective du titre en vérifiant que la section parente est correctement scindée à l'emplacement du curseur et qu'un nouveau dossier physique est créé
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-3-4 — Insertion de listes, checklists et citations (Page: Prrojet/Edition/bar de style)
- Cliquer sur les boutons d'insertion de liste à puces ou numérotée : valider la structure générée dans les deux modes
- Tester l'insertion de case à cocher (Checklist) : vérifier la création de la liste de tâches (`- [ ] Tâche` en markdown / HTML interactif)
- Tester l'insertion de citations (Blockquote) et vérifier le rendu
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-3-5 — Insertion et actions sur les liens hypertexte (Page: Prrojet/Edition/bar de style)
- Insérer un lien hypertexte sur le texte sélectionné en saisissant une URL dans l'invite
- En mode Visu, cliquer sur un lien existant pour faire apparaître le menu d'actions contextuel : vérifier l'ouverture du lien dans un nouvel onglet, l'édition de l'URL via le popup d'édition stylisé, et la suppression du lien avec conservation du texte
- En mode Code, vérifier l'insertion de la syntaxe markdown du lien
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-3-6 — Importation et insertion d'images (Page: Prrojet/Edition/bar de style)
- Cliquer sur le bouton d'insertion d'image pour ouvrir le sélecteur de fichiers de l'OS
- Tester les restrictions d'upload d'images : valider que les formats autorisés sont acceptés (Jpeg, Png, Gif, Webp, Svg, Bmp) et rejeter les fichiers > 1 Mo avec un message d'erreur
- Vérifier l'insertion de l'image (génération du marqueur `{{IMG:id}}` et de la figure DOM) et la persistance immédiate de la section
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-3-7 — Alignement, taille, couleurs et surlignage (Page: Prrojet/Edition/bar de style)
- Tester l'application des alignements (gauche, centré, droite) sur la sélection
- Tester la modification de la taille du texte (Petit/Grand) via la barre de style
- Ouvrir les menus déroulants de couleur de texte et de surlignage : sélectionner une pastille et valider l'application immédiate du style CSS inline
- Tester le bouton d'effacement de mise en forme globale sur la sélection
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-3-8 — Historique d'édition (Undo / Redo) (Page: Prrojet/Edition/bar de style)
- Tester les boutons Annuler et Refaire de la barre de style dans les deux modes (Visu et Code)
- Valider la préservation de la position du curseur et de la sélection après un undo/redo
- S'assurer de la synchronisation de l'état actif des styles de la barre de style avec l'état restauré
- **Priorité:** bloquant
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-3-9 — Insertion d'extras en mode Code (Page: Prrojet/Edition/bar de style)
- Tester l'insertion d'un bloc de code ()
- Tester l'insertion d'un tableau markdown structuré
- Tester l'insertion d'un séparateur horizontal (---)
- **Priorité:** mineur
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`

### 2-5-3-10 — Slash commands et menu d'insertion rapide (Page: Prrojet/Edition/bar de style)
- Taper `/` dans une section contenteditable en mode Visu : vérifier le déclenchement du menu Slash
- S'assurer que le menu Slash filtre les niveaux de titre pour ne proposer que des sous-sections de niveau inférieur à la section courante
- Utiliser le bouton de menu d'insertion rapide pour insérer directement un Nouveau titre, Nouveau document ou Bloc de code
- **Priorité:** critique
- **Composants:** `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.html`, `apps/projets/src/app/pages/projet-editor/components/projet-editor-zone/projet-editor-zone.component.ts`, `apps/projets/src/app/pages/projet-editor/components/slash-command-menu/slash-command-menu.component.ts`
