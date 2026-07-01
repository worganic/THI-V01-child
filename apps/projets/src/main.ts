import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Récupère le token et le user passés par le portail (localhost:4202) via paramètres URL
// pour contourner l'isolation localStorage cross-origin entre les deux apps.
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const user = params.get('user');
const theme = params.get('theme');
const portOffset = params.get('portOffset');
if (token) {
  localStorage.setItem('frankenstein_token', token);
  if (user) localStorage.setItem('frankenstein_user', user);
}
if (theme && ['dark', 'light', 'pink'].includes(theme)) {
  localStorage.setItem('theme', theme);
}
if (portOffset) {
  localStorage.setItem('port_offset', portOffset);
}
if (token || theme || portOffset) {
  const clean = new URL(window.location.href);
  clean.searchParams.delete('token');
  clean.searchParams.delete('user');
  clean.searchParams.delete('theme');
  clean.searchParams.delete('portOffset');
  window.history.replaceState({}, '', clean.toString());
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
