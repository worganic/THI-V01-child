import { Routes } from '@angular/router';
import { authGuard } from '@portail/core-auth';
import { PORTAL_ROUTES } from './portal-routes';

/**
 * Routage du socle du portail : connexion, accueil et administration.
 *
 * Fichier identique dans les deux monorepos. Ce qui change d'un portail à
 * l'autre — la liste des sous-applications montées et les pages maison — vit
 * dans `portal-routes.ts`, injecté ci-dessous par `...PORTAL_ROUTES`.
 */
export const appRoutes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'login', redirectTo: 'connexion', pathMatch: 'full' },

  {
    path: 'connexion',
    loadComponent: () => import('./connexion/connexion.component').then(m => m.ConnexionComponent)
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard],
    children: [
      { path: 'users', loadComponent: () => import('./admin/admin-users/admin-users.component').then(m => m.AdminUsersComponent) },
      { path: 'apps', loadComponent: () => import('./admin/admin-apps/admin-apps.component').then(m => m.AdminAppsComponent) },
      { path: 'groupes', loadComponent: () => import('./admin/admin-groupes/admin-groupes.component').then(m => m.AdminGroupesComponent) },
      { path: 'metiers', loadComponent: () => import('./admin/admin-metiers/admin-metiers.component').then(m => m.AdminMetiersComponent) },
      { path: 'matrice-users', loadComponent: () => import('./admin/admin-matrice-users/admin-matrice-users.component').then(m => m.AdminMatriceUsersComponent) },
      { path: 'matrice-apps', loadComponent: () => import('./admin/admin-matrice-apps/admin-matrice-apps.component').then(m => m.AdminMatriceAppsComponent) },
      { path: 'affectations', loadComponent: () => import('./admin/admin-affectations/admin-affectations.component').then(m => m.AdminAffectationsComponent) },
      { path: 'export', loadComponent: () => import('./admin/admin-export/admin-export.component').then(m => m.AdminExportComponent) },
      { path: 'config', loadComponent: () => import('./admin/admin-config/admin-config.component').then(m => m.AdminConfigComponent) },
      { path: '', redirectTo: 'users', pathMatch: 'full' }
    ]
  },

  // Sous-applications montées et pages propres à CE portail.
  ...PORTAL_ROUTES,

  { path: '**', redirectTo: 'home' }
];
