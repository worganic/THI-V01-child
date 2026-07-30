import { Component, Input, Output, EventEmitter, NgZone, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HelpHintComponent } from '../help-hint/help-hint.component';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Project, User, DayAgendaSlot, PlanningViewMode, ProjectTask, UnavailabilityPeriod, CreateTaskPayload, UpdateTaskPayload } from '../../../../models/project.model';
import { TaskModalComponent } from '../task-modal/task-modal.component';
import { dateRejectionReason, isDateAllowed, isExcludedWeekend, isExcludedHoliday, TODAY_ISO } from '../../../../utils/date-rules';
import { recomputeTaskSchedule, halfDayKey, allowedDaysInRange } from '../../../../utils/task-progress';
import { taskAccentColor } from '../../../../utils/task-colors';
import { toCsv, downloadCsv } from '../../../../utils/csv-export';
import { loadFromLocalStorage, saveToLocalStorage, userScopedKey } from '../../../../utils/local-cache';

/** Nombre de jours (inclusif) entre deux dates ISO YYYY-MM-DD. */
function daysBetween(dateStartIso: string, dateEndIso: string): number {
  const start = new Date(dateStartIso);
  const end = new Date(dateEndIso);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Un "segment" représente le rendu d'une tâche pour une case développeur × jour : soit une
 * portion réelle de la barre continue (avec cases à cocher), soit un simple passage gris
 * (week-end/jour férié traversé par la tâche, sans travail possible ce jour-là).
 */
interface TaskDaySegment {
  task: ProjectTask;
  isConnector: boolean;
  showTitle: boolean;
  isFirstOfSpan: boolean;
  isLastOfSpan: boolean;
  // Largeur (px) sur laquelle le titre doit "couler" sans coupure par-dessus les tuiles
  // suivantes (jusqu'à la fin de la tâche, la prochaine réapparition hebdomadaire du titre,
  // ou le bord de la grille visible). Calculée à partir de dayColumnPx (largeur dynamique).
  titleWidthPx: number;
}


@Component({
  selector: 'app-planning-agenda',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, TaskModalComponent, HelpHintComponent],
  templateUrl: './planning-agenda.component.html',
  styleUrls: ['./planning-agenda.component.scss']
})
export class PlanningAgendaComponent implements AfterViewInit, OnChanges {
  private zone = inject(NgZone);

  // Conteneur scrollable de la grille jour : mesuré pour calculer dynamiquement la largeur des
  // colonnes (voir recomputeDayColumnPx), afin que tous les jours affichés tiennent sur l'écran
  // sans ascenseur horizontal plutôt que d'utiliser une largeur fixe qui déborderait.
  @ViewChild('ganttScrollContainer') private ganttScrollContainerRef?: ElementRef<HTMLDivElement>;

  @Input({ required: true }) selectedProject: Project | null = null;
  @Input({ required: true }) users: User[] = [];
  @Input({ required: true }) agendaDays: DayAgendaSlot[] = [];
  // Vue mois uniquement : second mois affiché côte à côte (voir HomeAgendaComponent.monthDisplayCount).
  // Vide (tableau par défaut) tant qu'un seul mois est demandé.
  @Input() agendaDaysMonth2: DayAgendaSlot[] = [];
  @Input() monthDisplayCount: 1 | 2 = 1;
  // Congés/absences par développeur, indépendantes du projet affiché : surimpression sur le Gantt
  // (isDevUnavailable) et avertissement dans le modal de tâche (voir task-modal.component.ts).
  @Input() unavailabilities: UnavailabilityPeriod[] = [];

  // Navigation du planning (mois affiché, plage de jours, avant/après) : l'état vit dans le
  // composant parent (home-agenda), affiché ici juste au-dessus de la grille qu'il pilote.
  @Input() viewRangeLabel = '';
  @Input() rangeOptions: { label: string }[] = [];
  @Input() selectedRangeIndex = 0;
  @Input() viewMode: PlanningViewMode = 'days';
  @Output() viewModeChanged = new EventEmitter<PlanningViewMode>();
  // Vue mois uniquement : bascule 1/2 mois affichés côte à côte (voir monthDisplayCount).
  @Output() monthDisplayCountChanged = new EventEmitter<1 | 2>();
  @Output() rangeChanged = new EventEmitter<number>();
  @Output() previousRequested = new EventEmitter<void>();
  @Output() nextRequested = new EventEmitter<void>();
  // Pas fin (vue jour uniquement) : avance/recule d'un seul jour calendaire, contrairement aux
  // flèches précédent/suivant ci-dessus qui sautent d'une demi-fenêtre affichée.
  @Output() previousDayRequested = new EventEmitter<void>();
  @Output() nextDayRequested = new EventEmitter<void>();
  @Output() todayRequested = new EventEmitter<void>();

  @Output() taskStatusChanged = new EventEmitter<{ taskId: number; newStatus: ProjectTask['status'] }>();
  @Output() taskCreateRequested = new EventEmitter<{ projectId: number; payload: CreateTaskPayload }>();
  @Output() taskUpdateRequested = new EventEmitter<UpdateTaskPayload>();
  @Output() taskDeleteRequested = new EventEmitter<number>();
  // Retrait rapide d'un développeur depuis sa tuile de la colonne fixe du Gantt — voir
  // removeDevFromProject, uniquement proposé quand il n'a encore aucune tâche sur ce projet.
  @Output() devRemovalRequested = new EventEmitter<{ projectId: number; devId: number }>();

  taskModalOpen = false;
  editingTask: ProjectTask | null = null;
  // Bandeau d'erreur intégré à l'UI (pas de alert() natif, qui bloque l'automatisation/les tests).
  dropRejectionMessage: string | null = null;
  private dropRejectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Popup "sous-tâches" ouvert quand on coche une demi-journée sur une tâche qui en a.
  subtaskPopupTask: ProjectTask | null = null;
  // Date de la demi-journée qui a ouvert le popup : c'est cette date qui est enregistrée comme
  // date de validation d'une sous-tâche qu'on coche depuis ce popup (jamais saisie manuellement).
  private subtaskPopupDateSql: string | null = null;

  // Masquage de la zone (bouton chevron dans l'en-tête), persisté en localStorage par utilisateur
  // (voir CLAUDE.md — "Persistance en mode dégradé").
  private readonly collapsedCacheKey = userScopedKey('agenda:local-cache:collapsed:planning');
  collapsed = loadFromLocalStorage(this.collapsedCacheKey, false);

  // Id de la tâche survolée : assombrit TOUS ses segments (même sur des jours différents), pas
  // seulement la tuile sous le curseur, pour repérer l'étendue complète de la barre continue.
  hoveredTaskId: number | null = null;

  onTaskHoverStart(taskId: number): void {
    this.hoveredTaskId = taskId;
  }

  onTaskHoverEnd(): void {
    this.hoveredTaskId = null;
  }

  /**
   * Tâche dont les dates sont figées : Terminée, ou au moins une demi-journée déjà validée (voir
   * le même garde-fou dans onTaskDropped). Désactive le glisser dès la tuile, pour ne pas laisser
   * l'utilisateur croire qu'un déplacement va fonctionner avant de se le voir refuser au dépôt.
   */
  isTaskDateLocked(task: ProjectTask): boolean {
    return task.status === 'TERMINER' || (task.workedHalfDays?.length ?? 0) > 0;
  }

  /**
   * Répartition des tâches du projet actif pour un développeur : total, terminées, en cours ou à
   * venir (tout statut autre que Terminé). Sert à la fois au badge de charge de la colonne
   * développeur et à mettre son nom en gras s'il a encore quelque chose à faire sur ce projet.
   */
  devTaskStats(devId: number): { total: number; completed: number; active: number } {
    const tasks = (this.selectedProject?.tasks || []).filter(t => t.assignedUserId === devId);
    const completed = tasks.filter(t => t.status === 'TERMINER').length;
    return { total: tasks.length, completed, active: tasks.length - completed };
  }

  /**
   * Retire un développeur du projet directement depuis sa tuile de la colonne fixe — le template
   * ne propose le bouton que si devTaskStats(devId).total === 0, revérifié ici en filet de
   * sécurité (même règle que devHasAssignedTask côté nouveau-projet.component.ts : un développeur
   * ayant au moins une tâche, terminée ou non, ne peut pas être retiré).
   */
  removeDevFromProject(devId: number): void {
    if (!this.selectedProject) return;
    if (this.devTaskStats(devId).total > 0) return;
    this.devRemovalRequested.emit({ projectId: this.selectedProject.id, devId });
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    saveToLocalStorage(this.collapsedCacheKey, this.collapsed);
    // Le conteneur (@if) sort/rentre du DOM : le ViewChild n'est réévalué qu'après le prochain
    // rendu, d'où le report via setTimeout plutôt qu'un recalcul immédiat (container serait encore
    // absent/obsolète à cet instant précis).
    if (!this.collapsed) {
      setTimeout(() => this.recomputeDayColumnPx());
    }
  }

  onRangeChanged(index: number): void {
    this.rangeChanged.emit(Number(index));
  }

  // ==========================================================================
  // VUE MOIS (calendrier) — même jeu de données que la vue jour (agendaDays), simplement
  // découpé en semaines de 7 et rendu en cases plutôt qu'en barres continues.
  // ==========================================================================

  /** En-tête du calendrier : semaine commençant le lundi (L M M J V S D). */
  readonly monthWeekDayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  /** Nombre de lanes affichées par case avant repli sous un bouton « +N » (par semaine). */
  // Tuiles plus hautes (même format que la vue jour : titre + cases à cocher) qu'en vue jour :
  // 2 par case avant repli, sinon la grille du mois deviendrait démesurément haute.
  private readonly MONTH_MAX_VISIBLE_LANES = 2;

  /** Semaines dépliées via « +N » (clés = dateSql du lundi de la semaine), pour afficher toutes leurs lanes. */
  private expandedMonthWeeks = new Set<string>();

  /** Découpe une grille de mois (fournie par le parent) en lignes de 7 jours. */
  private weeksFor(days: DayAgendaSlot[]): DayAgendaSlot[][] {
    const weeks: DayAgendaSlot[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }

  get monthWeeks(): DayAgendaSlot[][] {
    return this.weeksFor(this.agendaDays);
  }

  /** Second mois affiché côte à côte (voir agendaDaysMonth2) — vide si monthDisplayCount === 1. */
  get monthWeeksMonth2(): DayAgendaSlot[][] {
    return this.weeksFor(this.agendaDaysMonth2);
  }

  private static readonly MONTH_NAMES_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  /**
   * Intitulé ("Juillet 2026") affiché au-dessus de chacun des calendriers en mode 2 mois — dérivé
   * du premier jour APPARTENANT réellement au mois (pas un jour de complément isOutsideMonth, qui
   * peut appartenir au mois précédent) plutôt que d'un @Input dédié, pour ne pas dupliquer une
   * donnée déjà présente dans agendaDays/agendaDaysMonth2.
   */
  monthCalendarLabel(days: DayAgendaSlot[]): string {
    const anchor = days.find(d => !d.isOutsideMonth) ?? days[0];
    if (!anchor) return '';
    const [year, month] = anchor.dateSql.split('-').map(Number);
    return `${PlanningAgendaComponent.MONTH_NAMES_FR[month - 1]} ${year}`;
  }

  monthCellId(dateSql: string): string {
    return `month-cell-${dateSql}`;
  }

  // Grisé "jour non travaillé" des colonnes/cases : passe par les mêmes fonctions que la
  // planification (donc par la date d'entrée en vigueur de la règle) au lieu de tester le
  // drapeau brut du projet. Sans ça, cocher « pas de week-end » repeignait aussi les samedis
  // et dimanches DÉJÀ travaillés, qui continuent pourtant d'afficher leurs tuiles.
  showsExcludedWeekend(day: DayAgendaSlot): boolean {
    return isExcludedWeekend(day.dateSql, this.selectedProject);
  }

  showsExcludedHoliday(day: DayAgendaSlot): boolean {
    return isExcludedHoliday(day.dateSql, this.selectedProject);
  }

  /**
   * Tâches actives ce jour-là, tous développeurs confondus (la vue mois n'a pas de ligne par
   * développeur). Même règle que la vue jour : une case week-end/férié exclue par le projet reste
   * vide, même si une tâche multi-jours la traverse. Sert aussi de source de données au CDK
   * (cdkDropListData) — l'ordre n'a plus d'importance pour l'affichage, qui passe par les lanes.
   */
  getTasksForDay(project: Project, dateSql: string): ProjectTask[] {
    if (!project || !project.tasks) return [];
    if (!isDateAllowed(dateSql, project)) return [];
    return project.tasks.filter((t: ProjectTask) => t.dateStart <= dateSql && t.dateEnd >= dateSql);
  }

  /**
   * Attribue à chaque tâche active au moins un jour de la semaine une "lane" (rang d'empilement)
   * stable sur toute la semaine affichée : comme dans la grille Gantt (computeDevLanes), une même
   * tâche garde ainsi la même ligne verticale d'un jour à l'autre au lieu de "remonter" dès qu'une
   * autre tâche active seulement certains jours de la semaine se termine.
   */
  private computeWeekLanes(project: Project, week: DayAgendaSlot[]): Map<number, number> {
    const laneByTaskId = new Map<number, number>();
    if (!project?.tasks || week.length === 0) return laneByTaskId;
    const weekStart = week[0].dateSql;
    const weekEnd = week[week.length - 1].dateSql;

    const tasks = project.tasks
      .filter(t => t.dateStart <= weekEnd && t.dateEnd >= weekStart)
      .sort((a, b) =>
        (a.dateStart < b.dateStart ? -1 : a.dateStart > b.dateStart ? 1 : 0) ||
        (a.assignedUserId ?? 0) - (b.assignedUserId ?? 0) ||
        a.id - b.id
      );

    const laneEndDates: string[] = [];
    for (const task of tasks) {
      let lane = laneEndDates.findIndex(endDate => endDate < task.dateStart);
      if (lane === -1) {
        lane = laneEndDates.length;
        laneEndDates.push(task.dateEnd);
      } else {
        laneEndDates[lane] = task.dateEnd;
      }
      laneByTaskId.set(task.id, lane);
    }
    return laneByTaskId;
  }

  private weekKey(week: DayAgendaSlot[]): string | null {
    return week[0]?.dateSql ?? null;
  }

  private weekLaneCount(project: Project, week: DayAgendaSlot[]): number {
    const laneByTaskId = this.computeWeekLanes(project, week);
    return laneByTaskId.size > 0 ? Math.max(...laneByTaskId.values()) + 1 : 0;
  }

  private visibleLaneCountForWeek(project: Project, week: DayAgendaSlot[]): number {
    const laneCount = this.weekLaneCount(project, week);
    if (this.isWeekExpanded(week)) return laneCount;
    return Math.min(laneCount, this.MONTH_MAX_VISIBLE_LANES);
  }

  /**
   * Lanes à afficher pour un jour de la semaine : tableau à taille fixe (nombre de lanes VISIBLES
   * cette semaine), chaque case contenant soit la tâche occupant cette lane ce jour-là, soit `null`
   * (lane réservée mais inoccupée ce jour précis, pour garder l'alignement vertical entre jours).
   */
  visibleTaskLanesForDay(project: Project, week: DayAgendaSlot[], dateSql: string): (ProjectTask | null)[] {
    if (!project?.tasks) return [];
    if (!isDateAllowed(dateSql, project)) return [];

    const laneByTaskId = this.computeWeekLanes(project, week);
    const visibleCount = this.visibleLaneCountForWeek(project, week);
    const lanes: (ProjectTask | null)[] = new Array(visibleCount).fill(null);

    const activeTasks = project.tasks.filter(t => t.dateStart <= dateSql && t.dateEnd >= dateSql);
    for (const task of activeTasks) {
      const lane = laneByTaskId.get(task.id);
      if (lane !== undefined && lane < visibleCount) lanes[lane] = task;
    }
    return lanes;
  }

  /** Nombre de tâches actives ce jour-là dans une lane au-delà du seuil replié (indépendant de
   *  l'état déplié, pour savoir sur quelles cases précises afficher « +N » et « Réduire »). */
  private extraLaneTaskCountForDay(project: Project, week: DayAgendaSlot[], dateSql: string): number {
    if (!project?.tasks) return 0;
    if (!isDateAllowed(dateSql, project)) return 0;
    const laneByTaskId = this.computeWeekLanes(project, week);
    return project.tasks.filter(t => {
      if (!(t.dateStart <= dateSql && t.dateEnd >= dateSql)) return false;
      const lane = laneByTaskId.get(t.id);
      return lane !== undefined && lane >= this.MONTH_MAX_VISIBLE_LANES;
    }).length;
  }

  /** Nombre de tâches masquées ce jour-là (dans des lanes repliées sous le bouton « +N »). */
  hiddenLaneTaskCountForDay(project: Project, week: DayAgendaSlot[], dateSql: string): number {
    if (this.isWeekExpanded(week)) return 0;
    return this.extraLaneTaskCountForDay(project, week, dateSql);
  }

  /**
   * « Réduire » n'apparaît que sur les cases qui avaient effectivement une tâche dans une lane
   * repliée (symétrique à « +N ») : évite de répéter le bouton sur les 7 jours de la semaine
   * dépliée alors qu'un seul suffit pour la replier.
   */
  showCollapseButtonForDay(project: Project, week: DayAgendaSlot[], dateSql: string): boolean {
    return this.isWeekExpanded(week) && this.extraLaneTaskCountForDay(project, week, dateSql) > 0;
  }

  isWeekExpanded(week: DayAgendaSlot[]): boolean {
    const key = this.weekKey(week);
    return key !== null && this.expandedMonthWeeks.has(key);
  }

  toggleWeekExpanded(week: DayAgendaSlot[], event: Event): void {
    event.stopPropagation();
    const key = this.weekKey(week);
    if (key === null) return;
    if (this.expandedMonthWeeks.has(key)) {
      this.expandedMonthWeeks.delete(key);
    } else {
      this.expandedMonthWeeks.add(key);
    }
  }

  /** Nom du développeur assigné, pour l'infobulle des pastilles du calendrier. */
  assignedUserLabel(task: ProjectTask): string {
    const dev = this.users.find(u => u.id === task.assignedUserId)
      || this.selectedProject?.developers.find(d => d.id === task.assignedUserId);
    return dev ? `${dev.firstname} ${dev.lastname}` : 'Non assignée';
  }

  monthChipTooltip(task: ProjectTask): string {
    return `${task.name} — ${this.assignedUserLabel(task)} — ${this.remainingHalfDays(task)} demi-j restante(s)`;
  }

  /**
   * Couleur d'accent stable pour une tâche (bandeau sous la tuile en vue mois) : deux tâches
   * peuvent partager la même couleur de statut (ex: toutes deux "En cours") sans être la même
   * tâche — ce bandeau, propre à chaque id, permet de suivre une tâche précise d'un jour à l'autre.
   * Partagée avec le modal d'édition (utils/task-colors.ts) pour que son contour reprenne la même
   * couleur que la tâche ouverte.
   */
  taskAccentColor(task: ProjectTask): string {
    return taskAccentColor(task);
  }

  /**
   * Déplacement d'une tâche dans le calendrier mensuel : seule la date de début change, le
   * développeur assigné reste celui de la tâche (la vue mois ne porte pas cette dimension).
   */
  onMonthTaskDropped(event: CdkDragDrop<ProjectTask[]>, targetDateSql: string): void {
    const task: ProjectTask = event.item.data;
    if (!task) return;
    this.onTaskDropped(event, task.assignedUserId ?? null, targetDateSql);
  }

  /** Nom + statut de la tâche prérequise d'une tâche, pour l'infobulle du repère ⛓️ sur sa tuile. */
  blockingTaskTooltip(task: ProjectTask): string {
    if (!task.parentTaskId || !this.selectedProject) return '';
    const blocker = this.selectedProject.tasks.find(t => t.id === task.parentTaskId);
    if (!blocker) return '';
    const doneLabel = blocker.status === 'TERMINER' ? 'terminée' : 'pas encore terminée';
    return `Dépend de « ${blocker.name} » (${doneLabel})`;
  }

  /** Vrai si ce développeur a une période de congé/absence couvrant cette date. */
  isDevUnavailable(devId: number, dateSql: string): boolean {
    return this.unavailabilities.some(u => u.userId === devId && u.dateStart <= dateSql && u.dateEnd >= dateSql);
  }

  /** Raison(s) d'indisponibilité de ce développeur ce jour-là, pour l'infobulle de la case grisée. */
  devUnavailabilityTooltip(devId: number, dateSql: string): string {
    const periods = this.unavailabilities.filter(u => u.userId === devId && u.dateStart <= dateSql && u.dateEnd >= dateSql);
    if (periods.length === 0) return '';
    return periods.map(p => p.reason || 'Indisponible').join(', ');
  }

  getTasksForDevAndDay(project: Project, devId: number, dateSql: string): ProjectTask[] {
    if (!project || !project.tasks) return [];
    // Case week-end/jour férié exclue par le projet : elle doit rester vide, même si une tâche
    // multi-jours chevauche chronologiquement cette date (elle "saute" ce jour visuellement).
    if (!isDateAllowed(dateSql, project)) return [];
    return project.tasks.filter((t: ProjectTask) =>
      t.assignedUserId === devId &&
      t.dateStart <= dateSql &&
      t.dateEnd >= dateSql
    );
  }

  /**
   * Segments à afficher pour une case développeur × jour : une tâche multi-jours forme une seule
   * barre continue (pas une carte par jour), interrompue visuellement en gris sur les week-ends
   * et jours fériés qu'elle traverse. Le titre n'apparaît qu'une fois par semaine (ou au tout
   * début de la barre), les jours suivants ne montrent que les cases à cocher.
   */
  getTaskSegmentsForDevAndDay(project: Project, devId: number, dateSql: string): (TaskDaySegment | null)[] {
    if (!project || !project.tasks) return [];
    const dayIndex = this.agendaDays.findIndex(d => d.dateSql === dateSql);
    const laneByTaskId = this.computeDevLanes(project, devId);
    const laneCount = laneByTaskId.size > 0 ? Math.max(...laneByTaskId.values()) + 1 : 0;

    // Tableau à taille fixe (nombre total de lanes du développeur, tous jours confondus) : une
    // tâche garde toujours la même lane sur toute sa durée, même quand une autre tâche voisine
    // se termine — sinon la barre "remonte" visuellement dès qu'une place au-dessus se libère.
    const lanes: (TaskDaySegment | null)[] = new Array(laneCount).fill(null);
    const activeTasks = project.tasks.filter((t: ProjectTask) =>
      t.assignedUserId === devId &&
      t.dateStart <= dateSql &&
      t.dateEnd >= dateSql
    );
    for (const task of activeTasks) {
      const lane = laneByTaskId.get(task.id) ?? 0;
      const isConnector = !isDateAllowed(dateSql, project);
      const isFirstOfSpan = this.isFirstSegmentDay(task, dayIndex);
      const isLastOfSpan = this.isLastSegmentDay(task, dayIndex);
      const isMonday = new Date(dateSql).getDay() === 1;
      const showTitle = !isConnector && (isFirstOfSpan || isMonday);
      const titleWidthPx = showTitle ? this.computeTitleFlowWidthPx(task, dayIndex) : 0;
      lanes[lane] = { task, isConnector, showTitle, isFirstOfSpan, isLastOfSpan, titleWidthPx };
    }
    return lanes;
  }

  /**
   * Attribue à chaque tâche d'un développeur une "lane" (rang d'empilement) stable sur toute sa
   * durée : tri par date de début, puis affectation gloutonne à la première lane déjà libre à
   * cette date (algorithme classique d'allocation d'intervalles, comme dans un vrai Gantt).
   */
  private computeDevLanes(project: Project, devId: number): Map<number, number> {
    const laneByTaskId = new Map<number, number>();
    const tasks = (project.tasks || [])
      .filter(t => t.assignedUserId === devId)
      .sort((a, b) => (a.dateStart < b.dateStart ? -1 : a.dateStart > b.dateStart ? 1 : a.id - b.id));

    const laneEndDates: string[] = [];
    for (const task of tasks) {
      let lane = laneEndDates.findIndex(endDate => endDate < task.dateStart);
      if (lane === -1) {
        lane = laneEndDates.length;
        laneEndDates.push(task.dateEnd);
      } else {
        laneEndDates[lane] = task.dateEnd;
      }
      laneByTaskId.set(task.id, lane);
    }
    return laneByTaskId;
  }

  // ==========================================================================
  // LARGEUR DYNAMIQUE DES COLONNES JOUR : tous les jours affichés doivent tenir sur l'écran sans
  // ascenseur horizontal, quelle que soit la plage choisie (5/15/30 jours...). La largeur de
  // colonne est donc recalculée (pas une constante fixe) à partir de la largeur réellement
  // disponible dans le conteneur, divisée par le nombre de jours affichés — avec un plancher
  // (colonnes toujours utilisables) et un plafond (pas de colonnes démesurées quand peu de jours
  // sont affichés). Si la plage est trop dense pour tenir même au plancher (ex: 5 mois), un
  // ascenseur horizontal réapparaît naturellement : c'est le compromis accepté au-delà du plancher.
  // ==========================================================================

  /** Largeur effective (px) d'une colonne jour, recalculée par recomputeDayColumnPx(). */
  dayColumnPx = 90;

  private readonly DEV_COLUMN_PX = 180; // doit rester synchronisée avec .col-fixed-dev en SCSS
  private readonly MIN_DAY_COLUMN_PX = 42; // sous ce seuil, cases à cocher illisibles
  private readonly MAX_DAY_COLUMN_PX = 130; // évite des colonnes démesurées pour une plage courte (5 jours)
  // En-dessous de ce seuil, la case "X demi-j" est masquée (voir isCompactDayColumn) : plus assez
  // de place pour case à cocher + texte + case à cocher sur la même ligne.
  private readonly COMPACT_DAY_COLUMN_PX = 56;

  ngAfterViewInit(): void {
    this.recomputeDayColumnPx();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['agendaDays'] || changes['viewMode']) {
      // Recalcul immédiat (cas courant : le conteneur existe déjà, seul le nombre de jours change)
      // + un recalcul différé (cas viewMode 'month' → 'days' : le conteneur vient de rentrer dans
      // le DOM via @if et n'est pas encore accessible au moment précis où ngOnChanges s'exécute).
      this.recomputeDayColumnPx();
      setTimeout(() => this.recomputeDayColumnPx());
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.recomputeDayColumnPx();
  }

  /** Vrai si la colonne est trop étroite pour afficher le texte "X demi-j" à côté des cases à cocher. */
  get isCompactDayColumn(): boolean {
    return this.dayColumnPx < this.COMPACT_DAY_COLUMN_PX;
  }

  private recomputeDayColumnPx(): void {
    if (this.viewMode !== 'days') return;
    const container = this.ganttScrollContainerRef?.nativeElement;
    if (!container || this.agendaDays.length === 0) return;

    // Marge de sécurité (8px) contre les arrondis de bordures de table qui déclencheraient
    // l'ascenseur horizontal pour un dépassement de 1px.
    const availableForDays = container.clientWidth - this.DEV_COLUMN_PX - 8;
    const ideal = Math.floor(availableForDays / this.agendaDays.length);
    const clamped = Math.max(this.MIN_DAY_COLUMN_PX, Math.min(this.MAX_DAY_COLUMN_PX, ideal));

    if (clamped !== this.dayColumnPx) {
      this.dayColumnPx = clamped;
    }
  }

  /**
   * Nombre de tuiles (x dayColumnPx) sur lesquelles le titre affiché à `dayIndex` doit s'étendre
   * sans interruption : il couvre les jours suivants tant qu'ils appartiennent à la même tâche
   * (y compris les passages gris week-end/férié), jusqu'à la fin de la tâche, jusqu'au lundi
   * suivant (nouvelle réapparition hebdomadaire du titre) ou jusqu'au bord de la grille visible.
   */
  private computeTitleFlowWidthPx(task: ProjectTask, dayIndex: number): number {
    let count = 1;
    let j = dayIndex + 1;
    while (j < this.agendaDays.length) {
      const day = this.agendaDays[j];
      if (!(task.dateStart <= day.dateSql && task.dateEnd >= day.dateSql)) break;
      if (new Date(day.dateSql).getDay() === 1) break; // lundi suivant : nouvelle occurrence du titre
      count++;
      j++;
    }
    return count * this.dayColumnPx;
  }

  /** Vrai si le jour précédent (dans la grille affichée) ne fait pas partie de la même tâche. */
  private isFirstSegmentDay(task: ProjectTask, dayIndex: number): boolean {
    if (dayIndex <= 0) return true;
    const prev = this.agendaDays[dayIndex - 1];
    return !(task.dateStart <= prev.dateSql && task.dateEnd >= prev.dateSql);
  }

  /** Vrai si le jour suivant (dans la grille affichée) ne fait pas partie de la même tâche. */
  private isLastSegmentDay(task: ProjectTask, dayIndex: number): boolean {
    if (dayIndex < 0 || dayIndex >= this.agendaDays.length - 1) return true;
    const next = this.agendaDays[dayIndex + 1];
    return !(task.dateStart <= next.dateSql && task.dateEnd >= next.dateSql);
  }

  /** Nombre de demi-journées encore dues sur une tâche (total prévu moins ce qui est déjà coché). */
  remainingHalfDays(task: ProjectTask): number {
    return Math.max(0, task.halfDaysDuration - (task.workedHalfDays || []).length);
  }

  isHalfDayWorked(task: ProjectTask, dateSql: string, period: 'AM' | 'PM'): boolean {
    return (task.workedHalfDays || []).includes(halfDayKey(dateSql, period));
  }

  /**
   * Quand le nombre de demi-journées manquantes est impair, le tout dernier jour ajouté par
   * l'extension ne rembourse qu'une demi-journée (le matin) : sa case après-midi ne doit pas
   * être affichée, puisqu'aucune demi-journée n'est due sur ce créneau.
   */
  isHalfDaySlotApplicable(task: ProjectTask, dateSql: string, period: 'AM' | 'PM'): boolean {
    if (period === 'AM') return true;
    const { dateEnd, partialFinalDay } = recomputeTaskSchedule(task, this.selectedProject);
    return !(partialFinalDay && dateSql === dateEnd);
  }

  /**
   * Vrai quand toutes les demi-journées dues ce jour-là sont cochées (matin toujours requis,
   * après-midi seulement s'il s'applique — voir isHalfDaySlotApplicable) : la zone basse de la
   * tuile passe alors en vert pour signaler visuellement que ce jour est validé.
   */
  isDayValidated(task: ProjectTask, dateSql: string): boolean {
    const amDone = this.isHalfDayWorked(task, dateSql, 'AM');
    const pmDone = !this.isHalfDaySlotApplicable(task, dateSql, 'PM') || this.isHalfDayWorked(task, dateSql, 'PM');
    return amDone && pmDone;
  }

  /**
   * Une carte représente un jour passé (avant aujourd'hui) non entièrement validé (matin et/ou
   * après-midi non coché) : elle doit s'afficher en noir, peu importe le statut de la tâche.
   */
  isCardOverdue(task: ProjectTask, dateSql: string): boolean {
    if (task.status === 'TERMINER') return false;
    if (dateSql >= TODAY_ISO) return false;
    return !this.isHalfDayWorked(task, dateSql, 'AM') || !this.isHalfDayWorked(task, dateSql, 'PM');
  }

  /**
   * Coche/décoche la demi-journée (matin/après-midi) travaillée pour une tâche à une date donnée.
   * Recalcule ensuite automatiquement la date de fin (les demi-journées manquantes sur des jours
   * déjà conclus prolongent la tâche) et le statut (Terminé si le total prévu est atteint). Si la
   * tâche a des sous-tâches, ouvre un popup pour les pointer.
   */
  toggleHalfDay(task: ProjectTask, dateSql: string, period: 'AM' | 'PM', event: Event): void {
    event.stopPropagation();
    const key = halfDayKey(dateSql, period);
    const currentlyWorked = (task.workedHalfDays || []).includes(key);
    const newWorkedHalfDays = currentlyWorked
      ? (task.workedHalfDays || []).filter(k => k !== key)
      : [...(task.workedHalfDays || []), key];

    const taskForCompute = { ...task, workedHalfDays: newWorkedHalfDays };
    const { dateEnd, status } = recomputeTaskSchedule(taskForCompute, this.selectedProject);

    this.taskUpdateRequested.emit({
      id: task.id,
      name: task.name,
      description: task.description,
      status,
      assignedUserId: task.assignedUserId ?? null,
      dateStart: task.dateStart,
      dateEnd,
      halfDaysDuration: task.halfDaysDuration,
      comments: task.comments,
      isRisky: task.isRisky,
      gitBranch: task.gitBranch,
      workedHalfDays: newWorkedHalfDays,
      extensions: task.extensions,
      subTasks: task.subTasks
      // baseDateEnd volontairement omis : un recalcul auto ne redéfinit pas le plan initial.
    });

    // Pas de popup s'il n'y a aucune sous-tâche à pointer, ou si elles sont déjà toutes Terminées
    // (rien à cocher) : l'interrompre inutilement à chaque demi-journée serait pénible.
    const hasPendingSubTasks = (task.subTasks || []).some(st => st.status !== 'TERMINER');
    if (!currentlyWorked && hasPendingSubTasks) {
      // Le popup doit pointer sur l'état À JOUR (avec la demi-journée qu'on vient de cocher),
      // pas sur `task` (référence figée d'avant ce toggle) : sinon, valider une sous-tâche
      // depuis le popup ré-émettrait l'ancien workedHalfDays et annulerait la coche qu'on vient
      // de faire, avant même que le rechargement serveur n'ait eu le temps de la refléter.
      this.subtaskPopupTask = { ...task, workedHalfDays: newWorkedHalfDays, dateEnd, status };
      this.subtaskPopupDateSql = dateSql;
    }
  }

  closeSubtaskPopup(): void {
    this.subtaskPopupTask = null;
    this.subtaskPopupDateSql = null;
  }

  /**
   * Coche/décoche une sous-tâche depuis le popup demi-journée. La date de validation n'est
   * jamais saisie à la main : elle est celle de la demi-journée qui a ouvert le popup, posée
   * quand la sous-tâche passe Terminée et effacée si on la décoche.
   */
  toggleSubtaskDone(task: ProjectTask, subTaskId: number, event: Event): void {
    event.stopPropagation();
    const validationDate = this.subtaskPopupDateSql;
    const subTasks = (task.subTasks || []).map(st => {
      if (st.id !== subTaskId) return st;
      const nowDone = st.status !== 'TERMINER';
      return {
        ...st,
        status: (nowDone ? 'TERMINER' : 'NON_COMMENCE') as ProjectTask['status'],
        dateEnd: nowDone ? (validationDate ?? undefined) : undefined
      };
    });
    this.taskUpdateRequested.emit({
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      assignedUserId: task.assignedUserId ?? null,
      dateStart: task.dateStart,
      dateEnd: task.dateEnd,
      halfDaysDuration: task.halfDaysDuration,
      comments: task.comments,
      isRisky: task.isRisky,
      gitBranch: task.gitBranch,
      workedHalfDays: task.workedHalfDays,
      extensions: task.extensions,
      subTasks
    });
    // Reflète immédiatement la coche dans le popup ouvert (avant le prochain rechargement).
    if (this.subtaskPopupTask && this.subtaskPopupTask.id === task.id) {
      this.subtaskPopupTask = { ...task, subTasks };
    }
  }

  /** Total des journées marquées "non utilisées", toutes tâches confondues, pour le projet affiché. */
  get projectUnusedDaysCount(): number {
    if (!this.selectedProject) return 0;
    // Réutilise le même calcul que la replanification auto (task-progress.ts) : seuls les jours
    // déjà passés comptent comme "manquants", pas les tâches encore entièrement à venir.
    return this.selectedProject.tasks.reduce((sum, t) => {
      const { missingHalfDays } = recomputeTaskSchedule(t, this.selectedProject);
      return sum + Math.floor(missingHalfDays / 2);
    }, 0);
  }

  /** Identifiant unique d'une case (développeur × jour), utilisé pour le glisser-déposer. */
  cellId(devId: number, dateSql: string): string {
    return `cell-${devId}-${dateSql}`;
  }

  /** Liste de toutes les cases de la grille courante, pour connecter les drop-lists CDK entre elles. */
  get allCellIds(): string[] {
    if (!this.selectedProject) return [];
    // Vue mois : une seule case par jour (pas de dimension développeur). Les deux calendriers
    // (voir agendaDaysMonth2) partagent la même liste de connexion, pour qu'une tâche proche de la
    // fin du premier mois puisse être déposée directement sur le second.
    if (this.viewMode === 'month') {
      return [...this.agendaDays, ...this.agendaDaysMonth2].map(day => this.monthCellId(day.dateSql));
    }
    const ids: string[] = [];
    for (const dev of this.selectedProject.developers) {
      for (const day of this.agendaDays) {
        ids.push(this.cellId(dev.id, day.dateSql));
      }
    }
    return ids;
  }

  /** Nombre de jours ouvrés (selon les règles du projet) entre dateStart et dateEnd inclus. */
  private countAllowedDays(dateStart: string, dateEnd: string): number {
    let count = 0;
    let d = dateStart;
    let guard = 0;
    while (d <= dateEnd && guard < 1000) {
      if (isDateAllowed(d, this.selectedProject)) count++;
      d = addDays(d, 1);
      guard++;
    }
    return count;
  }

  // `targetDevId` peut être null quand le déplacement vient du calendrier mensuel sur une tâche
  // non assignée : la tâche reste alors sans développeur, seules ses dates changent.
  onTaskDropped(event: CdkDragDrop<ProjectTask[]>, targetDevId: number | null, targetDateSql: string): void {
    const task: ProjectTask = event.item.data;
    if (!task) return;

    // Tâche terminée : plan acquis, ni les dates ni le développeur ne bougent plus. Le glisser est
    // déjà désactivé sur la tuile (cdkDragDisabled), ce garde-fou couvre les autres chemins
    // d'arrivée d'un drop (tuile relâchée depuis une autre case, dépôt clavier du CDK...).
    if (task.status === 'TERMINER') {
      this.showDropRejection('Cette tâche est terminée : ses dates et son développeur sont figés.');
      return;
    }

    // Pas de déplacement réel (même développeur, même jour de début) : rien à faire.
    // Comparaison normalisée : une tâche non assignée porte indifféremment undefined ou null.
    if ((task.assignedUserId ?? null) === targetDevId && task.dateStart === targetDateSql) return;

    // Changement de développeur uniquement (mêmes dates) : les demi-journées déjà cochées restent
    // valables (elles sont liées au calendrier, pas au développeur assigné), donc on les préserve
    // sans toucher au reste du plan — pas besoin de recalculer le span ni de revalider les dates.
    if (task.dateStart === targetDateSql) {
      this.taskUpdateRequested.emit({
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        assignedUserId: targetDevId,
        dateStart: task.dateStart,
        dateEnd: task.dateEnd,
        halfDaysDuration: task.halfDaysDuration,
        comments: task.comments,
        isRisky: task.isRisky,
        gitBranch: task.gitBranch,
        workedHalfDays: task.workedHalfDays,
        extensions: task.extensions,
        subTasks: task.subTasks
      });
      return;
    }

    // Au moins une demi-journée déjà validée sur cette tâche : ses dates sont figées, même si elle
    // n'est pas encore entièrement Terminée (voir la même règle sur Project.dateStart côté
    // nouveau-projet.component.ts — isDateStartLocked). Ne bloque QUE le déplacement de date : la
    // réaffectation à un autre développeur sans changer les dates reste autorisée ci-dessus, les
    // demi-journées cochées restant liées au calendrier, pas au développeur.
    if ((task.workedHalfDays?.length ?? 0) > 0) {
      this.showDropRejection('Au moins une demi-journée de cette tâche est déjà validée : ses dates sont figées, elle ne peut plus être déplacée.');
      return;
    }

    // Span basé sur le plan prévu (baseDateEnd), pas sur dateEnd courant : dateEnd peut avoir été
    // rallongé par le retard auto-compensé (demi-journées non cochées sur des jours passés), un
    // retard qui n'a plus lieu d'être une fois la tâche déplacée sur une nouvelle période.
    const baseEnd = task.baseDateEnd || task.dateEnd;
    const newDateStart = targetDateSql;
    // Le nombre de jours OUVRÉS (pas calendaires) du plan initial détermine la nouvelle date de
    // fin : un calcul calendaire brut (addDays) peut faire retomber la fin sur un week-end/jour
    // férié dès que le déplacement traverse un nombre différent de jours exclus, rejetant à tort
    // un déplacement pourtant valide (la tâche elle-même saute déjà ces jours partout ailleurs).
    const allowedSpanCount = this.countAllowedDays(task.dateStart, baseEnd);
    let newDateEnd = newDateStart;
    let addedAllowed = isDateAllowed(newDateEnd, this.selectedProject) ? 1 : 0;
    let guard = 0;
    while (addedAllowed < allowedSpanCount && guard < 1000) {
      newDateEnd = addDays(newDateEnd, 1);
      if (isDateAllowed(newDateEnd, this.selectedProject)) addedAllowed++;
      guard++;
    }

    const rejection = dateRejectionReason(newDateStart, this.selectedProject) || dateRejectionReason(newDateEnd, this.selectedProject);
    if (rejection) {
      this.showDropRejection(rejection);
      return;
    }

    // Reporte chaque demi-journée cochée sur le jour ouvré occupant la MÊME position dans le
    // nouveau planning (ex: la 2e demi-journée matin cochée reste la 2e après déplacement), au
    // lieu de tout redécocher : la carte garde son état visuel, seules les dates sous-jacentes
    // changent. Basé sur la plage ACTUELLEMENT affichée (dateStart→dateEnd, extensions incluses)
    // pour couvrir toutes les cases visibles avant le déplacement ; si le nouveau plan (repartant
    // sur la longueur d'origine, sans retard hérité) est plus court, les positions en trop sont
    // perdues faute de case équivalente sur la nouvelle carte.
    const oldAllowedDays = allowedDaysInRange(task.dateStart, task.dateEnd, this.selectedProject);
    const newAllowedDays = allowedDaysInRange(newDateStart, newDateEnd, this.selectedProject);
    const remappedWorkedHalfDays: string[] = [];
    for (const key of task.workedHalfDays || []) {
      const period = key.endsWith('-AM') ? 'AM' : key.endsWith('-PM') ? 'PM' : null;
      if (!period) continue;
      const oldDate = key.slice(0, -3);
      const idx = oldAllowedDays.indexOf(oldDate);
      if (idx === -1 || idx >= newAllowedDays.length) continue;
      remappedWorkedHalfDays.push(halfDayKey(newAllowedDays[idx], period));
    }

    this.taskUpdateRequested.emit({
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      assignedUserId: targetDevId,
      dateStart: newDateStart,
      dateEnd: newDateEnd,
      // Un déplacement redéfinit le plan : la référence des jours "conclus" suit la tâche.
      baseDateEnd: newDateEnd,
      halfDaysDuration: task.halfDaysDuration,
      comments: task.comments,
      isRisky: task.isRisky,
      gitBranch: task.gitBranch,
      workedHalfDays: remappedWorkedHalfDays,
      extensions: task.extensions,
      subTasks: task.subTasks
    });
  }

  /** Affiche le bandeau de refus quelques secondes, puis l'efface automatiquement. */
  private showDropRejection(message: string): void {
    this.dropRejectionMessage = message;
    if (this.dropRejectionTimeoutId) clearTimeout(this.dropRejectionTimeoutId);
    this.dropRejectionTimeoutId = setTimeout(() => {
      this.zone.run(() => { this.dropRejectionMessage = null; });
    }, 4000);
  }

  private static readonly STATUS_LABELS_FR: Record<ProjectTask['status'], string> = {
    NON_COMMENCE: 'Non commencé',
    EN_ATTENTE: 'En attente',
    EN_COURS: 'En cours',
    TERMINER: 'Terminé'
  };

  /**
   * Export CSV du planning du projet affiché : une ligne par tâche, colonnes utiles pour un point
   * d'avancement (statut, développeur, dates, charge, retard). Génération purement front (Blob +
   * lien de téléchargement), aucune dépendance ajoutée — voir utils/csv-export.ts.
   */
  exportProjectTasksCsv(): void {
    if (!this.selectedProject) return;
    const project = this.selectedProject;

    const headers = ['Code Projet', 'Tâche', 'Développeur', 'Statut', 'Date Début', 'Date Fin', 'Durée (demi-j)', 'Demi-j restantes', 'À risque'];
    const rows = project.tasks.map(t => [
      project.code,
      t.name,
      this.assignedUserLabel(t),
      PlanningAgendaComponent.STATUS_LABELS_FR[t.status],
      t.dateStart,
      t.dateEnd,
      t.halfDaysDuration,
      this.remainingHalfDays(t),
      t.isRisky ? 'Oui' : 'Non'
    ]);

    downloadCsv(`${project.code}-planning.csv`, toCsv(headers, rows));
  }

  openCreateTaskModal(): void {
    this.editingTask = null;
    this.taskModalOpen = true;
  }

  openEditTaskModal(task: ProjectTask, event: Event): void {
    event.stopPropagation();
    this.editingTask = task;
    this.taskModalOpen = true;
  }

  onModalClosed(): void {
    this.taskModalOpen = false;
    this.editingTask = null;
  }

  onTaskCreated(payload: CreateTaskPayload): void {
    if (!this.selectedProject) return;
    this.taskCreateRequested.emit({ projectId: this.selectedProject.id, payload });
  }

  onTaskUpdated(payload: UpdateTaskPayload): void {
    this.taskUpdateRequested.emit(payload);
  }

  onTaskDeleted(taskId: number): void {
    this.taskDeleteRequested.emit(taskId);
  }
}
