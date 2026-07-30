import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HelpHintComponent } from '../help-hint/help-hint.component';
import { FormsModule } from '@angular/forms';
import { User, UnavailabilityPeriod, CreateUnavailabilityPayload } from '../../../../models/project.model';
import { loadFromLocalStorage, saveToLocalStorage, userScopedKey } from '../../../../utils/local-cache';
import { DateRangePickerComponent } from '../date-range-picker/date-range-picker.component';

/**
 * Gestion des périodes d'indisponibilité (congés/absences) par développeur, indépendantes de tout
 * projet : sans ça, rien n'empêchait d'assigner une tâche à un développeur absent (voir
 * planning-agenda pour la surimpression sur le Gantt et task-modal pour l'avertissement).
 */
@Component({
  selector: 'app-indisponibilites',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangePickerComponent, HelpHintComponent],
  templateUrl: './indisponibilites.component.html',
  styleUrls: ['./indisponibilites.component.scss']
})
export class IndisponibilitesComponent {
  @Input({ required: true }) users: User[] = [];
  @Input({ required: true }) unavailabilities: UnavailabilityPeriod[] = [];

  @Output() created = new EventEmitter<CreateUnavailabilityPayload>();
  @Output() deleted = new EventEmitter<number>();

  // Persisté en localStorage par utilisateur (voir CLAUDE.md — "Persistance en mode dégradé").
  private readonly collapsedCacheKey = userScopedKey('agenda:local-cache:collapsed:indisponibilites');
  collapsed = loadFromLocalStorage(this.collapsedCacheKey, false);

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    saveToLocalStorage(this.collapsedCacheKey, this.collapsed);
  }

  form = this.emptyForm();

  // Pas de endpoint dédié "update" (voir ProjectService) : éditer une période revient à supprimer
  // l'ancienne et recréer une nouvelle avec les valeurs modifiées, en s'appuyant sur les mêmes
  // (created)/(deleted) déjà câblés de bout en bout (backend + repli local). editingId mémorise la
  // période en cours d'édition pour savoir quoi supprimer une fois le formulaire soumis.
  editingId: number | null = null;

  private emptyForm() {
    return {
      userId: null as number | null,
      dateStart: '',
      dateEnd: '',
      reason: ''
    };
  }

  onRangeChange(range: { start: string | null; end: string | null }): void {
    this.form.dateStart = range.start || '';
    this.form.dateEnd = range.end || '';
  }

  devLabel(userId: number): string {
    const dev = this.users.find(u => u.id === userId);
    return dev ? `${dev.firstname} ${dev.lastname}` : `#${userId}`;
  }

  /** Périodes triées par date de début, plus proches en premier. */
  get sortedUnavailabilities(): UnavailabilityPeriod[] {
    return [...this.unavailabilities].sort((a, b) => (a.dateStart < b.dateStart ? -1 : a.dateStart > b.dateStart ? 1 : 0));
  }

  startEdit(period: UnavailabilityPeriod): void {
    this.editingId = period.id;
    this.form = {
      userId: period.userId,
      dateStart: period.dateStart,
      dateEnd: period.dateEnd,
      reason: period.reason || ''
    };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.form = this.emptyForm();
  }

  onSubmit(): void {
    if (!this.form.userId || !this.form.dateStart || !this.form.dateEnd) return;
    if (this.form.dateEnd < this.form.dateStart) return;

    if (this.editingId !== null) {
      this.deleted.emit(this.editingId);
    }
    this.created.emit({
      userId: this.form.userId,
      dateStart: this.form.dateStart,
      dateEnd: this.form.dateEnd,
      reason: this.form.reason.trim() || undefined
    });
    this.editingId = null;
    this.form = this.emptyForm();
  }

  onDelete(id: number): void {
    if (this.editingId === id) this.cancelEdit();
    this.deleted.emit(id);
  }
}
