# ✅ Suite de tests — Zone 3 & Zone 4 (Système Projets)

Cette checklist couvre **toutes** les fonctions documentées dans [`REGLES_GESTION_PROJET.md`](../REGLES_GESTION_PROJET.md). Elle se compose de :

1. **Tests automatisés** (script Node) → `tests/test-zone-projet.js`
2. **Checklist manuelle** (cases à cocher) → ce fichier

À exécuter après chaque modification touchant :
- `frankenstein/src/app/pages/user/projet-editor/**`
- `frankenstein/src/app/core/services/project-files.service.ts`
- `server/server-data.js` (sections file-projects)

---

## 🤖 Lancer les tests automatisés

### Pré-requis
- Le serveur `server-data.js` doit tourner (port 3001 par défaut).
- Récupérer un token valide :
    1. Se connecter dans l'interface (`http://localhost:4200`)
    2. Ouvrir la console du navigateur
    3. Copier la valeur de `localStorage.getItem('frankenstein_token')`

### Commande
```bash
# Depuis la racine du child :
WORG_TOKEN="<token>" node tests/test-zone-projet.js

# Ou (Windows PowerShell) :
$env:WORG_TOKEN="<token>"; node tests/test-zone-projet.js

# Optionnel : changer l'URL ou le user de test
WORG_API="http://localhost:3001" WORG_TOKEN="<token>" node tests/test-zone-projet.js
```

Le script crée un projet temporaire (`__test-zone-projet__`), exécute toutes les opérations, puis supprime le projet à la fin.

Code de sortie : `0` si tous les tests passent, `1` sinon.

---

## 📋 Checklist manuelle (à cocher après chaque déploiement)

### Zone 3 — Arborescence

#### Création / Renommage / Suppression
- [ ] Clic droit sur la racine → "Nouveau dossier" crée le dossier + un `contenu.md`
- [ ] Clic droit sur la racine → "Nouveau fichier" crée un fichier `.md` à la racine
- [ ] Clic droit sur un dossier → "Nouveau dossier" crée un sous-dossier
- [ ] Clic droit sur un dossier → "Nouveau fichier" crée un fichier dedans
- [ ] Clic droit sur un dossier → "Renommer" change le nom (et le slug du chemin)
- [ ] Clic droit sur un fichier → "Renommer" change le nom (extension `.md` préservée)
- [ ] Clic droit sur un dossier → "Supprimer" demande confirmation et supprime récursivement
- [ ] Clic droit sur un fichier → "Supprimer" demande confirmation et supprime
- [ ] `contenu.md` n'apparaît PAS comme fichier dans la sidebar (caché)

#### Drag & Drop dossiers
- [ ] Dossier A → INSIDE dossier B : A devient enfant de B
- [ ] Dossier A → BEFORE dossier B (même parent) : A passe avant B
- [ ] Dossier A → AFTER dossier B (même parent) : A passe après B
- [ ] Dossier A → INSIDE descendant de A : action bloquée (erreur 400)
- [ ] Dossier A déposé sur fichier : action ignorée (pas de drop accepté)
- [ ] Dossier déplacé vers un parent contenant déjà un dossier de même nom : erreur "déjà existant"

#### Drag & Drop fichiers (documents additionnels)
- [ ] Fichier Doc1 → INSIDE dossier B : Doc1 est déplacé dans B
- [ ] Fichier Doc1 → BEFORE Doc2 (même dossier) : Doc1 passe juste avant Doc2 ✨ (NOUVEAU FIX)
- [ ] Fichier Doc1 → AFTER Doc2 (même dossier) : Doc1 passe juste après Doc2 ✨
- [ ] Fichier Doc1 → BEFORE Doc2 (autre dossier) : Doc1 est déplacé puis ré-ordonné ✨
- [ ] Fichier Doc1 → racine du projet : refusé (Doc1 reste dans son dossier d'origine)

#### Drag & Drop images
- [ ] Image → dossier B : image déplacée dans B (le marqueur en zone 4 est mis à jour au prochain refresh)
- [ ] Image → image frère, BEFORE/AFTER : ré-ordonnancement ✨

### Zone 4 — Éditeur unifié

#### Affichage
- [ ] Chaque dossier apparaît comme `# Titre` (niveau 1) → `#### Titre` (niveau 4 max)
- [ ] Le contenu de `contenu.md` suit immédiatement le titre du dossier
- [ ] Les documents additionnels apparaissent comme blocs `'nom\n…\n'` à la fin de la section
- [ ] Les images apparaissent comme vignettes (mode Edition) ou rendues réellement (mode Visu)
- [ ] Une image présente sans marqueur s'affiche en fin de section (rétro-compatibilité)

#### Édition de structure (sauvegarde par debounce 800 ms ou blur)
- [ ] Renommer un titre `#` → renomme le dossier physique
- [ ] Promouvoir/rétrograder un titre (`##` → `#` ou inverse) → déplace le dossier dans la hiérarchie
- [ ] Effacer un titre + son contenu → supprime le dossier sur disque
- [ ] Ajouter un nouveau bloc `'nouveau\n...\n'` → crée le fichier physique
- [ ] Supprimer un bloc → supprime le fichier physique

#### Drag & Drop (poignée gouttière gauche)
- [ ] Survol d'une ligne fait apparaître la poignée correspondante (priorité image > doc > dossier)
- [ ] Drag dossier `## D 2-1` → before/after dossier de **même niveau** : réordonne
- [ ] Drag dossier sur sous-section : interdit (handle filtré)
- [ ] Drag document Doc1 → before Doc2 (même section) : réordonne ✨ (NOUVEAU FIX)
- [ ] Drag document Doc1 → after Doc2 (même section) : réordonne ✨
- [ ] Drag document Doc1 → vers une autre section : déplace + ré-ordonne ✨
- [ ] Drag image → autre ligne : déplace le marqueur `{{IMG:id}}` dans le texte
- [ ] Drag avec curseur près du bord (40 px) → auto-scroll vertical
- [ ] Pendant le drag : la sauvegarde différée (saveTimeout) est annulée (pas d'écrasement concurrent)

#### Image card (mode Edition)
- [ ] Survol d'une vignette → aperçu agrandi (HoverPreview)
- [ ] Bouton ✎ → renommage inline (extension préservée)
- [ ] Bouton 🗑 → confirmation puis suppression du fichier + retrait du marqueur

#### Mode Visu
- [ ] Toggle Edit/Visu déclenche une sauvegarde
- [ ] Les marqueurs `{{IMG:id}}` sont remplacés par `<img src="...">`
- [ ] Les chemins d'image avec espaces sont correctement encodés
- [ ] Clic sur un titre rendu : émet `nodeActive` (highlight côté Z3)
- [ ] Clic sur un bloc fichier rendu : émet `nodeActive` du fichier

#### Synchronisation Z3 ↔ Z4
- [ ] Clic sur un dossier dans Z3 → scroll au titre correspondant dans Z4 + highlight bleu
- [ ] Clic sur un fichier additionnel dans Z3 → scroll au bloc + highlight vert
- [ ] Curseur dans un bloc fichier dans Z4 → fichier sélectionné dans Z3
- [ ] Curseur dans une section dans Z4 → dossier sélectionné dans Z3

---

## 🐛 Régressions historiques (à re-vérifier systématiquement)

| ID | Bug                                                                        | Fix dans   |
|----|----------------------------------------------------------------------------|------------|
| R1 | Réordonnancement dossiers même niveau impossible (nesting accidentel)      | mod-068    |
| R2 | Drag d'image en zone 4 ne faisait rien (marker non déplacé)                | mod-067    |
| R3 | Images invisibles en mode visu (chemins avec espaces non encodés)          | mod-066    |
| R4 | Pas de scroll auto vers la section cliquée                                 | mod-065    |
| R5 | Réordonnancement Doc1/Doc2/Doc3 dans même dossier impossible (Z3 et Z4)    | **mod-069** ✨ |
