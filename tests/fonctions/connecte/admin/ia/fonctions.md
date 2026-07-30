# Admin › IA — Fonctions métier

Composant : `AdminIaComponent` (portail)
Vue : gestion des documents Skill (titre, texte markdown, IA associée), stockés en base MySQL (`admin_ia_skills`).

---

## `2-1-8-1` — Liste des skills

- Charge tous les skills via `GET /api/admin/ia-skills` (admin uniquement), triés par dernière modification
- Tableau : titre, IA associée (provider + modèle), date de mise à jour, actions (modifier / supprimer)
- État vide : message "Aucun skill pour l'instant."

---

## `2-1-8-2` — Création d'un skill

- Bouton "Nouveau skill" ouvre une popup avec formulaire : titre, IA (Claude Code / Antigravity CLI / Aucune), modèle, texte markdown
- Le champ Modèle est un `<select>` alimenté par `GET {EXECUTOR_API}/api/cli-status` (même source que Config › Intelligence Artificielle › Outils CLI) si des modèles sont disponibles pour le provider choisi, sinon un champ texte libre
- Validation : titre et texte requis
- `POST /api/admin/ia-skills` (admin uniquement)

---

## `2-1-8-3` — Modification d'un skill

- Bouton "Modifier" (icône crayon) ouvre la même popup pré-remplie
- `PUT /api/admin/ia-skills/:id` (admin uniquement)

---

## `2-1-8-4` — Suppression d'un skill

- Bouton "Supprimer" → confirmation inline (Confirmer/Annuler) → `DELETE /api/admin/ia-skills/:id` (admin uniquement)

---

## `2-1-8-5` — Aperçu markdown

- Bouton "Aperçu" dans le formulaire bascule entre édition (textarea) et rendu HTML léger (gras, italique, titres, listes, code, citations de bloc) sans dépendance externe

---

## `2-1-8-6` — Sélection IA / modèle liée aux Outils CLI

- La liste des providers proposés (Claude Code, Antigravity CLI) correspond aux outils CLI configurables dans `connecte/config` › Intelligence Artificielle › Outils CLI
- Les modèles disponibles par provider proviennent du même endpoint `/api/cli-status` que la page Config (nécessite l'app Electron/executor locale démarrée ; sinon champ texte libre en repli)

---

## États

| État | Description |
|------|-------------|
| Chargement | "Chargement…" |
| Aucun skill | Message + icône |
| Formulaire ouvert | Popup création/édition |
| Confirmation suppression | Boutons Confirmer/Annuler inline |

- **Composants:** `admin-ia.component.ts`, `admin-ia.component.html`, `admin.component.ts`, `server/server-data.js`
