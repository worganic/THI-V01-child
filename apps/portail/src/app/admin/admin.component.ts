import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

/**
 * Les trois familles d'administration, reprises telles quelles de l'autre portail
 * pour que les deux systèmes se lisent de la même façon :
 *  - `portail`      : le système transverse (comptes, catalogue d'apps, config, outils) ;
 *  - `applications` : l'admin propre à chaque sous-application, quand elle en déclare une ;
 *  - `autres`       : tout le reste.
 */
export type AdminCategory = 'portail' | 'applications' | 'autres';

/** Une page d'administration = un segment de route enfant de `/admin`. */
export interface AdminSection {
  id: string;
  label: string;
  icon: string;
  /** Segment de route enfant (voir app.routes.ts). */
  route: string;
}

/** Un onglet regroupe les pages d'un même sujet ; il n'a pas de route propre. */
export interface AdminTab {
  id: string;
  label: string;
  icon: string;
  category: AdminCategory;
  sections: AdminSection[];
}

const CATEGORIES: { id: AdminCategory; label: string; icon: string }[] = [
  { id: 'portail',      label: 'Portail',      icon: 'apps' },
  { id: 'applications', label: 'Applications', icon: 'view_module' },
  { id: 'autres',       label: 'Autres',       icon: 'more_horiz' },
];

/**
 * Menu à trois niveaux : catégorie → onglet → page. Les pages sont exactement
 * celles déjà servies par les routes enfants de `/admin` — aucune page n'est
 * ajoutée ni retirée ici, seul le chemin d'accès change.
 */
const ADMIN_TABS: AdminTab[] = [
  {
    id: 'systeme', label: 'Système', icon: 'apps', category: 'portail',
    sections: [
      { id: 'users',    label: 'Utilisateurs', icon: 'group',    route: 'users' },
      { id: 'apps',     label: 'Applications', icon: 'apps',     route: 'apps' },
      { id: 'groupes',  label: 'Groupes',      icon: 'category', route: 'groupes' },
      { id: 'metiers',  label: 'Métiers',      icon: 'badge',    route: 'metiers' },
    ],
  },
  {
    id: 'config', label: 'Config', icon: 'settings', category: 'portail',
    sections: [
      { id: 'config', label: 'Infos config', icon: 'settings', route: 'config' },
    ],
  },
  {
    id: 'outils', label: 'Outils', icon: 'handyman', category: 'portail',
    sections: [
      { id: 'export', label: 'Export JSON', icon: 'data_object', route: 'export' },
    ],
  },
];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly categories = CATEGORIES;
  readonly tabs = ADMIN_TABS;

  /** Segment de route actif (`users`, `config`…), déduit de l'URL courante. */
  private activeRoute = signal<string>('');

  /**
   * Catégorie affichée. Normalement déduite de la page ouverte, mais gardée en
   * signal propre pour qu'un clic sur une catégorie encore vide (Applications,
   * Autres) affiche bien son message plutôt que de ne rien faire.
   */
  activeCategory = signal<AdminCategory>('portail');

  /** Onglet contenant la page ouverte. */
  activeTab = computed<AdminTab | null>(
    () => this.tabs.find(t => t.sections.some(s => s.route === this.activeRoute())) ?? null
  );

  tabsInCategory = computed<AdminTab[]>(
    () => this.tabs.filter(t => t.category === this.activeCategory())
  );

  /** Rangée du bas : les pages de l'onglet ouvert, si celui-ci est dans la catégorie affichée. */
  sectionsInTab = computed<AdminSection[]>(() => {
    const tab = this.activeTab();
    return tab && tab.category === this.activeCategory() ? tab.sections : [];
  });

  ngOnInit(): void {
    this.syncFromUrl(this.router.url);
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(e => this.syncFromUrl(e.urlAfterRedirects));
  }

  /**
   * Le menu suit l'URL (et non l'inverse) : une navigation directe, un rafraîchissement
   * ou un retour arrière rouvrent la bonne catégorie et le bon onglet.
   */
  private syncFromUrl(url: string): void {
    const segment = url.split('?')[0].split('#')[0].split('/').filter(Boolean).pop() ?? '';
    this.activeRoute.set(segment);
    const tab = this.tabs.find(t => t.sections.some(s => s.route === segment));
    if (tab) this.activeCategory.set(tab.category);
  }

  isActiveRoute(route: string): boolean {
    return this.activeRoute() === route;
  }

  isActiveTab(tab: AdminTab): boolean {
    return this.activeTab()?.id === tab.id;
  }

  setCategory(category: AdminCategory): void {
    this.activeCategory.set(category);
    const first = this.tabs.find(t => t.category === category);
    if (first && !first.sections.some(s => s.route === this.activeRoute())) {
      this.openTab(first);
    }
  }

  /** Ouvrir un onglet = ouvrir sa première page. */
  openTab(tab: AdminTab): void {
    const first = tab.sections[0];
    if (first) this.router.navigate(['/admin', first.route]);
  }
}
