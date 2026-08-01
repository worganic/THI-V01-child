import { runtimeEnv } from '../../runtime-env';
import { navigateToApp } from '@portail/shared-ui';

// `navigateToApp` vit désormais dans la lib (le header s'en sert par défaut,
// le shell ne pouvant plus le passer en @Input — voir navigate-to-app.ts).
// Réexporté ici pour ne pas casser les appels existants.
export { navigateToApp };

export function navigateToProjets(path = ''): void {
  // runtimeEnv.projetsAppUrl a déjà le décalage de port appliqué
  navigateToApp(runtimeEnv.projetsAppUrl, path, false);
}
