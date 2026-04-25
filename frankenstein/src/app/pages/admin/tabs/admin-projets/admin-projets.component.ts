import { Component, OnInit, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService, Project } from '../../../../core/services/project.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-admin-projets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-projets.component.html',
})
export class AdminProjetsComponent implements OnInit {
  @Output() count = new EventEmitter<number>();

  projects = signal<Project[]>([]);
  loadingProjects = signal(true);
  projectsError = signal('');
  deletingProjectId = signal<string | null>(null);

  editingProject = signal<Project | null>(null);
  editTitle = '';
  editStatus: 'draft' | 'published' = 'draft';
  savingProject = signal(false);

  constructor(
    private projectService: ProjectService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadProjects();
  }

  async loadProjects() {
    this.loadingProjects.set(true);
    this.projectsError.set('');
    try {
      const list = await this.projectService.getProjects();
      this.projects.set(list);
      this.count.emit(list.length);
    } catch (e: any) {
      this.projectsError.set(e?.error?.error || 'Erreur chargement projets');
    } finally {
      this.loadingProjects.set(false);
    }
  }

  openEditProject(project: Project) {
    this.editingProject.set(project);
    this.editTitle = project.title;
    this.editStatus = project.status;
  }

  closeEditProject() {
    this.editingProject.set(null);
  }

  async saveProject() {
    const proj = this.editingProject();
    if (!proj || !this.editTitle.trim()) return;
    this.savingProject.set(true);
    try {
      await this.projectService.updateProject(proj.id, {
        title: this.editTitle,
        status: this.editStatus
      });
      this.closeEditProject();
      await this.loadProjects();
    } catch (e: any) {
      this.projectsError.set(e?.error?.error || 'Erreur sauvegarde');
    } finally {
      this.savingProject.set(false);
    }
  }

  openProject(id: string) {
    this.router.navigate(['/projets', id]);
  }

  confirmDeleteProject(id: string) { this.deletingProjectId.set(id); }
  cancelDeleteProject() { this.deletingProjectId.set(null); }

  async deleteProject(id: string) {
    try {
      await this.projectService.deleteProject(id);
      this.deletingProjectId.set(null);
      await this.loadProjects();
    } catch (e: any) {
      this.projectsError.set(e?.error?.error || 'Erreur suppression');
      this.deletingProjectId.set(null);
    }
  }

  statusLabel(status: string): string {
    return status === 'published' ? 'Publié' : 'Brouillon';
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
