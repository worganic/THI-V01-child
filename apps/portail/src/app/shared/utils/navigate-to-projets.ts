import { runtimeEnv } from '../../runtime-env';

const TOKEN_KEY = 'frankenstein_token';
const USER_KEY = 'frankenstein_user';
const THEME_KEY = 'theme';
const PORT_OFFSET_KEY = 'port_offset';

export function navigateToProjets(path = ''): void {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  const theme = localStorage.getItem(THEME_KEY);
  const portOffset = localStorage.getItem(PORT_OFFSET_KEY);
  const base = runtimeEnv.projetsAppUrl;
  const url = new URL(path ? `${base}/${path}` : base);
  if (token) url.searchParams.set('token', token);
  if (user) url.searchParams.set('user', user);
  if (theme) url.searchParams.set('theme', theme);
  if (portOffset) url.searchParams.set('portOffset', portOffset);
  window.location.href = url.toString();
}
