import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PortalAppsService, PortalApp } from '@worganic/portail-core/data-access';

/** Admin › Applications › Applications — CRUD des sous-applications du portail. */
@Component({
  selector: 'app-portail-apps-section',
  imports: [FormsModule],
  templateUrl: './portail-apps.component.html'
})
export class PortailAppsSectionComponent implements OnInit {
  private service = inject(PortalAppsService);

  apps    = signal<PortalApp[]>([]);
  loading = signal(true);
  error   = signal('');
  saving  = signal(false);
  deletingId = signal<number | null>(null);

  // Formulaire (création si editing() est null, sinon édition)
  showForm = signal(false);
  editing  = signal<PortalApp | null>(null);
  fCode = '';
  fNom = '';
  fDescription = '';
  fUrlPath = '';
  fIcone = 'apps';
  fOrdre = 0;
  fIsActive = true;

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.apps.set(await this.service.getApps());
      // Rafraîchit aussi les apps autorisées pour l'utilisateur courant (signal partagé lu
      // par NavComponent) : sans ça, un admin qui active/désactive une app ne verrait le
      // changement dans son propre menu qu'après un rechargement de page.
      await this.service.getHomeDashboard();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur chargement des applications');
    } finally {
      this.loading.set(false);
    }
  }

  openCreate() {
    this.editing.set(null);
    this.fCode = '';
    this.fNom = '';
    this.fDescription = '';
    this.fUrlPath = '';
    this.fIcone = 'apps';
    this.fOrdre = (this.apps().length + 1);
    this.fIsActive = true;
    this.showForm.set(true);
  }

  openEdit(app: PortalApp) {
    this.editing.set(app);
    this.fCode = app.code;
    this.fNom = app.nom;
    this.fDescription = app.description;
    this.fUrlPath = app.urlPath;
    this.fIcone = app.icone;
    this.fOrdre = app.ordre;
    this.fIsActive = app.isActive;
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  async save() {
    if (!this.fCode.trim() || !this.fNom.trim()) return;
    this.saving.set(true);
    this.error.set('');
    const payload: Partial<PortalApp> = {
      code: this.fCode.trim(),
      nom: this.fNom.trim(),
      description: this.fDescription.trim(),
      urlPath: this.fUrlPath.trim(),
      icone: this.fIcone.trim() || 'apps',
      ordre: Number(this.fOrdre) || 0,
      isActive: this.fIsActive,
    };
    try {
      const current = this.editing();
      if (current) await this.service.updateApp(current.id, payload);
      else         await this.service.createApp(payload);
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
      await this.service.deleteApp(id);
      this.deletingId.set(null);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur suppression');
      this.deletingId.set(null);
    }
  }

  async toggleActive(app: PortalApp) {
    try {
      await this.service.updateApp(app.id, { isActive: !app.isActive });
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour');
    }
  }
}
