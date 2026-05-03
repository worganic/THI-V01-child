import { Component, OnInit, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService, Project } from '../../../../core/services/project.service';
import { AuthService } from '../../../../core/services/auth.service';
import { WoActionHistoryService } from '../../../../core/services/wo-action-history.service';

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

  private woHistory = inject(WoActionHistoryService);

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
    const beforeState = { title: proj.title, status: proj.status };
    const newTitle = this.editTitle.trim();
    try {
      await this.projectService.updateProject(proj.id, {
        title: newTitle,
        status: this.editStatus
      });
      this.woHistory.track({
        section: 'projets',
        actionType: 'update',
        label: `Modification du projet «${newTitle}» (admin)`,
        entityType: 'project',
        entityId: proj.id,
        entityLabel: newTitle,
        beforeState: beforeState,
        afterState: { title: newTitle, status: this.editStatus },
        undoable: true,
        undoAction: { endpoint: `/api/frank/projects/${proj.id}`, method: 'PUT', payload: beforeState }
      }).catch(() => {});
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
    const proj = this.projects().find(p => p.id === id);
    try {
      await this.projectService.deleteProject(id);
      this.woHistory.track({
        section: 'projets',
        actionType: 'delete',
        label: `Suppression du projet «${proj?.title || id}» (admin)`,
        entityType: 'project',
        entityId: id,
        entityLabel: proj?.title,
        beforeState: proj ? { title: proj.title, status: proj.status } : undefined,
        undoable: false
      }).catch(() => {});
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
