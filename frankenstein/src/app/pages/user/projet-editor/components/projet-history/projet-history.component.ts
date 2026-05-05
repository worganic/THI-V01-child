import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjetCollabService, CollabHistoryEntry } from '../../../../../core/services/projet-collab.service';

export interface DisplayHistoryEntry extends CollabHistoryEntry {
  isPending?: boolean;
}

interface HistoryGroup {
  date: string;
  entries: DisplayHistoryEntry[];
}

@Component({
  selector: 'app-projet-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projet-history.component.html',
  host: { class: 'flex flex-col min-h-0 flex-1 overflow-hidden' },
})
export class ProjetHistoryComponent implements OnChanges {
  @Input() projetId: string | null = null;
  @Input() activeIds: Set<string> | null = null;
  @Output() entryClick = new EventEmitter<CollabHistoryEntry>();

  readonly collab = inject(ProjetCollabService);
  loadingEntryId: string | null = null;

  private readonly _activeIds = signal<Set<string> | null>(null);

  readonly groups = computed<HistoryGroup[]>(() => {
    const ids = this._activeIds();
    const saved = this.collab.history();
    const pending = this.collab.pending();
    // Convertit les entrées pending en DisplayHistoryEntry (mêmes champs visibles)
    const pendingDisplay: DisplayHistoryEntry[] = pending.map(p => ({
      id: `pending-${p.entityId}`,
      timestamp: p.timestamp,
      section: 'projets/contenu',
      actionType: 'update',
      label: p.label,
      entityType: 'content',
      entityId: p.entityId,
      entityLabel: '',
      userId: null,
      username: p.username,
      undone: false,
      isPending: true,
    }));
    let entries: DisplayHistoryEntry[] = [...pendingDisplay, ...saved];
    if (ids && ids.size > 0) entries = entries.filter(e => !!e.entityId && ids.has(e.entityId));
    const map = new Map<string, DisplayHistoryEntry[]>();
    for (const e of entries) {
      const day = new Date(e.timestamp).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries()).map(([date, ents]) => ({ date, entries: ents }));
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projetId'] && this.projetId) {
      this.collab.connect(this.projetId);
    }
    if (changes['activeIds']) {
      this._activeIds.set(this.activeIds);
    }
  }

  reload() {
    if (this.projetId) this.collab.loadHistory(this.projetId);
  }

  isClickable(entry: DisplayHistoryEntry): boolean {
    if (entry.isPending) return false;
    return entry.section === 'projets/contenu' && entry.actionType === 'update';
  }

  async onEntryClick(entry: DisplayHistoryEntry) {
    if (!this.isClickable(entry)) return;
    // Vérifier si beforeState/afterState sont déjà des objets parsés avec contenu
    const hasLoaded = (
      (entry.beforeState != null && typeof entry.beforeState === 'object' && 'content' in entry.beforeState) ||
      (entry.afterState  != null && typeof entry.afterState  === 'object' && 'content' in entry.afterState)
    );
    if (hasLoaded) {
      this.entryClick.emit(entry);
      return;
    }
    // Fetch depuis le serveur (gère le cas string JSON non parsé et les entrées sans état)
    this.loadingEntryId = entry.id;
    try {
      const full = await this.collab.fetchEntry(entry.id);
      this.entryClick.emit(full);
    } catch (e) {
      console.warn('[History] fetchEntry error:', e);
      this.entryClick.emit(entry);
    } finally {
      this.loadingEntryId = null;
    }
  }

  getActionIcon(entry: CollabHistoryEntry): string {
    const { actionType, section } = entry;
    if (actionType === 'create') return section.includes('sections') ? 'create_new_folder' : 'note_add';
    if (actionType === 'delete') return 'delete';
    if (actionType === 'upload') return 'image';
    if (actionType === 'update' && section.includes('contenu')) return 'edit_document';
    if (actionType === 'update') return 'edit';
    if (actionType === 'undo') return 'undo';
    if (actionType === 'redo') return 'redo';
    return 'history';
  }

  getIconBgColor(entry: CollabHistoryEntry): string {
    const { actionType } = entry;
    if (actionType === 'create') return 'bg-green-500/20';
    if (actionType === 'delete') return 'bg-red-500/20';
    if (actionType === 'upload') return 'bg-blue-500/20';
    if (actionType === 'update') return 'bg-yellow-500/20';
    if (actionType === 'undo' || actionType === 'redo') return 'bg-purple-500/20';
    return 'bg-white/8';
  }

  getIconColor(entry: CollabHistoryEntry): string {
    const { actionType } = entry;
    if (actionType === 'create') return 'text-green-400';
    if (actionType === 'delete') return 'text-red-400';
    if (actionType === 'upload') return 'text-blue-400';
    if (actionType === 'update') return 'text-yellow-400';
    if (actionType === 'undo' || actionType === 'redo') return 'text-purple-400';
    return 'text-white/40';
  }

  formatTime(ts: string): string {
    try {
      return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}
