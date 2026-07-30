import { runtimeEnv } from '../../runtime-env';

const TOKEN_KEY = 'frankenstein_token';
const USER_KEY = 'frankenstein_user';
const THEME_KEY = 'theme';
const PORT_OFFSET_KEY = 'port_offset';

/**
 * Navigue vers une sous-application servie sur un autre port/domaine en lui
 * transmettant la session (localStorage n'est pas partagé cross-origin) :
 * token, utilisateur, thème et décalage de port du launcher.
 *
 * `applyPortOffset` décale le port des URLs locales comme le fait `runtimeEnv`
 * quand plusieurs instances tournent en parallèle — à laisser à `false` pour
 * une URL qui vient déjà de `runtimeEnv` (sinon le décalage est appliqué deux fois).
 */
export function navigateToApp(baseUrl: string, path = '', applyPortOffset = true): void {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  const theme = localStorage.getItem(THEME_KEY);
  const portOffset = localStorage.getItem(PORT_OFFSET_KEY);
  const url = new URL(path ? `${baseUrl.replace(/\/$/, '')}/${path}` : baseUrl);
  const offset = Number(portOffset || '0');
  if (applyPortOffset && offset && url.port && /^(localhost|127\.0\.0\.1)$/.test(url.hostname)) {
    url.port = String(Number(url.port) + offset);
  }
  if (token) url.searchParams.set('token', token);
  if (user) url.searchParams.set('user', user);
  if (theme) url.searchParams.set('theme', theme);
  if (portOffset) url.searchParams.set('portOffset', portOffset);
  window.location.href = url.toString();
}

export function navigateToProjets(path = ''): void {
  // runtimeEnv.projetsAppUrl a déjà le décalage de port appliqué
  navigateToApp(runtimeEnv.projetsAppUrl, path, false);
}
