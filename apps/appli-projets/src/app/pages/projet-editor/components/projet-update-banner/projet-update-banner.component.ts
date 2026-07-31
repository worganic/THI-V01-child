import { Component, EventEmitter, Input, Output, computed, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjetCollabService, SectionPublishedEvent } from '@portail/core-data-access';
import { ProjetIncomingChangeService } from '../../services/projet-incoming-change.service';

/**
 * Bannière de notification des sections partagées par d'autres utilisateurs.
 *
 * Affiche un résumé des modifications partagées en attente de pull, avec
 * un bouton "Mettre à jour" qui déclenche un git pull côté serveur.
 *
 * Devient une bannière hors-ligne si l'utilisateur perd la connexion, et affiche
 * un avertissement "Non sauvegardé depuis Xs" tant qu'un brouillon reste en échec
 * de sauvegarde (retry automatique en cours côté service).
 */
@Component({
  selector: 'app-projet-update-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projet-update-banner.component.html',
  styleUrls: ['./projet-update-banner.component.scss']
})
export class ProjetUpdateBannerComponent implements OnDestroy {
  private collab = inject(ProjetCollabService);
  private incomingChangeService = inject(ProjetIncomingChangeService);

  @Input() projectName: string | null = null;
  @Output() pulled = new EventEmitter<{ newCommits: number; changedFiles: string[] }>();
  // Conflit live sur une section actuellement éditée localement (voir carte flottante dans
  // la zone d'édition) — "Voir" navigue vers la section au lieu de déclencher un pull global,
  // qui ne montrerait aucune carte et ferait juste disparaître la notification sans résolution.
  @Output() viewConflict = new EventEmitter<string>();

  readonly pulling = signal(false);
  readonly pullError = signal<string | null>(null);

  readonly hasUnsavedWork = this.collab.hasUnsavedWork;
  private readonly now = signal(Date.now());
  private readonly nowTimer = setInterval(() => this.now.set(Date.now()), 1000);

  readonly unsavedSeconds = computed(() => {
    const since = this.collab.oldestUnsavedAt();
    return since ? Math.max(0, Math.floor((this.now() - since.getTime()) / 1000)) : 0;
  });

  readonly unsavedSeverity = computed<'amber' | 'red' | null>(() => {
    if (!this.hasUnsavedWork()) return null;
    const s = this.unsavedSeconds();
    return s >= 60 ? 'red' : (s >= 10 ? 'amber' : null);
  });

  ngOnDestroy(): void {
    clearInterval(this.nowTimer);
  }

  // Liste triée par timestamp décroissant, séparée en deux catégories : les sections publiées
  // qui correspondent à un conflit live en attente sur un brouillon local (carte flottante déjà
  // visible dans la zone d'édition) vs les publications "normales" (aucun brouillon local en
  // cours ici, la mise à jour globale reste sûre).
  private readonly allEvents = computed<SectionPublishedEvent[]>(() => {
    const map = this.collab.pendingUpdates();
    return Array.from(map.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  });

  readonly conflictEvents = computed<SectionPublishedEvent[]>(() =>
    this.allEvents().filter(e => this.incomingChangeService.hasUnresolved(e.nodeId))
  );

  readonly events = computed<SectionPublishedEvent[]>(() =>
    this.allEvents().filter(e => !this.incomingChangeService.hasUnresolved(e.nodeId))
  );

  readonly isOnline = this.collab.isOnline;
  readonly count = computed(() => this.events().length);
  readonly conflictCount = computed(() => this.conflictEvents().length);

  readonly summaryLabel = computed(() => {
    const list = this.events();
    if (list.length === 0) return '';
    if (list.length === 1) {
      const e = list[0];
      return `${e.publishedBy.username} a partagé « ${e.sectionName} »`;
    }
    const names = Array.from(new Set(list.map(e => e.publishedBy.username)));
    if (names.length === 1) {
      return `${names[0]} a partagé ${list.length} sections`;
    }
    return `${names.length} utilisateurs ont partagé ${list.length} sections`;
  });

  onViewConflict(evt: SectionPublishedEvent): void {
    this.viewConflict.emit(evt.folderId ?? evt.nodeId);
  }

  async onPull(): Promise<void> {
    if (!this.projectName || this.pulling()) return;
    this.pulling.set(true);
    this.pullError.set(null);
    try {
      const r = await this.collab.pullProject(this.projectName);
      this.pulled.emit(r);
    } catch (e: any) {
      this.pullError.set(e?.error?.error || e?.message || 'Erreur de mise à jour');
    } finally {
      this.pulling.set(false);
    }
  }

  onDismiss(): void {
    this.collab.clearAllPendingUpdates();
  }
}
