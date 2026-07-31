import { Component, OnInit, NgZone, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../core/services/project.service';
import { Project, User, ProjectTask, DayAgendaSlot, PlanningViewMode, TaskHistoryEntry, UnavailabilityPeriod, CreateUnavailabilityPayload, CreateProjectPayload, UpdateProjectPayload, CreateTaskPayload, UpdateTaskPayload, ProjectMetier } from '../core/models/project.model';
import { NouveauProjetComponent, MetierAssignmentAutoSavePayload } from './components/nouveau-projet/nouveau-projet.component';
import { ListeProjetsComponent } from './components/liste-projets/liste-projets.component';
import { PlanningAgendaComponent } from './components/planning-agenda/planning-agenda.component';
import { ProjectStatsComponent } from './components/project-stats/project-stats.component';
import { ChargeInterProjetsComponent } from './components/charge-inter-projets/charge-inter-projets.component';
import { IndisponibilitesComponent } from './components/indisponibilites/indisponibilites.component';
import { AideAgendaComponent } from './components/aide-agenda/aide-agenda.component';
import { isHoliday, isDateAllowed, TODAY_ISO, PlanningRules } from '../core/utils/date-rules';
import { recomputeTaskSchedule } from '../core/utils/task-progress';

type RangeOption = { label: string; kind: 'days' | 'months'; amount: number };

/** Ligne du digest retard/échéances en tête de page (voir overdueDigestItems/upcomingDeadlineDigestItems). */
interface DigestItem {
  taskId: number;
  taskName: string;
  projectCode: string;
  devLabel: string;
  dateEnd: string;
}

const MONTH_NAMES_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** Indexé par Date.getDay() (0 = dimanche). */
const DAY_NAMES_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function addMonthsIso(dateIso: string, months: number): string {
  const d = new Date(dateIso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Formate une Date construite en composantes LOCALES (new Date(y, m, d)) en YYYY-MM-DD.
 * `toISOString()` ne convient pas ici : il repasse par UTC et décalerait la date d'un jour
 * dans tous les fuseaux à l'est de Greenwich (minuit local = la veille 22h UTC en France).
 */
function toIsoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Premier jour du mois contenant la date donnée (YYYY-MM-01). */
function firstOfMonthIso(dateIso: string): string {
  return `${dateIso.slice(0, 7)}-01`;
}

/** Décale un ancrage "premier du mois" de N mois (N négatif = mois précédents). */
function shiftMonthIso(monthAnchorIso: string, deltaMonths: number): string {
  const [year, month] = monthAnchorIso.split('-').map(Number);
  return toIsoDate(new Date(year, month - 1 + deltaMonths, 1));
}

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NouveauProjetComponent,
    ListeProjetsComponent,
    PlanningAgendaComponent,
    ProjectStatsComponent,
    ChargeInterProjetsComponent,
    IndisponibilitesComponent,
    AideAgendaComponent
  ],
  templateUrl: './home-agenda.component.html',
  styleUrls: ['./home-agenda.component.scss']
})
export class HomeAgendaComponent implements OnInit {
  private projectService = inject(ProjectService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  projects: Project[] = [];
  users: User[] = [];
  // Tous les utilisateurs actifs du portail (pas seulement le groupe Developpeur) : alimente
  // uniquement le filtre par métier du formulaire projet, voir ProjectService.getAllActiveUsers()
  // et NouveauProjetComponent.visibleUsers — le métier remplace alors le filtre groupe.
  allActiveUsers: User[] = [];
  selectedProject: Project | null = null;
  editingProject: Project | null = null;
  agendaDays: DayAgendaSlot[] = [];
  unavailabilities: UnavailabilityPeriod[] = [];
  // Métiers (Dev/Infra/Media...) : gérés depuis Admin > Métiers (portail-shell), consommés ici en
  // lecture seule pour le rattachement multi-métiers d'un projet — l'agenda n'a plus d'onglet
  // Configuration propre, cette gestion ne lui appartient plus (voir CLAUDE.md).
  metiers: ProjectMetier[] = [];

  // Bandeau d'alerte : distinct du fallback silencieux d'origine (catchError qui masquait aussi
  // bien l'absence de backend réel que les vraies pannes). Non-null tant que le dernier appel API
  // n'a pas abouti ; se réarme automatiquement au prochain appel réussi (voir ProjectService).
  apiIssue: string | null = null;

  // Digest retard/échéances (tous projets confondus), affiché en tête de page : replié par défaut,
  // le détail par tâche ne s'affiche qu'au clic pour ne pas alourdir la vue par défaut.
  digestExpanded = false;

  toggleDigestExpanded(): void {
    this.digestExpanded = !this.digestExpanded;
  }

  /** Tâches en retard (demi-journées manquantes sur des jours déjà passés), tous projets confondus. */
  get overdueDigestItems(): DigestItem[] {
    const items: DigestItem[] = [];
    for (const project of this.projects) {
      for (const task of project.tasks) {
        const { missingHalfDays } = recomputeTaskSchedule(task, project);
        if (missingHalfDays > 0) {
          items.push({
            taskId: task.id,
            taskName: task.name,
            projectCode: project.code,
            devLabel: this.devLabel(task.assignedUserId),
            dateEnd: task.dateEnd
          });
        }
      }
    }
    return items;
  }

  /** Tâches non terminées dont l'échéance tombe dans les 7 prochains jours, tous projets confondus. */
  get upcomingDeadlineDigestItems(): DigestItem[] {
    const horizon = addDaysIso(TODAY_ISO, 7);
    const items: DigestItem[] = [];
    for (const project of this.projects) {
      for (const task of project.tasks) {
        if (task.status === 'TERMINER') continue;
        if (task.dateEnd >= TODAY_ISO && task.dateEnd <= horizon) {
          items.push({
            taskId: task.id,
            taskName: task.name,
            projectCode: project.code,
            devLabel: this.devLabel(task.assignedUserId),
            dateEnd: task.dateEnd
          });
        }
      }
    }
    return items.sort((a, b) => (a.dateEnd < b.dateEnd ? -1 : a.dateEnd > b.dateEnd ? 1 : 0));
  }

  readonly rangeOptions: RangeOption[] = [
    { label: '5 jours', kind: 'days', amount: 5 },
    { label: '15 jours', kind: 'days', amount: 15 },
    { label: '30 jours', kind: 'days', amount: 30 },
    { label: '2 mois', kind: 'months', amount: 2 },
    { label: '5 mois', kind: 'months', amount: 5 }
  ];
  selectedRangeIndex = 1; // 15 jours par défaut
  viewStartDate = '2026-07-20';

  // Format d'affichage : grille Gantt par jour (défaut) ou calendrier mensuel. En vue mois, la
  // navigation avant/après se fait de mois en mois, autour de `monthAnchorDate` (toujours un 1er).
  viewMode: PlanningViewMode = 'days';
  monthAnchorDate = firstOfMonthIso(TODAY_ISO);
  // Vue mois uniquement : 1 ou 2 mois affichés côte à côte (voir PlanningAgendaComponent). Le
  // second mois est toujours celui qui suit monthAnchorDate — voir regenerateAgenda.
  monthDisplayCount: 1 | 2 = 1;
  agendaDaysMonth2: DayAgendaSlot[] = [];

  get viewRangeLabel(): string {
    if (this.viewMode === 'month') {
      const [year, month] = this.monthAnchorDate.split('-').map(Number);
      const label = `${MONTH_NAMES_FR[month - 1]} ${year}`;
      if (this.monthDisplayCount === 1) return label;
      const nextAnchor = shiftMonthIso(this.monthAnchorDate, 1);
      const [nextYear, nextMonth] = nextAnchor.split('-').map(Number);
      return `${label} — ${MONTH_NAMES_FR[nextMonth - 1]} ${nextYear}`;
    }
    if (this.agendaDays.length === 0) return '';
    const first = this.agendaDays[0].dateSql;
    const last = this.agendaDays[this.agendaDays.length - 1].dateSql;
    const start = new Date(first);
    const end = new Date(last);
    const startLabel = `${MONTH_NAMES_FR[start.getMonth()]} ${start.getFullYear()}`;
    const endLabel = `${MONTH_NAMES_FR[end.getMonth()]} ${end.getFullYear()}`;
    return startLabel === endLabel ? startLabel : `${startLabel} — ${endLabel}`;
  }

  ngOnInit(): void {
    this.loadData();
    this.regenerateAgenda();
    this.projectService.apiIssue$.subscribe(issue => {
      this.zone.run(() => {
        this.apiIssue = issue;
        this.cdr.detectChanges();
      });
    });
  }

  loadData(): void {
    // 🔧 CORRECTIF : dans cet environnement, les callbacks de HttpClient s'exécutent hors de la
    // zone Angular (confirmé empiriquement : les données du composant sont à jour mais jamais
    // reflétées dans la vue tant qu'un évènement DOM — un clic — ne force un cycle de détection).
    // this.zone.run() replace le contexte Angular ; this.cdr.detectChanges() force la vérification
    // synchrone immédiate (parent + enfants) sans attendre une éventuelle stabilisation de zone.
    this.projectService.getUsers().subscribe((devs: User[]) => {
      this.zone.run(() => {
        this.users = devs;
        this.cdr.detectChanges();
      });
    });

    this.projectService.getProjects().subscribe((projects: Project[]) => {
      this.zone.run(() => {
        this.projects = this.reconcileTaskSchedules(projects);

        // Recale selectedProject sur sa version fraîche (même id) après chaque rechargement,
        // sinon le panneau Agenda continue d'afficher l'ancien objet (développeurs, tâches...).
        const selectedId = this.selectedProject?.id;
        if (selectedId !== undefined) {
          this.selectedProject = this.projects.find(p => p.id === selectedId) || this.projects[0] || null;
        } else if (this.projects.length > 0) {
          this.selectedProject = this.projects[0];
        }

        this.cdr.detectChanges();
      });
    });

    this.projectService.getUnavailabilities().subscribe((periods: UnavailabilityPeriod[]) => {
      this.zone.run(() => {
        this.unavailabilities = periods;
        this.cdr.detectChanges();
      });
    });

    this.projectService.getMetiers().subscribe((metiers: ProjectMetier[]) => {
      this.zone.run(() => {
        this.metiers = metiers;
        this.cdr.detectChanges();
      });
    });

    this.projectService.getAllActiveUsers().subscribe((allUsers: User[]) => {
      this.zone.run(() => {
        this.allActiveUsers = allUsers;
        this.cdr.detectChanges();
      });
    });
  }

  onUnavailabilityCreateRequested(payload: CreateUnavailabilityPayload): void {
    this.projectService.createUnavailability(payload).subscribe(() => this.loadData());
  }

  onUnavailabilityDeleteRequested(id: number): void {
    this.projectService.deleteUnavailability(id).subscribe(() => this.loadData());
  }

  /**
   * Recalcule dateEnd/statut de chaque tâche à CHAQUE chargement des données (pas seulement au
   * moment où une case matin/après-midi est cochée) : un jour qui passe sans être validé doit
   * automatiquement prolonger la tâche à l'affichage, même sans interaction de l'utilisateur.
   * Persiste les corrections en arrière-plan sans redéclencher loadData() (baseDateEnd n'est pas
   * touché, donc la correction est idempotente d'un chargement à l'autre).
   */
  private reconcileTaskSchedules(projects: Project[]): Project[] {
    return projects.map(project => {
      let changed = false;
      const tasks = project.tasks.map(task => {
        const { dateEnd, status } = recomputeTaskSchedule(task, project);
        if (dateEnd === task.dateEnd && status === task.status) return task;

        changed = true;
        this.projectService.updateTask({
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
          workedHalfDays: task.workedHalfDays,
          extensions: task.extensions,
          history: task.history,
          subTasks: task.subTasks
          // baseDateEnd volontairement omis : ce recalcul ne redéfinit pas le plan initial.
        }).subscribe();

        return { ...task, dateEnd, status };
      });
      return changed ? { ...project, tasks } : project;
    });
  }

  // ==========================================================================
  // NAVIGATION DU PLANNING (mois affiché, plage de jours, avant/après)
  // ==========================================================================

  private currentWindowDaysCount(): number {
    const range = this.rangeOptions[this.selectedRangeIndex];
    if (range.kind === 'days') return range.amount;
    const endExclusive = addMonthsIso(this.viewStartDate, range.amount);
    return daysBetweenIso(this.viewStartDate, endExclusive);
  }

  private regenerateAgenda(): void {
    if (this.viewMode === 'month') {
      this.generateMonthTimeline(this.monthAnchorDate);
      // Second mois (voir monthDisplayCount) : toujours celui qui suit monthAnchorDate — vidé
      // (plutôt que jamais recalculé) dès qu'on repasse à 1 seul mois, pour ne pas laisser
      // PlanningAgendaComponent afficher un second calendrier obsolète si l'utilisateur rebascule
      // sur 2 mois sans que monthAnchorDate ait changé entre-temps.
      this.agendaDaysMonth2 = this.monthDisplayCount === 2
        ? this.buildMonthTimeline(shiftMonthIso(this.monthAnchorDate, 1))
        : [];
      return;
    }
    this.generateAgendaTimeline(this.viewStartDate, this.currentWindowDaysCount());
  }

  onRangeChanged(index: number): void {
    this.selectedRangeIndex = Number(index);
    this.regenerateAgenda();
  }

  onMonthDisplayCountChanged(count: 1 | 2): void {
    if (count === this.monthDisplayCount) return;
    this.monthDisplayCount = count;
    this.regenerateAgenda();
  }

  /**
   * Bascule jour ↔ mois. Les deux vues partagent la même position temporelle : passer en mois
   * ouvre le mois du jour actuellement affiché, et revenir en jour repart du mois consulté (sans
   * bouger si l'utilisateur n'a pas changé de mois entre-temps).
   */
  onViewModeChanged(mode: PlanningViewMode): void {
    if (mode === this.viewMode) return;
    if (mode === 'month') {
      this.monthAnchorDate = firstOfMonthIso(this.viewStartDate);
    } else if (this.monthAnchorDate.slice(0, 7) !== this.viewStartDate.slice(0, 7)) {
      this.viewStartDate = this.monthAnchorDate;
    }
    this.viewMode = mode;
    this.regenerateAgenda();
  }

  goToPrevious(): void {
    if (this.viewMode === 'month') {
      this.monthAnchorDate = shiftMonthIso(this.monthAnchorDate, -1);
      this.regenerateAgenda();
      return;
    }
    const step = Math.max(1, Math.round(this.currentWindowDaysCount() / 2));
    this.viewStartDate = addDaysIso(this.viewStartDate, -step);
    this.regenerateAgenda();
  }

  goToNext(): void {
    if (this.viewMode === 'month') {
      this.monthAnchorDate = shiftMonthIso(this.monthAnchorDate, 1);
      this.regenerateAgenda();
      return;
    }
    const step = Math.max(1, Math.round(this.currentWindowDaysCount() / 2));
    this.viewStartDate = addDaysIso(this.viewStartDate, step);
    this.regenerateAgenda();
  }

  goToToday(): void {
    this.viewStartDate = '2026-07-20';
    this.monthAnchorDate = firstOfMonthIso(TODAY_ISO);
    this.regenerateAgenda();
  }

  /**
   * Pas fin d'un seul jour calendaire (vue jour uniquement), contrairement à goToPrevious/goToNext
   * qui sautent d'une demi-fenêtre affichée : utile pour ajuster la fenêtre visible sans changer
   * de plage.
   */
  goToPreviousDay(): void {
    this.viewStartDate = addDaysIso(this.viewStartDate, -1);
    this.regenerateAgenda();
  }

  goToNextDay(): void {
    this.viewStartDate = addDaysIso(this.viewStartDate, 1);
    this.regenerateAgenda();
  }

  generateAgendaTimeline(startDateIso: string, daysCount: number): void {
    this.agendaDays = [];
    const startDate = new Date(startDateIso);

    for (let i = 0; i < daysCount; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dayOfWeek = d.getDay();
      const dateSql = d.toISOString().split('T')[0];
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
      const isToday = dateSql === TODAY_ISO;

      this.agendaDays.push({
        dateSql,
        dayName: DAY_NAMES_FR[dayOfWeek],
        dayNumber: d.getDate(),
        isWeekend,
        isHoliday: isHoliday(dateSql),
        isToday,
        isPast: dateSql < TODAY_ISO,
        tasksByDev: new Map()
      });
    }
  }

  /**
   * Grille du calendrier mensuel : semaines complètes commençant le lundi, du lundi précédant le
   * 1er du mois jusqu'au dimanche suivant le dernier jour. Les jours de complément (mois voisins)
   * sont marqués `isOutsideMonth` pour être affichés en grisé, comme dans un calendrier classique.
   * Extrait en méthode pure (retourne le tableau au lieu de l'assigner directement) pour pouvoir
   * générer un second mois côte à côte (voir agendaDaysMonth2 / regenerateAgenda) sans dupliquer
   * cette logique.
   */
  private buildMonthTimeline(monthAnchorIso: string): DayAgendaSlot[] {
    const [year, month] = monthAnchorIso.split('-').map(Number);
    const monthIndex = month - 1;
    // Décalage du 1er par rapport au lundi (getDay(): 0 = dimanche → 6 en semaine ISO).
    const leadingOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cellCount = Math.ceil((leadingOffset + daysInMonth) / 7) * 7;

    const days: DayAgendaSlot[] = [];
    for (let i = 0; i < cellCount; i++) {
      const d = new Date(year, monthIndex, 1 - leadingOffset + i);
      const dayOfWeek = d.getDay();
      const dateSql = toIsoDate(d);

      days.push({
        dateSql,
        dayName: DAY_NAMES_FR[dayOfWeek],
        dayNumber: d.getDate(),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isHoliday: isHoliday(dateSql),
        isToday: dateSql === TODAY_ISO,
        isPast: dateSql < TODAY_ISO,
        isOutsideMonth: d.getMonth() !== monthIndex,
        tasksByDev: new Map()
      });
    }
    return days;
  }

  generateMonthTimeline(monthAnchorIso: string): void {
    this.agendaDays = this.buildMonthTimeline(monthAnchorIso);
  }

  onProjectCreated(payload: Omit<CreateProjectPayload, 'tasks'>): void {
    this.projectService.createProject({
      ...payload,
      tasks: []
    }).subscribe(() => {
      this.loadData();
    });
  }

  onSelectProject(project: Project): void {
    this.selectedProject = project;
  }

  onEditProjectRequested(project: Project): void {
    this.editingProject = project;
  }

  onEditCancelled(): void {
    this.editingProject = null;
  }

  /**
   * Reconstruit un UpdateProjectPayload complet à partir de l'état actuellement persisté d'un
   * projet (this.projects), en ne remplaçant que les champs fournis — utilisé par les sauvegardes
   * "rapides" déclenchées hors du formulaire principal (métier coché, développeur retiré depuis sa
   * tuile...), qui ne doivent JAMAIS s'appuyer sur un éventuel état non validé du formulaire.
   */
  private buildUpdatePayload(previous: Project, overrides: Partial<UpdateProjectPayload>): UpdateProjectPayload {
    return {
      id: previous.id,
      code: previous.code,
      name: previous.name,
      description: previous.description,
      riskLevel: previous.riskLevel,
      dateStart: previous.dateStart,
      dateEndEstimated: previous.dateEndEstimated,
      estimatedTimeDays: previous.estimatedTimeDays,
      developerIds: previous.developers.map(d => d.id),
      excludeWeekends: previous.excludeWeekends,
      excludeHolidays: previous.excludeHolidays,
      weekendsRuleFrom: previous.weekendsRuleFrom,
      holidaysRuleFrom: previous.holidaysRuleFrom,
      metierIds: previous.metierIds,
      ...overrides
    };
  }

  /**
   * Sauvegarde immédiate du rattachement métiers/développeurs, déclenchée à chaque coche/décoche
   * d'un métier dans le formulaire (voir NouveauProjetComponent.toggleMetierSelection) — sans
   * attendre le clic sur "Modifier le projet". Contrairement à onProjectUpdated, ne touche PAS
   * editingProject : réaffecter cet @Input ferait perdre au formulaire toute saisie non validée en
   * cours sur un autre champ (ngOnChanges y réinitialiserait tout le form). Les autres champs du
   * projet (code, nom, dates...) sont donc repris tels quels depuis this.projects, jamais depuis
   * le formulaire.
   */
  onMetierAssignmentAutoSaved(event: MetierAssignmentAutoSavePayload): void {
    const previous = this.projects.find(p => p.id === event.id);
    if (!previous) return;
    const payload = this.buildUpdatePayload(previous, {
      developerIds: event.developerIds,
      metierIds: event.metierIds
    });
    this.projectService.updateProject(payload).subscribe(() => this.loadData());
  }

  /**
   * Retire un développeur du projet depuis sa tuile de la colonne fixe du Gantt (voir
   * PlanningAgendaComponent.removeDevFromProject) — revérifie ici en autorité qu'il n'a aucune
   * tâche assignée sur ce projet avant d'envoyer la mise à jour, même si le bouton n'est déjà
   * proposé côté template que dans ce cas.
   */
  onDevRemovalRequested(event: { projectId: number; devId: number }): void {
    const previous = this.projects.find(p => p.id === event.projectId);
    if (!previous) return;
    const hasTask = previous.tasks.some(t => t.assignedUserId === event.devId);
    if (hasTask) return;

    const payload = this.buildUpdatePayload(previous, {
      developerIds: previous.developers.map(d => d.id).filter(id => id !== event.devId)
    });
    this.projectService.updateProject(payload).subscribe(() => this.loadData());
  }

  async onProjectUpdated(payload: UpdateProjectPayload): Promise<void> {
    // Snapshot AVANT l'enregistrement : sert de référence "règles précédentes" pour ne replanifier
    // que ce que le changement impacte réellement (this.projects sera rafraîchi juste après).
    const previous = this.projects.find(p => p.id === payload.id);
    const effectivePayload = this.withRuleEffectiveDates(payload, previous);

    await firstValueFrom(this.projectService.updateProject(effectivePayload));
    this.zone.run(() => {
      this.editingProject = null;
      this.cdr.detectChanges();
    });

    // Si l'exclusion week-end/jours fériés vient d'être activée, les tâches déjà planifiées
    // sur ces jours doivent être automatiquement décalées pour rester cohérentes — sinon
    // l'agenda afficherait des tâches en violation de la règle qu'on vient d'activer.
    await this.rescheduleTasksViolatingRules(effectivePayload, previous);

    this.loadData();
  }

  /**
   * Date d'entrée en vigueur de chaque contrainte de planification (voir Project.weekendsRuleFrom) :
   * une règle qu'on vient d'ACTIVER ne prend effet que demain, pour que les jours déjà travaillés —
   * et aujourd'hui — conservent exactement leurs tuiles et leurs demi-journées cochées. Une règle
   * inchangée garde sa date d'origine (sinon activer une autre contrainte "libérerait" a posteriori
   * les week-ends passés déjà grisés) ; une règle désactivée perd la sienne, la prochaine activation
   * repartant d'une nouvelle date d'effet.
   */
  private withRuleEffectiveDates(payload: UpdateProjectPayload, previous: Project | undefined): UpdateProjectPayload {
    const tomorrow = addDaysIso(TODAY_ISO, 1);

    const nextRuleFrom = (
      enabled: boolean | undefined,
      wasEnabled: boolean | undefined,
      previousFrom: string | null | undefined
    ): string | null => {
      if (!enabled) return null;
      if (wasEnabled) return previousFrom ?? null;
      return tomorrow;
    };

    return {
      ...payload,
      weekendsRuleFrom: nextRuleFrom(payload.excludeWeekends, previous?.excludeWeekends, previous?.weekendsRuleFrom),
      holidaysRuleFrom: nextRuleFrom(payload.excludeHolidays, previous?.excludeHolidays, previous?.holidaysRuleFrom)
    };
  }

  private async rescheduleTasksViolatingRules(
    payload: UpdateProjectPayload,
    previous: Project | undefined
  ): Promise<void> {
    if (!payload.excludeWeekends && !payload.excludeHolidays) return;

    // Récupère l'état frais (pas this.projects, potentiellement obsolète) : la mise à jour du
    // projet vient de réussir, les tâches à vérifier doivent refléter la base à jour.
    const freshProjects = await firstValueFrom(this.projectService.getProjects());
    const project = freshProjects.find(p => p.id === payload.id);
    if (!project) return;

    const newRules: PlanningRules = {
      excludeWeekends: payload.excludeWeekends,
      excludeHolidays: payload.excludeHolidays,
      weekendsRuleFrom: payload.weekendsRuleFrom,
      holidaysRuleFrom: payload.holidaysRuleFrom
    };
    // Règles telles qu'elles étaient AVANT cette édition : un jour déjà interdit hier ne doit pas
    // être recompté comme "perdu" aujourd'hui, sinon chaque enregistrement du projet rallongerait
    // un peu plus les tâches qui traversent un week-end déjà exclu.
    const oldRules: PlanningRules = {
      excludeWeekends: previous?.excludeWeekends,
      excludeHolidays: previous?.excludeHolidays,
      weekendsRuleFrom: previous?.weekendsRuleFrom,
      holidaysRuleFrom: previous?.holidaysRuleFrom
    };
    /** Jour planifiable avant l'édition mais interdit après : c'est le seul cas à compenser. */
    const becameForbidden = (dateIso: string) =>
      isDateAllowed(dateIso, oldRules) && !isDateAllowed(dateIso, newRules);

    /** Repousse une date de `count` jours réellement planifiables sous les nouvelles règles. */
    const pushByAllowedDays = (dateIso: string, count: number): string => {
      let result = dateIso;
      let added = 0;
      let attempts = 0;
      while (added < count && attempts < 200) {
        result = addDaysIso(result, 1);
        if (isDateAllowed(result, newRules)) added++;
        attempts++;
      }
      return result;
    };

    for (const task of project.tasks) {
      // Tâche entièrement passée : rien à replanifier, on ne réécrit jamais une date révolue.
      if (task.dateEnd < TODAY_ISO) continue;

      // Ancre du plan initial. dateEnd, lui, inclut déjà les prolongations automatiques dues aux
      // demi-journées non validées (voir recomputeTaskSchedule) : c'est baseDateEnd qu'il faut
      // décaler, jamais remplacer par dateEnd — sinon chaque décalage repart d'une fin déjà
      // allongée et la tâche gonfle un peu plus à chaque enregistrement (cf. CLAUDE.md).
      const baseEnd = task.baseDateEnd || task.dateEnd;

      let newStart = task.dateStart;
      let newEnd = task.dateEnd;
      let newBaseEnd = baseEnd;

      if (becameForbidden(task.dateStart)) {
        // Le départ lui-même tombe sur un jour désormais interdit. Forcément dans le futur : les
        // dates d'effet ci-dessus laissent passer le passé et aujourd'hui. Le bloc entier glisse
        // jusqu'au prochain créneau valide, en conservant sa durée calendaire.
        const spanDays = daysBetweenIso(task.dateStart, task.dateEnd);
        let attempts = 0;
        while ((!isDateAllowed(newStart, newRules) || !isDateAllowed(newEnd, newRules)) && attempts < 60) {
          newStart = addDaysIso(newStart, 1);
          newEnd = addDaysIso(newStart, spanDays);
          attempts++;
        }
        // Le plan glisse en bloc : l'ancre suit le même décalage calendaire que le départ.
        newBaseEnd = addDaysIso(baseEnd, daysBetweenIso(task.dateStart, newStart));
      } else {
        // Départ conservé (tâche déjà commencée, ou départ resté valide) : on compte les jours de
        // la plage qui viennent de devenir interdits et on repousse la fin d'autant de jours
        // réellement planifiables. Contrôler seulement dateEnd ne suffirait pas — la fin peut
        // rester un jour valide alors qu'un jour interdit apparaît au milieu de la plage.
        let lostDays = 0;
        let guard = 0;
        for (let d = task.dateStart; d <= task.dateEnd && guard < 2000; d = addDaysIso(d, 1)) {
          if (becameForbidden(d)) lostDays++;
          guard++;
        }
        if (lostDays === 0) continue;

        newEnd = pushByAllowedDays(newEnd, lostDays);
        // Même nombre de jours perdus sur l'ancre, calculé DEPUIS l'ancre.
        newBaseEnd = pushByAllowedDays(baseEnd, lostDays);
      }

      if (newStart === task.dateStart && newEnd === task.dateEnd && newBaseEnd === baseEnd) continue;

      await firstValueFrom(this.projectService.updateTask({
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        assignedUserId: task.assignedUserId ?? null,
        dateStart: newStart,
        dateEnd: newEnd,
        // Ancre décalée du même nombre de jours que le plan, jamais alignée sur dateEnd (qui
        // contient déjà les prolongations automatiques) — voir le calcul de newBaseEnd ci-dessus.
        baseDateEnd: newBaseEnd,
        halfDaysDuration: task.halfDaysDuration,
        comments: task.comments,
        isRisky: task.isRisky,
        gitBranch: task.gitBranch,
        workedHalfDays: task.workedHalfDays,
        extensions: task.extensions,
        history: task.history,
        subTasks: task.subTasks
      }));
    }
  }

  onTaskStatusChanged(event: { taskId: number; newStatus: ProjectTask['status'] }): void {
    this.projectService.updateTaskStatus(event.taskId, event.newStatus).subscribe(() => {
      this.loadData();
    });
  }

  onTaskCreateRequested(event: { projectId: number; payload: CreateTaskPayload }): void {
    this.projectService.createTask(event.projectId, event.payload).subscribe(() => {
      this.loadData();
    });
  }

  private static readonly STATUS_LABELS_FR: Record<ProjectTask['status'], string> = {
    NON_COMMENCE: 'Non commencé',
    EN_ATTENTE: 'En attente',
    EN_COURS: 'En cours',
    TERMINER: 'Terminé'
  };

  private devLabel(devId: number | null | undefined): string {
    if (devId === null || devId === undefined) return 'Non assigné';
    const dev = this.users.find(u => u.id === devId);
    return dev ? `${dev.firstname} ${dev.lastname}` : `#${devId}`;
  }

  /**
   * Compare l'état précédent d'une tâche au payload envoyé et fabrique les entrées d'historique
   * correspondantes (changement de statut, changement de développeur assigné). Calculé une seule
   * fois ici, centralement dans onTaskUpdateRequested, pour couvrir tous les points d'entrée qui
   * émettent taskUpdateRequested (formulaire, glisser-déposer, coche demi-journée, ajout de jours,
   * sous-tâches) sans avoir à dupliquer la comparaison dans chacun d'eux.
   */
  private buildTaskHistoryDiff(oldTask: ProjectTask | undefined, payload: UpdateTaskPayload): TaskHistoryEntry[] {
    if (!oldTask) return payload.history || [];
    const entries: TaskHistoryEntry[] = [...(oldTask.history || [])];

    if (oldTask.status !== payload.status) {
      entries.push({
        date: TODAY_ISO,
        message: `Statut changé de « ${HomeAgendaComponent.STATUS_LABELS_FR[oldTask.status]} » à « ${HomeAgendaComponent.STATUS_LABELS_FR[payload.status]} »`
      });
    }

    const oldDevId = oldTask.assignedUserId ?? null;
    const newDevId = payload.assignedUserId ?? null;
    if (oldDevId !== newDevId) {
      entries.push({
        date: TODAY_ISO,
        message: `Réaffectée de ${this.devLabel(oldDevId)} à ${this.devLabel(newDevId)}`
      });
    }

    return entries;
  }

  /**
   * Réouverture d'une tâche terminée (statut « Terminé » -> autre) : la dernière demi-journée
   * validée est décochée.
   *
   * Sans ça la réouverture ne tiendrait pas. Une tâche bascule automatiquement en « Terminé » dès
   * que le total de demi-journées travaillées atteint la durée prévue (voir recomputeTaskSchedule) :
   * une tâche complète rouverte serait donc re-terminée au rechargement suivant, annulant
   * silencieusement le changement de statut. Libérer la dernière demi-journée rend à la tâche le
   * reste à faire qui justifie sa réouverture.
   */
  private reopenCompletedTask(
    oldTask: ProjectTask,
    payload: UpdateTaskPayload
  ): { payload: UpdateTaskPayload; cancelledHalfDay: string | null } {
    const worked = [...(payload.workedHalfDays ?? oldTask.workedHalfDays ?? [])];
    if (worked.length === 0) return { payload, cancelledHalfDay: null };

    // Les clés ont la forme `YYYY-MM-DD-AM|PM` : l'ordre lexicographique est donc déjà l'ordre
    // chronologique (dates ISO, et "AM" avant "PM" à date égale). La liste stockée, elle, n'est
    // pas triée — elle suit l'ordre dans lequel les cases ont été cochées.
    const lastWorked = [...worked].sort().pop() ?? null;

    return {
      payload: { ...payload, workedHalfDays: worked.filter(key => key !== lastWorked) },
      cancelledHalfDay: lastWorked
    };
  }

  /** « 2026-07-24-AM » -> « 24/07/2026 (matin) », pour l'entrée d'historique. */
  private static formatHalfDayKey(key: string): string {
    const period = key.endsWith('-AM') ? 'matin' : 'après-midi';
    const [year, month, day] = key.slice(0, -3).split('-');
    return `${day}/${month}/${year} (${period})`;
  }

  onTaskUpdateRequested(payload: UpdateTaskPayload): void {
    const oldTask = this.projects.flatMap(p => p.tasks).find(t => t.id === payload.id);

    const isReopening = !!oldTask && oldTask.status === 'TERMINER' && payload.status !== 'TERMINER';
    const reopened = isReopening ? this.reopenCompletedTask(oldTask, payload) : null;
    const finalPayload = reopened?.payload ?? payload;

    const history = this.buildTaskHistoryDiff(oldTask, finalPayload);
    if (reopened?.cancelledHalfDay) {
      history.push({
        date: TODAY_ISO,
        message: `Réouverture : demi-journée du ${HomeAgendaComponent.formatHalfDayKey(reopened.cancelledHalfDay)} annulée`
      });
    }

    this.projectService.updateTask({ ...finalPayload, history }).subscribe(() => {
      this.loadData();
    });
  }

  onTaskDeleteRequested(taskId: number): void {
    this.projectService.deleteTask(taskId).subscribe(() => {
      this.loadData();
    });
  }
}
