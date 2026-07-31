import { computeLineDiff } from './compute-line-diff';

export type TriDiffRelation = 'same' | 'removed' | 'added' | 'current-only';

export interface TriDiffRow {
  current: string | null;
  before: string | null;
  after: string | null;
  /** Relation avant/après pour cette ligne ('current-only' si la ligne n'existe que dans Actuel). */
  relation: TriDiffRelation;
  currentNum: number | null;
  beforeNum: number | null;
  afterNum: number | null;
}

/**
 * Aligne 3 versions d'un texte (Actuel / Avant / Après) sur une grille de lignes
 * commune, en utilisant "après" comme pivot entre les deux diffs 2 à 2
 * (Avant↔Après et Après↔Actuel proviennent tous deux de computeLineDiff, qui
 * parcourt "après" dans le même ordre dans les deux cas — on peut donc les
 * fusionner en avançant en parallèle sur les lignes qui consomment "après").
 *
 * Une valeur `null` sur une colonne signifie que la ligne n'existe pas dans
 * cette version — à afficher en placeholder (rouge, sans numéro de ligne) côté
 * template, plutôt que de décaler les lignes suivantes vers le haut.
 */
export function computeTriDiff(current: string[], before: string[], after: string[]): TriDiffRow[] {
  const pairsBA = computeLineDiff(before, after); // consomme "after" quand type !== 'removed'
  const pairsAC = computeLineDiff(after, current); // consomme "after" (= son "before") quand type !== 'added'

  const rows: TriDiffRow[] = [];
  let i = 0, j = 0;
  let curNum = 1, befNum = 1, aftNum = 1;

  while (i < pairsBA.length || j < pairsAC.length) {
    const rowBA = i < pairsBA.length ? pairsBA[i] : null;
    const rowAC = j < pairsAC.length ? pairsAC[j] : null;

    const baConsumesAfter = !!rowBA && rowBA.type !== 'removed';
    const acConsumesAfter = !!rowAC && rowAC.type !== 'added';

    if (rowBA && !baConsumesAfter) {
      // Ligne présente uniquement dans "avant" (supprimée par rapport à "après")
      rows.push({
        current: null, before: rowBA.left, after: null,
        relation: 'removed',
        currentNum: null, beforeNum: befNum++, afterNum: null,
      });
      i++;
      continue;
    }
    if (rowAC && !acConsumesAfter) {
      // Ligne présente uniquement dans "actuel" (ajoutée par rapport à "après")
      rows.push({
        current: rowAC.right, before: null, after: null,
        relation: 'current-only',
        currentNum: curNum++, beforeNum: null, afterNum: null,
      });
      j++;
      continue;
    }

    // Les deux côtés (quand présents) consomment la même ligne de "après"
    const afterLine = rowBA ? rowBA.right : (rowAC ? rowAC.left : null);
    rows.push({
      current: rowAC ? rowAC.right : null,
      before: rowBA ? rowBA.left : null,
      after: afterLine,
      relation: rowBA ? rowBA.type : 'added',
      currentNum: rowAC ? curNum++ : null,
      beforeNum: rowBA && rowBA.type !== 'added' ? befNum++ : null,
      afterNum: afterLine != null ? aftNum++ : null,
    });
    i++; j++;
  }

  return rows;
}

/**
 * Fusion automatique à 3 voies (avant / mien / leur), pivotant sur "avant" — PAS sur "leur"
 * comme `computeTriDiff` (qui sert à l'affichage manuel côté `ProjetDiffComponent`, où pivoter
 * sur "après" est correct puisque l'utilisateur choisit lui-même quoi garder ligne à ligne).
 *
 * Pivoter sur "après" pour une fusion AUTOMATIQUE a un défaut : une ligne de "mien" qui n'a pas
 * bougé depuis "avant" (donc littéralement identique à l'ancienne version) mais que "leur" a
 * modifiée à la même position ressort comme deux lignes distinctes ("leur" nouvelle valeur +
 * "mien" ancienne valeur inchangée), au lieu d'une seule ligne fusionnée — la vieille valeur
 * survit en double à côté de la nouvelle. Pivoter sur "avant" élimine ce problème : pour
 * chaque ligne de la base commune, on sait distinguer "mien ne l'a pas touchée" de "mien l'a
 * remplacée par autre chose", indépendamment de ce que "leur" en a fait.
 *
 * Règle de résolution par ligne de "avant" :
 * - ni l'un ni l'autre n'a changé  → garder tel quel
 * - seul "leur" a changé           → prendre la version de "leur"
 * - seul "mien" a changé           → garder la version de "mien"
 * - les deux ont changé (substitution de la même ligne des deux côtés, avec des textes
 *   différents) → les DEUX versions sont conservées (mien puis leur), l'une à la suite de
 *   l'autre, plutôt que d'en choisir une silencieusement : un vrai conflit ligne-à-ligne ne
 *   doit jamais faire disparaître le travail de l'un des deux utilisateurs sans qu'il l'ait vu
 *   — quitte à laisser une ligne en double à nettoyer manuellement (voir "Voir le diff complet"
 *   pour un choix éclairé). C'est le même choix de sûreté que le reste de cette fonctionnalité :
 *   dupliquer plutôt que risquer de perdre silencieusement une modification.
 * Les lignes ajoutées par "mien" ou "leur" (absentes de "avant", donc aucun conflit possible
 * puisqu'aucun des deux ne remplace rien) sont conservées telles quelles, dans l'ordre où elles
 * apparaissent.
 */
export function mergeThreeWay(before: string[], mine: string[], theirs: string[]): string[] {
  const pairsBM = computeLineDiff(before, mine);
  const pairsBT = computeLineDiff(before, theirs);

  const result: string[] = [];
  let i = 0, j = 0;

  while (i < pairsBM.length || j < pairsBT.length) {
    const pm = i < pairsBM.length ? pairsBM[i] : null;
    const pt = j < pairsBT.length ? pairsBT[j] : null;

    const mConsumesBefore = !!pm && pm.type !== 'added';
    const tConsumesBefore = !!pt && pt.type !== 'added';

    if (pm && !mConsumesBefore) {
      // Ligne ajoutée par "mien", absente de "avant" — conservée telle quelle.
      result.push(pm.right);
      i++;
      continue;
    }
    if (pt && !tConsumesBefore) {
      // Ligne ajoutée par "leur", absente de "avant" — conservée telle quelle.
      result.push(pt.right);
      j++;
      continue;
    }

    // Les deux consomment la même ligne de "avant" à cette position.
    const mineSame = !pm || pm.type === 'same';
    const theirsSame = !pt || pt.type === 'same';
    if (mineSame && theirsSame) {
      if (pm && pm.type !== 'removed') result.push(pm.right);
    } else if (mineSame && !theirsSame) {
      // Seul "leur" a changé cette ligne — adopter sa version (ou la supprimer si "leur" l'a retirée).
      if (pt && pt.type !== 'removed') result.push(pt.right);
    } else if (!mineSame && theirsSame) {
      // Seul "mien" a changé cette ligne — la garder.
      if (pm && pm.type !== 'removed') result.push(pm.right);
    } else {
      // Les deux ont remplacé cette même ligne de "avant" (chacun par un texte différent) :
      // ne rien pousser ICI pour l'ancienne ligne (elle disparaît, normal) — les deux nouvelles
      // versions (celle de "mien" et celle de "leur") seront chacune poussées séparément par les
      // branches "added" ci-dessus, aux itérations suivantes de la boucle. Résultat assumé : les
      // deux lignes apparaissent l'une après l'autre plutôt qu'un choix silencieux entre les deux.
    }
    i++; j++;
  }

  return result;
}
