// =============================================================================
// Couleur d'accent stable par tâche (indexée sur son id), utilisée pour repérer visuellement une
// tâche précise : bandeau sous les tuiles de la vue mois, contour du modal d'édition de cette
// même tâche. Volontairement distincte du rouge (liseré "à risque") et du vert/noir des statuts.
// =============================================================================

import { ProjectTask } from '../models/project.model';

const TASK_ACCENT_COLORS = [
  '#7c3aed', '#eab308', '#0ea5e9', '#db2777', '#f97316',
  '#0891b2', '#a16207', '#4338ca', '#0d9488', '#be185d'
];

export function taskAccentColor(task: Pick<ProjectTask, 'id'>): string {
  return TASK_ACCENT_COLORS[task.id % TASK_ACCENT_COLORS.length];
}
