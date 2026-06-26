import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartPoint } from '@worganic/portail-core/data-access';

@Component({
  selector: 'app-chart-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col bg-light-background dark:bg-background rounded-lg border border-indigo-500/20 overflow-hidden">

      <!-- Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-indigo-500/15 bg-indigo-500/5 flex-shrink-0">
        <span class="material-symbols-outlined text-indigo-400 text-lg">show_chart</span>
        <span class="text-sm font-semibold text-light-text dark:text-white/90">{{ title }}</span>
        @if (stats()) {
          <span class="ml-auto text-[11px] text-light-text-muted dark:text-white/40">
            Min : {{ stats()!.min }} · Max : {{ stats()!.max }} · Dernière : <span class="text-indigo-400 font-semibold">{{ stats()!.last }}</span>
          </span>
        }
      </div>

      <!-- Graphique SVG -->
      <div class="px-4 py-4">
        @if (points.length === 0) {
          <p class="text-[12px] text-light-text-muted dark:text-white/40 italic text-center py-4">Aucune donnée à afficher.</p>
        } @else if (points.length === 1) {
          <p class="text-[12px] text-light-text-muted dark:text-white/40 text-center py-4">{{ points[0].label }} : {{ points[0].value }}</p>
        } @else {
          <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" [attr.width]="W" [attr.height]="H"
               class="w-full max-w-full overflow-visible"
               style="max-height: 160px;">

            <!-- Grille horizontale (5 lignes) -->
            @for (tick of yTicks(); track $index) {
              <line [attr.x1]="PAD_L" [attr.y1]="yPos(tick)" [attr.x2]="W - PAD_R" [attr.y2]="yPos(tick)"
                    stroke-width="0.5" class="stroke-light-border dark:stroke-white/10" />
              <text [attr.x]="PAD_L - 4" [attr.y]="yPos(tick) + 3.5" text-anchor="end"
                    font-size="8" class="fill-light-text-muted dark:fill-white/30">{{ tick | number:'1.0-1' }}</text>
            }

            <!-- Aire sous la courbe -->
            <path [attr.d]="areaPath()" fill="rgba(99,102,241,0.10)" />

            <!-- Ligne de la courbe -->
            <polyline [attr.points]="polylinePoints()" fill="none" stroke="#6366f1" stroke-width="2" stroke-linejoin="round" />

            <!-- Points -->
            @for (pt of points; track $index) {
              <circle [attr.cx]="xPos($index)" [attr.cy]="yPos(pt.value)" r="4" fill="#6366f1" />
              <text [attr.x]="xPos($index)" [attr.y]="yPos(pt.value) - 8" text-anchor="middle"
                    font-size="8" class="fill-indigo-400">{{ pt.value }}</text>
            }

            <!-- Labels axe X -->
            @for (pt of points; track $index) {
              <text [attr.x]="xPos($index)" [attr.y]="H - 2" text-anchor="middle"
                    font-size="8" class="fill-light-text-muted dark:fill-white/40">{{ pt.label }}</text>
            }
          </svg>
        }
      </div>
    </div>
  `,
})
export class ChartBoardComponent {
  @Input() title = 'Graphique';
  @Input() points: ChartPoint[] = [];

  readonly W = 520;
  readonly H = 140;
  readonly PAD_L = 30;
  readonly PAD_R = 10;
  readonly PAD_T = 20;
  readonly PAD_B = 20;

  private get chartW() { return this.W - this.PAD_L - this.PAD_R; }
  private get chartH() { return this.H - this.PAD_T - this.PAD_B; }

  private get minVal() { return Math.min(...this.points.map(p => p.value)); }
  private get maxVal() { return Math.max(...this.points.map(p => p.value)); }
  private get valRange() { return this.maxVal - this.minVal || 1; }

  xPos(i: number): number {
    if (this.points.length <= 1) return this.PAD_L + this.chartW / 2;
    return this.PAD_L + (i / (this.points.length - 1)) * this.chartW;
  }

  yPos(val: number): number {
    return this.PAD_T + (1 - (val - this.minVal) / this.valRange) * this.chartH;
  }

  polylinePoints(): string {
    return this.points.map((p, i) => `${this.xPos(i)},${this.yPos(p.value)}`).join(' ');
  }

  areaPath(): string {
    if (this.points.length < 2) return '';
    const pts = this.points.map((p, i) => `${this.xPos(i)},${this.yPos(p.value)}`).join(' L ');
    const base = this.PAD_T + this.chartH;
    return `M ${this.xPos(0)},${base} L ${pts} L ${this.xPos(this.points.length - 1)},${base} Z`;
  }

  yTicks = computed(() => {
    const min = Math.min(...this.points.map(p => p.value));
    const max = Math.max(...this.points.map(p => p.value));
    const range = max - min || 1;
    const step = range / 4;
    return [0, 1, 2, 3, 4].map(i => min + i * step);
  });

  stats = computed(() => {
    if (this.points.length === 0) return null;
    const vals = this.points.map(p => p.value);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      last: vals[vals.length - 1],
    };
  });
}
