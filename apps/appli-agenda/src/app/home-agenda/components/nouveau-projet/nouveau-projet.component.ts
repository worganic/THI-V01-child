import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project, User, RiskLevel, ProjectMetier } from '../../../../models/project.model';
import { HelpHintComponent } from '../help-hint/help-hint.component';
import { metierBadgeClass } from '../../../../utils/metier-colors';
import { computeDateEndEstimated } from '../../../../utils/date-rules';

export interface ProjectFormPayload {
  code: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  dateStart: string;
  dateEndEstimated: string;
  estimatedTimeDays: number;
  developerIds: number[];
  excludeWeekends: boolean;
  excludeHolidays: boolean;
  metierIds: number[];
}

/**
 * Sauvegarde immédiate (sans passer par le bouton "Modifier le projet") du rattachement métiers/
 * développeurs, déclenchée à chaque coche/décoche d'un métier en mode édition — voir
 * toggleMetierSelection. Ne porte que ces deux champs : les autres (code, nom, dates...) ne sont
 * enregistrés qu'à la soumission explicite du formulaire, pour ne jamais sauvegarder en douce une
 * modification en cours de saisie sur un autre champ.
 */
export interface MetierAssignmentAutoSavePayload {
  id: number;
  developerIds: number[];
  metierIds: number[];
}

@Component({
  selector: 'app-nouveau-projet',
  standalone: true,
  imports: [CommonModule, FormsModule, HelpHintComponent],
  templateUrl: './nouveau-projet.component.html',
  styleUrls: ['./nouveau-projet.component.scss']
})
export class NouveauProjetComponent implements OnChanges {
  @Input({ required: true }) users: User[] = [];
  // Tous les utilisateurs actifs du portail (voir ProjectService.getAllActiveUsers()), utilisé
  // uniquement par visibleUsers quand un métier est coché — voir ce getter.
  @Input() allUsers: User[] = [];
  @Input({ required: true }) metiers: ProjectMetier[] = [];
  // Non-null : le formulaire bascule en mode édition, pré-rempli avec ce projet.
  @Input() editingProject: Project | null = null;

  @Output() projectCreated = new EventEmitter<ProjectFormPayload>();
  @Output() projectUpdated = new EventEmitter<ProjectFormPayload & { id: number }>();
  // Émis quand l'édition est annulée ou validée, pour que le parent efface editingProject.
  @Output() editCancelled = new EventEmitter<void>();
  // Émis à chaque coche/décoche d'un métier en mode édition (voir MetierAssignmentAutoSavePayload) :
  // contrairement à projectUpdated, ne doit PAS faire sortir le formulaire du mode édition (le
  // parent ne doit donc pas réaffecter editingProject en réponse à cet évènement).
  @Output() metierAssignmentAutoSaved = new EventEmitter<MetierAssignmentAutoSavePayload>();

  readonly badgeClass = metierBadgeClass;

  // Le formulaire est masqué par défaut (sauf en mode édition, cf. ngOnChanges)
  isFormVisible = false;

  form = this.emptyForm();

  get isEditMode(): boolean {
    return !!this.editingProject;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingProject'] && this.editingProject) {
      const p = this.editingProject;
      this.form = {
        code: p.code,
        name: p.name,
        description: p.description,
        riskLevel: p.riskLevel,
        dateStart: p.dateStart,
        estimatedTimeDays: p.estimatedTimeDays,
        selectedDevIds: p.developers.map(d => d.id),
        excludeWeekends: !!p.excludeWeekends,
        excludeHolidays: !!p.excludeHolidays,
        selectedMetierIds: p.metierIds ? [...p.metierIds] : []
      };
      this.isFormVisible = true;
    }
  }

  private emptyForm() {
    return {
      code: '',
      name: '',
      description: '',
      riskLevel: 'FAIBLE' as RiskLevel,
      dateStart: '2026-07-27',
      estimatedTimeDays: 10,
      selectedDevIds: [] as number[],
      excludeWeekends: false,
      excludeHolidays: false,
      selectedMetierIds: [] as number[]
    };
  }

  toggleForm(): void {
    if (this.isEditMode) {
      // "Annuler" en mode édition referme le formulaire et prévient le parent.
      this.form = this.emptyForm();
      this.isFormVisible = false;
      this.editCancelled.emit();
      return;
    }
    this.isFormVisible = !this.isFormVisible;
  }

  isDevSelected(devId: number): boolean {
    return this.form.selectedDevIds.includes(devId);
  }

  /**
   * Date de fin estimée, calculée à partir de la date de début et de l'estimation (voir
   * computeDateEndEstimated) — remplace l'ancien champ de saisie libre, qui pouvait diverger
   * silencieusement des deux autres champs (ex: date de fin antérieure à la date de début).
   */
  get computedDateEndEstimated(): string {
    return computeDateEndEstimated(this.form.dateStart, this.form.estimatedTimeDays);
  }

  /**
   * Dès qu'au moins une demi-journée a été validée sur une tâche de ce projet (n'importe laquelle),
   * la date de début ne doit plus pouvoir être déplacée — la décaler déplacerait tout le projet
   * dans l'agenda et désynchroniserait le travail déjà réellement effectué de sa date d'origine.
   */
  get isDateStartLocked(): boolean {
    return !!this.editingProject?.tasks?.some(t => (t.workedHalfDays?.length ?? 0) > 0);
  }

  /** Métier de ce développeur (voir User.metier_id), pour l'afficher sous son nom dans la case à cocher. */
  metierFor(dev: User): ProjectMetier | undefined {
    if (dev.metier_id == null) return undefined;
    return this.metiers.find(m => m.id === dev.metier_id);
  }

  /**
   * Développeurs proposés dans la case à cocher.
   * - Aucun métier coché : liste par défaut (this.users, restreinte au groupe portail
   *   "Developpeur"), comportement historique inchangé.
   * - Un ou plusieurs métiers cochés : le métier REMPLACE le filtre groupe — tous les utilisateurs
   *   actifs du portail correspondants apparaissent (this.allUsers), même hors groupe Developpeur.
   *   Un développeur déjà sélectionné et verrouillé (devHasAssignedTask) reste visible même si son
   *   métier ne correspond plus au filtre courant — sinon le formulaire masquerait silencieusement
   *   un développeur pourtant toujours affecté au projet (voir aussi toggleMetierSelection).
   */
  get visibleUsers(): User[] {
    if (this.form.selectedMetierIds.length === 0) return this.users;
    const pool = this.allUsers.length > 0 ? this.allUsers : this.users;
    return pool.filter(u =>
      (u.metier_id != null && this.form.selectedMetierIds.includes(u.metier_id)) ||
      (this.isDevSelected(u.id) && this.devHasAssignedTask(u.id))
    );
  }

  /**
   * Un développeur ayant au moins une tâche assignée dans ce projet — terminée ou non — ne peut
   * plus en être retiré : le retirer casserait l'historique (assignedUserId de tâches déjà
   * réalisées) sans qu'on puisse le réaffecter après coup. Seul un développeur jamais assigné
   * peut être décoché.
   */
  devHasAssignedTask(devId: number): boolean {
    return !!this.editingProject?.tasks?.some(t => t.assignedUserId === devId);
  }

  toggleDevSelection(devId: number): void {
    const idx = this.form.selectedDevIds.indexOf(devId);
    if (idx > -1) {
      if (this.devHasAssignedTask(devId)) return;
      this.form.selectedDevIds.splice(idx, 1);
    } else {
      this.form.selectedDevIds.push(devId);
    }
  }

  isMetierSelected(metierId: number): boolean {
    return this.form.selectedMetierIds.includes(metierId);
  }

  /**
   * Coche/décoche un métier : met à jour la sélection, retire du formulaire les développeurs qui
   * ne correspondent plus à aucun métier coché (sauf ceux verrouillés par une tâche assignée), et
   * — en mode édition uniquement — enregistre immédiatement ce rattachement côté serveur, sans
   * attendre le clic sur "Modifier le projet" (voir MetierAssignmentAutoSavePayload).
   */
  toggleMetierSelection(metierId: number): void {
    const idx = this.form.selectedMetierIds.indexOf(metierId);
    if (idx > -1) {
      this.form.selectedMetierIds.splice(idx, 1);
    } else {
      this.form.selectedMetierIds.push(metierId);
    }

    if (this.form.selectedMetierIds.length > 0) {
      const allowedIds = new Set(this.visibleUsers.map(u => u.id));
      this.form.selectedDevIds = this.form.selectedDevIds.filter(id => allowedIds.has(id));
    }

    if (this.isEditMode && this.editingProject) {
      this.metierAssignmentAutoSaved.emit({
        id: this.editingProject.id,
        developerIds: this.developerIdsWithRequired(),
        metierIds: [...this.form.selectedMetierIds]
      });
    }
  }

  /**
   * Développeurs actuellement cochés, complétés par ceux ayant au moins une tâche assignée dans ce
   * projet (voir devHasAssignedTask) : ce filet de sécurité doit s'appliquer identiquement que la
   * sauvegarde vienne de la soumission du formulaire ou de l'auto-save déclenché par un métier.
   */
  private developerIdsWithRequired(): number[] {
    const requiredDevIds = (this.editingProject?.tasks || [])
      .map(t => t.assignedUserId)
      .filter((id): id is number => id != null);
    return Array.from(new Set([...this.form.selectedDevIds, ...requiredDevIds]));
  }

  onSubmit(): void {
    if (!this.form.code || !this.form.name) return;

    const developerIds = this.developerIdsWithRequired();

    const payload: ProjectFormPayload = {
      code: this.form.code,
      name: this.form.name,
      description: this.form.description,
      riskLevel: this.form.riskLevel,
      dateStart: this.form.dateStart,
      dateEndEstimated: this.computedDateEndEstimated,
      estimatedTimeDays: this.form.estimatedTimeDays,
      developerIds,
      excludeWeekends: this.form.excludeWeekends,
      excludeHolidays: this.form.excludeHolidays,
      metierIds: [...this.form.selectedMetierIds]
    };

    if (this.isEditMode && this.editingProject) {
      this.projectUpdated.emit({ ...payload, id: this.editingProject.id });
      this.editCancelled.emit();
    } else {
      this.projectCreated.emit(payload);
    }

    // Reset du formulaire et re-masquage
    this.form = this.emptyForm();
    this.isFormVisible = false;
  }
}