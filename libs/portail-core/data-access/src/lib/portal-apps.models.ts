/**
 * Modèles du portail applicatif : sous-applications listées sur la page
 * d'accueil, groupes qui les regroupent, métiers des utilisateurs et droits.
 * Persistés en MySQL (tables portal_*), voir server/modules/portal-apps.js.
 */

export interface PortalApp {
  id: number;
  /** Identifiant technique stable (ex: `appli-agenda`) — unique en base. */
  code: string;
  nom: string;
  description: string;
  /** URL de la sous-application (absolue) ou route interne du portail (`/documents`). */
  urlPath: string;
  /** Nom d'icône Material Symbols. */
  icone: string;
  ordre: number;
  isActive: boolean;
  /** Renseigné uniquement par le dashboard d'accueil. */
  droits?: PortalDroit;
}

export interface PortalGroupe {
  id: number;
  nom: string;
  description: string;
  ordre: number;
  isActive: boolean;
}

/** Groupe enrichi de ses applications — payload de la page d'accueil. */
export interface PortalGroupeAvecApps extends PortalGroupe {
  apps: PortalApp[];
}

export interface PortalMetier {
  id: number;
  nom: string;
  /** Une des 6 teintes de METIER_COLORS. */
  color: string;
  isActive: boolean;
}

export interface PortalUser {
  id: string;
  username: string;
  email: string;
  role: string;
  metierId: number | null;
  metierNom: string | null;
  metierColor: string | null;
  createdAt: string | null;
  lastLogin: string | null;
}

export type PortalDroit = 'lecture' | 'ecriture' | 'admin';

export interface PortalGroupeApp {
  id: number;
  groupeId: number;
  appId: number;
}

export interface PortalUserGroupe {
  id: number;
  userId: string;
  groupeId: number;
}

export interface PortalUserApp {
  id: number;
  userId: string;
  appId: number;
  droits: PortalDroit;
}

export interface PortalHomeDashboard {
  groupes: PortalGroupeAvecApps[];
  isAdmin: boolean;
}

/** Teintes disponibles pour les tags métier (classes Tailwind figées, thème clair + sombre). */
export const METIER_COLORS: { value: string; label: string; badgeClass: string }[] = [
  { value: 'blue',   label: 'Bleu',    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30' },
  { value: 'green',  label: 'Vert',    badgeClass: 'bg-green-500/10 text-green-600 dark:text-green-300 border-green-500/30' },
  { value: 'purple', label: 'Violet',  badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30' },
  { value: 'amber',  label: 'Ambre',   badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30' },
  { value: 'slate',  label: 'Ardoise', badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30' },
  { value: 'red',    label: 'Rouge',   badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30' },
];

export function metierBadgeClass(color: string | null | undefined): string {
  return METIER_COLORS.find(c => c.value === color)?.badgeClass ?? METIER_COLORS[4].badgeClass;
}
