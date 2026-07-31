import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project, ProjectTask, SubTask, User, TaskStatus, TaskExtension, TaskHistoryEntry, UnavailabilityPeriod, CreateTaskPayload, UpdateTaskPayload } from '../../../core/models/project.model';
import { dateRejectionReason, isDateAllowed, TODAY_ISO } from '../../../core/utils/date-rules';
import { recomputeTaskSchedule } from '../../../core/utils/task-progress';
import { taskAccentColor } from '../../../core/utils/task-colors';

export interface TaskStats {
  totalHalfDays: number;
  workedHalfDays: number;
  remainingHalfDays: number;
  progressPercent: number;
  missingHalfDays: number;
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-modal.component.html',
  styleUrls: ['./task-modal.component.scss']
})
export class TaskModalComponent implements OnChanges {
  @Input() users: User[] = [];
  // Non-null : le modal s'ouvre en mode édition, pré-rempli avec cette tâche.
  @Input() task: ProjectTask | null = null;
  // Requis en mode création (à quel projet rattacher la nouvelle tâche).
  @Input() projectId: number | null = null;
  @Input() open = false;
  // Porte les contraintes de planification (excludeWeekends/excludeHolidays) à valider.
  @Input() project: Project | null = null;
  // Congés/absences par développeur (voir planning-agenda) : sert uniquement à avertir si le
  // développeur sélectionné est indisponible sur la période choisie — n'empêche pas l'enregistrement
  // (une affectation malgré congés reste une décision du chef de projet, pas une règle bloquante).
  @Input() unavailabilities: UnavailabilityPeriod[] = [];

  @Output() created = new EventEmitter<CreateTaskPayload>();
  @Output() updated = new EventEmitter<UpdateTaskPayload>();
  @Output() deleted = new EventEmitter<number>();
  @Output() closed = new EventEmitter<void>();

  form = this.emptyForm();
  errorMessage: string | null = null;
  // Confirmation de suppression intégrée à l'UI (pas de confirm() natif, qui bloque
  // l'automatisation/les tests et casse l'expérience d'une SPA).
  confirmingDelete = false;

  // Sous-tâches : copie locale (optimiste) de task.subTasks, car l'input [task] ne se
  // rafraîchit pas tant que le modal reste ouvert après un enregistrement — on la met donc à
  // jour manuellement à chaque ajout/suppression. Le formulaire d'ajout reste toujours affiché.
  // Ni date ni statut ne se saisissent ici : une sous-tâche naît "Non commencé" sans date, et ne
  // devient "Terminé" (avec sa date de validation) qu'en cochant la case dans le popup demi-journée.
  subTasksList: SubTask[] = [];
  newSubTask: { title: string } = { title: '' };

  // Ajout manuel de jours (indépendant de l'input Date Fin), avec commentaire obligatoire.
  showAddDaysForm = false;
  addDaysCount = 1;
  addDaysComment = '';

  /**
   * Miroir local du plan de la tâche (dates, durée, ancre, extensions), même raison que
   * `subTasksList` ci-dessus : l'input `[task]` ne se rafraîchit PAS tant que le modal reste
   * ouvert. « Ajouter des jours » enregistre puis laisse le modal ouvert — sans ce miroir, les
   * jours ajoutés n'apparaissaient nulle part, et l'enregistrement suivant renvoyait l'ancien
   * plan lu dans `this.task`, écrasant à la fois la nouvelle fin, la durée et l'extension.
   * C'est ce miroir (jamais `this.task`) qui fait foi pour l'affichage et pour onSubmit.
   */
  plan: { dateStart: string; dateEnd: string; halfDaysDuration: number; baseDateEnd?: string } = {
    dateStart: '', dateEnd: '', halfDaysDuration: 0
  };
  extensionsList: TaskExtension[] = [];

  // Une tâche Terminée s'ouvre en lecture seule (principe : plus rien à modifier une fois
  // terminée) ; ce drapeau est l'échappatoire explicite pour repasser au formulaire d'édition.
  editUnlocked = false;

  get isEditMode(): boolean {
    return !!this.task;
  }

  get isReadOnlyMode(): boolean {
    return this.isEditMode && this.task?.status === 'TERMINER' && !this.editUnlocked;
  }

  unlockEdit(): void {
    this.editUnlocked = true;
  }

  get assignedDevLabel(): string {
    const dev = this.users.find(u => u.id === this.task?.assignedUserId);
    return dev ? `${dev.firstname} ${dev.lastname}` : 'Non assigné';
  }

  /** Historique des changements de statut / développeur (voir home-agenda.component.ts), plus récent en premier. */
  get taskHistoryMostRecentFirst(): TaskHistoryEntry[] {
    return [...(this.task?.history || [])].reverse();
  }

  /**
   * Contour du modal coloré comme le bandeau sous la tuile de cette tâche en vue mois (même
   * couleur d'accent, voir utils/task-colors.ts) : repère immédiat de la tâche qu'on est en train
   * d'éditer. En création (pas encore de tâche/id), reprend la couleur neutre de la marque.
   */
  get modalAccentColor(): string {
    return this.task ? taskAccentColor(this.task) : '#00205b';
  }

  /**
   * Avertissement (non bloquant) si le développeur actuellement sélectionné dans le formulaire a
   * une période de congé/absence chevauchant les dates de la tâche. Recalculé à chaque frappe
   * (dates ou développeur) puisqu'il lit directement `this.form`, pas une valeur figée à l'ouverture.
   */
  get assignedDevUnavailabilityWarning(): string | null {
    const devId = this.form.assignedUserId;
    if (!devId || !this.form.dateStart || !this.form.dateEnd) return null;
    const overlapping = this.unavailabilities.filter(u =>
      u.userId === devId && u.dateStart <= this.form.dateEnd && u.dateEnd >= this.form.dateStart
    );
    if (overlapping.length === 0) return null;
    const dev = this.users.find(u => u.id === devId);
    const devName = dev ? `${dev.firstname} ${dev.lastname}` : 'Ce développeur';
    const periods = overlapping.map(u => `${u.dateStart} → ${u.dateEnd}${u.reason ? ' (' + u.reason + ')' : ''}`).join(', ');
    return `${devName} est indisponible sur une partie de cette période : ${periods}.`;
  }

  /** Tâches du même projet pouvant être choisies comme "tâche prérequise" (jamais soi-même). */
  get availableBlockingTasks(): ProjectTask[] {
    return (this.project?.tasks || []).filter(t => t.id !== this.task?.id);
  }

  /**
   * Avertissement (non bloquant) si la tâche prérequise sélectionnée n'est pas encore Terminée :
   * n'empêche pas l'enregistrement, une dépendance peut être délibérément ignorée par le chef de
   * projet — c'est un repère visuel, pas une règle dure comme l'exclusion week-end/férié.
   */
  get blockingTaskWarning(): string | null {
    if (!this.form.parentTaskId) return null;
    const blocker = (this.project?.tasks || []).find(t => t.id === this.form.parentTaskId);
    if (!blocker || blocker.status === 'TERMINER') return null;
    return `Cette tâche dépend de « ${blocker.name} », qui n'est pas encore terminée.`;
  }

  /**
   * Une tâche déjà commencée (date de début atteinte ou dépassée) ne doit plus voir ses dates
   * de début/fin modifiées directement depuis ce formulaire : seul le bouton "Ajouter des jours"
   * (avec commentaire, tracé dans l'historique) reste actif pour prolonger le planning.
   */
  get isTaskStarted(): boolean {
    return this.isEditMode && !!this.task && this.task.dateStart <= TODAY_ISO;
  }

  /**
   * Tâche terminée : son plan est acquis. Dates ET développeur assigné sont figés (ici comme au
   * glisser-déposer, voir planning-agenda) — réaffecter ou déplacer après coup réécrirait un
   * travail déjà réalisé. Seul le statut reste modifiable, c'est la porte de sortie pour rouvrir
   * la tâche (voir onTaskUpdateRequested côté home-agenda, qui annule alors la dernière
   * demi-journée). On se base sur le statut ENREGISTRÉ, pas sur celui du formulaire : les champs
   * se débloquent une fois la réouverture réellement sauvegardée, pas au simple choix dans la liste.
   */
  get isTaskCompleted(): boolean {
    return this.isEditMode && this.task?.status === 'TERMINER';
  }

  /**
   * Dates et durée sont définies UNE SEULE FOIS, à la création : ensuite le plan ne se modifie
   * plus qu'en passant par « Ajouter des jours » (nombre de jours + commentaire obligatoire,
   * tracé dans les extensions). Éditer librement ces trois champs après coup contournerait cette
   * traçabilité et casserait le décompte des demi-journées déjà validées.
   */
  get areDatesLocked(): boolean {
    return this.isEditMode;
  }

  /**
   * Date de fin déduite du début et de la durée (jamais saisie) : la durée est exprimée en
   * demi-journées, donc en jours ouvrés arrondis au supérieur — 8 demi-journées = 4 jours, une
   * durée impaire occupant la matinée du dernier jour. Les jours exclus par le projet
   * (week-end/férié) sont sautés, comme partout ailleurs dans le planning.
   */
  private computeDateEnd(dateStart: string, halfDaysDuration: number): string {
    const workingDays = Math.max(1, Math.ceil(Number(halfDaysDuration) / 2));
    let dateEnd = dateStart;
    // Le jour de début compte déjà comme premier jour ouvré s'il est planifiable.
    let counted = isDateAllowed(dateEnd, this.project) ? 1 : 0;
    let guard = 0;
    while (counted < workingDays && guard < 1000) {
      dateEnd = addDaysIso(dateEnd, 1);
      if (isDateAllowed(dateEnd, this.project)) counted++;
      guard++;
    }
    return dateEnd;
  }

  /** Recalcule la date de fin à chaque changement de date de début ou de durée (création). */
  onPlanInputChanged(): void {
    if (this.isEditMode || !this.form.dateStart) return;
    this.form.dateEnd = this.computeDateEnd(this.form.dateStart, this.form.halfDaysDuration);
  }

  /**
   * Ligne récapitulative de TOUS les jours ajoutés (voir « Ajouter des jours ») : du premier jour
   * du premier ajout à la fin du dernier, avec le total. null tant qu'aucun jour n'a été ajouté.
   */
  get extensionsSummary(): { dateStart: string; dateEnd: string; totalDays: number } | null {
    const dated = this.extensionsList.filter(e => e.dateStart && e.dateEnd);
    if (dated.length === 0) return null;

    const totalDays = this.extensionsList.reduce((sum, e) => sum + e.addedDays, 0);
    return {
      dateStart: dated[0].dateStart as string,
      dateEnd: dated[dated.length - 1].dateEnd as string,
      totalDays
    };
  }

  /** Temps déjà travaillé / restant, dérivé des demi-journées cochées (matin/après-midi). */
  get taskStats(): TaskStats | null {
    if (!this.task) return null;

    // Durée lue dans le miroir local : après « Ajouter des jours » (modal resté ouvert),
    // this.task porte encore l'ancienne valeur et le temps restant afficherait 0.
    const totalHalfDays = this.plan.halfDaysDuration || this.task.halfDaysDuration;
    const workedHalfDays = Math.min((this.task.workedHalfDays || []).length, totalHalfDays);
    const remainingHalfDays = Math.max(0, totalHalfDays - workedHalfDays);
    const progressPercent = totalHalfDays > 0 ? Math.round((workedHalfDays / totalHalfDays) * 100) : 0;
    const { missingHalfDays } = recomputeTaskSchedule(this.task, this.project);

    return { totalHalfDays, workedHalfDays, remainingHalfDays, progressPercent, missingHalfDays };
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.errorMessage = null;
      this.confirmingDelete = false;
      this.showAddDaysForm = false;
      this.addDaysCount = 1;
      this.addDaysComment = '';
      this.editUnlocked = false;
    }
    if (changes['task'] || changes['open']) {
      if (this.task) {
        this.form = {
          name: this.task.name,
          description: this.task.description || '',
          assignedUserId: this.task.assignedUserId ?? null,
          dateStart: this.task.dateStart,
          dateEnd: this.task.dateEnd,
          halfDaysDuration: this.task.halfDaysDuration,
          comments: this.task.comments || '',
          isRisky: this.task.isRisky,
          status: this.task.status,
          gitBranch: this.task.gitBranch || '',
          parentTaskId: this.task.parentTaskId ?? null
        };
        this.subTasksList = (this.task.subTasks || []).map(st => ({ ...st }));
        this.newSubTask = { title: '' };
        this.plan = {
          dateStart: this.task.dateStart,
          dateEnd: this.task.dateEnd,
          halfDaysDuration: this.task.halfDaysDuration,
          baseDateEnd: this.task.baseDateEnd
        };
        this.extensionsList = (this.task.extensions || []).map(e => ({ ...e }));
      } else if (this.open) {
        this.form = this.emptyForm();
        this.subTasksList = [];
        this.newSubTask = { title: '' };
        this.plan = { dateStart: '', dateEnd: '', halfDaysDuration: 0 };
        this.extensionsList = [];
      }
    }
  }

  private emptyForm() {
    return {
      name: '',
      description: '',
      assignedUserId: null as number | null,
      dateStart: '',
      dateEnd: '',
      halfDaysDuration: 1,
      comments: '',
      isRisky: false,
      status: 'NON_COMMENCE' as TaskStatus,
      gitBranch: '',
      parentTaskId: null as number | null
    };
  }

  onSubmit(): void {
    if (!this.form.name || !this.form.dateStart || !this.form.dateEnd) return;

    this.errorMessage = dateRejectionReason(this.form.dateStart, this.project)
      || dateRejectionReason(this.form.dateEnd, this.project);
    if (this.errorMessage) return;

    // En édition, le plan (dates + durée) et — pour une tâche terminée — le développeur assigné
    // sont figés : on renvoie systématiquement les valeurs ENREGISTRÉES. Les champs sont déjà
    // désactivés côté formulaire ; ce filet évite qu'une valeur héritée d'un rendu précédent ou
    // une manipulation du DOM ne réécrive un plan qui ne doit changer que via « Ajouter des jours ».
    const editing = this.isEditMode && this.task;

    const base = {
      name: this.form.name,
      description: this.form.description,
      assignedUserId: this.isTaskCompleted && this.task
        ? (this.task.assignedUserId ?? null)
        : this.form.assignedUserId,
      dateStart: editing ? this.plan.dateStart : this.form.dateStart,
      dateEnd: editing ? this.plan.dateEnd : this.form.dateEnd,
      halfDaysDuration: editing ? this.plan.halfDaysDuration : Number(this.form.halfDaysDuration),
      comments: this.form.comments,
      isRisky: this.form.isRisky,
      status: this.form.status,
      gitBranch: this.form.gitBranch || undefined,
      parentTaskId: this.form.parentTaskId
    };

    if (this.isEditMode && this.task) {
      // baseDateEnd (ancre du plan initial) n'est JAMAIS redéfini par un enregistrement manuel :
      // les dates ne sont plus modifiables ici, et task.dateEnd peut avoir été auto-prolongé par
      // recomputeTaskSchedule. Le reprendre ferait avancer l'ancre à chaque sauvegarde, même pour
      // un champ sans rapport (commentaire, statut...), et le recalcul automatique rallongerait
      // alors la tâche un peu plus à chaque fois (cf. CLAUDE.md). Seul confirmAddDays ci-dessous
      // redéfinit le plan. workedHalfDays/extensions/subTasks sont préservés (gérés par leurs
      // propres contrôles, pas ce formulaire).
      this.updated.emit({
        ...base,
        id: this.task.id,
        baseDateEnd: this.plan.baseDateEnd,
        workedHalfDays: this.task.workedHalfDays,
        extensions: this.extensionsList,
        subTasks: this.subTasksList
      });
    } else {
      this.created.emit(base);
    }
    this.close();
  }

  // ==========================================================================
  // SOUS-TÂCHES (titre, date de fin, état) — visibles uniquement en mode édition.
  // Le formulaire d'ajout reste toujours affiché ; valider enregistre la sous-tâche, l'affiche
  // dans la liste ci-dessous, et revide le formulaire pour la suivante.
  // ==========================================================================

  addSubTask(): void {
    if (!this.task || !this.newSubTask.title.trim()) return;

    const entry: SubTask = {
      id: Date.now(),
      title: this.newSubTask.title.trim(),
      status: 'NON_COMMENCE'
      // dateEnd volontairement omis : posée uniquement à la validation via le popup demi-journée.
    };
    this.subTasksList = [...this.subTasksList, entry];
    this.persistSubTasks();
    this.newSubTask = { title: '' };
  }

  private static readonly SUBTASK_STATUS_LABELS: Record<TaskStatus, string> = {
    NON_COMMENCE: 'Non commencé',
    EN_ATTENTE: 'En attente',
    EN_COURS: 'En cours',
    TERMINER: 'Terminé'
  };

  subTaskStatusLabel(status: TaskStatus): string {
    return TaskModalComponent.SUBTASK_STATUS_LABELS[status] ?? status;
  }

  /** Annule la validation d'une sous-tâche : retour à "Non commencé" et suppression de sa date. */
  cancelSubTaskValidation(id: number): void {
    this.subTasksList = this.subTasksList.map(st =>
      st.id === id ? { ...st, status: 'NON_COMMENCE' as TaskStatus, dateEnd: undefined } : st
    );
    this.persistSubTasks();
  }

  deleteSubTask(id: number): void {
    this.subTasksList = this.subTasksList.filter(st => st.id !== id);
    this.persistSubTasks();
  }

  private persistSubTasks(): void {
    if (!this.task) return;
    this.updated.emit({
      id: this.task.id,
      name: this.task.name,
      description: this.task.description,
      status: this.task.status,
      assignedUserId: this.task.assignedUserId ?? null,
      dateStart: this.task.dateStart,
      dateEnd: this.task.dateEnd,
      halfDaysDuration: this.task.halfDaysDuration,
      comments: this.task.comments,
      isRisky: this.task.isRisky,
      gitBranch: this.task.gitBranch,
      workedHalfDays: this.task.workedHalfDays,
      extensions: this.task.extensions,
      subTasks: this.subTasksList
    });
    // Le modal reste ouvert : on peut continuer à ajouter/éditer d'autres sous-tâches.
  }

  // ==========================================================================
  // AJOUT MANUEL DE JOURS (avec commentaire), indépendant de l'input Date Fin.
  // ==========================================================================

  toggleAddDaysForm(): void {
    this.showAddDaysForm = !this.showAddDaysForm;
    this.addDaysCount = 1;
    this.addDaysComment = '';
  }

  confirmAddDays(): void {
    if (!this.task || !this.addDaysComment.trim() || this.addDaysCount < 1) return;

    // Point de départ : le plan COURANT (miroir local), pas this.task — deux ajouts successifs
    // sans fermer le modal doivent se cumuler, or this.task reste figé sur l'état d'ouverture.
    const previousEnd = this.plan.dateEnd;
    let newDateEnd = previousEnd;
    // Premier jour ouvré suivant la fin actuelle : début de la plage ajoutée (les jours ajoutés
    // se rattachent bout à bout à la tâche, ils ne créent pas une seconde période détachée).
    let extensionStart: string | null = null;
    let added = 0;
    let attempts = 0;
    while (added < this.addDaysCount && attempts < 200) {
      newDateEnd = addDaysIso(newDateEnd, 1);
      if (isDateAllowed(newDateEnd, this.project)) {
        added++;
        if (extensionStart === null) extensionStart = newDateEnd;
      }
      attempts++;
    }

    // Les jours ajoutés sont du travail en plus, pas seulement du délai : sans augmenter la
    // durée, la tâche afficherait plus de tuiles que de demi-journées à faire.
    const newDuration = this.plan.halfDaysDuration + this.addDaysCount * 2;

    this.extensionsList = [
      ...this.extensionsList,
      {
        date: TODAY_ISO,
        addedDays: this.addDaysCount,
        comment: this.addDaysComment.trim(),
        dateStart: extensionStart ?? newDateEnd,
        dateEnd: newDateEnd
      }
    ];

    // Miroir local mis à jour AVANT l'émission : le modal reste ouvert, il doit afficher
    // immédiatement la nouvelle fin, la nouvelle durée et la ligne récapitulative.
    this.plan = {
      ...this.plan,
      dateEnd: newDateEnd,
      halfDaysDuration: newDuration,
      // Un ajout manuel redéfinit le plan : les jours ajoutés ne doivent pas être re-comptés
      // comme "manquants" par le recalcul automatique des cases matin/après-midi.
      baseDateEnd: newDateEnd
    };
    this.form.dateEnd = newDateEnd;
    this.form.halfDaysDuration = newDuration;

    this.updated.emit({
      id: this.task.id,
      name: this.task.name,
      description: this.task.description,
      status: this.task.status,
      assignedUserId: this.task.assignedUserId ?? null,
      dateStart: this.plan.dateStart,
      dateEnd: newDateEnd,
      baseDateEnd: newDateEnd,
      halfDaysDuration: newDuration,
      comments: this.task.comments,
      isRisky: this.task.isRisky,
      gitBranch: this.task.gitBranch,
      workedHalfDays: this.task.workedHalfDays,
      extensions: this.extensionsList,
      subTasks: this.subTasksList
    });

    this.showAddDaysForm = false;
    this.addDaysCount = 1;
    this.addDaysComment = '';
  }

  onDelete(): void {
    if (!this.task) return;
    if (!this.confirmingDelete) {
      this.confirmingDelete = true;
      return;
    }
    this.deleted.emit(this.task.id);
    this.close();
  }

  cancelDelete(): void {
    this.confirmingDelete = false;
  }

  close(): void {
    this.confirmingDelete = false;
    this.closed.emit();
  }
}
