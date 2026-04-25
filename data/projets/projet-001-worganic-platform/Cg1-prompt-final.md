# Document Final - Tous les Prompts des Exigences

**Créé le** : 17/01/2026
**Statut** : Complet
**Total des exigences** : 69

---

## Exigences Métier (BM)

# Prompt BM-01 - Simplifier la création de projets structurés

## Description
Réduire la complexité et les erreurs de création de projets en proposant des templates standardisées qui garantissent la cohérence et la qualité des livrables.

## Contexte
- **Traçabilité** : Source A-prompt.md ligne 4-7
- **Priorité** : Must Have
- **Complexité estimée** : Multi-phase (dépend des EF-SYS associées)

## Objectif Métier
Augmenter la productivité des équipes et réduire les coûts de mise en place de nouveaux projets.

## Indicateurs de Succès
- Temps moyen de création d'un projet < 5 minutes
- Taux d'utilisation des templates > 80%

## Critères d'acceptation
- Les utilisateurs peuvent créer un projet en moins de 5 minutes
- Au moins 80% des nouveaux projets utilisent les templates fournies
- Les templates couvrent les cas d'usage les plus courants
- La création de projet est intuitive et sans erreur

## Dépendances Exigences
- EU-01, EU-02
- EF-SYS-001, EF-SYS-002, EF-SYS-010, EF-SYS-015
- ENF-SYS-020, ENF-SYS-030

## Instructions de mise en œuvre
1. Mettre en place un système de templates standardisées
2. Créer une interface de sélection et création de projet fluide
3. Automatiser la création de la structure de dossiers du projet
4. Implémenter un suivi des métriques d'utilisation des templates
5. Tester l'UX complète de création de projet avec des utilisateurs finaux

## Appel à l'action
Implémenter le système de gestion des templates et le processus de création de projet selon les critères d'acceptation ci-dessus.

---

# Prompt BM-02 - Garantir la cohérence entre projets similaires

## Description
Utiliser des templates structurées pour assurer que tous les projets d'un même type suivent la même méthodologie et produisent des livrables uniformes.

## Contexte
- **Traçabilité** : Source A-prompt.md ligne 5
- **Priorité** : Must Have
- **Complexité estimée** : Infrastructure et processus

## Objectif Métier
Améliorer la qualité des livrables, faciliter la scalabilité et la maintenance.

## Indicateurs de Succès
- 100% des projets d'une même template ont la même structure
- Satisfaction client > 90%

## Critères d'acceptation
- Tous les projets créés avec une même template possèdent une structure identique
- La cohérence est vérifiable et traçable
- Les livrables sont uniformes d'un projet à l'autre
- Aucune variation involontaire n'est possible

## Dépendances Exigences
- EU-02, EU-03
- EF-SYS-070, EF-SYS-072, EF-SYS-073
- ENF-SYS-022

## Instructions de mise en œuvre
1. Définir une structure de fichiers standardisée pour chaque type de template
2. Implémenter une validation de la structure lors de la création d'un projet
3. Créer des tests de conformité pour vérifier la cohérence
4. Documenter les règles de cohérence attendues
5. Mettre en place un système d'alertes en cas de déviation

## Appel à l'action
Mettre en place le système de validation de cohérence des templates et s'assurer que 100% des nouveaux projets respectent les règles définies.

---

# Prompt BM-03 - Intégrer l'IA pour l'automatisation intelligente

## Description
Utiliser l'IA pour automatiser la génération de documents détaillés à partir des réponses collectées, réduisant ainsi l'effort manuel et améliorant la qualité.

## Contexte
- **Traçabilité** : Source A-prompt.md ligne 35-36, 51-110
- **Priorité** : Must Have
- **Complexité estimée** : Infrastructure IA (Claude Code CLI)

## Objectif Métier
Réduire le temps de génération des livrables de 70%, augmenter la qualité des documents générés.

## Indicateurs de Succès
- Temps de génération < 1 minute
- Documents générés avec qualité acceptable > 95%

## Critères d'acceptation
- La génération IA est lancée avec un simple clic
- Les documents générés sont de haute qualité
- Le processus génère des livrables complets et professionnels
- Les utilisateurs peuvent réviser et modifier avant génération
- Le temps total de génération est inférieur à 1 minute

## Dépendances Exigences
- EU-05
- EF-SYS-040, EF-SYS-041, EF-SYS-042, EF-SYS-043
- ENF-SYS-001, ENF-SYS-003

## Instructions de mise en œuvre
1. Implémenter l'intégration avec Claude Code CLI
2. Créer un système de prompt generation automatique
3. Mettre en place le streaming temps réel de la génération
4. Implémenter la sauvegarde des fichiers générés
5. Créer des templates de prompts pour chaque type de livrables
6. Tester la qualité des documents générés

## Appel à l'action
Implémenter l'intégration complète avec Claude Code CLI et assurer que les documents générés respectent les critères de qualité définis.

---

# Prompt BM-04 - Offrir une expérience utilisateur professionnelle

## Description
Développer une plateforme web avec une UX fluide, responsive et professionnelle pour augmenter l'adoption et la satisfaction des utilisateurs.

## Contexte
- **Traçabilité** : Source A-prompt.md ligne 7, 594-815
- **Priorité** : Must Have
- **Complexité estimée** : UI/UX complète

## Objectif Métier
Augmenter le taux d'adoption, réduire les demandes de support, améliorer la rétention utilisateurs.

## Indicateurs de Succès
- NPS > 70
- Taux d'adoption > 85%
- Temps d'apprentissage < 30 minutes

## Critères d'acceptation
- L'interface est moderne, intuitive et professionnelle
- L'application fonctionne sur tous les appareils (mobile, tablet, desktop)
- La navigation est fluide et sans friction
- Les utilisateurs peuvent accomplir les tâches principales sans documentation
- Le NPS (Net Promoter Score) est supérieur à 70
- Plus de 85% des utilisateurs utilisent activement la plateforme

## Dépendances Exigences
- EU-01 à EU-08
- EF-SYS-060, EF-SYS-061, EF-SYS-062, EF-SYS-063, EF-SYS-064
- ENF-SYS-001, ENF-SYS-002, ENF-SYS-030, ENF-SYS-031, ENF-SYS-032

## Instructions de mise en œuvre
1. Concevoir une interface utilisateur cohérente et professionnelle
2. Implémenter le responsive design pour tous les appareils
3. Créer une navigation intuitive et logique
4. Mettre en place des animations et transitions fluides
5. Implémenter les notifications et messages de validation
6. Tester l'UX avec des utilisateurs finaux
7. Optimiser les performances pour une expérience fluide

## Appel à l'action
Développer une interface utilisateur professionnelle et intuitiveconforme aux standards UX modernes et aux critères d'acceptation définis.

---

# Prompt BM-05 - Maintenir la traçabilité complète des projets

## Description
Enregistrer l'historique détaillé de toutes les actions et modifications pour assurer la traçabilité, faciliter l'audit et permettre la reprise de projets abandonnés.

## Contexte
- **Traçabilité** : Source A-prompt.md ligne 522-590
- **Priorité** : Should Have
- **Complexité estimée** : Système d'historique et audit

## Objectif Métier
Améliorer la conformité, la gouvernance et la récupération de projets.

## Indicateurs de Succès
- 100% des actions enregistrées
- Temps de reprise d'un projet < 5 minutes

## Critères d'acceptation
- Chaque action significative est enregistrée dans l'historique
- L'historique est immuable et ne peut pas être modifié
- Toutes les actions incluent un timestamp et des détails contextuels
- Les utilisateurs peuvent reprendre un projet à partir de n'importe quel point de son historique
- L'audit trail est complet et traçable

## Dépendances Exigences
- EU-03, EU-06
- EF-SYS-050, EF-SYS-051, EF-SYS-052, EF-SYS-053
- ENF-SYS-040, ENF-SYS-041, ENF-SYS-042

## Instructions de mise en œuvre
1. Implémenter un système d'historique append-only
2. Enregistrer les actions : création, réponse, complétion, génération
3. Créer une timeline visuelle pour afficher l'historique
4. Implémenter le filtrage par type d'action
5. Assurer l'immuabilité des entrées d'historique
6. Permettre la récupération d'état antérieur si besoin
7. Mettre en place les tests de conformité

## Appel à l'action
Mettre en place un système complet de traçabilité et d'audit garantissant l'intégrité de l'historique et la conformité des actions.

---

## Exigences Utilisateur (EU)

# Prompt EU-01 - Découvrir les templates disponibles

## Description
En tant qu'utilisateur, je veux voir la liste des templates avec leur description, le nombre de phases, le temps estimé et les tags pour choisir la plus adaptée à mon besoin.

## Contexte
- **Traçabilité Métier** : BM-01, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse (3-4 heures)

## User Story
En tant qu'utilisateur, je peux parcourir les templates disponibles avec descriptions pour sélectionner celle qui me correspond.

## Bénéfice
Gagner du temps dans le choix de la template, comprendre rapidement ce que chaque template propose.

## Critères d'acceptation
- Les templates s'affichent en grille avec image, nom, description, nombre de phases et temps estimé
- Pouvoir voir les détails d'une template en cliquant dessus
- Les templates sont triables par type et popularité

## Dépendances
- Service de chargement des templates depuis le système de fichiers
- EF-SYS-001, EF-SYS-002

## Instructions de mise en œuvre
1. Créer un composant TemplateGrid pour afficher les templates
2. Charger les métadonnées de templates depuis le dossier structure/
3. Implémenter l'affichage des détails au clic
4. Ajouter des fonctionnalités de tri et filtrage
5. Rendre le design responsive et visuellement attractif
6. Tester avec des utilisateurs réels

## Appel à l'action
Développer l'interface de découverte des templates avec un design attractif et une navigation intuitive.

---

# Prompt EU-02 - Créer un nouveau projet

## Description
En tant qu'utilisateur, je veux sélectionner une template, donner un nom à mon projet et démarrer immédiatement le questionnaire.

## Contexte
- **Traçabilité Métier** : BM-01, BM-02, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## User Story
En tant qu'utilisateur, je veux créer un nouveau projet en 3 clics pour commencer ma préparation.

## Bénéfice
Démarrage rapide et sans friction, réduction de la charge cognitive.

## Critères d'acceptation
- Un formulaire modal de création s'ouvre avec champs "Nom du projet" et "Template"
- Après validation, je suis redirigé vers le questionnaire de la phase 1
- Le projet apparaît dans ma liste

## Dépendances
- EU-01
- EF-SYS-010 à EF-SYS-015

## Instructions de mise en œuvre
1. Créer un formulaire modal de création de projet
2. Implémenter la validation du nom du projet
3. Créer l'infrastructure de stockage du projet
4. Initialiser la structure de phases et questions
5. Rediriger vers la première phase automatiquement
6. Ajouter le nouveau projet à la liste des projets visibles
7. Enregistrer l'action dans l'historique

## Appel à l'action
Implémenter le flux complet de création de projet en assurant que les utilisateurs peuvent créer un nouveau projet en moins de 3 actions.

---

# Prompt EU-03 - Reprendre un projet existant

## Description
En tant qu'utilisateur, je veux voir mes projets en cours avec leur progression actuelle et reprendre facilement à la dernière phase active.

## Contexte
- **Traçabilité Métier** : BM-01, BM-04, BM-05
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## User Story
En tant qu'utilisateur, je veux voir tous mes projets avec leur statut pour continuer le travail.

## Bénéfice
Facilité de reprise, continuité du travail sans perte d'information.

## Critères d'acceptation
- La page d'accueil affiche tous mes projets avec leur progression
- Je peux cliquer sur un projet pour le reprendre à la dernière phase
- Toutes mes réponses précédentes sont restaurées

## Dépendances
- EU-01
- EF-SYS-011 à EF-SYS-015

## Instructions de mise en œuvre
1. Créer un composant ProjectList pour afficher les projets
2. Charger tous les projets de l'utilisateur
3. Afficher la progression pour chaque projet
4. Implémenter le clic pour reprendre un projet
5. Restaurer l'état exact du projet (réponses, phase active)
6. Afficher l'heure de dernière modification
7. Ajouter des options de tri et filtrage

## Appel à l'action
Développer l'interface de liste des projets avec reprise transparente et restauration complète de l'état.

---

# Prompt EU-04 - Répondre aux questions du questionnaire

## Description
En tant qu'utilisateur, je veux répondre facilement aux questions du questionnaire, avec aide contextuelle et validations, en naviguant facilement entre les questions.

## Contexte
- **Traçabilité Métier** : BM-01, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne-Élevée (10-12 heures)

## User Story
En tant qu'utilisateur, je veux remplir un questionnaire progressif avec navigation intuitive.

## Bénéfice
Expérience progressive et non-stressante, aide en contexte pour mieux répondre.

## Critères d'acceptation
- Les questions s'affichent une à une avec progression visuelle
- Chaque type de question a un champ adapté (text, date, select, etc.)
- Mes réponses sont sauvegardées automatiquement
- Je peux naviguer vers/arrière entre les questions
- Une aide contextuelle est disponible pour chaque question

## Dépendances
- EU-02 ou EU-03
- EF-SYS-030 à EF-SYS-035

## Instructions de mise en œuvre
1. Créer un composant QuestionnaireForm pour afficher une question
2. Implémenter les 10 types de questions avec les champs appropriés
3. Ajouter la sauvegarde automatique des réponses
4. Créer les boutons Précédent/Suivant
5. Ajouter l'aide contextuelle pour chaque question
6. Afficher la progression (X/Y)
7. Tester avec tous les types de questions

## Appel à l'action
Implémenter l'interface de questionnaire avec tous les types de questions et une expérience utilisateur fluide.

---

# Prompt EU-05 - Générer des documents avec l'IA

## Description
En tant qu'utilisateur, je veux cliquer sur un bouton pour générer automatiquement les documents finaux basés sur mes réponses, avec retour temps réel de la génération.

## Contexte
- **Traçabilité Métier** : BM-03, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Élevée (14-18 heures)

## User Story
En tant qu'utilisateur, je veux générer mon cahier des charges avec un simple clic.

## Bénéfice
Gain de temps considérable (plusieurs heures épargnées), documents professionnels garantis.

## Critères d'acceptation
- Un bouton "Générer" est présent sur la dernière phase
- Je vois un prompt preview que je peux modifier
- Le processus de génération s'affiche avec streaming en temps réel
- Les fichiers générés apparaissent dans le panneau à droite
- Je peux télécharger chaque fichier individuellement

## Dépendances
- EU-04 (questionnaire complété)
- EF-SYS-040 à EF-SYS-045

## Instructions de mise en œuvre
1. Créer un composant GenerationPanel pour afficher l'interface de génération
2. Implémenter la génération du prompt à partir des réponses
3. Créer un générateur de preview modifiable
4. Mettre en place l'intégration Claude Code CLI
5. Implémenter le streaming temps réel avec SSE
6. Créer la sauvegarde automatique des fichiers générés
7. Afficher la liste des fichiers générés
8. Tester la qualité des documents générés

## Appel à l'action
Implémenter le système complet de génération IA avec streaming temps réel et téléchargement des fichiers générés.

---

# Prompt EU-06 - Consulter l'historique du projet

## Description
En tant qu'utilisateur, je veux voir une timeline visuelle de toutes les actions effectuées sur le projet pour comprendre son évolution.

## Contexte
- **Traçabilité Métier** : BM-05, BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne (8-10 heures)

## User Story
En tant qu'utilisateur, je veux voir l'historique de mon projet pour retracer ce qui a été fait.

## Bénéfice
Traçabilité complète, compréhension du parcours du projet, récupération de l'état précédent si besoin.

## Critères d'acceptation
- Un onglet "Historique" affiche une timeline visuelle
- Chaque entrée montre la date, l'action, la description et les détails
- Je peux filtrer l'historique par type d'action
- La timeline est ordonnée chronologiquement (plus récent en premier)

## Dépendances
- EU-02 ou EU-03
- EF-SYS-050 à EF-SYS-053

## Instructions de mise en œuvre
1. Créer un composant ProjectHistory pour afficher la timeline
2. Charger l'historique depuis le fichier history.json
3. Afficher les entrées avec icônes et timestamps
4. Implémenter le filtrage par type d'action
5. Ajouter la possibilité de voir les détails d'une action
6. Rendre la timeline visuellement attrayante
7. Tester avec un historique complet

## Appel à l'action
Développer l'interface d'historique du projet avec une timeline visuelle complète et fonctionnalités de filtrage.

---

# Prompt EU-07 - Télécharger les documents générés

## Description
En tant qu'utilisateur, je veux télécharger facilement les documents générés ou tous les fichiers en une seule archive.

## Contexte
- **Traçabilité Métier** : BM-03, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse-Moyenne (4-6 heures)

## User Story
En tant qu'utilisateur, je veux récupérer mes documents générés pour les utiliser ailleurs.

## Bénéfice
Portabilité des documents, utilisation dans d'autres outils.

## Critères d'acceptation
- Chaque fichier a un bouton "Télécharger"
- Un bouton "Télécharger tout" crée une archive ZIP
- Les fichiers sont correctement nommés et formatés
- Le téléchargement est rapide (< 5 secondes)

## Dépendances
- EU-05
- EF-SYS-045

## Instructions de mise en œuvre
1. Créer des fonctions de téléchargement pour fichiers individuels
2. Implémenter la création d'archives ZIP
3. Ajouter les boutons de téléchargement dans l'interface
4. Gérer les noms de fichiers appropriés
5. Assurer les performances (< 5 secondes)
6. Tester les téléchargements sur différents navigateurs

## Appel à l'action
Implémenter les fonctionnalités de téléchargement pour les fichiers générés avec support du téléchargement groupé en ZIP.

---

# Prompt EU-08 - Naviguer entre les phases

## Description
En tant qu'utilisateur, je veux voir l'état d'avancement global avec indicateurs visuels et pouvoir sauter entre les phases facilement.

## Contexte
- **Traçabilité Métier** : BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse-Moyenne (5-7 heures)

## User Story
En tant qu'utilisateur, je veux naviguer entre les phases pour voir ma progression.

## Bénéfice
Clarté de la structure, repères visuels, liberté de mouvement.

## Critères d'acceptation
- Une sidebar affiche toutes les phases avec leur statut (completed, in_progress, pending)
- Les icônes/couleurs indiquent le statut visuel
- Je peux cliquer sur une phase pour y sauter
- La phase active est mise en évidence

## Dépendances
- EU-02 ou EU-03
- EF-SYS-020 à EF-SYS-023

## Instructions de mise en œuvre
1. Créer un composant PhaseList pour afficher les phases
2. Implémenter les indicateurs visuels de statut
3. Ajouter la navigation au clic sur une phase
4. Afficher la phase active de manière distinguée
5. Créer les boutons Précédent/Suivant
6. Afficher la progression globale
7. Tester la navigation fluide

## Appel à l'action
Développer l'interface de navigation des phases avec indicateurs visuels clairs et navigation intuitive.

---

## Exigences Système Fonctionnelles (EF-SYS)

# Prompt EF-SYS-001 - Afficher la liste des templates

## Description
Le système doit afficher une grille de toutes les templates disponibles avec leur icône, nom, description courte, nombre de phases et tags.

## Contexte
- **Traçabilité** : EU-01, BM-01, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse (3-4 heures)

## Source de Données
Dossier `structure/` avec sous-dossiers nommés par template

## Format de Sortie
Composant React `TemplateGrid` affichant `TemplateCard` pour chaque template

## Critères d'acceptation
- La liste de toutes les templates est chargée au démarrage
- Chaque template affiche correctement : icône, nom, description, phases_count, tags
- Les templates sont affichées en grille responsive
- Cliquer sur une template affiche ses détails

## Dépendances
Service `templateService.js` pour lire les fichiers

## Instructions de mise en œuvre
1. Créer le service templateService.js pour lire les templates
2. Implémenter le composant TemplateCard
3. Créer le composant TemplateGrid avec responsive design
4. Charger les métadonnées des templates
5. Afficher les icônes, descriptions et tags
6. Ajouter les interactions au clic

## Appel à l'action
Développer le composant d'affichage des templates avec un design attrayant et responsive.

---

# Prompt EF-SYS-002 - Afficher les détails d'une template

## Description
Le système doit afficher une modale avec tous les détails de la template sélectionnée : nom complet, description détaillée, phases, nombre de questions, durée estimée et bouton "Utiliser cette template".

## Contexte
- **Traçabilité** : EU-01, BM-01
- **Priorité** : Must Have
- **Complexité estimée** : Basse-Moyenne (4-5 heures)

## Source de Données
Fichier `_config/config.json` de la template, contenu de `_sujet/sujet.md`

## Format de Sortie
Modale avec titre, description, liste des phases avec durée estimée

## Critères d'acceptation
- Les détails d'une template s'affichent correctement
- La description du fichier `sujet.md` est affichée
- Les phases de `_phases/` sont listées avec leurs métadonnées
- Le bouton "Utiliser" lance le dialogue de création de projet

## Dépendances
EF-SYS-001, Service de lecture de fichiers

## Instructions de mise en œuvre
1. Créer un composant modale pour afficher les détails
2. Charger les métadonnées complètes de la template
3. Afficher la description détaillée
4. Lister les phases avec information
5. Implémenter le bouton "Utiliser cette template"
6. Ajouter la fermeture de modale
7. Rendre le design attrayant

## Appel à l'action
Développer la modale de détails avec tous les éléments nécessaires pour une décision informée.

---

# Prompt EF-SYS-003 - Charger les phases d'une template

## Description
Le système doit charger et indexer toutes les phases d'une template depuis le dossier `_phases/` avec leurs métadonnées (ID, nom, description, type, ordre).

## Contexte
- **Traçabilité** : BM-02, EU-02
- **Priorité** : Must Have
- **Complexité estimée** : Basse (2-3 heures)

## Source de Données
Fichiers `phase.json` dans chaque dossier de phase `_phases/[num]-[nom]/`

## Format de Sortie
Array JSON de phases avec structure définie

## Critères d'acceptation
- Les phases sont chargées dans le bon ordre (par numéro)
- Chaque phase a tous ses attributs (id, name, description, type, order, icon)
- Les phases marquées required=true ne peuvent pas être skippées
- Aucune phase n'est dupliquée

## Dépendances
Service de lecture des fichiers JSON

## Instructions de mise en œuvre
1. Créer un service pour lire les fichiers de phases
2. Parser les métadonnées de phase.json
3. Trier les phases par numéro
4. Valider la structure des données
5. Mettre en cache les phases chargées
6. Gérer les erreurs de lecture

## Appel à l'action
Implémenter le service de chargement des phases avec validation et tri appropriés.

---

# Prompt EF-SYS-010 - Créer un nouveau projet

## Description
Le système doit créer un nouveau projet avec un ID unique, enregistrer ses métadonnées (nom, template, dates), initialiser la structure de dossiers et les fichiers de suivi.

## Contexte
- **Traçabilité** : EU-02, BM-01, BM-02, BM-05
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Source de Données
Formulaire de création avec champs: nom du projet, sélection de template

## Format de Sortie
Structure JSON `project.json` dans `projects/[id-projet]/`

## Critères d'acceptation
- Un projet avec un ID unique est créé
- Les fichiers `project.json` et `history.json` existent et sont valides
- Le dossier `_phases/` est initialisé avec les phases de la template
- Le statut est "in_progress" et completion à 0%
- Les timestamps created_at et updated_at sont correctement enregistrés

## Dépendances
Service `projectService.js`, EF-SYS-003

## Instructions de mise en œuvre
1. Générer un ID unique pour le projet
2. Créer la structure de dossiers du projet
3. Initialiser le fichier project.json
4. Créer le fichier history.json vide
5. Copier les phases de la template
6. Enregistrer les timestamps
7. Valider la structure créée

## Appel à l'action
Implémenter le service complet de création de projet avec initialisation de toute la structure nécessaire.

---

# Prompt EF-SYS-011 - Afficher la liste des projets

## Description
Le système doit afficher la liste de tous les projets de l'utilisateur avec leur progression, statut, dernière modification et template utilisée.

## Contexte
- **Traçabilité** : EU-03, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse-Moyenne (4-6 heures)

## Source de Données
Dossier `projects/` avec tous les répertoires de projets

## Format de Sortie
Composant React `ProjectList` affichant des `ProjectCard`

## Critères d'acceptation
- Tous les projets sont listés sur la page d'accueil
- Chaque projet affiche: nom, template, pourcentage completion, phase actuelle
- Les projets sont triables par date modifiée ou progression
- Les projets avec statut "completed" sont identifiés visuellement

## Dépendances
Service de lecture des projets

## Instructions de mise en œuvre
1. Créer le composant ProjectCard
2. Créer le composant ProjectList
3. Lister tous les projets du dossier projects/
4. Afficher les métadonnées de chaque projet
5. Implémenter le tri par date ou progression
6. Ajouter des visuels pour les projets complétés
7. Rendre responsive

## Appel à l'action
Développer l'interface de liste des projets avec fonctionnalités de tri et affichage du statut.

---

# Prompt EF-SYS-012 - Afficher les détails d'un projet

## Description
Le système doit afficher la page de projet avec la structure 3 colonnes : phases à gauche, contenu principal au centre, résumé à droite.

## Contexte
- **Traçabilité** : EU-03, EU-08, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (8-10 heures)

## Source de Données
Fichier `project.json` du projet, fichiers `_phases/*/status.json`

## Format de Sortie
Page layout avec Sidebar (phases), MainContent (questionnaire/génération), Summary (résumé et dernières réponses)

## Critères d'acceptation
- La page projet charge sans erreur
- Les 3 colonnes sont présentes et responsive
- Le statut global et progression sont affichés correctement
- Les réponses récentes sont visibles dans le résumé

## Dépendances
EF-SYS-010, EF-SYS-020, EF-SYS-030

## Instructions de mise en œuvre
1. Créer le layout 3 colonnes
2. Charger les données du projet
3. Afficher les phases dans la sidebar
4. Afficher le questionnaire au centre
5. Afficher le résumé à droite
6. Rendre responsive (empilé sur mobile)
7. Tester le layout complet

## Appel à l'action
Développer la page projet avec un layout 3 colonnes responsif et tous les éléments nécessaires.

---

# Prompt EF-SYS-013 - Mettre à jour un projet

## Description
Le système doit permettre la mise à jour du nom et du statut d'un projet, avec enregistrement des modifications dans l'historique.

## Contexte
- **Traçabilité** : EU-03, BM-05
- **Priorité** : Should Have
- **Complexité estimée** : Basse-Moyenne (4-5 heures)

## Source de Données
Modifications de `project.json`

## Format de Sortie
Fichier `project.json` mis à jour, entrée d'historique créée

## Critères d'acceptation
- Le nom du projet peut être modifié et la modification persiste
- Le statut peut passer de "in_progress" à "completed"
- Le timestamp updated_at est mis à jour
- Une entrée d'historique est créée pour la modification

## Dépendances
EF-SYS-010, EF-SYS-050

## Instructions de mise en œuvre
1. Créer les champs éditables pour le nom du projet
2. Implémenter la sauvegarde du nouveau nom
3. Ajouter l'option de marquer comme terminé
4. Mettre à jour updated_at
5. Créer une entrée d'historique
6. Valider les données avant sauvegarde

## Appel à l'action
Implémenter les fonctionnalités de modification de projet avec historique.

---

# Prompt EF-SYS-014 - Supprimer un projet

## Description
Le système doit permettre la suppression d'un projet avec confirmation de l'utilisateur.

## Contexte
- **Traçabilité** : EU-03
- **Priorité** : Could Have
- **Complexité estimée** : Basse (2-3 heures)

## Source de Données
Dossier `projects/[id]/` à supprimer

## Format de Sortie
Dossier supprimé, l'utilisateur redirigé vers la liste des projets

## Critères d'acceptation
- Un message de confirmation s'affiche avant la suppression
- Le dossier du projet est complètement supprimé
- L'utilisateur ne peut plus accéder au projet supprimé
- La liste des projets se met à jour

## Dépendances
EF-SYS-011

## Instructions de mise en œuvre
1. Ajouter un bouton supprimer sur la page projet
2. Afficher une modale de confirmation
3. Implémenter la suppression du dossier
4. Rediriger vers la liste des projets
5. Mettre à jour la liste automatiquement
6. Gérer les erreurs de suppression

## Appel à l'action
Implémenter la fonctionnalité de suppression de projet avec confirmation.

---

# Prompt EF-SYS-015 - Calculer la progression globale

## Description
Le système doit calculer automatiquement le pourcentage de progression du projet basé sur le nombre de phases complétées et le nombre de questions répondues.

## Contexte
- **Traçabilité** : EU-03, EU-08, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse (2-3 heures)

## Formule
(Phases complétées / Phases totales) × 0.5 + (Questions répondues / Questions totales) × 0.5

## Format de Sortie
Pourcentage entier de 0 à 100, mis à jour en temps réel

## Critères d'acceptation
- Le calcul réflète correctement les phases complétées et questions répondues
- La progression se met à jour immédiatement après chaque réponse ou changement de phase
- Le pourcentage est affiché sur la carte projet et la page projet
- Un projet vide commence à 0%, un projet terminé affiche 100%

## Dépendances
EF-SYS-010, EF-SYS-030, EF-SYS-033

## Instructions de mise en œuvre
1. Créer une fonction de calcul de progression
2. Implémenter la formule donnée
3. Mettre à jour en temps réel
4. Afficher le pourcentage partout
5. Tester avec différents scénarios
6. Optimiser les performances

## Appel à l'action
Implémenter le calcul automatique de progression avec mise à jour temps réel.

---

# Prompt EF-SYS-020 - Afficher les phases du projet

## Description
Le système doit afficher une sidebar avec toutes les phases du projet, avec icônes visuelles indiquant leur statut (completed ✅, in_progress 🔵, pending ⚪).

## Contexte
- **Traçabilité** : EU-08, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse-Moyenne (4-5 heures)

## Source de Données
Fichiers `_phases/*/phase.json` et `_phases/*/status.json`

## Format de Sortie
Composant React `PhaseList` avec `PhaseItem` pour chaque phase

## Critères d'acceptation
- Toutes les phases sont listées dans le bon ordre
- Chaque phase affiche correctement son statut avec icône/couleur
- La phase actuelle est mise en évidence
- Cliquer sur une phase navigue vers celle-ci

## Dépendances
EF-SYS-003, EF-SYS-022

## Instructions de mise en œuvre
1. Créer le composant PhaseItem
2. Créer le composant PhaseList
3. Charger les phases et leurs statuts
4. Afficher les icônes de statut
5. Ajouter la navigation au clic
6. Mettre en évidence la phase active
7. Styliser attrayement

## Appel à l'action
Développer la sidebar des phases avec indicateurs visuels clairs et navigation fluide.

---

# Prompt EF-SYS-021 - Charger le statut d'une phase

## Description
Le système doit charger et afficher le statut détaillé d'une phase (completed, in_progress, pending) avec le nombre de questions répondues.

## Contexte
- **Traçabilité** : EU-08, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse (2-3 heures)

## Source de Données
Fichier `_phases/[id]/status.json`

## Format de Sortie
Objet JSON avec fields: phase_id, status, started_at, completed_at, questions_answered, questions_total

## Critères d'acceptation
- Le statut d'une phase se charge correctement
- Le nombre de questions répondues / total est exact
- Les dates de début/fin sont enregistrées correctement
- Une phase sans début n'a pas de started_at

## Dépendances
EF-SYS-003

## Instructions de mise en œuvre
1. Créer une fonction de chargement du statut
2. Parser le fichier status.json
3. Valider les données
4. Compter les questions répondues
5. Formater les dates
6. Mettre en cache si approprié

## Appel à l'action
Implémenter le chargement et la gestion du statut des phases.

---

# Prompt EF-SYS-022 - Mettre à jour le statut d'une phase

## Description
Le système doit mettre à jour le statut d'une phase à "completed" quand toutes les questions sont répondues, avec enregistrement dans l'historique.

## Contexte
- **Traçabilité** : EU-08, EU-04, BM-05
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (5-6 heures)

## Source de Données
Modifications de `_phases/[id]/status.json` et `questions.json`

## Format de Sortie
Fichier `status.json` mis à jour, entrée d'historique créée

## Critères d'acceptation
- Une phase passe automatiquement à "completed" quand les 100% des questions sont répondues
- Le timestamp completed_at est enregistré
- L'historique du projet enregistre ce changement
- La progression globale du projet se met à jour

## Dépendances
EF-SYS-021, EF-SYS-033, EF-SYS-050, EF-SYS-015

## Instructions de mise en œuvre
1. Créer une fonction de mise à jour du statut
2. Vérifier si toutes les questions sont répondues
3. Mettre à jour le statut si nécessaire
4. Enregistrer completed_at
5. Créer une entrée d'historique
6. Mettre à jour la progression globale
7. Émettre des notifications

## Appel à l'action
Implémenter la mise à jour automatique du statut des phases avec historique.

---

# Prompt EF-SYS-023 - Naviguer entre les phases

## Description
Le système doit permettre la navigation entre les phases via la sidebar, boutons Précédent/Suivant, et liens directs dans la liste.

## Contexte
- **Traçabilité** : EU-08, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse-Moyenne (4-5 heures)

## Source de Données
Structure des phases du projet

## Format de Sortie
Navigation dans l'UI, URL mise à jour, contenu de la phase changé

## Critères d'acceptation
- Cliquer sur une phase dans la sidebar la charge instantanément
- Les boutons Précédent/Suivant fonctionnent correctement
- On ne peut pas aller avant la phase 1 ou après la dernière phase
- L'URL de la page change pour refléter la phase actuelle
- Les réponses restent sauvegardées lors de la navigation

## Dépendances
EF-SYS-020, EF-SYS-030

## Instructions de mise en œuvre
1. Implémenter la navigation au clic
2. Créer les boutons Précédent/Suivant
3. Gérer les limites (première/dernière phase)
4. Mettre à jour l'URL
5. Charger le contenu de la phase
6. Conserver les réponses
7. Afficher les transitions fluides

## Appel à l'action
Implémenter la navigation fluide entre les phases avec mise à jour de l'URL.

---

# Prompt EF-SYS-030 - Charger les questions d'une phase

## Description
Le système doit charger toutes les questions d'une phase depuis le fichier `questions.json` avec leurs métadonnées (type, options, help, etc.).

## Contexte
- **Traçabilité** : EU-04, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse (2-3 heures)

## Source de Données
Fichier `_phases/[id]/questions.json`

## Format de Sortie
Array JSON de questions avec structure définie (id, label, type, required, response, etc.)

## Critères d'acceptation
- Toutes les questions sont chargées dans le bon ordre
- Chaque question a ses attributs corrects (label, type, required, options si applicable)
- Les réponses précédentes sont chargées si le projet a été repris
- Les questions requises sont identifiées

## Dépendances
EF-SYS-022

## Instructions de mise en œuvre
1. Créer une fonction de chargement des questions
2. Parser le fichier questions.json
3. Valider la structure de chaque question
4. Charger les réponses précédentes si disponibles
5. Trier les questions correctement
6. Mettre en cache si approprié

## Appel à l'action
Implémenter le chargement complet des questions avec gestion des réponses précédentes.

---

# Prompt EF-SYS-031 - Afficher une question à la fois

## Description
Le système doit afficher une seule question à la fois avec son label, description d'aide, type de champ et barre de progression.

## Contexte
- **Traçabilité** : EU-04, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse-Moyenne (4-5 heures)

## Source de Données
Élément courant de la liste de questions

## Format de Sortie
Composant React `QuestionnaireForm` affichant une `QuestionInput`

## Critères d'acceptation
- Une seule question s'affiche à la fois (pas de scroll vertical long)
- Le label et la description d'aide sont visibles et lisibles
- La progression "Question X/Y" s'affiche correctement
- Les animations de transition entre questions sont fluides
- La question change immédiatement lors de la navigation

## Dépendances
EF-SYS-030

## Instructions de mise en œuvre
1. Créer le composant QuestionnaireForm
2. Afficher une question à la fois
3. Afficher le label et l'aide
4. Afficher la progression
5. Ajouter des animations de transition
6. Gérer la navigation
7. Rendre responsive

## Appel à l'action
Développer l'interface du questionnaire affichant une question à la fois avec animations fluides.

---

# Prompt EF-SYS-032 - Supporter les différents types de questions

## Description
Le système doit supporter 10 types de questions avec champs d'input adaptés : text, textarea, number, date, select, checkbox, radio, boolean, range, file.

## Contexte
- **Traçabilité** : EU-04, BM-02
- **Priorité** : Must Have
- **Complexité estimée** : Élevée (12-15 heures)

## Source de Données
Champ `type` dans les questions

## Format de Sortie
Composant `QuestionInput` générique qui rend le bon composant basé sur le type

## Critères d'acceptation
- Chaque type de question affiche le bon composant d'input
- Les validations appropriées sont appliquées
- Les options pour select/checkbox/radio s'affichent correctement
- Les fichiers peuvent être uploadés pour le type file
- Le range affiche un slider avec min/max values

## Dépendances
EF-SYS-031

## Instructions de mise en œuvre
1. Créer les composants pour chaque type
2. Créer le composant QuestionInput générique
3. Implémenter les validations appropriées
4. Gérer les options pour select/checkbox/radio
5. Implémenter l'upload de fichiers
6. Créer le slider pour range
7. Tester tous les types

## Appel à l'action
Implémenter l'ensemble complet des 10 types de questions avec validations appropriées.

---

# Prompt EF-SYS-033 - Sauvegarder la réponse à une question

## Description
Le système doit sauvegarder automatiquement chaque réponse dans le fichier JSON du projet dès que l'utilisateur la saisit, avec timestamp.

## Contexte
- **Traçabilité** : EU-04, BM-05
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Source de Données
Valeur saisie par l'utilisateur dans le champ d'input

## Format de Sortie
Fichier `_phases/[id]/questions.json` mis à jour, timestamp answered_at enregistré

## Critères d'acceptation
- Une réponse saisie est sauvegardée en moins de 1 seconde
- Le timestamp answered_at est enregistré correctement
- La réponse persiste si on quitte et revient au projet
- Les réponses multiples (checkbox) sont correctement sérialisées
- Aucune réponse n'est jamais perdue

## Dépendances
EF-SYS-030

## Instructions de mise en œuvre
1. Créer une fonction de sauvegarde auto
2. Implémenter le debounce pour éviter les sauvegardes trop fréquentes
3. Enregistrer le timestamp
4. Gérer les types de réponses complexes
5. Implémenter la gestion d'erreurs
6. Afficher des indicateurs de sauvegarde
7. Tester la persistance

## Appel à l'action
Implémenter la sauvegarde automatique fiable des réponses avec gestion d'erreurs robuste.

---

# Prompt EF-SYS-034 - Afficher la progression du questionnaire

## Description
Le système doit afficher une barre de progression montrant le nombre de questions répondues vs. total, avec compteur "N répondues".

## Contexte
- **Traçabilité** : EU-04, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse (2-3 heures)

## Source de Données
Nombre de questions avec response !== null vs. total

## Format de Sortie
Barre Progress React avec pourcentage et texte "Question X / Y (N répondues)"

## Critères d'acceptation
- La barre de progression débute à 0% et finit à 100% quand tous répondus
- Le texte affiche correctement le nombre de questions répondues
- La barre se met à jour en temps réel quand une réponse est saisie
- Le pourcentage affiché est arrondi à l'entier le plus proche

## Dépendances
EF-SYS-033

## Instructions de mise en œuvre
1. Créer le composant ProgressBar
2. Calculer le pourcentage
3. Afficher le texte de progression
4. Mettre à jour en temps réel
5. Ajouter des animations
6. Styliser attrayement
7. Tester avec différents cas

## Appel à l'action
Développer l'affichage de la progression du questionnaire en temps réel.

---

# Prompt EF-SYS-035 - Naviguer entre les questions

## Description
Le système doit permettre la navigation entre les questions via les boutons Précédent/Suivant et un menu "Voir tout".

## Contexte
- **Traçabilité** : EU-04, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse-Moyenne (4-5 heures)

## Source de Données
Index courant dans la liste de questions

## Format de Sortie
Navigation dans le questionnaire, boutons activés/désactivés selon la position

## Critères d'acceptation
- Le bouton Précédent est désactivé à la première question
- Le bouton Suivant est désactivé à la dernière question
- Cliquer Suivant charge la question suivante immédiatement
- Un bouton "Voir toutes les questions" affiche un modal avec la liste complète
- On peut sauter directement à une question en cliquant dessus dans le modal

## Dépendances
EF-SYS-031, EF-SYS-034

## Instructions de mise en œuvre
1. Créer les boutons Précédent/Suivant
2. Gérer l'état désactivé
3. Implémenter les handlers de clic
4. Créer un modal pour voir toutes les questions
5. Ajouter la navigation au clic dans le modal
6. Sauvegarder avant de naviguer
7. Afficher les transitions

## Appel à l'action
Implémenter la navigation flexible entre les questions avec vue d'ensemble.

---

# Prompt EF-SYS-040 - Générer un prompt à partir des réponses

## Description
Le système doit générer automatiquement un prompt intelligent qui compile toutes les réponses du projet dans un contexte structuré pour Claude.

## Contexte
- **Traçabilité** : EU-05, BM-03
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Source de Données
Fichiers `questions.json` et réponses de tous les phases, fichier `_base/instructions.md` de la template

## Format de Sortie
Prompt texte structuré fourni à Claude Code CLI

## Critères d'acceptation
- Le prompt contient toutes les réponses du questionnaire
- Le prompt incluent les instructions de la template depuis `_base/instructions.md`
- Le format du prompt est clair et bien structuré
- Les réponses multi-lignes sont correctement échappées
- L'utilisateur peut modifier le prompt avant de l'envoyer

## Dépendances
EF-SYS-030, EF-SYS-033

## Instructions de mise en œuvre
1. Créer une fonction de génération de prompt
2. Collecter les réponses de toutes les phases
3. Charger les instructions de la template
4. Construire un prompt structuré
5. Créer une interface de preview modifiable
6. Gérer l'échappement des caractères spéciaux
7. Tester avec différents types de réponses

## Appel à l'action
Implémenter la génération intelligent de prompts à partir des réponses du questionnaire.

---

# Prompt EF-SYS-041 - Appeler Claude Code CLI

## Description
Le système doit exécuter la commande Claude Code CLI avec le prompt généré en utilisant `child_process.spawn()` et capturer la sortie.

## Contexte
- **Traçabilité** : EU-05, BM-03
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne-Élevée (10-12 heures)

## Source de Données
Prompt généré (EF-SYS-040)

## Format de Sortie
Stream de réponse de Claude, fichiers créés dans `_outputs/`

## Critères d'acceptation
- La commande `claude` est exécutée avec les bons arguments
- La génération démarre moins de 2 secondes après le clic
- Les fichiers sont créés dans `projects/[id]/_outputs/`
- Les erreurs de Claude sont correctement capturées et affichées
- Le processus ne bloque pas l'interface utilisateur

## Dépendances
EF-SYS-040, Service `claudeService.js`

## Instructions de mise en œuvre
1. Créer un service claudeService.js
2. Implémenter l'exécution via spawn
3. Gérer le streaming de la réponse
4. Capturer les erreurs
5. Créer les fichiers de sortie
6. Gérer les timeouts
7. Tester sur différents systèmes

## Appel à l'action
Implémenter l'intégration robuste avec Claude Code CLI avec gestion d'erreurs complète.

---

# Prompt EF-SYS-042 - Afficher la réponse en streaming

## Description
Le système doit afficher la réponse de Claude en temps réel (streaming) avec mise à jour progressive du texte dans un container dédié.

## Contexte
- **Traçabilité** : EU-05, BM-03, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (8-10 heures)

## Source de Données
Stream stdout de Claude depuis Server-Sent Events (SSE)

## Format de Sortie
Composant React `StreamingResponse` affichant le texte qui se met à jour progressivement

## Critères d'acceptation
- Le texte apparaît au fur et à mesure de la génération (< 100ms de latence)
- Un curseur ou spinner indique que la génération est en cours
- La réponse finale est complète et bien formatée
- Le scroll suit automatiquement le nouveau texte (auto-scroll)
- L'utilisateur peut copier la réponse

## Dépendances
EF-SYS-041, Hook `useClaudeStream`

## Instructions de mise en œuvre
1. Créer le hook useClaudeStream
2. Créer le composant StreamingResponse
3. Implémenter le rendu progressif
4. Ajouter le curseur/spinner
5. Implémenter l'auto-scroll
6. Ajouter le bouton de copie
7. Tester la latence et performance

## Appel à l'action
Développer l'affichage streaming en temps réel avec une UX fluide et réactive.

---

# Prompt EF-SYS-043 - Créer les fichiers générés

## Description
Le système doit enregistrer tous les fichiers générés par Claude dans le dossier `projects/[id]/_outputs/` avec les bons noms et formats.

## Contexte
- **Traçabilité** : EU-05, EU-07, BM-03
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Source de Données
Fichiers créés par Claude Code CLI

## Format de Sortie
Fichiers sauvegardés dans `_outputs/` (markdown, docx, etc.)

## Critères d'acceptation
- Tous les fichiers créés par Claude sont sauvegardés
- Les noms de fichiers sont lisibles et descriptifs
- Les fichiers sont accessibles pour téléchargement
- Les fichiers existants ne sont pas écrasés (versioning si besoin)
- Les permissions de fichier permettent la lecture et suppression

## Dépendances
EF-SYS-041

## Instructions de mise en œuvre
1. Créer le dossier _outputs/ au moment nécessaire
2. Récupérer les fichiers créés par Claude
3. Renommer les fichiers si besoin
4. Implémenter le versioning pour les doublons
5. Gérer les permissions des fichiers
6. Valider que les fichiers sont accessibles
7. Tester avec différents types de fichiers

## Appel à l'action
Implémenter la sauvegarde et l'organisation des fichiers générés avec versioning.

---

# Prompt EF-SYS-044 - Afficher la liste des fichiers générés

## Description
Le système doit afficher une liste de tous les fichiers générés avec leur nom, type, taille et date de création, avec icônes appropriées.

## Contexte
- **Traçabilité** : EU-07, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse-Moyenne (4-6 heures)

## Source de Données
Contenu du dossier `projects/[id]/_outputs/`

## Format de Sortie
Composant React `GeneratedFilesList` affichant `FileItem` pour chaque fichier

## Critères d'acceptation
- Tous les fichiers du dossier `_outputs/` sont listés
- Chaque fichier affiche: icône type, nom, taille, date création
- Les fichiers sont triables par nom ou date
- Les icônes reflètent correctement le type de fichier

## Dépendances
EF-SYS-043

## Instructions de mise en œuvre
1. Créer le composant FileItem
2. Créer le composant GeneratedFilesList
3. Scanner le dossier _outputs/
4. Afficher les métadonnées des fichiers
5. Ajouter les icônes appropriées
6. Implémenter le tri
7. Rendre responsive

## Appel à l'action
Développer l'interface d'affichage des fichiers générés avec tri et visualisation claire.

---

# Prompt EF-SYS-045 - Télécharger les fichiers générés

## Description
Le système doit permettre le téléchargement de fichiers individuels ou tous les fichiers en archive ZIP.

## Contexte
- **Traçabilité** : EU-07, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Source de Données
Fichiers dans `projects/[id]/_outputs/`

## Format de Sortie
Fichier unique ou archive ZIP téléchargée

## Critères d'acceptation
- Chaque fichier a un bouton "Télécharger" qui fonctionne
- Les fichiers téléchargés ont les bons noms et contenus
- Un bouton "Télécharger tout" crée une archive ZIP valide
- Le téléchargement complète en < 5 secondes
- L'utilisateur reçoit une notification de succès

## Dépendances
EF-SYS-044

## Instructions de mise en œuvre
1. Créer les fonctions de téléchargement
2. Implémenter la création d'archives ZIP
3. Ajouter les boutons aux fichiers
4. Gérer les noms de fichiers
5. Implémenter les téléchargements avec streaming
6. Ajouter les notifications
7. Tester sur différents navigateurs

## Appel à l'action
Implémenter les téléchargements fiables de fichiers avec support ZIP groupé.

---

# Prompt EF-SYS-050 - Créer une entrée d'historique

## Description
Le système doit créer automatiquement une entrée d'historique pour chaque action significative (création de projet, réponse à question, complétion de phase, génération IA).

## Contexte
- **Traçabilité** : EU-06, BM-05
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Source de Données
Actions utilisateur capturées par les services

## Format de Sortie
Entrée JSON ajoutée à `projects/[id]/history.json`

## Critères d'acceptation
- Une entrée est créée pour: project_created, question_answered, phase_completed, ai_generation
- Chaque entrée a: id, timestamp, action, icon, details
- Le timestamp est au format ISO 8601
- L'historique est immuable (pas de modification, seulement ajout)
- Les entrées sont dans l'ordre chronologique

## Dépendances
Services divers

## Instructions de mise en œuvre
1. Créer une fonction d'enregistrement d'historique
2. Définir les types d'actions supportées
3. Générer les IDs uniques
4. Enregistrer avec timestamps ISO 8601
5. Ajouter les détails contextuels
6. Assurer l'immuabilité
7. Tester tous les types d'actions

## Appel à l'action
Implémenter le système d'enregistrement d'historique complet et immuable.

---

# Prompt EF-SYS-051 - Afficher la timeline d'un projet

## Description
Le système doit afficher l'historique complet du projet sous forme de timeline visuelle avec les entrées les plus récentes en haut.

## Contexte
- **Traçabilité** : EU-06, BM-04, BM-05
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Source de Données
Fichier `projects/[id]/history.json`

## Format de Sortie
Composant React `ProjectHistory` affichant une timeline verticale avec entrées

## Critères d'acceptation
- La timeline affiche toutes les entrées d'historique
- Les entrées sont ordonnées du plus récent au plus ancien
- Chaque entrée affiche: icône, timestamp, description, détails supplémentaires
- Les couleurs/icônes reflètent le type d'action
- Le timeline est responsive et scrollable

## Dépendances
EF-SYS-050

## Instructions de mise en œuvre
1. Créer le composant TimelineItem
2. Créer le composant ProjectHistory
3. Charger l'historique depuis history.json
4. Afficher les entrées en ordre inverse (plus récent en haut)
5. Ajouter les icônes et couleurs
6. Gérer le scroll
7. Styliser attrayement

## Appel à l'action
Développer la timeline visuelle complète de l'historique du projet.

---

# Prompt EF-SYS-052 - Filtrer l'historique

## Description
Le système doit permettre le filtrage de l'historique par type d'action (toutes, project_created, question_answered, phase_completed, ai_generation).

## Contexte
- **Traçabilité** : EU-06, BM-05
- **Priorité** : Could Have
- **Complexité estimée** : Basse-Moyenne (4-5 heures)

## Source de Données
Champ `action` des entrées d'historique

## Format de Sortie
Timeline filtrée affichant seulement les entrées du type sélectionné

## Critères d'acceptation
- Les boutons de filtre permettent de sélectionner les types d'actions
- Cliquer sur un filtre met à jour la timeline instantanément
- Le filtre "Tous" affiche toutes les entrées
- Les compteurs affichent le nombre d'entrées par type

## Dépendances
EF-SYS-051

## Instructions de mise en œuvre
1. Créer les boutons de filtrage
2. Implémenter la logique de filtrage
3. Afficher les compteurs
4. Mettre à jour la timeline dynamiquement
5. Ajouter les animations
6. Styliser les boutons actifs
7. Tester tous les filtres

## Appel à l'action
Implémenter le filtrage flexible de l'historique avec compteurs visuels.

---

# Prompt EF-SYS-053 - Afficher les détails d'une entrée

## Description
Le système doit afficher les détails complets d'une entrée d'historique quand on clique dessus (réponse saisie, fichiers créés, etc.).

## Contexte
- **Traçabilité** : EU-06, BM-05
- **Priorité** : Could Have
- **Complexité estimée** : Basse-Moyenne (4-5 heures)

## Source de Données
Champ `details` de l'entrée d'historique

## Format de Sortie
Modale ou panneau latéral affichant les détails formatés

## Critères d'acceptation
- Cliquer sur une entrée affiche ses détails
- Les détails incluent toutes les infos pertinentes
- Les détails sont bien formatés et lisibles
- On peut fermer la modale de détails facilement

## Dépendances
EF-SYS-051

## Instructions de mise en œuvre
1. Ajouter les listeners aux entrées
2. Créer une modale de détails
3. Formater les différents types de détails
4. Afficher les réponses, fichiers, etc.
5. Implémenter la fermeture
6. Styliser attrayement
7. Tester avec différents détails

## Appel à l'action
Développer l'affichage détaillé des entrées d'historique.

---

# Prompt EF-SYS-060 - Afficher la page d'accueil

## Description
Le système doit afficher la page d'accueil avec un header, la liste des projets de l'utilisateur et la grille des templates disponibles.

## Contexte
- **Traçabilité** : EU-01, EU-03, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (8-10 heures)

## Source de Données
Liste projets et liste templates

## Format de Sortie
Page React `HomePage` avec layout global

## Critères d'acceptation
- La page d'accueil charge sans erreur
- Le header affiche le logo et titre ProjectForge
- La liste des projets s'affiche sous la section "MES PROJETS"
- La grille des templates s'affiche sous la section "TEMPLATES DISPONIBLES"
- Un bouton "+ Nouveau projet" est visible
- La page est responsive sur mobile, tablet, desktop

## Dépendances
EF-SYS-001, EF-SYS-011

## Instructions de mise en œuvre
1. Créer la structure HTML de la page
2. Implémenter le header avec logo
3. Charger et afficher les projets
4. Charger et afficher les templates
5. Ajouter le bouton "+ Nouveau projet"
6. Rendre responsive
7. Tester sur tous les breakpoints

## Appel à l'action
Développer la page d'accueil professionnelle et accueillante.

---

# Prompt EF-SYS-061 - Afficher la page projet

## Description
Le système doit afficher la page projet avec 3 colonnes: Sidebar des phases (gauche), Contenu principal (centre), Résumé (droite), avec navigation intuitive.

## Contexte
- **Traçabilité** : EU-03, EU-04, EU-08, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Élevée (14-16 heures)

## Source de Données
Métadonnées du projet et contenu actif

## Format de Sortie
Page React `ProjectPage` avec layout 3 colonnes responsive

## Critères d'acceptation
- Les 3 colonnes s'affichent correctement
- Le layout est responsive et se réorganise sur mobile
- La navigation entre les sections est fluide
- Les données se mettent à jour en temps réel
- On peut revenir à la page d'accueil facilement

## Dépendances
EF-SYS-020, EF-SYS-030, EF-SYS-051

## Instructions de mise en œuvre
1. Créer la structure 3 colonnes
2. Implémenter les composants des 3 sections
3. Gérer le responsive (empilé sur mobile)
4. Implémenter la navigation
5. Gérer les mises à jour temps réel
6. Ajouter le bouton retour
7. Tester complètement

## Appel à l'action
Développer la page projet complète avec layout 3 colonnes responsive et tous les éléments.

---

# Prompt EF-SYS-062 - Afficher les notifications

## Description
Le système doit afficher des notifications de succès (réponse sauvegardée, génération terminée) et d'erreur avec un toast ou notification temporaire.

## Contexte
- **Traçabilité** : BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Basse-Moyenne (4-5 heures)

## Source de Données
Actions utilisateur générant des événements

## Format de Sortie
Toast notifications avec Sonner ou React Hot Toast

## Critères d'acceptation
- Une notification apparaît après une sauvegarde réussie
- Les notifications d'erreur affichent un message explicite
- Les toasts disparaissent automatiquement après 3 secondes
- Les notifications sont visibles et non-intrusives
- Plusieurs notifications peuvent s'afficher en stack

## Dépendances
Services divers

## Instructions de mise en œuvre
1. Intégrer une libraire de toast (Sonner, React Hot Toast)
2. Créer des fonctions d'affichage de notifications
3. Ajouter les notifications aux actions clés
4. Implémenter les animations
5. Gérer les durées d'affichage
6. Styliser les toasts
7. Tester les multiples notifications

## Appel à l'action
Implémenter un système de notifications visuelle et non-intrusive.

---

# Prompt EF-SYS-063 - Afficher les messages de validation

## Description
Le système doit afficher des messages de validation/erreur pour les champs requis et les formats invalides.

## Contexte
- **Traçabilité** : EU-04, BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Basse-Moyenne (4-6 heures)

## Source de Données
Validation des inputs utilisateur

## Format de Sortie
Messages d'erreur inline sous les champs ou toast

## Critères d'acceptation
- Une question requise non répondue affiche un message d'alerte
- Un email invalide affiche "Format email invalide"
- Un nombre négatif pour un champ numérique affiche "Veuillez entrer un nombre positif"
- Les messages sont clairs et actionnables

## Dépendances
EF-SYS-032

## Instructions de mise en œuvre
1. Créer des fonctions de validation
2. Implémenter les messages d'erreur
3. Afficher les erreurs inline
4. Ajouter les icônes d'erreur
5. Styliser les messages d'erreur
6. Tester tous les types de validation
7. Afficher les messages en français clair

## Appel à l'action
Implémenter un système complet de validation avec messages d'erreur clairs et utiles.

---

# Prompt EF-SYS-064 - Gérer les erreurs API

## Description
Le système doit gérer gracieusement les erreurs de communication avec l'API backend (timeout, 500, 404) et afficher des messages significatifs.

## Contexte
- **Traçabilité** : BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Source de Données
Erreurs HTTP du backend

## Format de Sortie
Messages d'erreur user-friendly avec options de retry

## Critères d'acceptation
- Une erreur 500 affiche "Une erreur serveur s'est produite, réessayez plus tard"
- Un timeout affiche "Connexion perdue, veuillez vérifier votre réseau"
- Un 404 ne se produit pas (erreur de logique)
- Un bouton "Réessayer" permet de relancer l'action
- Les erreurs sont loggées côté serveur pour debug

## Dépendances
Services API

## Instructions de mise en œuvre
1. Créer des handlers d'erreur globaux
2. Implémenter la gestion par code d'erreur
3. Afficher des messages compréhensibles
4. Ajouter les boutons de retry
5. Implémenter les logs
6. Tester différents codes d'erreur
7. Gérer les timeouts appropriately

## Appel à l'action
Implémenter une gestion d'erreurs robuste et user-friendly avec retry automatique.

---

# Prompt EF-SYS-070 - Stocker les projets en JSON

## Description
Le système doit stocker les métadonnées complètes de chaque projet dans un fichier `project.json` avec structure standardisée.

## Contexte
- **Traçabilité** : BM-02, BM-05
- **Priorité** : Must Have
- **Complexité estimée** : Basse (2-3 heures)

## Source de Données
Données saisies lors de la création et mise à jour d'un projet

## Format de Sortie
Fichier `projects/[id]/project.json` avec structure définie

## Critères d'acceptation
- Le fichier `project.json` est créé avec tous les champs requis
- Les timestamps sont au format ISO 8601
- La structure JSON est valide et schématisée
- Les fichiers peuvent être lus par le backend
- Aucune donnée sensible n'est stockée

## Dépendances
EF-SYS-010

## Instructions de mise en œuvre
1. Définir le schéma du fichier project.json
2. Implémenter la sérialisation des données
3. Valider la structure JSON
4. Implémenter la lecture
5. Gérer les migrations de version
6. Tester avec divers projets
7. Documenter le schéma

## Appel à l'action
Implémenter le stockage JSON standardisé des projets avec validation de schéma.

---

# Prompt EF-SYS-071 - Stocker l'historique en JSON

## Description
Le système doit stocker l'historique complet du projet dans un fichier `history.json` immuable avec entrées chronologiques.

## Contexte
- **Traçabilité** : BM-05
- **Priorité** : Must Have
- **Complexité estimée** : Basse (2-3 heures)

## Source de Données
Entrées d'historique créées par les actions utilisateur

## Format de Sortie
Fichier `projects/[id]/history.json` avec structure définie

## Critères d'acceptation
- Le fichier `history.json` est créé à la création du projet
- Les entrées s'ajoutent sans écraser les précédentes
- Chaque entrée a un ID unique et immuable
- Les timestamps sont corrects et en ordre croissant
- L'historique ne peut pas être modifié après création

## Dépendances
EF-SYS-050

## Instructions de mise en œuvre
1. Définir le schéma du fichier history.json
2. Implémenter l'ajout d'entrées en append-only
3. Générer les IDs uniques
4. Valider les timestamps
5. Implémenter la protection contre les modifications
6. Gérer le versioning si besoin
7. Tester l'immuabilité

## Appel à l'action
Implémenter le stockage immuable de l'historique avec protection intégrée.

---

# Prompt EF-SYS-072 - Stocker les réponses aux questionnaires

## Description
Le système doit stocker les réponses à chaque question dans le fichier `questions.json` de la phase, avec timestamp de réponse.

## Contexte
- **Traçabilité** : BM-02, BM-05
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Source de Données
Réponses saisies par l'utilisateur

## Format de Sortie
Fichiers `_phases/[id]/questions.json` mis à jour avec fields `response` et `answered_at`

## Critères d'acceptation
- Les réponses sont sauvegardées immédiatement et correctement
- Le timestamp `answered_at` est enregistré
- Les réponses complexes (checkbox, fichiers) sont correctement sérialisées
- Les réponses peuvent être relues et modifiées
- Aucune réponse n'est jamais perdue

## Dépendances
EF-SYS-033

## Instructions de mise en œuvre
1. Implémenter la sérialisation des réponses
2. Ajouter les champs response et answered_at
3. Gérer les types complexes
4. Implémenter la persistance fiable
5. Ajouter les validations
6. Gérer les erreurs de sauvegarde
7. Tester avec divers types de réponses

## Appel à l'action
Implémenter le stockage persistent et fiable des réponses aux questionnaires.

---

# Prompt EF-SYS-073 - Stocker les métadonnées des phases

## Description
Le système doit stocker le statut et les métadonnées de chaque phase dans le fichier `status.json` avec dates de début/fin.

## Contexte
- **Traçabilité** : BM-02, BM-05
- **Priorité** : Must Have
- **Complexité estimée** : Basse-Moyenne (4-5 heures)

## Source de Données
Progression de l'utilisateur dans les phases

## Format de Sortie
Fichiers `_phases/[id]/status.json` avec structure définie

## Critères d'acceptation
- Le fichier `status.json` est créé pour chaque phase
- Le statut change correctement: pending → in_progress → completed
- Les timestamps `started_at` et `completed_at` sont enregistrés
- Le nombre de questions répondues est à jour
- Les statuts ne régressent pas

## Dépendances
EF-SYS-022

## Instructions de mise en œuvre
1. Définir le schéma du fichier status.json
2. Implémenter la création au démarrage de la phase
3. Implémenter les transitions d'état
4. Enregistrer les timestamps correctement
5. Compter les questions répondues
6. Valider les transitions d'état
7. Tester les transitions d'état

## Appel à l'action
Implémenter le stockage des métadonnées de phases avec gestion d'état correcte.

---

## Exigences Non-Fonctionnelles (ENF-SYS)

# Prompt ENF-SYS-001 - Temps de chargement des pages

## Description
Les pages doivent être entièrement chargées et interactives en moins de 3 secondes sur une connexion 4G (10 Mbps).

## Contexte
- **Catégorie** : Performance
- **Traçabilité Métier** : BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Métrique
Temps First Contentful Paint (FCP) < 1.5s, Time to Interactive (TTI) < 3s

## Critères d'acceptation
- L'accueil se charge en < 3 secondes (avec projets listés)
- Une page projet se charge en < 2 secondes
- Les transitions entre pages sont fluides (< 200ms)

## Instructions de mise en œuvre
1. Optimiser le bundle Vite avec code splitting
2. Implémenter le lazy loading des composants
3. Optimiser les images et ressources
4. Minimiser le JavaScript initial
5. Implémenter la mise en cache
6. Mesurer avec les DevTools
7. Tester sur connexion 4G simulée

## Appel à l'action
Optimiser les performances des pages pour respecter les critères de temps de chargement.

---

# Prompt ENF-SYS-002 - Réactivité de l'interface

## Description
L'interface doit réagir aux interactions utilisateur en moins de 200 millisecondes.

## Contexte
- **Catégorie** : Performance
- **Traçabilité Métier** : BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Métrique
Input lag < 200ms pour clics et saisies

## Critères d'acceptation
- Cliquer sur un bouton affiche l'effet immédiatement
- Saisir du texte n'a pas de lag
- Les animations sont fluides (60 FPS)
- Le scroll est réactif (avec momentum sur mobile)

## Instructions de mise en œuvre
1. Optimiser React avec useMemo et useCallback
2. Utiliser Framer Motion pour les animations
3. Implémenter le debouncing/throttling si nécessaire
4. Profiler avec React DevTools
5. Tester sur appareil réel
6. Optimiser les re-renders
7. Implémenter la virtualisation si besoin

## Appel à l'action
Optimiser la réactivité de l'interface pour une UX fluide et sans lag.

---

# Prompt ENF-SYS-003 - Streaming en temps réel

## Description
Le streaming de la réponse Claude doit afficher les chunks en temps réel avec latence < 100ms.

## Contexte
- **Catégorie** : Performance
- **Traçabilité Métier** : BM-03, BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Métrique
Latence du streaming < 100ms, pas de "freezing"

## Critères d'acceptation
- Les chunks de la réponse Claude apparaissent au fur et à mesure
- Il n'y a pas de délai perceptible entre la génération et l'affichage
- Le texte s'ajoute fluidement sans saccade
- Le scroll suit la nouvelle ligne automatiquement

## Instructions de mise en œuvre
1. Implémenter Server-Sent Events (SSE)
2. Créer le hook useClaudeStream
3. Optimiser le rendu progressif
4. Implémenter l'auto-scroll
5. Gérer les bufferings
6. Tester la latence avec Chrome DevTools
7. Optimiser pour différentes connexions

## Appel à l'action
Implémenter le streaming temps réel avec latence minimale et rendu fluide.

---

# Prompt ENF-SYS-010 - Pas de données sensibles en JSON

## Description
Les fichiers JSON ne doivent jamais contenir de données sensibles (mots de passe, tokens API, clés privées).

## Contexte
- **Catégorie** : Sécurité
- **Traçabilité Métier** : BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (4-6 heures)

## Principes
Security by design, least privilege

## Critères d'acceptation
- Aucun mot de passe n'est stocké nulle part
- Les fichiers JSON ne contiennent que des données métier
- Les réponses utilisateur ne révèlent pas d'informations sensibles
- Un audit de sécurité confirme l'absence de secrets

## Instructions de mise en œuvre
1. Effectuer un audit complet du code
2. Chercher les mots de passe stockés
3. Valider les données sensibles
4. Implémenter les guards de sécurité
5. Documenter les données sensibles interdites
6. Configurer les linters
7. Effectuer des revues de code

## Appel à l'action
Effectuer un audit de sécurité et implémenter les guardrails pour éviter le stockage de données sensibles.

---

# Prompt ENF-SYS-011 - Pas d'authentification requise

## Description
L'application ne doit pas implémenter d'authentification (au stade initial). Les projets sont basés sur l'ID unique généré.

## Contexte
- **Catégorie** : Sécurité
- **Traçabilité Métier** : BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Basse (0 heures - N/A)

## Principes
Simplicité, pas de gestion d'utilisateurs

## Critères d'acceptation
- Pas de page de login
- Les projets sont accessibles via URL ou ID
- Aucune donnée sensible d'utilisateur n'est demandée

## Instructions de mise en œuvre
1. Concevoir l'architecture sans authentification
2. Utiliser les IDs uniques pour identifier les projets
3. Documenter la sécurité non-authentifiée
4. Planifier la migration future vers l'authentification
5. Implémenter les mécanismes de protection
6. Tester l'accessibilité sans login

## Appel à l'action
Confirmer l'absence d'authentification et documenter les implications de sécurité.

---

# Prompt ENF-SYS-012 - Sécurité de la communication Claude Code

## Description
La communication avec Claude Code CLI doit être sécurisée et exécutée dans un contexte restreint (dossier projet uniquement).

## Contexte
- **Catégorie** : Sécurité
- **Traçabilité Métier** : BM-03
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Principes
Sandboxing, path restriction

## Critères d'acceptation
- Les commandes Claude ne s'exécutent que dans `projects/[id]/_outputs/`
- Aucun accès au système de fichiers en dehors du projet
- Les erreurs d'exécution ne révèlent pas le système
- Les timeouts protègent contre les commandes infinies

## Instructions de mise en œuvre
1. Implémenter la vérification des chemins (path whitelisting)
2. Configurer les sandboxes si disponibles
3. Implémenter les timeouts de commande
4. Gérer les erreurs sans révéler le système
5. Implémenter les logs de sécurité
6. Tester l'isolation
7. Effectuer un audit de sécurité

## Appel à l'action
Implémenter la sécurité d'exécution avec sandboxing et restrictions de chemin.

---

# Prompt ENF-SYS-020 - Gestion de multiples projets

## Description
Le système doit gérer jusqu'à 1000 projets par utilisateur sans dégradation de performance.

## Contexte
- **Catégorie** : Scalabilité
- **Traçabilité Métier** : BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne-Élevée (8-10 heures)

## Métrique
Temps de chargement de la liste < 2 secondes même avec 1000 projets

## Critères d'acceptation
- La liste des projets affiche les plus récents rapidement
- Les recherches/filtres restent rapides
- Le tri par date ou progression fonctionne en < 500ms
- Aucun memory leak avec beaucoup de projets

## Instructions de mise en œuvre
1. Implémenter la pagination ou virtualisation
2. Indexer les fichiers des projets
3. Optimiser les requêtes de lecture
4. Implémenter le caching
5. Tester avec 1000 projets
6. Profiler la mémoire
7. Optimiser les performances

## Appel à l'action
Implémenter la scalabilité pour gérer 1000+ projets sans dégradation de performance.

---

# Prompt ENF-SYS-021 - Gestion des phases et questions

## Description
Le système doit gérer une phase avec jusqu'à 100 questions sans ralentissements.

## Contexte
- **Catégorie** : Scalabilité
- **Traçabilité Métier** : BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Métrique
Navigation entre questions < 100ms même avec 100 questions

## Critères d'acceptation
- Un questionnaire de 100 questions se charge rapidement
- La navigation entre questions est fluide
- Les sauvegarde de réponses sont instantanées
- Le modal "Voir tout" affiche 100 questions sans lag

## Instructions de mise en œuvre
1. Implémenter la virtualisation du questionnaire
2. Utiliser le lazy loading des questions
3. Optimiser le rendu des options
4. Implémenter le caching des questions
5. Tester avec 100 questions
6. Profiler les performances
7. Optimiser les bottlenecks

## Appel à l'action
Implémenter la scalabilité pour gérer 100+ questions sans ralentissement.

---

# Prompt ENF-SYS-022 - Optimisation des fichiers JSON

## Description
Les fichiers JSON doivent être organisés pour permettre des lectures/écritures efficaces même avec de larges historiques.

## Contexte
- **Catégorie** : Scalabilité
- **Traçabilité Métier** : BM-05
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Principes
Séparation des fichiers, indexation appropriée

## Critères d'acceptation
- Un historique avec 1000 entrées reste lisible en < 500ms
- L'ajout d'une nouvelle entrée d'historique prend < 100ms
- Les fichiers JSON restent gérables (pas > 10 MB)
- Aucune corruption de fichier lors de modifications concurrentes

## Instructions de mise en œuvre
1. Optimiser la structure des fichiers JSON
2. Implémenter la séparation des données
3. Ajouter l'indexation appropriée
4. Implémenter le file locking si besoin
5. Tester avec 1000 entrées d'historique
6. Profiler les performances d'I/O
7. Documenter l'architecture

## Appel à l'action
Optimiser l'organisation des fichiers JSON pour la scalabilité et la performance.

---

# Prompt ENF-SYS-030 - Conformité WCAG 2.1 niveau AA

## Description
L'application doit être conforme aux critères WCAG 2.1 niveau AA pour l'accessibilité.

## Contexte
- **Catégorie** : Accessibilité
- **Traçabilité Métier** : BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne-Élevée (8-12 heures)

## Principes
Inclusivité, accès équitable

## Critères d'acceptation
- Audit automatisé (axe, lighthouse) passe avec score > 90
- Navigation au clavier est complète et logique
- Tous les éléments interactifs ont un contraste > 4.5:1
- Les couleurs ne sont pas le seul moyen de transmettre l'info

## Instructions de mise en œuvre
1. Installer axe DevTools et Lighthouse
2. Effectuer les audits d'accessibilité
3. Corriger les contrastes de couleurs
4. Implémenter la navigation au clavier
5. Ajouter les attributs ARIA
6. Tester avec un lecteur d'écran
7. Documenter les conformités

## Appel à l'action
Implémenter la conformité complète WCAG 2.1 AA avec tests automatisés et manuels.

---

# Prompt ENF-SYS-031 - Labels et descriptions accessibles

## Description
Tous les composants interactifs doivent avoir des labels appropriés et des descriptions pour les lecteurs d'écran.

## Contexte
- **Catégorie** : Accessibilité
- **Traçabilité Métier** : BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Principes
Screen reader compatibility

## Critères d'acceptation
- Tous les champs de formulaire ont un <label> associé
- Les boutons ont du texte ou aria-label approprié
- Les icônes ont des descriptions (aria-label ou title)
- Les listes et grilles ont la structure ARIA appropriée
- Un lecteur d'écran peut naviguer complètement dans l'app

## Instructions de mise en œuvre
1. Ajouter les labels HTML5 à tous les formulaires
2. Ajouter aria-label pour les icônes
3. Implémenter les rôles ARIA appropriés
4. Ajouter les descriptions ARIA pour les listes
5. Tester avec un lecteur d'écran (NVDA, JAWS)
6. Corriger les problèmes identifiés
7. Documenter les labels

## Appel à l'action
Implémenter les labels et descriptions accessibles pour tous les éléments interactifs.

---

# Prompt ENF-SYS-032 - Responsive design multi-appareils

## Description
L'application doit être responsive et fonctionnelle sur mobile (320px), tablet (768px) et desktop (1920px).

## Contexte
- **Catégorie** : Accessibilité
- **Traçabilité Métier** : BM-04
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne-Élevée (8-10 heures)

## Breakpoints
Mobile: 320px+, Tablet: 768px+, Desktop: 1024px+, Large: 1920px+

## Critères d'acceptation
- Pas de scrolling horizontal sur mobile
- Les 3 colonnes se réorganisent sur mobile (empilées verticalement)
- Les gestes tactiles fonctionnent (swipe pour naviguer phases)
- Les inputs sont tactiles-friendly (taille > 44px)
- Tous les écrans testés: iPhone 12, iPad, Desktop 1920px

## Instructions de mise en œuvre
1. Implémenter le mobile-first CSS
2. Utiliser TailwindCSS pour la responsivité
3. Tester sur Chrome DevTools (multi-device)
4. Tester sur appareils réels
5. Implémenter les gestes tactiles
6. Augmenter la taille des touches
7. Optimiser pour chaque breakpoint

## Appel à l'action
Implémenter un responsive design robuste et testé sur tous les appareils.

---

# Prompt ENF-SYS-040 - Persistance des données

## Description
Aucune réponse utilisateur ne doit être perdue, même en cas de crash ou fermeture inattendue de l'app.

## Contexte
- **Catégorie** : Fiabilité
- **Traçabilité Métier** : BM-05
- **Priorité** : Must Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Stratégie
Sauvegarde immédiate, vérification d'intégrité

## Critères d'acceptation
- Une réponse saisie est écrite sur le disque avant de valider
- Fermer le navigateur brutalement ne perd aucune réponse
- Un rechargement de page restaure l'état précédent
- Les fichiers JSON sont toujours valides
- En cas d'erreur, un message d'alerte avertit l'utilisateur

## Instructions de mise en œuvre
1. Implémenter la sauvegarde atomique
2. Ajouter les vérifications d'intégrité
3. Implémenter la journalisation
4. Gérer les erreurs de sauvegarde
5. Tester avec crash simulés
6. Implémenter la récupération
7. Documenter la stratégie

## Appel à l'action
Implémenter la persistance fiable des données avec récupération d'erreurs.

---

# Prompt ENF-SYS-041 - Gestion des erreurs

## Description
Les erreurs doivent être gérées gracieusement avec messages clairs et options de recovery.

## Contexte
- **Catégorie** : Fiabilité
- **Traçabilité Métier** : BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Principes
Fail-safe, user-friendly error messages

## Critères d'acceptation
- Aucun crash sans page d'erreur
- Les erreurs affichent des messages compréhensibles
- Un bouton "Réessayer" est toujours disponible
- Les erreurs sont loggées côté serveur
- L'historique ne perd jamais d'entrée

## Instructions de mise en œuvre
1. Implémenter Error Boundary React
2. Ajouter les try-catch généralisés
3. Créer les pages d'erreur custom
4. Implémenter les logs d'erreur
5. Ajouter les retry buttons
6. Tester les scénarios d'erreur
7. Documenter le handling

## Appel à l'action
Implémenter une gestion d'erreurs complète et user-friendly.

---

# Prompt ENF-SYS-042 - Intégrité de l'historique

## Description
L'historique doit être immuable et enregistré immédiatement après chaque action.

## Contexte
- **Catégorie** : Fiabilité
- **Traçabilité Métier** : BM-05
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Principes
Write-once, immutability

## Critères d'acceptation
- Chaque action crée une entrée d'historique immédiatement
- L'historique ne peut pas être modifié ou supprimé
- Les IDs d'entrée sont uniques et permanents
- Même en cas de crash, l'entrée a été enregistrée
- L'ordre chronologique est toujours respecté

## Instructions de mise en œuvre
1. Implémenter l'architecture append-only
2. Générer les IDs uniques (UUID)
3. Enregistrer immédiatement après chaque action
4. Implémenter la protection contre les modifications
5. Tester la persistance en cas de crash
6. Valider l'ordre chronologique
7. Documenter l'immuabilité

## Appel à l'action
Implémenter l'historique immuable avec garanties de persistance.

---

# Prompt ENF-SYS-050 - Structure de code claire

## Description
Le code doit suivre une architecture claire avec services, hooks et composants bien séparés.

## Contexte
- **Catégorie** : Maintenabilité
- **Traçabilité Métier** : BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne-Élevée (8-10 heures)

## Principes
Separation of concerns, SOLID principles

## Critères d'acceptation
- Les services contiennent la logique métier
- Les composants sont focalisés sur la présentation
- Les hooks encapsulent la logique réutilisable
- Les dépendances sont minimes et explicites
- Un nouveau développeur comprend rapidement la structure

## Instructions de mise en œuvre
1. Organiser le code par domaines
2. Séparer les services des composants
3. Créer les custom hooks
4. Implémenter les patterns React
5. Effectuer les revues de code
6. Documenter l'architecture
7. Tester la maintenabilité

## Appel à l'action
Implémenter une architecture claire et maintenable suivant les bonnes pratiques.

---

# Prompt ENF-SYS-051 - Composants réutilisables

## Description
Les composants UI doivent être réutilisables et configurable via props plutôt que dupliqués.

## Contexte
- **Catégorie** : Maintenabilité
- **Traçabilité Métier** : BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne (6-8 heures)

## Principes
DRY (Don't Repeat Yourself), component composition

## Critères d'acceptation
- Pas de duplication de code entre composants similaires
- Les composants acceptent des props pour la customisation
- Les styles peuvent être variés via className ou styles props
- Un bouton/carte/input générique existe et est réutilisé partout

## Instructions de mise en œuvre
1. Identifier les composants dupliqués
2. Créer des composants génériques
3. Implémenter les props de customisation
4. Refactorer les usages
5. Documenter les props
6. Tester la réutilisabilité
7. Mettre à jour le guide de style

## Appel à l'action
Implémenter des composants réutilisables et éliminer la duplication de code.

---

# Prompt ENF-SYS-052 - Services découplés

## Description
Les services backend (project, template, claude) doivent être découplés et testables indépendamment.

## Contexte
- **Catégorie** : Maintenabilité
- **Traçabilité Métier** : BM-04
- **Priorité** : Should Have
- **Complexité estimée** : Moyenne-Élevée (8-10 heures)

## Principes
Dependency injection, testability

## Critères d'acceptation
- Chaque service a une responsabilité unique
- Les services ne dépendent pas l'un de l'autre (ou via injection)
- Les services peuvent être testés sans base de données réelle
- Les erreurs d'un service n'affectent pas les autres
- La modification d'un service ne casse pas les autres

## Instructions de mise en œuvre
1. Refactorer les services pour l'indépendance
2. Implémenter la dependency injection
3. Créer les tests unitaires
4. Implémenter les mocks
5. Tester les services isolément
6. Documenter les interfaces
7. Effectuer les revues

## Appel à l'action
Implémenter les services découplés et testables indépendamment.

---

