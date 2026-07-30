import { Component, signal } from '@angular/core';
import { PortailAppsSectionComponent } from './sections/portail-apps.component';
import { PortailGroupesSectionComponent } from './sections/portail-groupes.component';
import { PortailMetiersSectionComponent } from './sections/portail-metiers.component';
import { PortailDroitsSectionComponent } from './sections/portail-droits.component';

type PortailSection = 'apps' | 'groupes' | 'metiers' | 'droits';

/**
 * Admin › Applications — gestion des sous-applications du portail,
 * des groupes qui les regroupent, des métiers et des droits utilisateurs.
 * Ce qui est configuré ici pilote directement la page d'accueil.
 */
@Component({
  selector: 'app-admin-portail',
  imports: [
    PortailAppsSectionComponent,
    PortailGroupesSectionComponent,
    PortailMetiersSectionComponent,
    PortailDroitsSectionComponent,
  ],
  templateUrl: './admin-portail.component.html'
})
export class AdminPortailComponent {
  section = signal<PortailSection>('apps');

  readonly sections: { id: PortailSection; label: string; icon: string }[] = [
    { id: 'apps',    label: 'Applications', icon: 'apps' },
    { id: 'groupes', label: 'Groupes',      icon: 'category' },
    { id: 'metiers', label: 'Métiers',      icon: 'badge' },
    { id: 'droits',  label: 'Droits',       icon: 'lock_person' },
  ];

  setSection(id: PortailSection) { this.section.set(id); }
}
