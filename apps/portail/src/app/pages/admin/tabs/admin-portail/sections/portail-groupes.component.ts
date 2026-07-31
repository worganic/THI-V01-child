import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PortalAppsService,
  PortalApp,
  PortalGroupe,
  PortalGroupeApp,
} from '@portail/core-data-access';

/**
 * Admin › Applications › Groupes — CRUD des groupes et rattachement
 * des applications à chaque groupe (matrice groupe × applications).
 */
@Component({
  selector: 'app-portail-groupes-section',
  imports: [FormsModule],
  templateUrl: './portail-groupes.component.html'
})
export class PortailGroupesSectionComponent implements OnInit {
  private service = inject(PortalAppsService);

  groupes    = signal<PortalGroupe[]>([]);
  apps       = signal<PortalApp[]>([]);
  groupeApps = signal<PortalGroupeApp[]>([]);
  loading    = signal(true);
  error      = signal('');
  saving     = signal(false);
  deletingId = signal<number | null>(null);

  selectedGroupeId = signal<number | null>(null);
  selectedGroupe = computed(() => this.groupes().find(g => g.id === this.selectedGroupeId()) || null);

  showForm = signal(false);
  editing  = signal<PortalGroupe | null>(null);
  fNom = '';
  fDescription = '';
  fOrdre = 0;
  fIsActive = true;

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [groupes, apps, groupeApps] = await Promise.all([
        this.service.getGroupes(),
        this.service.getApps(),
        this.service.getGroupeApps(),
      ]);
      this.groupes.set(groupes);
      this.apps.set(apps);
      this.groupeApps.set(groupeApps);
      if (!this.selectedGroupeId() || !groupes.some(g => g.id === this.selectedGroupeId())) {
        this.selectedGroupeId.set(groupes[0]?.id ?? null);
      }
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur chargement des groupes');
    } finally {
      this.loading.set(false);
    }
  }

  countApps(groupeId: number): number {
    return this.groupeApps().filter(ga => ga.groupeId === groupeId).length;
  }

  isLinked(appId: number): boolean {
    const groupeId = this.selectedGroupeId();
    return !!groupeId && this.groupeApps().some(ga => ga.groupeId === groupeId && ga.appId === appId);
  }

  async toggleApp(appId: number) {
    const groupeId = this.selectedGroupeId();
    if (!groupeId) return;
    const linked = !this.isLinked(appId);
    try {
      await this.service.toggleGroupeApp(groupeId, appId, linked);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour du rattachement');
    }
  }

  openCreate() {
    this.editing.set(null);
    this.fNom = '';
    this.fDescription = '';
    this.fOrdre = this.groupes().length + 1;
    this.fIsActive = true;
    this.showForm.set(true);
  }

  openEdit(groupe: PortalGroupe) {
    this.editing.set(groupe);
    this.fNom = groupe.nom;
    this.fDescription = groupe.description;
    this.fOrdre = groupe.ordre;
    this.fIsActive = groupe.isActive;
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  async save() {
    if (!this.fNom.trim()) return;
    this.saving.set(true);
    this.error.set('');
    const payload: Partial<PortalGroupe> = {
      nom: this.fNom.trim(),
      description: this.fDescription.trim(),
      ordre: Number(this.fOrdre) || 0,
      isActive: this.fIsActive,
    };
    try {
      const current = this.editing();
      if (current) await this.service.updateGroupe(current.id, payload);
      else         await this.service.createGroupe(payload);
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
      await this.service.deleteGroupe(id);
      this.deletingId.set(null);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur suppression');
      this.deletingId.set(null);
    }
  }
}
