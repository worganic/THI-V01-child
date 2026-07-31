import { Component } from '@angular/core';

/**
 * Admin propre à l'agenda — point d'extension pour de futurs réglages
 * spécifiques à cette sous-application (les users/groupes/métiers restent
 * gérés dans l'admin du portail, communs à tout le système).
 */
@Component({
  selector: 'app-admin-agenda',
  imports: [],
  templateUrl: './admin-agenda.component.html',
  styleUrls: ['./admin-agenda.component.scss']
})
export class AdminAgendaComponent {}
