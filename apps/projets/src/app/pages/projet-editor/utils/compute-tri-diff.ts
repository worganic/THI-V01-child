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
