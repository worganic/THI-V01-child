import { Injectable, InjectionToken, inject, signal } from '@angular/core';

/**
 * Thème du portail entier : un seul `data-theme` posé sur `<html>` suffit à basculer
 * toutes les applications montées (un seul document DOM — les variables CSS de
 * libs/shared/ui/src/portal-tokens.scss réagissent à cet attribut).
 *
 * Le service est identique dans les deux monorepos ; ce qui change d'un portail à
 * l'autre — nombre de thèmes, classes CSS posées, icônes, clé de stockage — vit dans
 * `PORTAL_THEME_CONFIG`, fourni par `app.config.ts`. Un portail à deux thèmes et un
 * portail à trois thèmes exécutent donc bien le même code.
 *
 * Fichier identique dans les deux monorepos.
 */

/** Nom d'un thème. Volontairement non fermé : chaque portail définit sa propre liste. */
export type PortalTheme = string;

export interface PortalThemeConfig {
  /** Clé localStorage où la préférence est mémorisée. */
  storageKey: string;
  /** Ordre de rotation du bouton de bascule. */
  cycle: PortalTheme[];
  /** Thème initial si aucune préférence n'est enregistrée. `'system'` suit `prefers-color-scheme`. */
  fallback: PortalTheme | 'system';
  /**
   * Classes CSS à poser sur `<html>` pour chaque thème, en plus de l'attribut
   * `data-theme`. C'est ce dont Tailwind a besoin côté plateforme (`.dark`), et ce
   * qui permet à une sous-application copiée d'un portail à l'autre d'adosser son
   * SCSS aux mêmes sélecteurs. Voir libs/shared/ui/src/portal-tokens.scss.
   */
  classes: Record<PortalTheme, string[]>;
  /** Icône Material affichée par le bouton de bascule pour chaque thème. */
  icons: Record<PortalTheme, string>;
}

export const PORTAL_THEME_CONFIG = new InjectionToken<PortalThemeConfig>('PORTAL_THEME_CONFIG');

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private config = inject(PORTAL_THEME_CONFIG);

  /** Thème courant. Signal : lisible directement dans un template, sans sub/unsub. */
  readonly theme = signal<PortalTheme>(this.resolveInitialTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  /**
   * Réapplique la préférence enregistrée. Appelé au démarrage par les applications
   * qui ne montent pas le portail complet (sous-application autonome). Idempotent.
   */
  initTheme(): void {
    this.applyTheme(this.resolveInitialTheme());
  }

  /** Passe au thème suivant dans le cycle du portail. */
  toggleTheme(): void {
    const { cycle } = this.config;
    const index = cycle.indexOf(this.theme());
    this.applyTheme(cycle[(index + 1) % cycle.length]);
  }

  applyTheme(theme: PortalTheme): void {
    this.theme.set(theme);
    localStorage.setItem(this.config.storageKey, theme);

    const root = document.documentElement;
    // Retire les classes de tous les thèmes connus avant de poser celles du thème
    // actif : un thème peut en cumuler plusieurs (ex. « pink » = .dark + .pink).
    for (const classes of Object.values(this.config.classes)) {
      if (classes.length) root.classList.remove(...classes);
    }
    const active = this.config.classes[theme] ?? [];
    if (active.length) root.classList.add(...active);

    root.setAttribute('data-theme', theme);
  }

  /** Icône du bouton de bascule. Lit le signal : utilisable dans un `effect`. */
  getThemeIcon(): string {
    return this.config.icons[this.theme()] ?? '';
  }

  private resolveInitialTheme(): PortalTheme {
    const stored = localStorage.getItem(this.config.storageKey);
    if (stored && this.config.cycle.includes(stored)) return stored;
    if (this.config.fallback === 'system') {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.config.fallback;
  }
}
