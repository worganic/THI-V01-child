/**
 * Modèles du portail applicatif : sous-applications listées sur la page
 * d'accueil, groupes qui les regroupent, métiers des utilisateurs et droits.
 * Persistés en base (tables portal_*), voir server/modules/portal-apps.js.
 *
 * Fichier volontairement identique dans les deux monorepos : c'est le
 * vocabulaire du catalogue d'applications, sur lequel s'appuie l'entrée
 * `CATALOG_ENTRY` que chaque sous-application porte dans son propre
 * `server/index.js`.
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
  /**
   * Calculé côté serveur au démarrage (jamais stocké) : `false` si l'entrée
   * pointe vers une route interne dont le module backend n'a pas été monté
   * (dossier de la sous-application absent de cette installation) — voir
   * markAppMounted/isAppAvailable dans server/modules/portal-apps.js. Les
   * applications externes (URL absolue) sont toujours considérées disponibles.
   */
  isAvailable?: boolean;
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
  /** Une des 6 teintes de METIER_COLOR_OPTIONS. */
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

export interface MetierColorOption {
  value: string;
  label: string;
}

/**
 * Vocabulaire des teintes de métier — 6 valeurs fixes plutôt qu'une couleur
 * libre. Volontairement sans classe de framework : chaque portail décide du
 * rendu en définissant ses propres règles `.metier-*` dans sa feuille de
 * styles, adossées à ses teintes `--category-*`. C'est ce qui permet à ce
 * fichier d'être identique dans les deux monorepos alors que l'un est en
 * Bootstrap et l'autre en Tailwind.
 */
export const METIER_COLOR_OPTIONS: MetierColorOption[] = [
  { value: 'blue',   label: 'Bleu' },
  { value: 'green',  label: 'Vert' },
  { value: 'purple', label: 'Violet' },
  { value: 'amber',  label: 'Ambre' },
  { value: 'slate',  label: 'Ardoise' },
  { value: 'red',    label: 'Rouge' },
];

export const DEFAULT_METIER_COLOR = METIER_COLOR_OPTIONS[0].value;

/** Classe CSS `metier-<couleur>`, avec repli sur `slate` si la valeur est inconnue. */
export function metierBadgeClass(color: string | null | undefined): string {
  const known = METIER_COLOR_OPTIONS.some(o => o.value === color);
  return `metier-${known ? color : 'slate'}`;
}
