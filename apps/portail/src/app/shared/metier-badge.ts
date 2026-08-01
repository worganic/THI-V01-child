import { METIER_COLOR_OPTIONS } from '@portail/core-data-access';

/**
 * Rendu Tailwind des 6 teintes de métier, propre à CE portail.
 *
 * Le vocabulaire des teintes (`METIER_COLOR_OPTIONS`, 6 valeurs) est partagé
 * avec l'autre portail via `@portail/core-data-access` ; la façon de les
 * peindre ne l'est pas — l'autre portail est en Bootstrap et rend les mêmes
 * valeurs via ses règles `.metier-*`. Garder le mapping ici est ce qui permet
 * à `portal-apps.models.ts` de rester identique dans les deux monorepos.
 * Voir docs/architecture-sous-applications.md, section « Design ».
 */
export const METIER_COLORS: { value: string; label: string; badgeClass: string }[] = [
  { value: 'blue',   label: 'Bleu',    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30' },
  { value: 'green',  label: 'Vert',    badgeClass: 'bg-green-500/10 text-green-600 dark:text-green-300 border-green-500/30' },
  { value: 'purple', label: 'Violet',  badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30' },
  { value: 'amber',  label: 'Ambre',   badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30' },
  { value: 'slate',  label: 'Ardoise', badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30' },
  { value: 'red',    label: 'Rouge',   badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30' },
];

// Garde-fou : si une teinte est ajoutée au vocabulaire partagé sans être peinte
// ici, autant le voir au build plutôt que d'afficher un badge sans style.
if (METIER_COLORS.length !== METIER_COLOR_OPTIONS.length) {
  console.warn('[metier-badge] METIER_COLORS ne couvre plus toutes les teintes de METIER_COLOR_OPTIONS.');
}

/** Repli sur `slate` (index 4) comme avant, si la valeur est inconnue. */
export function metierBadgeClass(color: string | null | undefined): string {
  return METIER_COLORS.find(c => c.value === color)?.badgeClass ?? METIER_COLORS[4].badgeClass;
}

/**
 * Variante pleine des mêmes teintes — pastille de couleur franche sur texte
 * blanc, comme dans les tableaux d'administration de l'autre portail. Les
 * fonds translucides de `METIER_COLORS` ci-dessus restent utilisés partout
 * ailleurs (listes, fiches), où ils se fondent mieux dans la carte.
 */
const METIER_SOLID_CLASSES: Record<string, string> = {
  blue:   'bg-blue-600 text-white border-blue-600',
  green:  'bg-green-600 text-white border-green-600',
  purple: 'bg-purple-600 text-white border-purple-600',
  amber:  'bg-amber-600 text-white border-amber-600',
  slate:  'bg-slate-600 text-white border-slate-600',
  red:    'bg-red-600 text-white border-red-600',
};

/** Même repli sur `slate` que `metierBadgeClass`, si la valeur est inconnue. */
export function metierSolidBadgeClass(color: string | null | undefined): string {
  return METIER_SOLID_CLASSES[color ?? ''] ?? METIER_SOLID_CLASSES['slate'];
}
