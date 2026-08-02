import { Routes } from '@angular/router';
import { authGuard } from '@portail/core-auth';

/**
 * Sous-applications montées et pages propres à CE portail.
 *
 * Ce fichier existe dans les deux monorepos sous le même nom et n'y déclare pas
 * les mêmes routes : c'est le point d'extension prévu pour que `app.routes.ts`,
 * lui, reste identique des deux côtés.
 *
 * Le code des sous-applications vit dans `apps/appli-<nom>/` : elles sont
 * chargées à la demande dans le shell et héritent de son header, de son thème
 * et de sa session. Les cartes de la page d'accueil pointent sur ces routes
 * internes (table `portal_apps`, colonne `url_path`).
 */
export const PORTAL_ROUTES: Routes = [
  // ─── Sous-applications montées dans le portail ────────────────────────────
  {
    path: 'agenda',
    loadChildren: () => import('../../../appli-agenda/src/app/app.routes').then(m => m.appRoutes),
    canActivate: [authGuard]
  },
  {
    path: 'recettes',
    loadChildren: () => import('../../../appli-recettes/src/app/app.routes').then(m => m.appRoutes),
    canActivate: [authGuard]
  },
  {
    path: 'documents',
    loadChildren: () => import('../../../appli-documents/src/app/app.routes').then(m => m.appRoutes),
    canActivate: [authGuard]
  },

  // ─── Pages propres à cette plateforme ─────────────────────────────────────
  {
    path: 'editor',
    loadComponent: () => import('./pages/user/editor/editor.component').then(m => m.EditorComponent),
    canActivate: [authGuard]
  },
  {
    path: 'config',
    loadComponent: () => import('./pages/user/config/config.component').then(m => m.ConfigComponent),
    canActivate: [authGuard]
  },
  {
    path: 'deployments',
    loadComponent: () => import('./pages/user/deployments/deployments.component').then(m => m.DeploymentsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'wo-action-history',
    loadComponent: () => import('./pages/user/wo-action-history/wo-action-history.component').then(m => m.WoActionHistoryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'trello',
    loadComponent: () => import('./pages/trello/trello-page.component').then(m => m.TrelloPageComponent),
    canActivate: [authGuard]
  },

  // ─── Administration maison ────────────────────────────────────────────────
  // Onglets propres à cette plateforme (tests, IA, mega-outils, mémo,
  // déploiements, thème…), conservés le temps de leur reprise en onglets
  // contribués via AdminTabsRegistryService — mécanisme déjà utilisé par les
  // sous-applications, qui est la cible pour les faire apparaître dans l'admin
  // commun plutôt que dans un écran séparé.
  {
    path: 'admin-outils',
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin-outils/:tab',
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin-outils/:tab/:subtab',
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard]
  },

  // ─── Pages de documentation des outils ────────────────────────────────────
  {
    path: 'tchat-ia-doc',
    loadComponent: () => import('./tools/tchat-ia/tchat-ia-doc.component').then(m => m.TchatIaDocComponent)
  },
  {
    path: 'ticket-widget-doc',
    loadComponent: () => import('./tools/ticket-widget/ticket-widget-doc.component').then(m => m.TicketWidgetDocComponent)
  },
  {
    path: 'cahier-recette-doc',
    loadComponent: () => import('./tools/cahier-recette/cahier-recette-doc.component').then(m => m.CahierRecetteDocComponent)
  },
];
