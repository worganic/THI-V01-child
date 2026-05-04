import { Component, Input, OnChanges, SimpleChanges, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjetCollabService, CollabHistoryEntry } from '../../../../../core/services/projet-collab.service';

interface HistoryGroup {
  date: string;
  entries: CollabHistoryEntry[];
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

  readonly collab = inject(ProjetCollabService);

  readonly groups = computed<HistoryGroup[]>(() => {
    const entries = this.collab.history();
    const map = new Map<string, CollabHistoryEntry[]>();
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
  }

  reload() {
    if (this.projetId) this.collab.loadHistory(this.projetId);
  }

  getActionIcon(entry: CollabHistoryEntry): string {
    const { actionType, section } = entry;
    if (actionType === 'create') return section.includes('sections') ? 'create_new_folder' : (section.includes('contenu') || section.includes('fichiers') ? 'note_add' : 'add_circle');
    if (actionType === 'delete') return 'delete';
    if (actionType === 'upload') return 'image';
    if (actionType === 'update' && section.includes('contenu')) return 'edit_document';
    if (actionType === 'update') return 'edit';
    if (actionType === 'undo') return 'undo';
    if (actionType === 'redo') return 'redo';
    return 'history';
  }

  getActionColor(entry: CollabHistoryEntry): string {
    const { actionType } = entry;
    if (actionType === 'create') return 'text-green-400 dark:text-green-400';
    if (actionType === 'delete') return 'text-red-400 dark:text-red-400';
    if (actionType === 'upload') return 'text-blue-400 dark:text-blue-400';
    if (actionType === 'update') return 'text-yellow-400 dark:text-yellow-400';
    if (actionType === 'undo' || actionType === 'redo') return 'text-purple-400 dark:text-purple-400';
    return 'text-light-text-muted dark:text-white/40';
  }

  formatTime(ts: string): string {
    try {
      return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}
