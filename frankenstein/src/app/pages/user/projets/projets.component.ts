import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorgHelpTriggerComponent } from '../../../shared/help/worg-help-trigger.component';
import { Router } from '@angular/router';
import { ProjectService, Project } from '../../../core/services/project.service';

@Component({
  selector: 'app-projets',
  standalone: true,
  imports: [CommonModule, FormsModule, WorgHelpTriggerComponent],
  templateUrl: './projets.component.html',
  styleUrl: './projets.component.scss'
})
export class ProjetsComponent implements OnInit {
  projects = signal<Project[]>([]);
  loading = signal(true);
  error = signal('');

  // Modale nouveau projet
  showNewModal = signal(false);
  newTitle = '';
  newContent = '';
  creating = signal(false);

  // Édition inline
  editingId = signal<string | null>(null);
  editTitle = '';
  editContent = '';
  saving = signal(false);

  // Confirmation suppression
  deletingId = signal<string | null>(null);

  constructor(private projectService: ProjectService, private router: Router) {}

  async ngOnInit() {
    await this.loadProjects();
  }

  async loadProjects() {
    this.loading.set(true);
    this.error.set('');
    try {
      const list = await this.projectService.getProjects();
      this.projects.set(list);
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur lors du chargement des projets');
    } finally {
      this.loading.set(false);
    }
  }

  openNewModal() {
    this.newTitle = '';
    this.newContent = '';
    this.showNewModal.set(true);
  }

  closeNewModal() {
    this.showNewModal.set(false);
  }

  async createProject() {
    if (!this.newTitle.trim()) return;
    this.creating.set(true);
    try {
      const project = await this.projectService.createProject({
        title: this.newTitle.trim(),
        content: this.newContent,
        status: 'draft'
      });
      this.closeNewModal();
      this.router.navigate(['/projets', project.id]);
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur lors de la création');
    } finally {
      this.creating.set(false);
    }
  }

  openProject(id: string) {
    this.router.navigate(['/projets', id]);
  }

  startEdit(project: Project, event: Event) {
    event.stopPropagation();
    this.editingId.set(project.id);
    this.editTitle = project.title;
    this.editContent = project.description || '';
  }

  cancelEdit(event: Event) {
    event.stopPropagation();
    this.editingId.set(null);
  }

  async saveEdit(id: string, event: Event) {
    event.stopPropagation();
    if (!this.editTitle.trim()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.projectService.updateProject(id, {
        title: this.editTitle.trim(),
        description: this.editContent
      });
      this.editingId.set(null);
      await this.loadProjects();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur lors de la sauvegarde');
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(id: string, event: Event) {
    event.stopPropagation();
    this.deletingId.set(id);
  }

  cancelDelete() {
    this.deletingId.set(null);
  }

  async deleteProject(id: string) {
    try {
      await this.projectService.deleteProject(id);
      this.deletingId.set(null);
      await this.loadProjects();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur lors de la suppression');
      this.deletingId.set(null);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  statusLabel(status: string): string {
    return status === 'published' ? 'Publié' : 'Brouillon';
  }
}
