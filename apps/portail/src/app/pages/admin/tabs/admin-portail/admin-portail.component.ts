import { Component, signal } from '@angular/core';
import { PortailUtilisateursSectionComponent } from './sections/portail-utilisateurs.component';
import { PortailAppsSectionComponent } from './sections/portail-apps.component';
import { PortailGroupesSectionComponent } from './sections/portail-groupes.component';
import { PortailMetiersSectionComponent } from './sections/portail-metiers.component';
import { PortailExportSectionComponent } from './sections/portail-export.component';
import { PortailConfigSectionComponent } from './sections/portail-config.component';

type PortailSection = 'utilisateurs' | 'groupes' | 'metiers' | 'apps' | 'export' | 'config';

/**
 * Admin › Portail — gestion de tout ce qui concerne le portail : les comptes
 * utilisateurs (compte, métier, groupes, accès directs), les sous-applications,
 * les groupes qui les regroupent et les métiers. Ce qui est configuré ici
 * pilote directement la page d'accueil.
 *
 * Les six pages et leur ordre sont ceux de l'autre portail — c'est le même
 * parcours d'administration des deux côtés, aux données près.
 */
@Component({
  selector: 'app-admin-portail',
  imports: [
    PortailUtilisateursSectionComponent,
    PortailAppsSectionComponent,
    PortailGroupesSectionComponent,
    PortailMetiersSectionComponent,
    PortailExportSectionComponent,
    PortailConfigSectionComponent,
  ],
  templateUrl: './admin-portail.component.html'
})
export class AdminPortailComponent {
  section = signal<PortailSection>('utilisateurs');

  readonly sections: { id: PortailSection; label: string; icon: string }[] = [
    { id: 'utilisateurs', label: 'Utilisateurs', icon: 'group' },
    { id: 'groupes',      label: 'Groupes',      icon: 'category' },
    { id: 'metiers',      label: 'Métiers',      icon: 'badge' },
    { id: 'apps',         label: 'Applications', icon: 'apps' },
    { id: 'export',       label: 'Export JSON',  icon: 'data_object' },
    { id: 'config',       label: 'Infos config', icon: 'settings' },
  ];

  setSection(id: PortailSection) { this.section.set(id); }
}
