import { Component } from '@angular/core';

/**
 * Admin propre à l'agenda — point d'extension pour de futurs réglages
 * spécifiques à cette sous-application (les users/groupes/métiers restent
 * gérés dans Admin › Portail, communs à tout le système).
 */
@Component({
  selector: 'app-admin-agenda',
  imports: [],
  templateUrl: './admin-agenda.component.html'
})
export class AdminAgendaComponent {}
