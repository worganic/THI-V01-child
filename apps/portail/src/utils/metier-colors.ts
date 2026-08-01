// =============================================================================
// Palette des métiers (Admin > Métiers) : réutilise les 6 teintes --category-* du design system
// centralisé (voir libs/shared/ui/src/portal-tokens.scss, chargé une seule fois par
// portail-shell et donc disponible dans tout le document). Même principe que les catégories de
// projet de l'agenda (apps/appli-agenda/src/utils/category-colors.ts) — dupliqué ici plutôt que
// partagé via une lib, portail-shell et appli-agenda ne s'important pas l'un l'autre.
// =============================================================================

export interface MetierColorOption {
  value: string;
  label: string;
}

export const METIER_COLOR_OPTIONS: MetierColorOption[] = [
  { value: 'blue', label: 'Bleu' },
  { value: 'green', label: 'Vert' },
  { value: 'purple', label: 'Violet' },
  { value: 'amber', label: 'Ambre' },
  { value: 'slate', label: 'Ardoise' },
  { value: 'red', label: 'Rouge' },
];

export const DEFAULT_METIER_COLOR = METIER_COLOR_OPTIONS[0].value;

/** Classe CSS `metier-<couleur>` : voir les règles `.metier-*` dans le SCSS des composants qui l'utilisent. */
export function metierBadgeClass(color: string | undefined): string {
  const known = METIER_COLOR_OPTIONS.some(o => o.value === color);
  return `metier-${known ? color : 'slate'}`;
}
