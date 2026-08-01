export interface LaunchMode {
  command: string;
  label: string;
  description: string;
}

// Les 4 modes de lancement du portail (voir package.json à la racine). Source unique,
// utilisée à la fois par l'écran de blocage (lib-backend-unavailable) et par la page
// d'admin "Infos config" — tenue à jour manuellement en miroir des scripts npm réels.
export const LAUNCH_MODES: LaunchMode[] = [
  { command: 'npm run start:dev-local', label: 'Dev / Local', description: "code en dev, API servie par le mock local (aucun réseau requis)" },
  { command: 'npm run start:dev-val', label: 'Dev / Val', description: 'code en dev, API réelle Val (réseau interne / VPN requis)' },
  { command: 'npm run start:val', label: 'Val / Val', description: 'code compilé en config Val, API réelle Val (réseau interne / VPN requis)' },
  { command: 'npm run start:prod', label: 'Prod / Prod', description: 'code compilé en config Prod, API réelle Prod' },
];
