import { Component, signal } from '@angular/core';
import { PortailUtilisateursSectionComponent } from './sections/portail-utilisateurs.component';
import { PortailAppsSectionComponent } from './sections/portail-apps.component';
import { PortailGroupesSectionComponent } from './sections/portail-groupes.component';
import { PortailMetiersSectionComponent } from './sections/portail-metiers.component';

type PortailSection = 'utilisateurs' | 'apps' | 'groupes' | 'metiers';

/**
 * Admin › Portail — gestion de tout ce qui concerne le portail : les comptes
 * utilisateurs (compte, métier, groupes, accès directs), les sous-applications,
 * les groupes qui les regroupent et les métiers. Ce qui est configuré ici
 * pilote directement la page d'accueil.
 */
@Component({
  selector: 'app-admin-portail',
  imports: [
    PortailUtilisateursSectionComponent,
    PortailAppsSectionComponent,
    PortailGroupesSectionComponent,
    PortailMetiersSectionComponent,
  ],
  templateUrl: './admin-portail.component.html'
})
export class AdminPortailComponent {
  section = signal<PortailSection>('utilisateurs');

  readonly sections: { id: PortailSection; label: string; icon: string }[] = [
    { id: 'utilisateurs', label: 'Utilisateurs', icon: 'group' },
    { id: 'apps',         label: 'Applications', icon: 'apps' },
    { id: 'groupes',      label: 'Groupes',      icon: 'category' },
    { id: 'metiers',      label: 'Métiers',      icon: 'badge' },
  ];

  setSection(id: PortailSection) { this.section.set(id); }
}
