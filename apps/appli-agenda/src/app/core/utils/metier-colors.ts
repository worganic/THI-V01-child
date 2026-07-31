// =============================================================================
// Palette des métiers de projet : réutilise les 6 teintes --category-* du design system
// centralisé (voir libs/shared-ui/src/global-design.scss, déjà utilisées sur la page d'accueil du
// portail et par Admin > Métiers) plutôt qu'une couleur libre — un badge de métier reste ainsi
// cohérent avec le reste du portail et s'adapte au thème sombre sans configuration supplémentaire.
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
