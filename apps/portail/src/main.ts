import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Permet de lancer une 2e instance de l'app sur des ports décalés (test multi-users)
// via le launcher Python : ?portOffset=10 → les URLs des services (API, executor, agent, projets)
// sont décalées du même offset et persistées pour les navigations suivantes.
const params = new URLSearchParams(window.location.search);
const portOffset = params.get('portOffset');
if (portOffset) {
  localStorage.setItem('port_offset', portOffset);
  const clean = new URL(window.location.href);
  clean.searchParams.delete('portOffset');
  window.history.replaceState({}, '', clean.toString());
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
