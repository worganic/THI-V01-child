import { environment } from '../environments/environment';

// Permet de lancer 2 instances de l'app sur des ports différents (multi-users de test)
// via le launcher Python : les URLs des services (API, executor, agent, projets) sont
// décalées du même offset que le port sur lequel tourne l'app elle-même.
function withPortOffset(url: string, offset: number): string {
  if (!offset) return url;
  try {
    const u = new URL(url);
    u.port = String(Number(u.port) + offset);
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

const portOffset = Number(localStorage.getItem('port_offset') || '0');

export const runtimeEnv = {
  ...environment,
  apiDataUrl: withPortOffset(environment.apiDataUrl, portOffset),
  apiExecutorUrl: withPortOffset(environment.apiExecutorUrl, portOffset),
  apiAgentUrl: withPortOffset(environment.apiAgentUrl, portOffset),
  projetsAppUrl: withPortOffset(environment.projetsAppUrl, portOffset),
};
