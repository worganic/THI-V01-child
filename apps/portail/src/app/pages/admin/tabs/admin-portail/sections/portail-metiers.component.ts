import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import {
  PortalAppsService,
  PortalMetier,
  PortalUser,
  METIER_COLORS,
  metierBadgeClass,
} from '@worganic/portail-core/data-access';

/**
 * Admin › Applications › Métiers — CRUD des métiers.
 * Un métier qualifie la fiche utilisateur, il n'accorde aucun droit.
 */
@Component({
  selector: 'app-portail-metiers-section',
  imports: [FormsModule, NgClass],
  templateUrl: './portail-metiers.component.html'
})
export class PortailMetiersSectionComponent implements OnInit {
  private service = inject(PortalAppsService);

  metiers = signal<PortalMetier[]>([]);
  users   = signal<PortalUser[]>([]);
  loading = signal(true);
  error   = signal('');
  saving  = signal(false);
  deletingId = signal<number | null>(null);

  readonly colors = METIER_COLORS;
  readonly badgeClass = metierBadgeClass;

  showForm = signal(false);
  editing  = signal<PortalMetier | null>(null);
  fNom = '';
  fColor = METIER_COLORS[0].value;
  fIsActive = true;

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [metiers, users] = await Promise.all([this.service.getMetiers(), this.service.getUsers()]);
      this.metiers.set(metiers);
      this.users.set(users);
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur chargement des métiers');
    } finally {
      this.loading.set(false);
    }
  }

  countUsers(metierId: number): number {
    return this.users().filter(u => u.metierId === metierId).length;
  }

  openCreate() {
    this.editing.set(null);
    this.fNom = '';
    this.fColor = METIER_COLORS[0].value;
    this.fIsActive = true;
    this.showForm.set(true);
  }

  openEdit(metier: PortalMetier) {
    this.editing.set(metier);
    this.fNom = metier.nom;
    this.fColor = metier.color;
    this.fIsActive = metier.isActive;
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  async save() {
    if (!this.fNom.trim()) return;
    this.saving.set(true);
    this.error.set('');
    const payload: Partial<PortalMetier> = {
      nom: this.fNom.trim(),
      color: this.fColor,
      isActive: this.fIsActive,
    };
    try {
      const current = this.editing();
      if (current) await this.service.updateMetier(current.id, payload);
      else         await this.service.createMetier(payload);
      this.showForm.set(false);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur enregistrement');
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(id: number) { this.deletingId.set(id); }
  cancelDelete() { this.deletingId.set(null); }

  async remove(id: number) {
    try {
      await this.service.deleteMetier(id);
      this.deletingId.set(null);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur suppression');
      this.deletingId.set(null);
    }
  }
}
