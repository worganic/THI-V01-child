import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CalendarDay {
  dateSql: string;
  dayNumber: number;
  isOutsideMonth: boolean;
}

/**
 * Sélecteur de plage de dates en un seul contrôle (bouton affichant "début → fin" + popup
 * calendrier unique) : remplace les deux `<input type="date">` séparés "Du"/"Au", qui obligeaient
 * à ouvrir deux calendriers indépendants pour poser une seule période. Premier clic sur un jour =
 * début, second clic = fin (clic avant le début en cours redémarre la sélection).
 */
@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-range-picker.component.html',
  styleUrls: ['./date-range-picker.component.scss']
})
export class DateRangePickerComponent implements OnChanges {
  private readonly elementRef = inject(ElementRef);

  @ViewChild('triggerBtn') private triggerBtn?: ElementRef<HTMLButtonElement>;

  @Input() start: string | null = null;
  @Input() end: string | null = null;
  @Output() rangeChange = new EventEmitter<{ start: string | null; end: string | null }>();

  open = false;
  workingStart: string | null = null;
  workingEnd: string | null = null;
  hoveredDateSql: string | null = null;

  // Popup en position:fixed (voir template + SCSS) plutôt qu'absolute : la carte contenant ce champ
  // (.indispo-card) a overflow:hidden pour arrondir ses coins, ce qui coupait le calendrier dès
  // qu'il dépassait le bas de la carte. En position:fixed, calculée depuis le bouton déclencheur, le
  // popup s'affiche par-dessus toute la page sans être rogné par un ancêtre.
  popupTop = 0;
  popupLeft = 0;

  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();

  readonly weekDayLabels = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
  private readonly monthLabels = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if ('start' in changes || 'end' in changes) {
      this.workingStart = this.start;
      this.workingEnd = this.end;
      if (this.start) {
        const base = this.parseSql(this.start);
        this.viewYear = base.getFullYear();
        this.viewMonth = base.getMonth();
      }
    }
  }

  get displayLabel(): string {
    if (!this.workingStart) return 'jj/mm/aaaa → jj/mm/aaaa';
    const s = this.formatDisplay(this.workingStart);
    const e = this.workingEnd ? this.formatDisplay(this.workingEnd) : '…';
    return `${s} → ${e}`;
  }

  get monthLabel(): string {
    return `${this.monthLabels[this.viewMonth]} ${this.viewYear}`;
  }

  /** Grille de 6 semaines (Lundi → Dimanche), bordée par les jours du mois voisin pour compléter les semaines. */
  get calendarWeeks(): CalendarDay[][] {
    const firstOfMonth = new Date(this.viewYear, this.viewMonth, 1);
    const firstWeekdayMondayBased = (firstOfMonth.getDay() + 6) % 7;
    const cursor = new Date(this.viewYear, this.viewMonth, 1 - firstWeekdayMondayBased);

    const weeks: CalendarDay[][] = [];
    for (let w = 0; w < 6; w++) {
      const week: CalendarDay[] = [];
      for (let d = 0; d < 7; d++) {
        week.push({
          dateSql: this.toSql(cursor),
          dayNumber: cursor.getDate(),
          isOutsideMonth: cursor.getMonth() !== this.viewMonth
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }

  toggleOpen(): void {
    this.open = !this.open;
    if (this.open) {
      this.updatePopupPosition();
    }
  }

  // Hauteur approximative du popup (en-tête + jours de semaine + 6 lignes + astuce), pour décider
  // de l'afficher au-dessus du bouton quand il n'y a pas la place en dessous (viewport bas/scrollé).
  private readonly estimatedPopupHeight = 330;

  private updatePopupPosition(): void {
    const rect = this.triggerBtn?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    const fitsBelow = rect.bottom + this.estimatedPopupHeight <= window.innerHeight;
    this.popupTop = fitsBelow ? rect.bottom + 4 : Math.max(4, rect.top - this.estimatedPopupHeight - 4);
    this.popupLeft = rect.left;
  }

  prevMonth(): void {
    this.viewMonth--;
    if (this.viewMonth < 0) {
      this.viewMonth = 11;
      this.viewYear--;
    }
  }

  nextMonth(): void {
    this.viewMonth++;
    if (this.viewMonth > 11) {
      this.viewMonth = 0;
      this.viewYear++;
    }
  }

  onDayClick(dateSql: string): void {
    if (!this.workingStart || this.workingEnd) {
      // Nouvelle sélection (rien en cours, ou une période complète déjà choisie) : ce clic pose le
      // début, la fin reste indéfinie jusqu'au prochain clic.
      this.workingStart = dateSql;
      this.workingEnd = null;
      return;
    }
    if (dateSql < this.workingStart) {
      // Clic avant le début en cours : redémarre la sélection depuis ce jour-là.
      this.workingStart = dateSql;
      this.workingEnd = null;
      return;
    }
    this.workingEnd = dateSql;
    this.rangeChange.emit({ start: this.workingStart, end: this.workingEnd });
    this.open = false;
  }

  isRangeEdge(dateSql: string): boolean {
    return dateSql === this.workingStart || dateSql === this.workingEnd;
  }

  /** Surligne la plage complète, ou un aperçu jusqu'au jour survolé tant que la fin n'est pas encore posée. */
  isInRange(dateSql: string): boolean {
    if (!this.workingStart) return false;
    const end = this.workingEnd || this.hoveredDateSql;
    if (!end) return dateSql === this.workingStart;
    const [lo, hi] = this.workingStart <= end ? [this.workingStart, end] : [end, this.workingStart];
    return dateSql >= lo && dateSql <= hi;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open && !this.elementRef.nativeElement.contains(event.target)) {
      this.open = false;
    }
  }

  // Popup en position:fixed (voir updatePopupPosition) : sans ce listener, un scroll de la page
  // laisserait le popup figé à ses anciennes coordonnées, désormais décroché de son bouton.
  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.open) {
      this.open = false;
    }
  }

  private toSql(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private parseSql(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private formatDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
}
