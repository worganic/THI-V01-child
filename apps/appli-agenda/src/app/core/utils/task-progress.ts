// =============================================================================
// Suivi du temps réel passé sur une tâche (cases matin/après-midi) :
// - les demi-journées non cochées sur des jours déjà conclus prolongent la tâche ;
// - une fois le total de demi-journées travaillées atteint, la tâche passe "Terminé".
// =============================================================================

import { Project, ProjectTask } from '../models/project.model';
import { isDateAllowed, TODAY_ISO } from './date-rules';

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

type ProjectRules = Pick<Project, 'excludeWeekends' | 'excludeHolidays' | 'weekendsRuleFrom' | 'holidaysRuleFrom'> | null | undefined;

/** Jours ouvrés (selon les règles du projet) entre dateStart et dateEnd inclus. */
export function allowedDaysInRange(dateStart: string, dateEnd: string, project: ProjectRules): string[] {
  const days: string[] = [];
  let d = dateStart;
  let guard = 0;
  while (d <= dateEnd && guard < 1000) {
    if (isDateAllowed(d, project)) days.push(d);
    d = addDaysIso(d, 1);
    guard++;
  }
  return days;
}

export function halfDayKey(dateSql: string, period: 'AM' | 'PM'): string {
  return `${dateSql}-${period}`;
}

/**
 * Recalcule la date de fin et le statut d'une tâche après un changement de case
 * matin/après-midi : les demi-journées manquantes sur les jours déjà conclus (avant
 * aujourd'hui) prolongent automatiquement la tâche ; si le total de demi-journées
 * travaillées atteint la durée prévue, la tâche passe "Terminé".
 */
export function recomputeTaskSchedule(
  task: Pick<ProjectTask, 'dateStart' | 'dateEnd' | 'baseDateEnd' | 'halfDaysDuration' | 'workedHalfDays' | 'status'>,
  project: ProjectRules
): { dateEnd: string; status: ProjectTask['status']; missingHalfDays: number; partialFinalDay: boolean } {
  // Une tâche déjà marquée Terminée (via le statut, indépendamment des cases cochées) n'a plus
  // rien de "manquant" : ne pas la compter en retard ni toucher à sa date de fin.
  if (task.status === 'TERMINER') {
    return { dateEnd: task.dateEnd, status: task.status, missingHalfDays: 0, partialFinalDay: false };
  }

  const baseEnd = task.baseDateEnd || task.dateEnd;
  const worked = new Set(task.workedHalfDays || []);

  // 1. Jours "conclus" = jours ouvrés du planning initial déjà passés (avant aujourd'hui).
  const plannedDays = allowedDaysInRange(task.dateStart, baseEnd, project);
  let missingHalfDays = 0;
  for (const day of plannedDays) {
    if (day >= TODAY_ISO) continue; // jour non conclu, pas encore évalué
    if (!worked.has(halfDayKey(day, 'AM'))) missingHalfDays++;
    if (!worked.has(halfDayKey(day, 'PM'))) missingHalfDays++;
  }

  // 2. Étend la date de fin pour compenser les demi-journées manquantes (jours ouvrés uniquement).
  const extensionDays = Math.ceil(missingHalfDays / 2);
  let newDateEnd = baseEnd;
  let added = 0;
  let guard = 0;
  while (added < extensionDays && guard < 1000) {
    newDateEnd = addDaysIso(newDateEnd, 1);
    if (isDateAllowed(newDateEnd, project)) added++;
    guard++;
  }

  // 3. Total de demi-journées travaillées dans la plage finale -> passage automatique à Terminé
  //    (jamais de rétrogradation automatique : un statut Terminé existant est conservé).
  const finalDays = allowedDaysInRange(task.dateStart, newDateEnd, project);
  let workedCount = 0;
  for (const day of finalDays) {
    if (worked.has(halfDayKey(day, 'AM'))) workedCount++;
    if (worked.has(halfDayKey(day, 'PM'))) workedCount++;
  }
  const status: ProjectTask['status'] = workedCount >= task.halfDaysDuration ? 'TERMINER' : task.status;

  // Si le nombre de demi-journées manquantes est impair, le dernier jour ajouté ne "rembourse"
  // qu'une seule demi-journée (le matin) : la case après-midi de ce jour-là n'a pas lieu d'être.
  const partialFinalDay = extensionDays > 0 && missingHalfDays % 2 === 1;

  return { dateEnd: newDateEnd, status, missingHalfDays, partialFinalDay };
}
