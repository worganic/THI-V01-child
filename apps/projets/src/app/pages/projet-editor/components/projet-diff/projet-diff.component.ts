import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollabHistoryEntry } from '@worganic/portail-core/data-access';
import { TriDiffRow, computeTriDiff } from '../../utils/compute-tri-diff';

export type { TriDiffRow };

@Component({
  selector: 'app-projet-diff',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projet-diff.component.html',
  host: { class: 'flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden' },
})
export class ProjetDiffComponent implements OnChanges {
  @Input() entry: CollabHistoryEntry | null = null;
  @Input() currentContent: string | null = null;
  @Input() leftLabel = 'Avant';
  @Input() rightLabel = 'Après';
  @Output() close = new EventEmitter<void>();
  @Output() applyContent = new EventEmitter<string>();

  // Grille unique alignant Actuel/Avant/Après ligne à ligne (une valeur `null` sur
  // une colonne = la ligne n'existe pas dans cette version, affichée en placeholder
  // plutôt que de décaler les lignes suivantes — voir computeTriDiff).
  rows: TriDiffRow[] = [];
  private originalCurrent: (string | null)[] = [];
  hasContent = false;
  leftLineCount = 0;
  rightLineCount = 0;

  // Indices (dans `rows`) modifiés via cherry-pick ←/→
  changedRowIndices = new Set<number>();

  ngOnChanges(changes: SimpleChanges) {
    if (changes['entry'] || changes['currentContent']) this.buildDiff();
  }

  private buildDiff() {
    let rawBefore = this.entry?.beforeState ?? null;
    let rawAfter  = this.entry?.afterState  ?? null;
    if (typeof rawBefore === 'string') { try { rawBefore = JSON.parse(rawBefore); } catch { rawBefore = null; } }
    if (typeof rawAfter  === 'string') { try { rawAfter  = JSON.parse(rawAfter);  } catch { rawAfter  = null; } }
    const before = (rawBefore as { content?: string } | null)?.content ?? null;
    const after  = (rawAfter  as { content?: string } | null)?.content ?? null;
    this.hasContent = before !== null || after !== null;
    if (!this.hasContent) { this.rows = []; return; }
    const bLines = (before ?? '').split('\n');
    const aLines = (after ?? '').split('\n');
    const cLines = (this.currentContent ?? '').split('\n');
    this.rows = computeTriDiff(cLines, bLines, aLines);
    this.originalCurrent = this.rows.map(r => r.current);
    this.leftLineCount = bLines.length;
    this.rightLineCount = aLines.length;
    this.changedRowIndices = new Set();
  }

  applyBeforeLine(index: number) {
    const row = this.rows[index];
    if (!row || row.before === null) return;
    row.current = row.before;
    this.changedRowIndices = new Set([...this.changedRowIndices, index]);
    this.renumberCurrent();
  }

  applyAfterLine(index: number) {
    const row = this.rows[index];
    if (!row || row.after === null) return;
    row.current = row.after;
    this.changedRowIndices = new Set([...this.changedRowIndices, index]);
    this.renumberCurrent();
  }

  private renumberCurrent() {
    let n = 1;
    for (const row of this.rows) {
      row.currentNum = row.current !== null ? n++ : null;
    }
  }

  applyChanges() {
    const text = this.rows.filter(r => r.current !== null).map(r => r.current as string).join('\n');
    this.applyContent.emit(text);
  }

  resetChanges() {
    this.rows.forEach((row, i) => { row.current = this.originalCurrent[i]; });
    this.renumberCurrent();
    this.changedRowIndices = new Set();
  }

  isLineChanged(index: number): boolean {
    return this.changedRowIndices.has(index);
  }

  formatTime(ts: string): string {
    try {
      return new Date(ts).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return ts; }
  }

  get removedCount(): number { return this.rows.filter(r => r.relation === 'removed').length; }
  get addedCount(): number { return this.rows.filter(r => r.relation === 'added').length; }
}
