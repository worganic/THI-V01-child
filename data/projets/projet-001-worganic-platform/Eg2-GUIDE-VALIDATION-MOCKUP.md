# ✅ Guide de Validation - Mockup ProjectForge

**Date** : 17/01/2026
**Document** : Guide complet pour valider le mockup
**Responsable** : Équipe Produit + Stakeholders
**Durée estimée** : 2-3 jours

---

## 🎯 Objectif de ce Document

Ce guide fournit une **structure complète de validation** du mockup de ProjectForge Platform. Il couvre :
- Qui doit valider quoi et quand
- Comment explorer le mockup
- Questions clés à poser
- Points de vérification
- Process d'approbation

---

## 👥 Rôles et Responsabilités

### **Product Manager**
**Responsabilité** : Valider que le mockup répond aux besoins métier
**Timeline** : 4-6 heures
**Tâches** :
- [ ] Vérifier que toutes les fonctionnalités clés sont présentes
- [ ] Valider le flux utilisateur complet
- [ ] Confirmer les données affichées sont appropriées
- [ ] Documenter les modifications demandées

### **UX/UI Designer**
**Responsabilité** : Valider la structure UI et la logique visuelle
**Timeline** : 6-8 heures
**Tâches** :
- [ ] Évaluer la hiérarchie visuelle
- [ ] Vérifier la cohérence des éléments
- [ ] Proposer des améliorations visuelles
- [ ] Créer des notes de design pour les développeurs

### **Tech Lead / Architect**
**Responsabilité** : Valider la faisabilité technique
**Timeline** : 4-6 heures
**Tâches** :
- [ ] Vérifier que toutes les pages sont mockées
- [ ] Identifier les points techniques complexes
- [ ] Valider les flux de données
- [ ] Estimer la complexité d'implémentation

### **Stakeholders / Clients**
**Responsabilité** : Valider que le mockup correspond à leur vision
**Timeline** : 2-4 heures
**Tâches** :
- [ ] Explorer le mockup (accueil à historique)
- [ ] Donner un avis global sur la structure
- [ ] Proposer des changements critiques
- [ ] Approuver le mockup ou demander des modifications

---

## 🚀 Process de Validation

### **Jour 1 : Exploration Individuelle** (2-3 heures)

Chacun explore le mockup indépendamment, prend des notes.

#### **Pour chaque page du mockup**
1. Ouvrir F0-mockup-complet.html dans un navigateur
2. Cliquer sur l'onglet correspondant
3. Explorez lentement chaque élément
4. Notez les questions ou remarques
5. Passez à la page suivante

#### **Éléments à examiner sur chaque page**
- [ ] **Header / Navigation** : Logo, menu utilisateur, boutons
- [ ] **Contenus principales** : Grille, formulaires, listes
- [ ] **Sidebar / Panneaux** : Filtres, navigation, info
- [ ] **Boutons d'action** : Voir, créer, continuer, etc.
- [ ] **Formulaires** : Tous les champs attendus ?
- [ ] **Données simulées** : Réalistes et complètes ?
- [ ] **Messages** : Erreurs, info, confirmation ?

#### **Questions à poser pour chaque élément**
1. **Est-ce que cet élément a du sens ici ?**
2. **Est-ce que c'est clair pour l'utilisateur final ?**
3. **Manque-t-il quelque chose ?**
4. **Cet élément peut-il être amélioré ?**
5. **Comment cela impacte le flux utilisateur ?**

---

### **Jour 2 : Validation Thématique** (6-8 heures)

L'équipe se réunit par thème pour discuter en détail.

#### **Session 1 : Flux Utilisateur Global** (2 heures)
**Participants** : Product, Designer, Tech Lead, 1 Stakeholder

**Agenda** :
1. Revisite accueil → templates → création → projet (30 min)
2. Discuss : le flux est-il naturel ? (30 min)
3. Identify : points bloquants ou confus (30 min)
4. Document : modifications clés (30 min)

**Questions clés** :
- Le parcours utilisateur de 15 minutes est-il crédible ?
- Y a-t-il trop/pas assez de clics ?
- Les informations apparaissent-elles au bon moment ?
- Peut-on sauter des étapes si nécessaire ?

---

#### **Session 2 : Questionnaire et Formulaires** (2 heures)
**Participants** : Product, Designer, Tech Lead

**Agenda** :
1. Explorer page questionnaire (30 min)
2. Valider champs de formulaire (30 min)
3. Discuss : progression et sauvegarde (30 min)
4. Document : champs à ajouter/retirer (30 min)

**Questions clés** :
- Tous les champs du formulaire de création sont-ils là ?
- Questions affichées une à une = ok ?
- Barre de progression suffisamment visible ?
- Aide contextuelle utile ?
- Comment gérer les réponses longues ?

---

#### **Session 3 : Génération et Fichiers** (2 heures)
**Participants** : Product, Tech Lead, Designer

**Agenda** :
1. Explorer page génération (30 min)
2. Discuss : aperçu du prompt, paramètres (30 min)
3. Valider : format et liste fichiers (30 min)
4. Document : formats supportés, taille (30 min)

**Questions clés** :
- Aperçu du prompt OK pour l'utilisateur ?
- Paramètres de génération (format, détail) importants ?
- Quels formats de fichiers sont requis ?
- Télécharger tout en ZIP = bon ?
- Taille des fichiers acceptable ?

---

#### **Session 4 : Historique et Navigation** (2 heures)
**Participants** : Tech Lead, Product, Designer

**Agenda** :
1. Explorer page historique (30 min)
2. Valider : timeline et filtres (30 min)
3. Discuss : données tracées suffisantes ? (30 min)
4. Document : événements à tracker (30 min)

**Questions clés** :
- Timeline claire et facile à lire ?
- Filtres couvrent tous les cas ?
- Détails historique suffisants ?
- Comment naviguer pour utilisateur revenant ?
- Besoin d'export historique ?

---

### **Jour 3 : Approbation et Décisions** (4-6 heures)

#### **Session 1 : Synthèse des Retours** (2 heures)
**Participants** : Product, Designer, Tech Lead

**Agenda** :
1. Lister toutes les modifications proposées (30 min)
2. Catégoriser : critique vs nice-to-have (30 min)
3. Évaluer : impact sur développement (30 min)
4. Décider : quoi inclure v1 (30 min)

#### **Session 2 : Présentation Client** (2 heures)
**Participants** : Product, Designer, 1 Tech Lead, Stakeholders

**Agenda** :
1. Démo du mockup (30 min)
2. Feedback clients (30 min)
3. Discussion modifications (30 min)
4. Approbation ou demande ajustements (30 min)

#### **Session 3 : Sign-off Interne** (2 heures)
**Participants** : Product, Tech Lead, Designer

**Agenda** :
1. Déterminer changements finaux (30 min)
2. Créer doc de sign-off (30 min)
3. Planifier modifications au mockup (30 min)
4. Valider readiness pour dev (30 min)

---

## 📋 Checklist de Validation Détaillée

### **PAGE 1 : ACCUEIL**

#### Projets en Cours
- [ ] Affiche "Mes Projets en Cours" avec titre
- [ ] Montre 3 projets exemplaires
- [ ] Chaque carte affiche :
  - [ ] Nom du projet
  - [ ] Template utilisée
  - [ ] Métadonnées (créé, phase, statut)
  - [ ] Barre de progression avec %
  - [ ] Bouton "Continuer" (primary)
  - [ ] Bouton "Détails"
- [ ] Peut scroller si plus de 3 projets

#### Templates Disponibles
- [ ] Affiche "Templates Disponibles" avec titre
- [ ] Montre 4 templates en grille
- [ ] Chaque carte template affiche :
  - [ ] Image placeholder
  - [ ] Nom de template
  - [ ] Description courte
  - [ ] Métadonnées (durée, phases)
  - [ ] Tags avec couleur
  - [ ] Bouton "Voir détails"
- [ ] Responsive : grille adaptée au écran

#### Header
- [ ] Logo "🚀 ProjectForge" visible
- [ ] Menu utilisateur dans coin
- [ ] Cohérent avec design général

---

### **PAGE 2 : DÉTAILS TEMPLATE**

- [ ] Titre "Cahier des Charges - Détails"
- [ ] Bouton retour vers accueil
- [ ] **Panneau description** :
  - [ ] Texte description claire
  - [ ] Listes à puces des features
- [ ] **Panneau métadonnées** :
  - [ ] Durée estimée
  - [ ] Nombre de phases
  - [ ] Nombre de questions
  - [ ] Public cible
  - [ ] Popularité/évaluations
- [ ] **Section phases** :
  - [ ] Toutes phases listées
  - [ ] Description pour chaque
  - [ ] Nombre questions / phase
- [ ] **Tags** affichés
- [ ] **Bouton action** "Utiliser cette Template"

---

### **PAGE 3 : CRÉATION PROJET**

- [ ] Formulaire centré (modal look)
- [ ] Titre "Créer un nouveau projet"
- [ ] Champ **Template selection** (required) :
  - [ ] Dropdown avec liste templates
  - [ ] Placeholder "--Choisir une template--"
  - [ ] Exemple pré-sélectionné
- [ ] Champ **Nom Projet** (required) :
  - [ ] Input text
  - [ ] Placeholder descriptif
- [ ] Champ **Description** (optional) :
  - [ ] Textarea
  - [ ] Label indique optional
- [ ] Message informatif bleu
- [ ] Bouton **"Créer le Projet"** (primary)
- [ ] Validation visuelle (si besoin)

---

### **PAGE 4 : PAGE PROJET (3 COLONNES)**

#### Sidebar Phases
- [ ] Titre "📊 Phases du Projet"
- [ ] Liste 3 phases avec :
  - [ ] Icône statut (✅ 🔵 ⚪)
  - [ ] Nom phase
  - [ ] Progression (X/Y)
  - [ ] Cliquable
  - [ ] Active phase surbrillancée
- [ ] Section actions avec :
  - [ ] Bouton "Voir Progression"
  - [ ] Bouton "Historique"

#### Contenu Principal
- [ ] Titre phase actuelle "Phase 2 - Périmètre"
- [ ] **Barre progression** :
  - [ ] Texte "Question 6 / 12"
  - [ ] Barre visuelle avec %
- [ ] **Affichage question** :
  - [ ] Label claire
  - [ ] Aide contextuelle (box bleue)
  - [ ] TextArea pour réponse
  - [ ] Placeholder de saisie
- [ ] **Boutons navigation** :
  - [ ] Précédent
  - [ ] Suivant (primary)
  - [ ] Voir tout
- [ ] Message "Réponse sauvegardée automatiquement"

#### Panel Droit - Résumé
- [ ] Titre "📋 Résumé du Projet"
- [ ] **Infos projet** :
  - [ ] Nom
  - [ ] Template
  - [ ] Date création
  - [ ] Progression global
- [ ] **Dernières réponses** :
  - [ ] Q1, Q2, Q3 affichées
  - [ ] Format compact
  - [ ] Lisible
- [ ] Bouton "Éditer Réponses"

#### Layout
- [ ] Grid 3 colonnes responsive
- [ ] Sur mobile : empile vertically
- [ ] Sidebar phases visible
- [ ] Proportions correctes

---

### **PAGE 5 : QUESTIONNAIRE**

- [ ] Titre "Répondre au Questionnaire - Phase 2"
- [ ] **Barre progression** :
  - [ ] "5 / 12 questions répondues"
  - [ ] Barre visuelle %
- [ ] **Question affichée** :
  - [ ] Numéro "Question 6 / 12"
  - [ ] Label clair
  - [ ] Aide contextuelle (box bleue)
  - [ ] TextArea
  - [ ] Lien "Voir les exemples"
- [ ] **Navigation buttons** :
  - [ ] Précédent
  - [ ] Suivant (primary)
  - [ ] Voir tout (12)
- [ ] **Navigation rapide** :
  - [ ] Grille 4 colonnes
  - [ ] Numéros 1-12
  - [ ] Questions répondues = bleu + check
  - [ ] Question actuelle = highlight
  - [ ] Cliquable

---

### **PAGE 6 : GÉNÉRATION IA**

- [ ] Titre "Générer les Documents avec l'IA"
- [ ] **Aperçu Prompt** :
  - [ ] TextArea avec prompt complet
  - [ ] Contenu réaliste simulé
  - [ ] Modifiable par utilisateur
- [ ] **Boutons action** :
  - [ ] "Lancer la génération" (primary)
  - [ ] "Copier le prompt"
- [ ] **Paramètres** :
  - [ ] Select "Format de sortie"
  - [ ] Select "Niveau de détail"
  - [ ] Options pertinentes
- [ ] **Zone streaming** :
  - [ ] Bordure bleue distinctive
  - [ ] Contenu simulé du document
  - [ ] Curseur clignotant
  - [ ] Initialement caché, visible au clic
- [ ] **Fichiers générés** :
  - [ ] Titre "Fichiers Générés"
  - [ ] 3 fichiers exemplaires
  - [ ] Chaque fichier avec :
    - [ ] Icône type
    - [ ] Nom et format
    - [ ] Taille
    - [ ] Date génération
    - [ ] Bouton "⬇️ Télécharger"
  - [ ] Bouton "📦 Télécharger tout (ZIP)"

---

### **PAGE 7 : HISTORIQUE**

- [ ] Titre "Historique du Projet"
- [ ] **Filtres** :
  - [ ] Boutons "Tous (8)", "Création (1)", "Questions (5)", etc.
  - [ ] Bouton "Tous" sélectionné par défaut
  - [ ] Filtrage fonctionne visuellement
- [ ] **Timeline** :
  - [ ] 5 entrées minimum affichées
  - [ ] Chaque entrée avec :
    - [ ] Date/heure (JJ/MM/YYYY HH:MM)
    - [ ] Icône action
    - [ ] Titre action
    - [ ] Encadré détails
  - [ ] Ordre chronologique inverse (récent en haut)
  - [ ] Types d'actions variés :
    - [ ] 📦 Génération
    - [ ] ❓ Réponse question
    - [ ] ✅ Phase complétée
    - [ ] 📝 Création projet
- [ ] **Résumé** :
  - [ ] Statistiques globales
  - [ ] Total actions et durée

---

### **PAGE 8 : INFO MOCKUP**

- [ ] Définition d'un mockup claire
- [ ] Liste des 8 pages décrites
- [ ] Points de validation énumérés
- [ ] Instructions d'utilisation
- [ ] Processus de validation décrit
- [ ] Bouton "Marquer Mockup comme Validé"

---

## 🤔 Questions Critiques de Validation

### **Compréhension Générale**
1. [ ] **Le flux global est-il clair ?**
   - Accueil → Template → Création → Projet → Questions → Génération → Historique
   - Score: ☐ 1 ☐ 2 ☐ 3 ☐ 4 ☐ 5

2. [ ] **Y a-t-il une page manquante ?**
   - ☐ Non, complet
   - ☐ Oui : ___________

3. [ ] **Le design est-il cohérent ?**
   - ☐ Oui
   - ☐ Non, problèmes : ___________

### **Fonctionnalités Clés**
4. [ ] **Les projets en cours sont-ils facilement accessibles ?**
   - ☐ Très facile
   - ☐ Facile
   - ☐ Neutre
   - ☐ Difficile
   - ☐ Très difficile

5. [ ] **Le questionnaire progression par progression est-il OK ?**
   - ☐ Oui, parfait
   - ☐ OK avec amélioration : ___________
   - ☐ Non, changer : ___________

6. [ ] **La génération IA est-elle bien expliquée ?**
   - ☐ Oui, très clair
   - ☐ Assez clair
   - ☐ Besoin clarification : ___________

### **Données et Réalisme**
7. [ ] **Les données simulées sont-elles réalistes ?**
   - Projets : ☐ Oui ☐ Non
   - Templates : ☐ Oui ☐ Non
   - Questionnaire : ☐ Oui ☐ Non
   - Fichiers générés : ☐ Oui ☐ Non

8. [ ] **Y a-t-il trop / pas assez d'informations affichées ?**
   - ☐ Trop d'info
   - ☐ Bon équilibre
   - ☐ Pas assez d'info

### **Modifications Clés**
9. [ ] **Quels sont les 3 changements les plus importants ?**
   - 1. ___________
   - 2. ___________
   - 3. ___________

10. [ ] **Quels sont les 3 changements les moins importants ?**
    - 1. ___________
    - 2. ___________
    - 3. ___________

---

## 📝 Formulaire de Rapport de Validation

### **Informations Générales**
- **Nom** : ___________
- **Rôle** : ☐ Product ☐ Designer ☐ Tech ☐ Stakeholder ☐ Autre
- **Date validation** : ___________
- **Temps spent** : ___ heures

### **Validation Globale**
- **Page 1 Accueil** :
  - ☐ OK - aucun changement
  - ☐ OK - modifications mineures
  - ☐ À revoir
  - Notes : ___________

- **Page 2 Détails Template** :
  - ☐ OK - aucun changement
  - ☐ OK - modifications mineures
  - ☐ À revoir
  - Notes : ___________

- **Page 3 Création Projet** :
  - ☐ OK - aucun changement
  - ☐ OK - modifications mineures
  - ☐ À revoir
  - Notes : ___________

- **Page 4 Page Projet (3 col)** :
  - ☐ OK - aucun changement
  - ☐ OK - modifications mineures
  - ☐ À revoir
  - Notes : ___________

- **Page 5 Questionnaire** :
  - ☐ OK - aucun changement
  - ☐ OK - modifications mineures
  - ☐ À revoir
  - Notes : ___________

- **Page 6 Génération** :
  - ☐ OK - aucun changement
  - ☐ OK - modifications mineures
  - ☐ À revoir
  - Notes : ___________

- **Page 7 Historique** :
  - ☐ OK - aucun changement
  - ☐ OK - modifications mineures
  - ☐ À revoir
  - Notes : ___________

### **Validation Finale**
- **Prêt pour développement ?**
  - ☐ Oui, sans changements
  - ☐ Oui, avec modifications mineures
  - ☐ Non, beaucoup de changements
  - ☐ Non, à revoir complètement

- **Score global satisfaction** : ___ / 10

---

## 🎯 Critères d'Approbation

### **Approbation Requise**
- [ ] Product Manager : Valide fonctionnalités
- [ ] Designer : Valide UI/UX
- [ ] Tech Lead : Valide faisabilité
- [ ] 1 Stakeholder : Approuve vision

### **Conditions d'Approbation**
- Aucune modification critique
- Modifications mineures documentées
- Consensus sur flux utilisateur
- Accord sur features incluses v1

### **Conditions de Rejet**
- Éléments critiques manquants
- Flux utilisateur confus
- Données manquantes ou invalides
- Désaccord sur approach

---

## 📅 Timeline Recommandée

| Phase | Durée | Responsable |
|-------|-------|------------|
| Exploration | 1 jour | Tous |
| Validation thématique | 1 jour | Product + Tech + Designer |
| Approbation | 0.5 jour | Product + Lead |
| Modifications | 0.5-1 jour | Designer + Tech |
| Sign-off final | 0.5 jour | Product + Lead + Stakeholder |
| **TOTAL** | **2-3 jours** | |

---

## ✅ Document de Sign-Off

Une fois validé, imprimer et signer :

```
PROJECT: ProjectForge Platform
DOCUMENT: Mockup Complet (F0-mockup-complet.html)
DATE: [DATE]

APPROBATION:

Product Manager: _____________ Date: _____
Designer: _____________ Date: _____
Tech Lead: _____________ Date: _____
Stakeholder: _____________ Date: _____

STATUT:
☐ APPROUVÉ - Prêt pour développement
☐ APPROUVÉ AVEC CONDITIONS - Voir notes
☐ À REVOIR - Modifications majeures nécessaires

NOTES:
_________________________________
_________________________________
_________________________________

Ce mockup est approuvé pour servir de référence
à l'équipe de développement pour les 5 phases
d'implémentation planifiées.
```

---

**Guide créé** : 17/01/2026
**Validité** : Pendant le projet
**Prochaine mise à jour** : Après sign-off initial

✅ **Prêt pour la Validation du Mockup !**
