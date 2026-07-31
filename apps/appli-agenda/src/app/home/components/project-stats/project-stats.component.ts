import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HelpHintComponent } from '../help-hint/help-hint.component';
import { Project, ProjectTask, TaskStatus, User } from '../../../core/models/project.model';
import { recomputeTaskSchedule } from '../../../core/utils/task-progress';
import { toCsv, downloadCsv } from '../../../core/utils/csv-export';
import { loadFromLocalStorage, saveToLocalStorage, userScopedKey } from '../../../core/utils/local-cache';

interface StatusCount {
  status: TaskStatus;
  label: string;
  count: number;
  percent: number;
}

interface DevStats {
  dev: User;
  taskCount: number;
  plannedHalfDays: number;
  workedHalfDays: number;
  remainingHalfDays: number;
  progressPercent: number;
  lateHalfDays: number;
}

const STATUS_DEFS: { status: TaskStatus; label: string }[] = [
  { status: 'NON_COMMENCE', label: 'Non commencé' },
  { status: 'EN_ATTENTE', label: 'En attente' },
  { status: 'EN_COURS', label: 'En cours' },
  { status: 'TERMINER', label: 'Terminé' }
];

@Component({
  selector: 'app-project-stats',
  standalone: true,
  imports: [CommonModule, HelpHintComponent],
  templateUrl: './project-stats.component.html',
  styleUrls: ['./project-stats.component.scss']
})
export class ProjectStatsComponent {
  @Input() project: Project | null = null;

  // Masquage de la zone (bouton chevron dans l'en-tête), persisté en localStorage par utilisateur
  // (voir CLAUDE.md — "Persistance en mode dégradé") pour retrouver le même état après un F5.
  private readonly collapsedCacheKey = userScopedKey('agenda:local-cache:collapsed:stats');
  collapsed = loadFromLocalStorage(this.collapsedCacheKey, false);

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    saveToLocalStorage(this.collapsedCacheKey, this.collapsed);
  }

  get totalTasks(): number {
    return this.project?.tasks.length || 0;
  }

  get statusCounts(): StatusCount[] {
    const tasks = this.project?.tasks || [];
    const total = tasks.length || 1;
    return STATUS_DEFS.map(d => {
      const count = tasks.filter(t => t.status === d.status).length;
      return { status: d.status, label: d.label, count, percent: Math.round((count / total) * 100) };
    });
  }

  get totalPlannedHalfDays(): number {
    return (this.project?.tasks || []).reduce((sum, t) => sum + t.halfDaysDuration, 0);
  }

  get totalWorkedHalfDays(): number {
    return (this.project?.tasks || []).reduce(
      (sum, t) => sum + Math.min((t.workedHalfDays || []).length, t.halfDaysDuration),
      0
    );
  }

  get totalRemainingHalfDays(): number {
    return Math.max(0, this.totalPlannedHalfDays - this.totalWorkedHalfDays);
  }

  get globalProgressPercent(): number {
    return this.totalPlannedHalfDays > 0
      ? Math.round((this.totalWorkedHalfDays / this.totalPlannedHalfDays) * 100)
      : 0;
  }

  /** Demi-journées manquantes cumulées, tous devs confondus (jours déjà passés non validés). */
  get totalLateHalfDays(): number {
    if (!this.project) return 0;
    return this.project.tasks.reduce((sum, t) => {
      const { missingHalfDays } = recomputeTaskSchedule(t, this.project);
      return sum + missingHalfDays;
    }, 0);
  }

  get devStats(): DevStats[] {
    if (!this.project) return [];
    const project = this.project;
    return project.developers.map(dev => {
      const tasks = project.tasks.filter((t: ProjectTask) => t.assignedUserId === dev.id);
      const plannedHalfDays = tasks.reduce((sum, t) => sum + t.halfDaysDuration, 0);
      const workedHalfDays = tasks.reduce(
        (sum, t) => sum + Math.min((t.workedHalfDays || []).length, t.halfDaysDuration),
        0
      );
      const remainingHalfDays = Math.max(0, plannedHalfDays - workedHalfDays);
      const progressPercent = plannedHalfDays > 0 ? Math.round((workedHalfDays / plannedHalfDays) * 100) : 0;
      const lateHalfDays = tasks.reduce((sum, t) => {
        const { missingHalfDays } = recomputeTaskSchedule(t, project);
        return sum + missingHalfDays;
      }, 0);
      return { dev, taskCount: tasks.length, plannedHalfDays, workedHalfDays, remainingHalfDays, progressPercent, lateHalfDays };
    });
  }

  /** Référence commune pour dimensionner les barres du graphique de charge par développeur. */
  get maxPlannedHalfDaysAcrossDevs(): number {
    return Math.max(1, ...this.devStats.map(d => d.plannedHalfDays), 0);
  }

  chartWorkedWidthPercent(stats: DevStats): number {
    return (stats.workedHalfDays / this.maxPlannedHalfDaysAcrossDevs) * 100;
  }

  chartRemainingWidthPercent(stats: DevStats): number {
    return (stats.remainingHalfDays / this.maxPlannedHalfDaysAcrossDevs) * 100;
  }

  /** Export CSV du tableau "Charge de travail par développeur" affiché juste au-dessus. */
  exportDevWorkloadCsv(): void {
    if (!this.project) return;
    const project = this.project;

    const headers = ['Développeur', 'Tâches', 'Prévu (demi-j)', 'Travaillé (demi-j)', 'Restant (demi-j)', 'Avancement (%)', 'Retard (demi-j)'];
    const rows = this.devStats.map(s => [
      `${s.dev.firstname} ${s.dev.lastname}`,
      s.taskCount,
      s.plannedHalfDays,
      s.workedHalfDays,
      s.remainingHalfDays,
      s.progressPercent,
      s.lateHalfDays
    ]);

    downloadCsv(`${project.code}-charge-developpeurs.csv`, toCsv(headers, rows));
  }
}
