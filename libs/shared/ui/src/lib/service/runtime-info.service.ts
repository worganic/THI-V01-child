import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';

/**
 * Mode de connexion réellement utilisé par le portail :
 * - `local`       : les appels partent vers le serveur de test (mock-api/server.js) ;
 * - `remote`       : les appels partent vers un backend Airbus réel qui répond (vivant) ;
 * - `unreachable`  : rien ne répond du tout (réseau/VPN coupé, backend down, timeout) ;
 * - `unknown`      : sonde encore en cours (état affiché quelques centaines de ms au démarrage).
 */
export type ConnectionMode = 'local' | 'remote' | 'unreachable' | 'unknown';

/** Environnement du backend interrogé. */
export type BackendEnvironment = 'Dev' | 'Val' | 'Prod';

/**
 * Ce dont le service a besoin pour se situer. Fourni par l'application hôte (le shell passe son
 * `environmentGlobal`) : la lib shared-ui ne peut pas importer un fichier d'app sans inverser la
 * dépendance lib -> app, et `libs/shared/ui/src/lib/config.ts` n'est qu'une copie qui dériverait.
 */
export interface PortailRuntimeConfig {
  /** Version affichée dans le footer. */
  version: string;
  /** Date de la version (optionnelle, affichée en infobulle). */
  versionDate?: string;
  /** Préfixe réellement utilisé par les services pour joindre le backend (ex: `/val/v2`). */
  serviceBase: string;
  /** Préfixes déclarés, pour reconnaître l'environnement par correspondance exacte (repli). */
  serviceDev?: string;
  serviceVal?: string;
  serviceProd?: string;
  /**
   * Label explicite fourni par le fichier `environmentGlobal` actif — évite l'ambiguïté du repli
   * par correspondance de préfixe quand plusieurs préfixes partagent temporairement la même
   * valeur (ex: Prod pas encore configuré avec sa propre adresse).
   */
  environment?: BackendEnvironment;
}

export const PORTAIL_RUNTIME_CONFIG = new InjectionToken<PortailRuntimeConfig>('PORTAIL_RUNTIME_CONFIG');

/**
 * Route servie UNIQUEMENT par le mock (voir mock-api/server.js). Le backend réel ne la connaît
 * pas : c'est précisément ce qui permet de distinguer les deux modes à l'exécution. Le choix
 * local/distant se fait côté proxy Angular (MOCK_API=1, voir apps/portail-shell/proxy.conf.js),
 * donc côté navigateur les URLs sont rigoureusement identiques dans les deux modes — seule une
 * sonde permet de savoir laquelle des deux cibles répond réellement.
 */
const RUNTIME_PROBE_PATH = '/__runtime';

@Injectable({ providedIn: 'root' })
export class RuntimeInfoService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(PORTAIL_RUNTIME_CONFIG);

  readonly connectionMode = signal<ConnectionMode>('unknown');

  readonly version = this.config.version;
  readonly versionDate = this.config.versionDate;
  readonly environment: BackendEnvironment = this.resolveEnvironment();

  constructor() {
    this.retryProbe();
  }

  /** Libellé court pour l'affichage (footer). */
  get connectionLabel(): string {
    switch (this.connectionMode()) {
      case 'local': return 'Local';
      case 'remote': return 'Distant';
      case 'unreachable': return 'Injoignable';
      default: return '…';
    }
  }

  /**
   * Environnement déduit en priorité du label explicite fourni par le fichier
   * `environmentGlobal` actif ; à défaut (ancienne config sans ce champ), repli sur la
   * correspondance de préfixe puis sur le segment présent dans l'URL (`/dev/`, `/val/`, `/prod/`).
   */
  private resolveEnvironment(): BackendEnvironment {
    if (this.config.environment) return this.config.environment;

    const base = this.config.serviceBase || '';

    if (this.config.serviceDev && base === this.config.serviceDev) return 'Dev';
    if (this.config.serviceVal && base === this.config.serviceVal) return 'Val';
    if (this.config.serviceProd && base === this.config.serviceProd) return 'Prod';

    const lower = base.toLowerCase();
    if (lower.includes('/dev/') || lower.endsWith('/dev')) return 'Dev';
    if (lower.includes('/prod/') || lower.endsWith('/prod')) return 'Prod';
    return 'Val';
  }

  /**
   * Sonde le backend actif. Rejouable manuellement (bouton "Réessayer" de l'écran de blocage) en
   * plus de l'appel automatique au démarrage.
   *
   * - Réponse 200 (JSON `{ mode: 'local', ... }`) : c'est le mock -> `local`.
   * - Erreur HTTP 404 "propre" : un vrai serveur a répondu, il ne connaît juste pas cette route
   *   réservée au mock -> `remote` (vivant, mode fonctionnel même si backend réel).
   * - Erreur réseau (status 0, CORS), timeout, ou 502/503/504 : personne ne répond -> `unreachable`.
   */
  retryProbe(): void {
    this.connectionMode.set('unknown');
    this.http.get(`${this.config.serviceBase}${RUNTIME_PROBE_PATH}`, { responseType: 'json' })
      .pipe(
        map((): ConnectionMode => 'local'),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) return of<ConnectionMode>('remote');
          return of<ConnectionMode>('unreachable');
        })
      )
      .subscribe(mode => this.connectionMode.set(mode));
  }
}
