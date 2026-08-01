import { Component, OnInit, signal, inject } from '@angular/core';
import {
  DbStatusService,
  API_DATA_URL,
  API_EXECUTOR_URL,
  API_AGENT_URL,
} from '@portail/core-data-access';

/** Une façon de démarrer la plateforme, telle que documentée dans le dépôt. */
interface LaunchMode {
  label: string;
  command: string;
  description: string;
}

const LAUNCH_MODES: LaunchMode[] = [
  { label: 'Portail seul',   command: 'npm start',              description: 'Portail sur le port 4202, sans API ni sous-application autonome.' },
  { label: 'Projets seul',   command: 'npm run start:projets',  description: 'Application projets sur le port 4203 (app NX autonome).' },
  { label: 'API seule',      command: 'npm run start:api',      description: 'API Express de données sur le port 3001.' },
  { label: 'Tout',           command: 'npm run start:all',      description: 'Portail + projets + API en parallèle — mode de développement courant.' },
  { label: 'Tout + Electron', command: 'npm run start:full',    description: 'Ajoute l\'exécuteur Electron (port 3002) pour les actions système.' },
];

/**
 * Admin › Portail › Infos config — état d'exécution courant (URL des services,
 * base de données, version déployée) et façons de lancer la plateforme.
 * Équivalent de la page « Infos config » de l'autre portail : une page de
 * constat, aucune valeur n'y est modifiable.
 */
@Component({
  selector: 'app-portail-config-section',
  templateUrl: './portail-config.component.html'
})
export class PortailConfigSectionComponent implements OnInit {
  readonly dbStatus = inject(DbStatusService);
  readonly apiDataUrl = inject(API_DATA_URL);
  readonly apiExecutorUrl = inject(API_EXECUTOR_URL);
  readonly apiAgentUrl = inject(API_AGENT_URL);

  readonly launchModes = LAUNCH_MODES;

  version       = signal<string>('—');
  upToDate      = signal<boolean | null>(null);
  currentBranch = signal<string>('—');
  deployedAt    = signal<string>('—');
  probing       = signal(false);
  error         = signal('');

  ngOnInit() { this.probe(); }

  /** Relance les deux sondes (base de données + version) affichées ci-dessus. */
  async probe() {
    this.probing.set(true);
    this.error.set('');
    await this.dbStatus.check();
    try {
      const res = await fetch(`${this.apiDataUrl}/api/version/check`);
      if (!res.ok) throw new Error('Sonde de version indisponible');
      const data = await res.json();
      this.version.set(data.localVersion ?? '—');
      this.upToDate.set(data.upToDate ?? null);
      this.currentBranch.set(data.currentBranch || 'main');
      this.deployedAt.set(
        data.latestDeployment?.deployed_at
          ? new Date(data.latestDeployment.deployed_at).toLocaleString('fr-FR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
          : '—'
      );
    } catch (e: any) {
      this.error.set(e?.message || 'Version indisponible côté serveur');
      this.upToDate.set(null);
    } finally {
      this.probing.set(false);
    }
  }

  /** Libellé de l'état de la base, aligné sur le vocabulaire de l'autre portail. */
  dbLabel(): string {
    switch (this.dbStatus.status()) {
      case 'ok':       return 'Connectée';
      case 'error':    return 'Injoignable';
      default:         return 'Vérification…';
    }
  }

  dbBadgeClass(): string {
    switch (this.dbStatus.status()) {
      case 'ok':    return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30';
      case 'error': return 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/30';
      default:      return 'bg-light-surface dark:bg-white/5 text-light-text-muted dark:text-white/40 border-light-border dark:border-white/10';
    }
  }
}
