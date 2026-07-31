// =============================================================================
// Modèles de données TypeScript - Agenda & Gestion de Projets Airbus Helicopters
// =============================================================================

export type ProjectStatus = 'A_FAIRE' | 'EN_COURS' | 'TERMINER';
export type TaskStatus = 'NON_COMMENCE' | 'EN_ATTENTE' | 'EN_COURS' | 'TERMINER';
export type RiskLevel = 'FAIBLE' | 'MOYEN' | 'ELEVE';

/**
 * Métier (Dev/Infra/Media...), géré depuis Admin > Métiers (portail-shell) — plus depuis l'agenda
 * lui-même. Un projet peut être rattaché à plusieurs métiers (contrairement à un utilisateur, qui
 * n'en a qu'un seul, voir apps/portail-shell/src/models/admin.models.ts). `color` référence une des
 * 6 teintes du design system (voir utils/metier-colors.ts et --category-* dans
 * global-design.scss — nom historique de ces variables, partagées avec les autres badges colorés
 * du portail) plutôt qu'une couleur libre : badge cohérent avec le reste du portail et adapté au
 * thème sombre sans configuration supplémentaire.
 */
export interface ProjectMetier {
  id: number;
  nom: string;
  color: string;
}

export interface User {
  id: number;
  matricule: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  groupe?: string;
  is_active?: boolean;
  avatar?: string;
  // Métier (voir ProjectMetier) : au plus un par utilisateur — permet de filtrer, dans le
  // formulaire projet, les développeurs proposés selon le(s) métier(s) coché(s) du projet.
  metier_id?: number | null;
}

/**
 * Période d'indisponibilité (congés/absence) d'un développeur, indépendante de tout projet —
 * affichée en surimpression sur le planning et en avertissement lors de l'assignation d'une tâche.
 */
export interface UnavailabilityPeriod {
  id: number;
  userId: number;
  dateStart: string; // ISO Date YYYY-MM-DD
  dateEnd: string;   // ISO Date YYYY-MM-DD, inclusive
  reason?: string;
}

export interface CreateUnavailabilityPayload {
  userId: number;
  dateStart: string;
  dateEnd: string;
  reason?: string;
}

export interface SubTask {
  id: number;
  title: string;
  // Date de validation (coche cochée dans le popup demi-journée) : absente tant que la
  // sous-tâche n'est pas Terminée, jamais saisie manuellement.
  dateEnd?: string; // ISO Date YYYY-MM-DD
  status: TaskStatus;
}

/** Trace d'une extension manuelle de tâche (bouton "+ jours" du modal, avec commentaire). */
export interface TaskExtension {
  date: string; // date ISO à laquelle l'extension a été ajoutée
  addedDays: number;
  comment: string;
  // Plage réellement couverte par les jours ajoutés : premier jour ouvré suivant la fin
  // précédente -> nouvelle date de fin. Stockée plutôt que recalculée, car la fin d'origine
  // est écrasée à chaque ajout (baseDateEnd suit le nouveau plan) et ne serait donc plus
  // reconstituable ensuite. Alimente la ligne récapitulative du modal (voir extensionsSummary).
  dateStart?: string;
  dateEnd?: string;
}

/**
 * Entrée d'historique d'une tâche : changement de statut ou de développeur assigné. Calculée
 * automatiquement (voir home-agenda.component.ts onTaskUpdateRequested) en comparant l'état
 * précédent au nouveau à chaque enregistrement — jamais saisie manuellement, contrairement aux
 * extensions de date qui portent un commentaire libre.
 */
export interface TaskHistoryEntry {
  date: string; // date ISO du changement
  message: string;
}

export interface ProjectTask {
  id: number;
  projectId: number;
  // Id d'une AUTRE tâche du même projet devant être Terminée avant que celle-ci ne démarre
  // ("tâche prérequise", sélectionnée dans le modal). Non bloquant : sert d'avertissement, pas
  // d'interdiction — l'utilisateur reste libre de démarrer quand même si le contexte le justifie.
  parentTaskId?: number | null;
  name: string;
  description?: string;
  status: TaskStatus;
  assignedUserId?: number | null;
  assignedUser?: User;
  dateStart: string; // ISO Date YYYY-MM-DD
  dateEnd: string;   // ISO Date YYYY-MM-DD
  // Date de fin initialement prévue (avant toute extension automatique ou manuelle) : sert de
  // référence pour savoir quels jours sont "conclus" et calculer les demi-journées manquantes.
  baseDateEnd?: string;
  halfDaysDuration: number; // ex: 1 = 0.5 jour, 2 = 1 jour, 3 = 1.5 jours, etc.
  comments?: string;
  isRisky: boolean;
  gitBranch?: string; // ex: feat/agenda-drag-drop
  // Demi-journées marquées "travaillées" (case cochée), au format "YYYY-MM-DD-AM"/"YYYY-MM-DD-PM".
  workedHalfDays?: string[];
  extensions?: TaskExtension[]; // historique des ajouts manuels de jours (+ commentaire)
  history?: TaskHistoryEntry[]; // historique des changements de statut / développeur assigné
  subTasks?: SubTask[]; // visibles uniquement dans le modal d'édition, pas dans la grille
}

export interface Project {
  id: number;
  code: string;
  name: string;
  description: string;
  status: ProjectStatus;
  riskLevel: RiskLevel;
  dateStart: string; // ISO Date YYYY-MM-DD
  dateEndEstimated: string; // ISO Date YYYY-MM-DD
  estimatedTimeDays: number;
  createdByMatricule: string;
  developers: User[];
  tasks: ProjectTask[];
  progressPercent?: number;
  // Métiers du projet (voir ProjectMetier) : un projet peut être rattaché à plusieurs métiers,
  // ou rester non rattaché (tableau vide).
  metierIds?: number[];
  metiers?: ProjectMetier[];
  // Contraintes de planification : si activées, aucune tâche ne peut être créée/déplacée
  // sur un week-end et/ou un jour férié (voir utils/date-rules.ts).
  excludeWeekends?: boolean;
  excludeHolidays?: boolean;
  // Date (incluse) à partir de laquelle la contrainte correspondante s'applique. null/absent =
  // depuis toujours (projet créé avec la règle déjà active). Posée à demain quand l'utilisateur
  // ACTIVE la règle sur un projet existant : les jours déjà passés — et aujourd'hui — gardent
  // alors l'affichage et le découpage qu'ils avaient, une règle nouvellement activée ne devant
  // jamais réécrire du travail déjà effectué (voir isDateAllowed).
  weekendsRuleFrom?: string | null;
  holidaysRuleFrom?: string | null;
}

export interface CreateProjectPayload {
  code: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  dateStart: string;
  dateEndEstimated: string;
  estimatedTimeDays: number;
  developerIds: number[];
  excludeWeekends?: boolean;
  excludeHolidays?: boolean;
  metierIds?: number[];
  tasks: Array<{
    name: string;
    assignedUserId?: number;
    dateStart: string;
    dateEnd: string;
    halfDaysDuration: number;
    comments?: string;
    isRisky?: boolean;
  }>;
}

export interface UpdateProjectPayload {
  id: number;
  code: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  dateStart: string;
  dateEndEstimated: string;
  estimatedTimeDays: number;
  developerIds: number[];
  excludeWeekends?: boolean;
  excludeHolidays?: boolean;
  metierIds?: number[];
  // Voir Project : recalculées à chaque édition selon que la règle vient d'être activée ou non.
  weekendsRuleFrom?: string | null;
  holidaysRuleFrom?: string | null;
}

export interface CreateTaskPayload {
  name: string;
  description?: string;
  status?: TaskStatus;
  assignedUserId?: number | null;
  dateStart: string;
  dateEnd: string;
  halfDaysDuration: number;
  comments?: string;
  isRisky?: boolean;
  gitBranch?: string;
  workedHalfDays?: string[];
  extensions?: TaskExtension[];
  history?: TaskHistoryEntry[];
  subTasks?: SubTask[];
  baseDateEnd?: string;
  // Tâche prérequise (doit être Terminée avant que celle-ci ne démarre) — voir ProjectTask.parentTaskId.
  parentTaskId?: number | null;
}

export interface UpdateTaskPayload extends CreateTaskPayload {
  id: number;
  status: TaskStatus;
}

export interface DayAgendaSlot {
  dateSql: string; // YYYY-MM-DD
  dayName: string; // Lundi, Mardi...
  dayNumber: number;
  isWeekend: boolean;
  isHoliday: boolean;
  isToday: boolean;
  // Antérieur à aujourd'hui (TODAY_ISO) : affiché en fond gris moyen, vue jour et vue mois.
  isPast: boolean;
  // Vue mois uniquement : jour de complément appartenant au mois précédent/suivant, affiché en
  // grisé pour compléter la première et la dernière semaine de la grille.
  isOutsideMonth?: boolean;
  tasksByDev: Map<number, ProjectTask[]>; // devId -> tasks
}

/**
 * Format d'affichage du planning : 'days' = grille Gantt par demi-journées (une colonne par jour,
 * une ligne par développeur), 'month' = calendrier mensuel (7 colonnes, une case par jour).
 */
export type PlanningViewMode = 'days' | 'month';