import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { API_DATA_URL } from './tokens';
import { AuthService } from './auth.service';

export interface AiTokenInfo {
  used: number;
  total: number;
  remaining: number;
}

export interface AiLogItem {
  stream: 'stdout' | 'stderr' | 'info';
  text: string;
}

/**
 * Service partagé d'exécution IA via SSE — utilisable depuis portail et projets.
 * Route : GET /api/mega-outils/prompt/execute-stream (tous les providers passent par l'executor local).
 */
@Injectable({ providedIn: 'root' })
export class AiExecuteService {
  private ngZone = inject(NgZone);
  private dataUrl = inject(API_DATA_URL);
  private authService = inject(AuthService);

  isStreaming = signal(false);
  tokenInfo   = signal<AiTokenInfo | null>(null);

  chunk$ = new Subject<string>();
  done$  = new Subject<string>();
  error$ = new Subject<string>();
  log$   = new Subject<AiLogItem>();

  private es: EventSource | null = null;

  cancel(): void {
    this.es?.close();
    this.es = null;
    this.ngZone.run(() => this.isStreaming.set(false));
  }

  /**
   * Exécution IA « one-shot » indépendante du flux streamé partagé : ouvre sa PROPRE
   * EventSource (sans toucher à `this.es`/`chunk$`/`done$`) et résout le texte complet.
   * Sert aux corrections/analyses en tâche de fond pendant qu'un popup streame déjà.
   */
  executeOnce(systemPrompt: string | null, userPrompt: string, provider: string, model: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const params = new URLSearchParams({
        systemPrompt: systemPrompt || '',
        userPrompt,
        provider,
        model,
        token: this.authService.getToken() || '',
      });
      const es = new EventSource(`${this.dataUrl}/api/mega-outils/prompt/execute-stream?${params.toString()}`);
      let accumulated = '';
      const finish = (fn: () => void) => { es.close(); this.ngZone.run(fn); };

      es.addEventListener('ai-log', (e: MessageEvent) => {
        const d = JSON.parse(e.data) as { stream: string; text: string };
        if (d.stream === 'stdout') accumulated += d.text;
      });
      es.addEventListener('ai-error', (e: MessageEvent) => {
        const d = JSON.parse(e.data) as { message: string };
        finish(() => reject(new Error(d.message)));
      });
      es.addEventListener('run-failed', (e: MessageEvent) => {
        const d = JSON.parse(e.data) as { message: string };
        finish(() => reject(new Error(d.message)));
      });
      es.addEventListener('complete', () => finish(() => resolve(accumulated)));
      es.onerror = () => {
        if (es.readyState !== EventSource.CLOSED) finish(() => reject(new Error('Connexion SSE interrompue')));
      };
    });
  }

  startExecution(systemPrompt: string | null, userPrompt: string, provider: string, model: string): void {
    this.cancel();
    this.isStreaming.set(true);
    this.tokenInfo.set(null);

    const params = new URLSearchParams({
      systemPrompt: systemPrompt || '',
      userPrompt,
      provider,
      model,
      token: this.authService.getToken() || '',
    });

    const es = new EventSource(`${this.dataUrl}/api/mega-outils/prompt/execute-stream?${params.toString()}`);
    this.es = es;
    let accumulated = '';

    es.addEventListener('ai-log', (e: MessageEvent) => {
      const d = JSON.parse(e.data) as { stream: string; text: string };
      this.ngZone.run(() => {
        if (d.stream === 'stdout') {
          accumulated += d.text;
          this.chunk$.next(d.text);
        }
        this.log$.next({ stream: d.stream as AiLogItem['stream'], text: d.text });
      });
    });

    es.addEventListener('ai-error', (e: MessageEvent) => {
      const d = JSON.parse(e.data) as { message: string };
      this.ngZone.run(() => { this.isStreaming.set(false); this.error$.next(d.message); });
      es.close();
      this.es = null;
    });

    es.addEventListener('run-failed', (e: MessageEvent) => {
      const d = JSON.parse(e.data) as { message: string };
      this.ngZone.run(() => { this.isStreaming.set(false); this.error$.next(d.message); });
      es.close();
      this.es = null;
    });

    es.addEventListener('complete', (_e: MessageEvent) => {
      this.ngZone.run(() => { this.isStreaming.set(false); this.done$.next(accumulated); });
      es.close();
      this.es = null;
    });

    es.onerror = () => {
      if (es.readyState !== EventSource.CLOSED) {
        this.ngZone.run(() => { this.isStreaming.set(false); this.error$.next('Connexion SSE interrompue'); });
        es.close();
        this.es = null;
      }
    };
  }
}
