# Guide d'Utilisation des Prompts - ProjectForge Platform

**Date** : 17/01/2026
**Version** : 1.0
**Statut** : Documentation complète

---

## 📋 Vue d'ensemble

Ce projet contient **69 fichiers de prompts** conçus pour générer l'implémentation complète du **ProjectForge Platform** en utilisant Claude Code.

### Résumé des fichiers créés :

| Type | Nombre | Dossier |
|------|--------|---------|
| **Prompts individuels** | 69 | `./docs/prompts/` |
| **Document final regroupé** | 1 | `./docs/D-final-prompt.md` |
| **Guide d'utilisation** | 1 | `./docs/D-GUIDE_UTILISATION.md` (ce fichier) |
| **README des prompts** | 1 | `./docs/prompts/README.md` |

---

## 🗂️ Structure des fichiers

### Dossier `./docs/prompts/`

Contient 69 fichiers de prompts organisés par catégories :

#### 1️⃣ Exigences Métier (BM) - 5 fichiers
- `prompt_BM-01.md` → Simplifier la création de projets structurés
- `prompt_BM-02.md` → Garantir la cohérence entre projets similaires
- `prompt_BM-03.md` → Intégrer l'IA pour l'automatisation intelligente
- `prompt_BM-04.md` → Offrir une expérience utilisateur professionnelle
- `prompt_BM-05.md` → Maintenir la traçabilité complète des projets

#### 2️⃣ Exigences Utilisateur (EU) - 8 fichiers
- `prompt_EU-01.md` à `prompt_EU-08.md`
- Couvrent les user stories complètes (découverte, création, navigation, génération, téléchargement)

#### 3️⃣ Exigences Système Fonctionnelles (EF-SYS) - 38 fichiers
- **Section 1** : Gestion des templates (EF-SYS-001 à 003)
- **Section 2** : Gestion des projets (EF-SYS-010 à 015)
- **Section 3** : Gestion des phases (EF-SYS-020 à 023)
- **Section 4** : Gestion des questionnaires (EF-SYS-030 à 035)
- **Section 5** : Intégration Claude Code (EF-SYS-040 à 045)
- **Section 6** : Gestion de l'historique (EF-SYS-050 à 053)
- **Section 7** : Interface utilisateur (EF-SYS-060 à 064)
- **Section 8** : Données et stockage (EF-SYS-070 à 073)

#### 4️⃣ Exigences Non-Fonctionnelles (ENF-SYS) - 18 fichiers
- **Performance** : ENF-SYS-001 à 003
- **Sécurité** : ENF-SYS-010 à 012
- **Scalabilité** : ENF-SYS-020 à 022
- **Accessibilité** : ENF-SYS-030 à 032
- **Fiabilité** : ENF-SYS-040 à 042
- **Maintenabilité** : ENF-SYS-050 à 052

### Fichier `./docs/D-final-prompt.md`

Document unique contenant TOUS les 69 prompts regroupés par catégorie pour une lecture intégrale.

---

## 📚 Contenu d'un prompt

Chaque fichier de prompt suit une structure standardisée :

```markdown
# Prompt [ID] - [Titre]

## Description
[Explication détaillée de l'exigence]

## Contexte
- **Traçabilité** : [Liens métier]
- **Priorité** : [Must Have / Should Have / Could Have]
- **Complexité estimée** : [Niveau et durée]

## Objectif Métier
[Objectif commercial]

## Indicateurs de Succès
- [Métrique 1]
- [Métrique 2]

## Critères d'acceptation
- [Critère 1 testable]
- [Critère 2 testable]
- [...]

## Dépendances Exigences
- [ID-exigence1], [ID-exigence2], ...
- [...]

## Instructions de mise en œuvre
1. [Étape 1]
2. [Étape 2]
3. [...]

## Appel à l'action
[Directive claire pour l'implémentation]
```

---

## 🚀 Comment utiliser les prompts

### Option 1 : Prompts individuels (recommandé pour la modularité)

Chaque prompt peut être utilisé indépendamment dans Claude Code :

```bash
# Dans Claude Code, ouvrir un prompt et l'envoyer
cat ./docs/prompts/prompt_EF-SYS-001.md | pbcopy
# ou copier/coller le contenu dans Claude Code
```

**Avantages** :
- Flexibilité dans l'ordre d'implémentation
- Gestion granulaire des dépendances
- Tests faciles par feature

**Recommandation** :
1. Commencer par les **EF-SYS-001 à 003** (Gestion des templates)
2. Puis **EF-SYS-010 à 015** (Gestion des projets)
3. Puis **EF-SYS-020 à 045** (Phases, questionnaires, Claude Code)
4. Ajouter **EF-SYS-050 à 073** (Historique, UI, données)
5. Implémenter les **ENF-SYS** (Non-fonctionnels, performance, accessibilité)

### Option 2 : Document final complet

Utiliser `./docs/D-final-prompt.md` pour une implémentation exhaustive :

```bash
# Copier l'intégralité du document
cat ./docs/D-final-prompt.md | pbcopy
```

**Avantages** :
- Vue d'ensemble complète
- Implémentation intégrale en une seule session
- Traçabilité complète

**Inconvénient** :
- Très volumineux (~2600 lignes)
- Peut être trop détaillé pour une session courte

---

## 📋 Ordre recommandé d'implémentation

### Phase 1 : Fondations (Semaine 1-2)
1. **EF-SYS-001** - Afficher la liste des templates
2. **EF-SYS-002** - Afficher les détails d'une template
3. **EF-SYS-003** - Charger les phases d'une template
4. **EF-SYS-010** - Créer un nouveau projet
5. **EF-SYS-011** - Afficher la liste des projets
6. **EF-SYS-060** - Afficher la page d'accueil

### Phase 2 : Fonctionnalités principales (Semaine 3-4)
7. **EF-SYS-020** - Afficher les phases du projet
8. **EF-SYS-030** - Charger les questions d'une phase
9. **EF-SYS-031** - Afficher une question à la fois
10. **EF-SYS-032** - Supporter les différents types de questions
11. **EF-SYS-033** - Sauvegarder la réponse à une question
12. **EF-SYS-034** - Afficher la progression du questionnaire

### Phase 3 : Génération IA (Semaine 5)
13. **EF-SYS-040** - Générer un prompt à partir des réponses
14. **EF-SYS-041** - Appeler Claude Code CLI
15. **EF-SYS-042** - Afficher la réponse en streaming
16. **EF-SYS-043** - Créer les fichiers générés
17. **EF-SYS-044** - Afficher la liste des fichiers générés
18. **EF-SYS-045** - Télécharger les fichiers générés

### Phase 4 : Fonctionnalités avancées (Semaine 6)
19. **EF-SYS-050** - Créer une entrée d'historique
20. **EF-SYS-051** - Afficher la timeline d'un projet
21. **EF-SYS-061** - Afficher la page projet (layout 3 colonnes)
22. **EF-SYS-070-073** - Stockage des données

### Phase 5 : Optimisations et qualité (Semaine 7+)
23. **ENF-SYS-001 à 003** - Performance
24. **ENF-SYS-030 à 032** - Accessibilité
25. **ENF-SYS-040 à 052** - Sécurité, fiabilité, maintenabilité

---

## 🔗 Dépendances entre exigences

Les dépendances sont documentées dans chaque prompt. Voici un résumé :

```
BM-01, BM-02 → EU-01, EU-02 → EF-SYS-001, EF-SYS-010, EF-SYS-060
              → EU-03 → EF-SYS-011, EF-SYS-012

EU-04 → EF-SYS-030, EF-SYS-031, EF-SYS-032, EF-SYS-033, EF-SYS-034

EU-05 → EF-SYS-040, EF-SYS-041, EF-SYS-042, EF-SYS-043, EF-SYS-044, EF-SYS-045

BM-05, EU-06 → EF-SYS-050, EF-SYS-051, EF-SYS-052, EF-SYS-053
```

**Respectez ces dépendances** pour éviter les problèmes d'implémentation.

---

## ✅ Critères d'acceptation globaux

Avant de considérer une exigence comme complète :

1. ✓ Code implémenté selon la description
2. ✓ Tous les critères d'acceptation testables sont validés
3. ✓ Les dépendances sont satisfaites
4. ✓ Les tests passent
5. ✓ La complexité estimée a été respectée (±20%)
6. ✓ La documentation a été mise à jour

---

## 📞 Questions fréquentes

### Q: Dois-je utiliser tous les prompts ?
**R**: Oui, les 69 prompts couvrent toutes les exigences du projet. Cependant, vous pouvez hiérarchiser par priorité (Must Have > Should Have > Could Have).

### Q: Dans quel ordre implémenter ?
**R**: Suivez l'ordre recommandé par phase ci-dessus. Respectez les dépendances.

### Q: Puis-je modifier les prompts ?
**R**: Oui, adaptez-les à votre contexte technique. Les critères d'acceptation doivent rester inchangés.

### Q: Où trouver la matrice de traçabilité ?
**R**: Dans le fichier `C-Exigences_Fonctionnelles_Structurees.md`, section "Matrice de Traçabilité".

### Q: Comment suivre la progression ?
**R**: Utilisez `./docs/Suivi_Projet_INTIA.md` ou un système de tracking (Jira, GitHub Projects, etc.).

---

## 📞 Support

- **Exigences métier** : Consultez `C-Exigences_Fonctionnelles_Structurees.md`
- **Qualité des exigences** : Consultez `B-Redaction_et_Qualite_des_Exigences_Fonctionnelles.md`
- **Contexte projet** : Consultez `A-prompt.md`

---

## 🎯 Résumé

| Aspect | Détail |
|--------|--------|
| **Total prompts** | 69 |
| **Emplacement** | `./docs/prompts/` |
| **Document final** | `./docs/D-final-prompt.md` |
| **Priorité Must Have** | 52 exigences |
| **Priorité Should Have** | 32 exigences |
| **Priorité Could Have** | 24 exigences |
| **Durée estimée** | 6-8 semaines |
| **Approche recommandée** | EPCT (Explore, Plan, Code, Test) |

---

**Généré avec** : Claude Code
**Date** : 17/01/2026

Bonne implémentation ! 🚀
