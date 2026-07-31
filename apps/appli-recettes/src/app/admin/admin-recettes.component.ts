import { Component } from '@angular/core';

/**
 * Admin propre aux recettes — point d'extension pour de futurs réglages
 * spécifiques à cette sous-application (les users/groupes/métiers restent
 * gérés dans Admin › Portail, communs à tout le système).
 */
@Component({
  selector: 'app-admin-recettes',
  imports: [],
  templateUrl: './admin-recettes.component.html'
})
export class AdminRecettesComponent {}
