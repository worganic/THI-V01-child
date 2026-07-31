import { Injectable, inject, signal } from '@angular/core';
import { ProjetCollabService } from '@portail/core-data-access';

export interface IncomingChange {
  fileId: string;
  folderId: string | null;
  content: string;
  versionId: string;
  authorId: string;
  authorName: string;
  timestamp: string;
}

/**
 * Conflit live : quand un autre utilisateur publie une modification sur un fichier que
 * l'utilisateur courant a un brouillon local divergent (isLocalPending), le changement
 * n'est plus absorbé silencieusement dans `files` — il est mis en attente ici, visible
 * via une carte flottante (zone d'édition), jusqu'à résolution explicite (Insérer / Voir
 * le diff complet / Rejeter). Jamais vidé par un rechargement automatique (loadFiles/pull),
 * seulement par une action utilisateur explicite — voir `resolve()`.
 */
@Injectable({ providedIn: 'root' })
export class ProjetIncomingChangeService {
  private collab = inject(ProjetCollabService);

  // version_saved arrive avant content_update dans le même tick serveur (voir bloc de
  // publication server-data.js) — cache court terme le temps de corréler les deux par nodeId.
  private pendingVersionByNode = new Map<string, { versionId: string; authorId: string; authorName: string; timestamp: string }>();

  readonly incomingChanges = signal<Map<string, IncomingChange>>(new Map());

  constructor() {
    this.collab.versionSaved$.subscribe(evt => {
      this.pendingVersionByNode.set(evt.nodeId, {
        versionId: evt.versionId, authorId: evt.authorId, authorName: evt.authorName, timestamp: evt.timestamp
      });
    });
    this.collab.contentUpdate$.subscribe(evt => {
      const sectionKey = evt.folderId ?? evt.nodeId;
      // Pas de brouillon local divergent sur cette section : comportement silencieux existant
      // inchangé (patch direct de `files` géré ailleurs) — ne concerne pas ce service.
      if (!this.collab.isLocalPending(sectionKey)) return;
      const versionInfo = this.pendingVersionByNode.get(evt.nodeId);
      const next = new Map(this.incomingChanges());
      next.set(evt.nodeId, {
        fileId: evt.nodeId,
        folderId: evt.folderId,
        content: evt.content,
        versionId: versionInfo?.versionId ?? '',
        authorId: versionInfo?.authorId ?? evt.updatedBy,
        authorName: versionInfo?.authorName ?? evt.updatedByName,
        timestamp: evt.timestamp
      });
      this.incomingChanges.set(next);
      this.pendingVersionByNode.delete(evt.nodeId);
    });
  }

  hasUnresolved(fileId: string): boolean {
    return this.incomingChanges().has(fileId);
  }

  get(fileId: string): IncomingChange | undefined {
    return this.incomingChanges().get(fileId);
  }

  /** Retire l'entrée en attente — appelé après une résolution explicite (Insérer / diff / Rejeter). */
  resolve(fileId: string): void {
    if (!this.incomingChanges().has(fileId)) return;
    const next = new Map(this.incomingChanges());
    next.delete(fileId);
    this.incomingChanges.set(next);
  }
}
