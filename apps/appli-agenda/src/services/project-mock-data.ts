// =============================================================================
// Données de démo initiales (état par défaut avant tout appel réseau), et repli utilisé par
// ProjectService quand le backend agenda est indisponible (voir ProjectService.apiIssue$).
// Extrait de ProjectService pour ne pas mêler données statiques et orchestration API/cache.
// =============================================================================

import { Project, User } from '../models/project.model';

export function getInitialMockUsers(): User[] {
  return [
    { id: 12, matricule: 'X495776', firstname: 'Johann', lastname: 'LOREAU', email: 'X495776@airbus.com', role: 'ADMIN', groupe: 'Developpeur', is_active: true },
    { id: 22, matricule: 'X602446', firstname: 'Guillaume', lastname: 'BARDOUX', email: 'X602446@airbus.com', role: 'ADMIN', groupe: 'Developpeur', is_active: true }
  ];
}

export function getInitialMockProjects(): Project[] {
  const devs = getInitialMockUsers();
  return [
    {
      id: 1,
      code: 'PRJ-SI-001',
      name: 'Refonte Interface Nursery SI',
      description: 'Migration vers Angular Standalone et intégration SOLACE dans le Monorepo NX',
      status: 'EN_COURS',
      riskLevel: 'MOYEN',
      dateStart: '2026-07-20',
      dateEndEstimated: '2026-08-14',
      estimatedTimeDays: 15.0,
      createdByMatricule: 'X495776',
      developers: [devs[0], devs[1]],
      progressPercent: 33,
      tasks: [
        {
          id: 101,
          projectId: 1,
          name: 'Découpage Composants Standalone Header/Footer',
          status: 'TERMINER',
          assignedUserId: 12,
          assignedUser: devs[0],
          dateStart: '2026-07-20',
          dateEnd: '2026-07-21',
          // Ancrage fixe pour recomputeTaskSchedule (utils/task-progress.ts) : sans lui, le calcul
          // se rabat sur dateEnd (une cible mobile qu'il vient lui-même de modifier), ce qui
          // provoque une extension de la tâche qui s'aggrave à chaque rechargement.
          baseDateEnd: '2026-07-21',
          halfDaysDuration: 4.0,
          comments: 'Validé avec la charte Airbus',
          isRisky: false
        },
        {
          id: 102,
          projectId: 1,
          name: 'Service HTTP Proxy & Mock APIs Relative',
          status: 'EN_COURS',
          assignedUserId: 12,
          assignedUser: devs[0],
          dateStart: '2026-07-22',
          dateEnd: '2026-07-24',
          baseDateEnd: '2026-07-24',
          halfDaysDuration: 6.0,
          comments: 'En attente validation CORS backend',
          isRisky: true
        },
        {
          id: 103,
          projectId: 1,
          name: 'Composant Planning Gantt & Agenda par Dev',
          status: 'EN_COURS',
          assignedUserId: 22,
          assignedUser: devs[1],
          dateStart: '2026-07-23',
          dateEnd: '2026-07-28',
          baseDateEnd: '2026-07-28',
          halfDaysDuration: 8.0,
          comments: 'Intégration du découpage en demi-journées',
          isRisky: false
        }
      ]
    },
    {
      id: 2,
      code: 'PRJ-SOL-002',
      name: 'Supervision Streaming MQTT Solace',
      description: 'Tableau de bord temps réel pour les flux Solace du centre de formation',
      status: 'A_FAIRE',
      riskLevel: 'FAIBLE',
      dateStart: '2026-08-03',
      dateEndEstimated: '2026-08-28',
      estimatedTimeDays: 10.0,
      createdByMatricule: 'X495776',
      developers: [devs[0], devs[1]],
      progressPercent: 0,
      tasks: [
        {
          id: 201,
          projectId: 2,
          name: 'Broker MQTT Client RXJS Integration',
          status: 'NON_COMMENCE',
          assignedUserId: 22,
          assignedUser: devs[1],
          dateStart: '2026-08-03',
          dateEnd: '2026-08-07',
          baseDateEnd: '2026-08-07',
          halfDaysDuration: 10.0,
          comments: 'Prévoir clés certificat SSL',
          isRisky: false
        }
      ]
    }
  ];
}
