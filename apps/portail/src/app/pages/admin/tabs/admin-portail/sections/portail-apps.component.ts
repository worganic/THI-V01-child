import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { PortalAppsService, PortalApp } from '@portail/core-data-access';
import { TableSort, paginate, WorgAdminPaginationComponent } from '@portail/shared-ui';

type AppColumn = 'code' | 'nom' | 'urlPath' | 'ordre' | 'statut';

/**
 * Admin › Portail › Applications — CRUD des sous-applications du portail.
 *
 * Même présentation que l'autre portail : formulaire d'ajout en tête, barre de
 * filtres, tableau triable avec édition en ligne, puis pagination.
 */
@Component({
  selector: 'app-portail-apps-section',
  imports: [FormsModule, NgClass, WorgAdminPaginationComponent],
  templateUrl: './portail-apps.component.html'
})
export class PortailAppsSectionComponent implements OnInit {
  private service = inject(PortalAppsService);

  apps    = signal<PortalApp[]>([]);
  loading = signal(true);
  error   = signal('');
  saving  = signal(false);
  deletingId = signal<number | null>(null);

  // ── Création ──────────────────────────────────────────────────────────────
  nCode = '';
  nNom = '';
  nDescription = '';
  nUrlPath = '';
  nIcone = 'apps';
  nOrdre = 0;
  nIsActive = true;

  // ── Édition en ligne ──────────────────────────────────────────────────────
  editingId = signal<number | null>(null);
  eCode = '';
  eNom = '';
  eDescription = '';
  eUrlPath = '';
  eIcone = '';
  eOrdre = 0;
  eIsActive = true;

  // ── Recherche / filtres ───────────────────────────────────────────────────
  searchText   = signal('');
  filterStatus = signal<'' | 'active' | 'inactive'>('');

  // ── Tri / pagination ──────────────────────────────────────────────────────
  readonly sort = new TableSort<AppColumn>('ordre');
  pageSize = signal(10);
  page     = signal(1);

  filteredApps = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    return this.apps().filter(a => {
      if (q && !`${a.code} ${a.nom} ${a.description} ${a.urlPath}`.toLowerCase().includes(q)) return false;
      if (this.filterStatus() === 'active' && !a.isActive) return false;
      if (this.filterStatus() === 'inactive' && a.isActive) return false;
      return true;
    });
  });

  sortedApps = computed(() =>
    this.sort.apply(this.filteredApps(), (a, col) => {
      switch (col) {
        case 'code':    return a.code.toLowerCase();
        case 'nom':     return a.nom.toLowerCase();
        case 'urlPath': return (a.urlPath || '').toLowerCase();
        case 'ordre':   return a.ordre;
        case 'statut':  return a.isActive ? 0 : 1;
      }
    })
  );

  pagedApps = computed(() => paginate(this.sortedApps(), this.pageSize(), this.page()));

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

  onFilterChange() { this.page.set(1); }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async ajouterApplication() {
    if (!this.nCode.trim() || !this.nNom.trim()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.service.createApp({
        code: this.nCode.trim(),
        nom: this.nNom.trim(),
        description: this.nDescription.trim(),
        urlPath: this.nUrlPath.trim(),
        icone: this.nIcone.trim() || 'apps',
        ordre: Number(this.nOrdre) || this.apps().length + 1,
        isActive: this.nIsActive,
      });
      this.nCode = '';
      this.nNom = '';
      this.nDescription = '';
      this.nUrlPath = '';
      this.nIcone = 'apps';
      this.nOrdre = 0;
      this.nIsActive = true;
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur enregistrement');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Édition en ligne ──────────────────────────────────────────────────────

  startEdit(app: PortalApp) {
    this.editingId.set(app.id);
    this.eCode = app.code;
    this.eNom = app.nom;
    this.eDescription = app.description;
    this.eUrlPath = app.urlPath;
    this.eIcone = app.icone;
    this.eOrdre = app.ordre;
    this.eIsActive = app.isActive;
  }

  cancelEdit() { this.editingId.set(null); }

  async saveEdit(app: PortalApp) {
    if (!this.eCode.trim() || !this.eNom.trim()) return;
    this.saving.set(true);
    try {
      await this.service.updateApp(app.id, {
        code: this.eCode.trim(),
        nom: this.eNom.trim(),
        description: this.eDescription.trim(),
        urlPath: this.eUrlPath.trim(),
        icone: this.eIcone.trim() || 'apps',
        ordre: Number(this.eOrdre) || 0,
        isActive: this.eIsActive,
      });
      this.editingId.set(null);
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
