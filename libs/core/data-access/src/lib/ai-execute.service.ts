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
  private prepareAbort: AbortController | null = null;
  private canceled = false;

  cancel(): void {
    this.canceled = true;
    this.prepareAbort?.abort();
    this.prepareAbort = null;
    this.es?.close();
    this.es = null;
    this.ngZone.run(() => this.isStreaming.set(false));
  }

  /**
   * Enregistre le prompt côté serveur (POST sans limite de taille) et renvoie un jobId.
   * Indispensable pour les gros prompts (système + état projet) : en GET via query params,
   * l'URL dépasse la limite d'en-tête HTTP → la requête n'atteint jamais le serveur et le
   * flux SSE ne s'établit pas (génération bloquée sans aucun retour).
   */
  private async prepareJob(systemPrompt: string | null, userPrompt: string, provider: string, model: string): Promise<string> {
    const ac = new AbortController();
    this.prepareAbort = ac;
    const token = this.authService.getToken() || '';
    const res = await fetch(`${this.dataUrl}/api/mega-outils/prompt/execute-prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ systemPrompt: systemPrompt || '', userPrompt, provider, model }),
      signal: ac.signal,
    });
    this.prepareAbort = null;
    if (!res.ok) {
      let msg = `Préparation du prompt échouée (${res.status})`;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    const { jobId } = await res.json();
    if (!jobId) throw new Error('jobId manquant dans la réponse de préparation');
    return jobId;
  }

  /**
   * Exécution IA « one-shot » indépendante du flux streamé partagé : ouvre sa PROPRE
   * EventSource (sans toucher à `this.es`/`chunk$`/`done$`) et résout le texte complet.
   * Sert aux corrections/analyses en tâche de fond pendant qu'un popup streame déjà.
   */
  async executeOnce(systemPrompt: string | null, userPrompt: string, provider: string, model: string): Promise<string> {
    const jobId = await this.prepareJob(systemPrompt, userPrompt, provider, model);
    return new Promise<string>((resolve, reject) => {
      const params = new URLSearchParams({ jobId, token: this.authService.getToken() || '' });
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
    this.canceled = false;
    this.isStreaming.set(true);
    this.tokenInfo.set(null);

    // Préparation du job (POST) puis ouverture du flux SSE avec un simple jobId : évite le
    // dépassement de longueur d'URL sur les gros prompts (génération du livrable bloquée).
    this.prepareJob(systemPrompt, userPrompt, provider, model)
      .then(jobId => { if (!this.canceled) this.openStream(jobId); })
      .catch(err => {
        if (this.canceled || err?.name === 'AbortError') return;
        this.ngZone.run(() => { this.isStreaming.set(false); this.error$.next(err?.message || 'Préparation du prompt impossible'); });
      });
  }

  private openStream(jobId: string): void {
    const params = new URLSearchParams({ jobId, token: this.authService.getToken() || '' });
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
