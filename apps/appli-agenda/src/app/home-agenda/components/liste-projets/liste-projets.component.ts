import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project, User, ProjectStatus, RiskLevel, ProjectMetier } from '../../../../models/project.model';
import { loadFromLocalStorage, saveToLocalStorage, userScopedKey } from '../../../../utils/local-cache';
import { HelpHintComponent } from '../help-hint/help-hint.component';
import { metierBadgeClass } from '../../../../utils/metier-colors';

@Component({
  selector: 'app-liste-projets',
  standalone: true,
  imports: [CommonModule, FormsModule, HelpHintComponent],
  templateUrl: './liste-projets.component.html',
  styleUrls: ['./liste-projets.component.scss']
})
export class ListeProjetsComponent {
  @Input({ required: true }) projects: Project[] = [];
  @Input({ required: true }) users: User[] = [];
  @Input({ required: true }) metiers: ProjectMetier[] = [];
  @Input() selectedProjectId: number | null = null;
  @Output() selectProject = new EventEmitter<Project>();
  @Output() editProject = new EventEmitter<Project>();

  readonly badgeClass = metierBadgeClass;

  activeStatusFilter: 'ALL' | ProjectStatus = 'ALL';
  searchQuery = '';
  selectedDevFilterId: number | null = null;
  // null = tous métiers confondus (voir filteredProjects).
  selectedMetierFilterId: number | null = null;

  // Masquage de la zone (bouton chevron dans l'en-tête), indépendant des filtres ci-dessous.
  // Persisté en localStorage par utilisateur (voir CLAUDE.md — "Persistance en mode dégradé").
  private readonly collapsedCacheKey = userScopedKey('agenda:local-cache:collapsed:liste-projets');
  collapsed = loadFromLocalStorage(this.collapsedCacheKey, false);

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    saveToLocalStorage(this.collapsedCacheKey, this.collapsed);
  }

  /**
   * Personnel proposé dans le filtre : dérivé des développeurs RÉELLEMENT affectés à au moins un
   * projet (project.developers, hydraté côté serveur depuis poportail_users) plutôt que de
   * `this.users` (restreint au groupe portail "Developpeur") — depuis que le métier remplace le
   * filtre groupe dans le formulaire projet, un utilisateur hors de ce groupe (ex: Jean-Michel
   * BONFORT) peut être affecté à un projet et doit donc pouvoir servir de filtre ici aussi, sans
   * quoi il resterait invisible dans cette liste malgré son affectation.
   */
  get assignedPersonnel(): User[] {
    const byId = new Map<number, User>();
    for (const project of this.projects) {
      for (const dev of project.developers) {
        if (!byId.has(dev.id)) byId.set(dev.id, dev);
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`)
    );
  }

  get allProjectsCount(): number { return this.projects.length; }
  get inProgressCount(): number { return this.projects.filter(p => p.status === 'EN_COURS').length; }
  get todoCount(): number { return this.projects.filter(p => p.status === 'A_FAIRE').length; }
  get completedCount(): number { return this.projects.filter(p => p.status === 'TERMINER').length; }

  get filteredProjects(): Project[] {
    return this.projects.filter(p => {
      const matchStatus = this.activeStatusFilter === 'ALL' || p.status === this.activeStatusFilter;
      const matchSearch = !this.searchQuery ||
        p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchDev = !this.selectedDevFilterId ||
        p.developers.some((d: User) => d.id === Number(this.selectedDevFilterId));
      const matchMetier = !this.selectedMetierFilterId ||
        (p.metierIds || []).includes(this.selectedMetierFilterId);
      return matchStatus && matchSearch && matchDev && matchMetier;
    });
  }

  setStatusFilter(status: 'ALL' | ProjectStatus): void {
    this.activeStatusFilter = status;
  }

  filterByDeveloper(devId: unknown): void {
    this.selectedDevFilterId = devId ? Number(devId) : null;
  }

  setMetierFilter(metierId: unknown): void {
    this.selectedMetierFilterId = metierId ? Number(metierId) : null;
  }

  /**
   * Nombre de tâches de CE projet actuellement assignées à ce développeur, en cours ou à venir
   * (statut différent de "Terminé") — une tâche déjà terminée ne représente plus de charge de
   * travail actuelle, elle ne compte donc pas ici (contrairement à devHasAssignedTask côté
   * nouveau-projet.component.ts, qui bloque le retrait d'un développeur même pour une tâche déjà
   * terminée : ce sont deux questions différentes, charge actuelle vs. historique complet).
   */
  devActiveTaskCount(project: Project, devId: number): number {
    return project.tasks.filter(t => t.assignedUserId === devId && t.status !== 'TERMINER').length;
  }

  onSelectProject(project: Project): void {
    this.selectProject.emit(project);
  }

  onEditProject(project: Project, event: Event): void {
    event.stopPropagation();
    this.editProject.emit(project);
  }

  getProjectStatusClass(status: ProjectStatus): string {
    switch (status) {
      case 'EN_COURS': return 'badge-in-progress';
      case 'TERMINER': return 'badge-done';
      case 'A_FAIRE': return 'badge-todo';
      default: return '';
    }
  }

  getProjectStatusLabel(status: ProjectStatus): string {
    switch (status) {
      case 'EN_COURS': return 'En cours';
      case 'TERMINER': return 'Terminé';
      case 'A_FAIRE': return 'À faire';
      default: return '';
    }
  }

  getRiskClass(risk: RiskLevel): string {
    switch (risk) {
      case 'FAIBLE': return 'risk-low';
      case 'MOYEN': return 'risk-medium';
      case 'ELEVE': return 'risk-high';
      default: return 'risk-low';
    }
  }
}