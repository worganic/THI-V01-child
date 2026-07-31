import { Component } from '@angular/core';

/**
 * Admin propre aux documents — point d'extension pour de futurs réglages
 * spécifiques à cette sous-application (les users/groupes/métiers restent
 * gérés dans Admin › Portail, communs à tout le système).
 */
@Component({
  selector: 'app-admin-documents',
  imports: [],
  templateUrl: './admin-documents.component.html'
})
export class AdminDocumentsComponent {}
