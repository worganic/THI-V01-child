import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollabHistoryEntry } from '../../../../../core/services/projet-collab.service';

export interface DiffPair {
  type: 'same' | 'removed' | 'added';
  left: string;
  right: string;
  leftNum: number | null;
  rightNum: number | null;
}

@Component({
  selector: 'app-projet-diff',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projet-diff.component.html',
  host: { class: 'flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden' },
})
export class ProjetDiffComponent implements OnChanges {
  @Input() entry: CollabHistoryEntry | null = null;
  @Output() close = new EventEmitter<void>();

  diffPairs: DiffPair[] = [];
  hasContent = false;
  leftLineCount = 0;
  rightLineCount = 0;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['entry']) this.buildDiff();
  }

  private buildDiff() {
    let rawBefore = this.entry?.beforeState ?? null;
    let rawAfter  = this.entry?.afterState  ?? null;
    // MySQL peut renvoyer les colonnes JSON comme strings avant JSON.parse côté serveur
    if (typeof rawBefore === 'string') { try { rawBefore = JSON.parse(rawBefore); } catch { rawBefore = null; } }
    if (typeof rawAfter  === 'string') { try { rawAfter  = JSON.parse(rawAfter);  } catch { rawAfter  = null; } }
    const before = (rawBefore as { content?: string } | null)?.content ?? null;
    const after  = (rawAfter  as { content?: string } | null)?.content ?? null;
    this.hasContent = before !== null || after !== null;
    if (!this.hasContent) { this.diffPairs = []; return; }
    const bLines = (before ?? '').split('\n');
    const aLines = (after ?? '').split('\n');
    this.diffPairs = computeLineDiff(bLines, aLines);
    this.leftLineCount = bLines.length;
    this.rightLineCount = aLines.length;
  }

  formatTime(ts: string): string {
    try {
      return new Date(ts).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return ts; }
  }

  get removedCount(): number { return this.diffPairs.filter(p => p.type === 'removed').length; }
  get addedCount(): number { return this.diffPairs.filter(p => p.type === 'added').length; }
}

// ── Diff algorithm ────────────────────────────────────────────────────────────

function computeLineDiff(before: string[], after: string[]): DiffPair[] {
  const MAX = 300;
  const b = before.slice(0, MAX);
  const a = after.slice(0, MAX);
  const m = b.length, n = a.length;

  // DP table for LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = b[i - 1] === a[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  // Traceback
  const raw: { type: 'same' | 'removed' | 'added'; bl: string; al: string }[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && b[i - 1] === a[j - 1]) {
      raw.unshift({ type: 'same', bl: b[i - 1], al: a[j - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: 'added', bl: '', al: a[j - 1] }); j--;
    } else {
      raw.unshift({ type: 'removed', bl: b[i - 1], al: '' }); i--;
    }
  }

  // Build pairs with line numbers
  let ln = 1, rn = 1;
  return raw.map(r => {
    const pair: DiffPair = {
      type: r.type,
      left: r.bl,
      right: r.al,
      leftNum: r.type !== 'added' ? ln : null,
      rightNum: r.type !== 'removed' ? rn : null,
    };
    if (r.type !== 'added') ln++;
    if (r.type !== 'removed') rn++;
    return pair;
  });
}
