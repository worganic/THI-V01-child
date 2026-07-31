// =============================================================================
// Calcul de l'avancement d'un projet à partir de ses tâches — extrait de ProjectService pour
// séparer le calcul métier (pur, sans état ni appel réseau) de l'orchestration API/cache.
// =============================================================================

import { Project } from '../models/project.model';

/** Pourcentage de tâches Terminées sur le total, pour chaque projet fourni. */
export function calculateProjectsProgress(projects: Project[]): Project[] {
  return projects.map(p => {
    if (!p.tasks || p.tasks.length === 0) {
      return { ...p, progressPercent: 0 };
    }
    const finished = p.tasks.filter(t => t.status === 'TERMINER').length;
    const progressPercent = Math.round((finished / p.tasks.length) * 100);
    return { ...p, progressPercent };
  });
}
