# Cahier des Charges — Application d'apprentissage de l'anglais

**Version :** 1.0  
**Date :** 2026-05-30  
**Stack cible :** Angular 17+ (standalone components), Tailwind CSS  

---

## 1. Objectif du projet

Créer une application web Angular permettant à un utilisateur francophone d'apprendre l'anglais de façon progressive, à travers des leçons structurées par niveaux de difficulté, chacune validée par des exercices interactifs.

---

## 2. Public cible

- Débutants complets (niveau A0) jusqu'aux intermédiaires (niveau B1)
- Utilisateurs francophones souhaitant progresser à leur rythme
- Aucun prérequis en anglais nécessaire pour commencer

---

## 3. Structure des niveaux et leçons

### 3.1 Niveaux (du plus facile au plus difficile)

| Niveau | Libellé | Description |
|--------|---------|-------------|
| A0 | Débutant absolu | Alphabet, chiffres, couleurs, formules de politesse |
| A1 | Élémentaire | Vocabulaire courant, phrases simples, présent simple |
| A2 | Pré-intermédiaire | Temps du passé, futur, descriptions |
| B1 | Intermédiaire | Expressions idiomatiques, conjugaisons complexes, textes courts |

### 3.2 Organisation des leçons

Chaque niveau contient **5 à 10 leçons**. Une leçon ne peut être déverrouillée que si la leçon précédente est **validée** (score ≥ 70 %).

```
Niveau A0
├── Leçon 1 — L'alphabet anglais         ✅ déverrouillée par défaut
├── Leçon 2 — Les chiffres (0–20)        🔒 déverrouillée si leçon 1 validée
├── Leçon 3 — Les couleurs               🔒
├── Leçon 4 — Se présenter              🔒
└── Leçon 5 — Formules de politesse     🔒

Niveau A1
├── Leçon 1 — Les articles (a, an, the)  🔒 déverrouillé si A0 complété
├── Leçon 2 — Les pronoms personnels     🔒
├── Leçon 3 — Le présent simple (to be) 🔒
├── Leçon 4 — Le présent simple (verbes courants) 🔒
├── Leçon 5 — La négation               🔒
├── Leçon 6 — Les questions simples     🔒
├── Leçon 7 — Vocabulaire : la famille  🔒
├── Leçon 8 — Vocabulaire : la maison   🔒
└── Leçon 9 — Vocabulaire : les aliments 🔒

Niveau A2
├── Leçon 1 — Le passé simple (to be)   🔒
├── Leçon 2 — Le passé simple (verbes réguliers) 🔒
├── Leçon 3 — Le passé simple (verbes irréguliers) 🔒
├── Leçon 4 — Le futur (will)           🔒
├── Leçon 5 — Le futur (going to)       🔒
├── Leçon 6 — Les adjectifs comparatifs 🔒
├── Leçon 7 — Les adjectifs superlatifs 🔒
└── Leçon 8 — Décrire des lieux et personnes 🔒

Niveau B1
├── Leçon 1 — Le présent continu        🔒
├── Leçon 2 — Le present perfect        🔒
├── Leçon 3 — Les modaux (can, could, should, must) 🔒
├── Leçon 4 — Les conditionnels (if clauses) 🔒
├── Leçon 5 — Expressions idiomatiques (set 1) 🔒
├── Leçon 6 — Expressions idiomatiques (set 2) 🔒
└── Leçon 7 — Compréhension de texte court 🔒
```

---

## 4. Contenu d'une leçon

### 4.1 Structure d'une leçon

```
[Phase 1 — Cours]       → Présentation théorique (texte + exemples)
[Phase 2 — Pratique]    → Mini-exercices guidés (sans score)
[Phase 3 — Validation]  → Exercices notés (score ≥ 70% requis)
```

### 4.2 Phase 1 — Cours

- Affichage d'une **carte de leçon** avec :
  - Titre et objectif pédagogique
  - Règle grammaticale ou liste de vocabulaire
  - 3 à 5 exemples EN → FR avec mise en évidence des éléments clés
  - Bouton audio (synthèse vocale) pour chaque exemple
- Navigation paginée entre les "slides" de cours (ex : 4 slides pour une règle complexe)

### 4.3 Phase 2 — Pratique guidée

- 2 à 3 exercices simples avec correction immédiate
- Feedback visuel instantané (correct/incorrect)
- Pas de pénalité, peut recommencer sans limite
- Objectif : comprendre avant de valider

### 4.4 Phase 3 — Validation (exercices notés)

- 5 à 10 questions selon le niveau
- Score calculé : nombre de bonnes réponses / total
- Seuil de validation : **70 %** (5/7 ou 7/10 selon le cas)
- En cas d'échec : bouton "Réessayer" (retourne en phase 2)
- En cas de succès : leçon marquée validée, suivante déverrouillée

---

## 5. Types d'exercices

### 5.1 QCM — Choix multiple

Question avec 4 options, une seule bonne réponse.

```
Quelle est la traduction de "dog" ?
  ○ Chat
  ○ Cheval
  ● Chien
  ○ Oiseau
```

### 5.2 Complétion de phrase — Trou à remplir

L'utilisateur tape le mot manquant dans un champ texte.

```
She ___ a student. (to be, présent)
→ Réponse attendue : "is"
```

### 5.3 Remise en ordre — Mots mélangés

Remettre les mots dans l'ordre pour former une phrase correcte.

```
[ like ] [ I ] [ cats ] [ don't ]
→ Réponse : "I don't like cats"
```

### 5.4 Association — Glisser-déposer

Relier chaque mot anglais à sa traduction française.

```
dog   ───► Pomme
apple ───► Chien
cat   ───► Chat
```

### 5.5 Vrai/Faux

Indiquer si la phrase est grammaticalement correcte ou non.

```
"She don't like coffee." → Vrai / Faux
```

### 5.6 Écoute et saisie (niveau A2+)

Synthèse vocale lit un mot ou une phrase, l'utilisateur tape ce qu'il a entendu.

```
🔊 [lecture audio]
→ L'utilisateur tape : "I went to the store"
```

### 5.7 Traduction libre (niveau B1)

Traduire une phrase française en anglais (tolérance orthographique légère).

```
"J'ai mangé une pomme ce matin."
→ Réponse attendue : "I ate an apple this morning."
```

---

## 6. Système de progression

### 6.1 Données de progression par utilisateur

```ts
interface UserProgress {
  userId: string;
  completedLessons: string[];       // IDs des leçons validées
  lessonScores: Record<string, number>; // lessonId → meilleur score
  currentLevel: 'A0' | 'A1' | 'A2' | 'B1';
  totalXP: number;
  streak: number;                   // jours consécutifs d'activité
  lastActivityDate: string;         // ISO 8601
}
```

### 6.2 XP et récompenses

| Action | XP gagnés |
|--------|-----------|
| Leçon validée (70–84%) | +50 XP |
| Leçon validée (85–99%) | +75 XP |
| Leçon validée (100%) | +100 XP |
| Série de 7 jours consécutifs | +200 XP bonus |
| Niveau complété | +500 XP |

### 6.3 Badges

| Badge | Condition |
|-------|-----------|
| Premier pas | Valider la première leçon |
| Perfectionniste | Obtenir 100% à 5 leçons |
| Niveau A0 complété | Toutes les leçons A0 validées |
| Niveau A1 complété | Toutes les leçons A1 validées |
| Niveau A2 complété | Toutes les leçons A2 validées |
| Niveau B1 complété | Toutes les leçons B1 validées |
| Série de feu (7j) | 7 jours consécutifs d'activité |

---

## 7. Architecture Angular

### 7.1 Structure des modules/routes

```
app/
├── core/
│   ├── services/
│   │   ├── lesson.service.ts         # Chargement des leçons
│   │   ├── progress.service.ts       # Gestion de la progression
│   │   ├── audio.service.ts          # Synthèse vocale (Web Speech API)
│   │   └── exercise.service.ts       # Logique de correction
│   └── guards/
│       └── lesson-unlocked.guard.ts  # Empêche l'accès aux leçons verrouillées
├── features/
│   ├── home/                         # Tableau de bord utilisateur
│   │   └── home.component.ts
│   ├── levels/                       # Liste des niveaux
│   │   └── levels.component.ts
│   ├── lesson-map/                   # Carte des leçons d'un niveau
│   │   └── lesson-map.component.ts
│   ├── lesson/                       # Affichage d'une leçon
│   │   ├── lesson.component.ts
│   │   ├── lesson-course/            # Phase 1 : cours
│   │   ├── lesson-practice/          # Phase 2 : pratique
│   │   └── lesson-quiz/              # Phase 3 : validation
│   ├── exercises/                    # Composants d'exercices réutilisables
│   │   ├── mcq/                      # QCM
│   │   ├── fill-blank/               # Trou à remplir
│   │   ├── word-order/               # Remise en ordre
│   │   ├── matching/                 # Association
│   │   ├── true-false/               # Vrai/Faux
│   │   ├── listening/                # Écoute
│   │   └── translation/              # Traduction libre
│   ├── progress/                     # Page progression / badges
│   │   └── progress.component.ts
│   └── settings/                     # Paramètres (langue UI, audio on/off)
│       └── settings.component.ts
└── shared/
    ├── components/
    │   ├── progress-bar/
    │   ├── xp-counter/
    │   ├── badge-card/
    │   ├── lesson-card/
    │   └── score-result/
    └── pipes/
        └── level-label.pipe.ts
```

### 7.2 Routes

```ts
const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'levels', component: LevelsComponent },
  { path: 'levels/:levelId', component: LessonMapComponent },
  {
    path: 'lesson/:lessonId',
    component: LessonComponent,
    canActivate: [LessonUnlockedGuard]
  },
  { path: 'progress', component: ProgressComponent },
  { path: 'settings', component: SettingsComponent },
];
```

### 7.3 Modèles de données

```ts
interface Lesson {
  id: string;               // ex: "a0-01"
  levelId: string;          // ex: "A0"
  order: number;            // position dans le niveau
  title: string;
  objective: string;        // "Apprendre les couleurs en anglais"
  slides: CourseSlide[];    // Phase 1
  practiceExercises: Exercise[];  // Phase 2
  quizExercises: Exercise[];      // Phase 3
  passingScore: number;     // 70 par défaut
}

interface CourseSlide {
  id: string;
  type: 'rule' | 'vocabulary' | 'examples';
  content: string;          // HTML/Markdown
  examples: Example[];
}

interface Example {
  english: string;
  french: string;
  audioKey?: string;        // clé pour la synthèse vocale
}

type ExerciseType =
  | 'mcq'
  | 'fill-blank'
  | 'word-order'
  | 'matching'
  | 'true-false'
  | 'listening'
  | 'translation';

interface Exercise {
  id: string;
  type: ExerciseType;
  question: string;
  options?: string[];       // MCQ, Vrai/Faux
  correctAnswer: string | string[];
  tolerance?: number;       // % de tolérance pour la saisie libre
  hint?: string;
}
```

---

## 8. UX / Interface utilisateur

### 8.1 Navigation principale

```
[Accueil]  [Niveaux]  [Progression]  [Paramètres]
```

### 8.2 Page Accueil

- Dernier niveau en cours (reprise rapide)
- Streak actuel (flamme + nombre de jours)
- XP total + barre de progression vers le prochain badge
- Bouton CTA "Continuer l'apprentissage"

### 8.3 Page Niveaux

- 4 cartes de niveaux (A0 / A1 / A2 / B1)
- Chaque carte affiche : nombre de leçons complétées / total, état (verrouillé/en cours/complété)
- Carte verrouillée si le niveau précédent n'est pas complété à 100%

### 8.4 Page Carte des leçons (Lesson Map)

- Affichage en colonne verticale type "chemin" (inspiré Duolingo)
- Chaque leçon = un nœud circulaire avec icône, état et score
- Nœud verrouillé = opaque, non cliquable
- Nœud en cours = surligné
- Nœud validé = coché avec score affiché

### 8.5 Écran de leçon — Cours (Phase 1)

- Slides paginées avec barre de progression en haut
- Bouton audio sur chaque exemple
- Bouton "Suivant" pour avancer
- Bouton "Commencer les exercices" à la fin

### 8.6 Écran de leçon — Exercice (Phase 2 et 3)

- Barre de progression (question X / Y) en haut
- Zone de question centrale
- Zone de réponse adaptée au type d'exercice
- Bouton "Valider"
- Feedback immédiat : fond vert (correct) / rouge (incorrect) + explication
- Bouton "Suivant" après le feedback

### 8.7 Écran résultat de leçon

- Score final en grand (ex : 8/10)
- Pourcentage + XP gagnés
- Badges débloqués (si applicable)
- Deux boutons : "Revoir la leçon" et "Leçon suivante"

### 8.8 Page Progression

- Barre XP totale avec niveau actuel
- Grille des badges (acquis / à débloquer)
- Calendrier de streak (derniers 30 jours)
- Statistiques : leçons validées, score moyen, temps total estimé

---

## 9. Persistance des données

### 9.1 Stockage local (MVP)

- `localStorage` avec clé `english_app_progress` : objet `UserProgress` sérialisé en JSON
- Contenu des leçons : fichiers JSON statiques dans `assets/lessons/`

### 9.2 Structure des fichiers de leçons

```
assets/
└── lessons/
    ├── index.json          # Liste de toutes les leçons (id, level, order, title)
    ├── a0/
    │   ├── a0-01.json      # Leçon 1 niveau A0
    │   ├── a0-02.json
    │   └── ...
    ├── a1/
    │   └── ...
    ├── a2/
    │   └── ...
    └── b1/
        └── ...
```

### 9.3 Évolution possible (post-MVP)

- Backend REST (NestJS ou Express) pour persistance multi-appareils
- Authentification utilisateur (email + mot de passe)
- Tableau de classement (leaderboard)

---

## 10. Accessibilité et audio

- **Synthèse vocale** : Web Speech API (`SpeechSynthesis`) — voix `en-US` ou `en-GB`
- **Bouton audio désactivable** dans les paramètres
- **Contraste** : respecter WCAG AA (ratio ≥ 4.5:1)
- **Navigation clavier** : tous les exercices utilisables sans souris
- **Responsive** : mobile-first, breakpoints sm/md/lg (Tailwind)

---

## 11. Règles pédagogiques

| Règle | Détail |
|-------|--------|
| Progression linéaire | Impossible de sauter une leçon |
| Seuil de validation | 70% minimum (configurable par leçon) |
| Répétition espacée | Les leçons validées peuvent être rejouées pour améliorer le score |
| Feedback explicatif | Chaque mauvaise réponse affiche la correction ET une courte explication |
| Difficulté croissante | Les types d'exercices difficiles (traduction, écoute) n'apparaissent qu'à partir du niveau A2 |

---

## 12. Phases de développement (MVP → V1)

### Phase 1 — MVP (4 semaines)

- [ ] Niveau A0 complet (5 leçons avec cours + exercices)
- [ ] Types d'exercices : QCM, Trou à remplir, Vrai/Faux
- [ ] Système de progression (localStorage)
- [ ] Navigation et carte des leçons
- [ ] Bouton audio (Web Speech API)

### Phase 2 — V1 (3 semaines)

- [ ] Niveaux A1 et A2 complets
- [ ] Types d'exercices : Remise en ordre, Association
- [ ] Système XP + badges
- [ ] Page progression

### Phase 3 — V1.1 (2 semaines)

- [ ] Niveau B1 complet
- [ ] Exercice d'écoute (listening)
- [ ] Exercice de traduction libre
- [ ] Streak et calendrier d'activité

### Phase 4 — V2 (optionnel)

- [ ] Backend + authentification
- [ ] Synchronisation multi-appareils
- [ ] Leaderboard
- [ ] Contenu généré par IA (exercices dynamiques)

---

## 13. Contraintes techniques

| Contrainte | Détail |
|------------|--------|
| Framework | Angular 17+ (standalone components, signals) |
| Style | Tailwind CSS 3.x |
| Tests | Jest (unitaire), Cypress (e2e) |
| Build | NX Monorepo si intégré dans la plateforme Worganic |
| Compatibilité | Chrome, Firefox, Edge — dernière version stable |
| Performance | Lazy loading par feature, score Lighthouse ≥ 90 |
| Audio | Web Speech API uniquement (pas de fichiers MP3 en MVP) |

---

*Document produit le 2026-05-30 — à réviser après la phase MVP.*
