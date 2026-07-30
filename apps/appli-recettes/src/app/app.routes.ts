import { Routes } from '@angular/router';
import { HomeRecettesComponent } from './home-recettes/home-recettes.component';

export const appRoutes: Routes = [
  {
    // Vue Liste : /recettes
    path: '',
    component: HomeRecettesComponent
  },
  {
    // Vue Détail (défaut) : /recettes/book-123
    path: ':bookId',
    component: HomeRecettesComponent
  },
  {
    // Vue Détail avec Onglet : /recettes/book-123/execution
    path: ':bookId/:tab',
    component: HomeRecettesComponent
  }
];