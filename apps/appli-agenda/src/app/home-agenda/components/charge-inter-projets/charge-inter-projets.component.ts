import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HelpHintComponent } from '../help-hint/help-hint.component';
import { Project, User, DayAgendaSlot } from '../../../../models/project.model';
import { loadFromLocalStorage, saveToLocalStorage, userScopedKey } from '../../../../utils/local-cache';

interface DevDayLoad {
  taskCount: number;
  projectCodes: string[];
}

/**
 * Charge d'un développeur, tous projets confondus, sur la période affichée : le planning Gantt
 * (planning-agenda) est scopé à un seul projet à la fois, donc un développeur affecté à deux
 * projets en parallèle n'a nulle part où voir sa charge cumulée ni détecter un chevauchement entre
 * projets. Cette vue additionnelle comble ce trou.
 */
@Component({
  selector: 'app-charge-inter-projets',
  standalone: true,
  imports: [CommonModule, HelpHintComponent],
  templateUrl: './charge-inter-projets.component.html',
  styleUrls: ['./charge-inter-projets.component.scss']
})
export class ChargeInterProjetsComponent {
  @Input({ required: true }) projects: Project[] = [];
  @Input({ required: true }) users: User[] = [];
  @Input({ required: true }) agendaDays: DayAgendaSlot[] = [];

  // Persisté en localStorage par utilisateur (voir CLAUDE.md — "Persistance en mode dégradé").
  private readonly collapsedCacheKey = userScopedKey('agenda:local-cache:collapsed:charge-inter-projets');
  collapsed = loadFromLocalStorage(this.collapsedCacheKey, false);

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    saveToLocalStorage(this.collapsedCacheKey, this.collapsed);
  }

  /** Tâches actives ce jour-là pour ce développeur, tous projets confondus. */
  private activeTasksForDevAndDay(devId: number, dateSql: string): { projectCode: string }[] {
    const active: { projectCode: string }[] = [];
    for (const project of this.projects) {
      for (const task of project.tasks || []) {
        if (task.assignedUserId === devId && task.dateStart <= dateSql && task.dateEnd >= dateSql) {
          active.push({ projectCode: project.code });
        }
      }
    }
    return active;
  }

  loadForDevAndDay(devId: number, dateSql: string): DevDayLoad {
    const active = this.activeTasksForDevAndDay(devId, dateSql);
    const projectCodes = Array.from(new Set(active.map(a => a.projectCode)));
    return { taskCount: active.length, projectCodes };
  }

  /** Vrai si ce jour-là, le développeur a des tâches actives sur PLUSIEURS projets distincts. */
  isOverloaded(devId: number, dateSql: string): boolean {
    return this.loadForDevAndDay(devId, dateSql).projectCodes.length > 1;
  }

  cellTooltip(devId: number, dateSql: string): string {
    const load = this.loadForDevAndDay(devId, dateSql);
    if (load.taskCount === 0) return '';
    return load.projectCodes.length > 1
      ? `⚠️ ${load.taskCount} tâche(s) réparties sur ${load.projectCodes.length} projets : ${load.projectCodes.join(', ')}`
      : `${load.taskCount} tâche(s) — ${load.projectCodes[0]}`;
  }

  /** Nombre total de jours en chevauchement inter-projets pour ce développeur, sur la période affichée. */
  overloadedDaysCount(devId: number): number {
    return this.agendaDays.filter(day => this.isOverloaded(devId, day.dateSql)).length;
  }
}
