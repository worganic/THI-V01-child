// =============================================================================
// Repli localStorage : filet de secours pour ProjectService quand le backend agenda est
// injoignable (voir ProjectService.apiIssue$). Sans lui, toute création/modification faite en
// mode dégradé ne vivait que dans la mémoire JS de l'onglet — perdue au moindre rechargement de
// page (recompilation Angular, F5, fermeture d'onglet...), donnant l'impression trompeuse que
// l'enregistrement n'avait jamais eu lieu.
// =============================================================================

const isBrowser = typeof window !== 'undefined' && !!window.localStorage;

/** Lit une valeur mise en cache, ou `fallback` si absente/illisible (première visite, storage corrompu...). */
export function loadFromLocalStorage<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Écrit une valeur en cache. Échoue silencieusement (quota dépassé, navigation privée...) : la
 *  donnée reste utilisable pour la session en cours, seule la persistance entre rechargements
 *  est perdue — pas une raison de faire échouer l'action de l'utilisateur. */
export function saveToLocalStorage<T>(key: string, value: T): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Volontairement ignoré (voir commentaire ci-dessus).
  }
}

/**
 * Préfixe une clé de cache avec l'identité de l'utilisateur courant, pour des préférences UI
 * (ex: section repliée/dépliée) qui doivent rester propres à chaque utilisateur sur un poste
 * partagé — sans quoi le dernier utilisateur connecté écraserait la préférence des autres. Lit
 * directement la session du portail en localStorage (clé `frankenstein_user`, écrite par
 * AuthService — voir libs/portail-core/data-access/src/lib/auth.service.ts) plutôt que d'injecter
 * AuthService dans des composants qui n'en ont sinon aucun besoin.
 */
export function userScopedKey(baseKey: string): string {
  let identity: string | null = null;
  if (isBrowser) {
    try {
      const raw = window.localStorage.getItem('frankenstein_user');
      identity = raw ? (JSON.parse(raw).username || JSON.parse(raw).id || null) : null;
    } catch {
      identity = null;
    }
  }
  return `${baseKey}:${identity || 'anonyme'}`;
}
