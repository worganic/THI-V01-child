// =============================================================================
// Règles de planification : week-ends et jours fériés (France).
// =============================================================================

/**
 * Date du jour utilisée dans tout l'agenda (retard, jour verrouillé, surlignage "aujourd'hui"...).
 * Calculée sur l'horloge locale (année/mois/jour, pas `toISOString` qui bascule en UTC et peut
 * décaler d'un jour selon le fuseau) au chargement du module — une valeur figée était auparavant
 * codée en dur ici pour une démo, ce qui désynchronisait le surlignage "aujourd'hui" de la vraie
 * date dès qu'on avançait dans le temps.
 */
function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const TODAY_ISO = toLocalIso(new Date());

/** Nombre de jours calendaires entre deux dates ISO (peut être négatif si endIso < startIso). */
export function daysBetweenIso(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Date de fin estimée d'un projet : dateDébut + (estimatedTimeDays - 1) jours calendaires, pour
 * qu'un projet d'1 jour démarre et finisse le même jour. Remplace la saisie libre de la date de
 * fin (voir NouveauProjetComponent) — un champ indépendant de la date de début et de l'estimation
 * pouvait diverger silencieusement des deux (ex: date de fin antérieure à la date de début).
 */
export function computeDateEndEstimated(dateStartIso: string, estimatedTimeDays: number): string {
  // new Date(y, m-1, d) — pas new Date(isoString), qui parse en UTC et peut décaler d'un jour en
  // heure locale (même piège documenté sur TODAY_ISO plus haut).
  const [year, month, day] = dateStartIso.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const days = Number.isFinite(estimatedTimeDays) && estimatedTimeDays > 0 ? estimatedTimeDays : 1;
  start.setDate(start.getDate() + (days - 1));
  return toLocalIso(start);
}

/**
 * Jours fériés français, calculés pour les années couvertes par l'agenda (2026-2027).
 * Les fêtes mobiles (Pâques, Ascension, Pentecôte) sont dérivées de la date de Pâques ;
 * étendre `computeEasterSunday` si l'agenda doit un jour couvrir d'autres années.
 */
function computeEasterSunday(year: number): Date {
  // Algorithme de Meeus/Jones/Butcher (calendrier grégorien).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function toIso(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDaysToDate(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function frenchHolidaysForYear(year: number): string[] {
  const easter = computeEasterSunday(year);
  return [
    `${year}-01-01`, // Nouvel An
    toIso(addDaysToDate(easter, 1)), // Lundi de Pâques
    `${year}-05-01`, // Fête du Travail
    `${year}-05-08`, // Victoire 1945
    toIso(addDaysToDate(easter, 39)), // Ascension
    toIso(addDaysToDate(easter, 50)), // Lundi de Pentecôte
    `${year}-07-14`, // Fête Nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`  // Noël
  ];
}

/** Cache par année pour éviter de recalculer Pâques à chaque appel. */
const holidaysCache = new Map<number, Set<string>>();

function holidaysForYear(year: number): Set<string> {
  let set = holidaysCache.get(year);
  if (!set) {
    set = new Set(frenchHolidaysForYear(year));
    holidaysCache.set(year, set);
  }
  return set;
}

export function isWeekend(dateIso: string): boolean {
  const day = new Date(dateIso).getDay();
  return day === 0 || day === 6;
}

export function isHoliday(dateIso: string): boolean {
  const year = new Date(dateIso).getFullYear();
  return holidaysForYear(year).has(dateIso);
}

/**
 * Contraintes de planification d'un projet, avec la date d'entrée en vigueur de chacune
 * (voir Project.weekendsRuleFrom / holidaysRuleFrom).
 */
export interface PlanningRules {
  excludeWeekends?: boolean;
  excludeHolidays?: boolean;
  weekendsRuleFrom?: string | null;
  holidaysRuleFrom?: string | null;
}

/**
 * Une règle ne s'applique qu'à partir de sa date d'entrée en vigueur. Sans date (null/absent),
 * elle vaut depuis toujours — cas d'un projet créé avec la contrainte déjà cochée.
 *
 * C'est ce qui empêche l'activation d'une contrainte de réécrire le passé : quand on coche
 * « pas de week-end » aujourd'hui, la date d'effet est posée à demain, donc les jours déjà
 * travaillés (et aujourd'hui) restent des jours planifiables — leurs tuiles, leurs demi-journées
 * cochées et leur découpage ne bougent pas, seule la suite du planning est contrainte.
 */
function ruleAppliesOn(dateIso: string, ruleFrom: string | null | undefined): boolean {
  return !ruleFrom || dateIso >= ruleFrom;
}

/** Week-end effectivement non planifiable pour ce projet à cette date. */
export function isExcludedWeekend(dateIso: string, rules: PlanningRules | null | undefined): boolean {
  return !!rules?.excludeWeekends && isWeekend(dateIso) && ruleAppliesOn(dateIso, rules.weekendsRuleFrom);
}

/** Jour férié effectivement non planifiable pour ce projet à cette date. */
export function isExcludedHoliday(dateIso: string, rules: PlanningRules | null | undefined): boolean {
  return !!rules?.excludeHolidays && isHoliday(dateIso) && ruleAppliesOn(dateIso, rules.holidaysRuleFrom);
}

/** true si la date respecte les contraintes de planification du projet. */
export function isDateAllowed(
  dateIso: string,
  rules: PlanningRules | null | undefined
): boolean {
  return !isExcludedWeekend(dateIso, rules) && !isExcludedHoliday(dateIso, rules);
}

/** Explique pourquoi une date est refusée (pour affichage utilisateur), ou null si acceptée. */
export function dateRejectionReason(
  dateIso: string,
  rules: PlanningRules | null | undefined
): string | null {
  if (isExcludedWeekend(dateIso, rules)) return 'Ce projet interdit la planification le week-end.';
  if (isExcludedHoliday(dateIso, rules)) return 'Ce projet interdit la planification les jours fériés.';
  return null;
}
