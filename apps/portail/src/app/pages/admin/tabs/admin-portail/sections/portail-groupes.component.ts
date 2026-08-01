import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import {
  PortalAppsService,
  PortalApp,
  PortalGroupe,
  PortalGroupeApp,
} from '@portail/core-data-access';
import { TableSort, paginate, WorgAdminPaginationComponent } from '@portail/shared-ui';

type GroupeColumn = 'nom' | 'description' | 'ordre' | 'apps' | 'statut';

/**
 * Admin › Portail › Groupes — CRUD des groupes et rattachement des
 * applications à chaque groupe (matrice groupe × applications).
 *
 * Même présentation que l'autre portail : formulaire d'ajout en tête, tableau
 * triable avec édition en ligne, et la matrice des applications dépliée sous la
 * ligne du groupe (l'autre portail affiche une carte par groupe — même
 * contenu, mais la ligne dépliable garde la page lisible quand les groupes se
 * multiplient).
 */
@Component({
  selector: 'app-portail-groupes-section',
  imports: [FormsModule, NgClass, WorgAdminPaginationComponent],
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
  expandedId = signal<number | null>(null);

  // ── Création ──────────────────────────────────────────────────────────────
  nNom = '';
  nDescription = '';
  nOrdre = 0;
  nIsActive = true;

  // ── Édition en ligne ──────────────────────────────────────────────────────
  editingId = signal<number | null>(null);
  eNom = '';
  eDescription = '';
  eOrdre = 0;
  eIsActive = true;

  // ── Recherche / filtres ───────────────────────────────────────────────────
  searchText   = signal('');
  filterStatus = signal<'' | 'active' | 'inactive'>('');

  // ── Tri / pagination ──────────────────────────────────────────────────────
  readonly sort = new TableSort<GroupeColumn>('ordre');
  pageSize = signal(10);
  page     = signal(1);

  filteredGroupes = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    return this.groupes().filter(g => {
      if (q && !`${g.nom} ${g.description}`.toLowerCase().includes(q)) return false;
      if (this.filterStatus() === 'active' && !g.isActive) return false;
      if (this.filterStatus() === 'inactive' && g.isActive) return false;
      return true;
    });
  });

  sortedGroupes = computed(() =>
    this.sort.apply(this.filteredGroupes(), (g, col) => {
      switch (col) {
        case 'nom':         return g.nom.toLowerCase();
        case 'description': return (g.description || '').toLowerCase();
        case 'ordre':       return g.ordre;
        case 'apps':        return this.countApps(g.id);
        case 'statut':      return g.isActive ? 0 : 1;
      }
    })
  );

  pagedGroupes = computed(() => paginate(this.sortedGroupes(), this.pageSize(), this.page()));

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.refresh();
    } finally {
      this.loading.set(false);
    }
  }

  /** Rechargement sans démonter le tableau (voir la même règle côté Utilisateurs). */
  async refresh() {
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
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur chargement des groupes');
    }
  }

  onFilterChange() { this.page.set(1); }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
  }

  // ── Matrice groupe × applications ─────────────────────────────────────────

  toggleExpand(id: number) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  countApps(groupeId: number): number {
    return this.groupeApps().filter(ga => ga.groupeId === groupeId).length;
  }

  isLinked(groupeId: number, appId: number): boolean {
    return this.groupeApps().some(ga => ga.groupeId === groupeId && ga.appId === appId);
  }

  async toggleApp(groupeId: number, appId: number) {
    try {
      await this.service.toggleGroupeApp(groupeId, appId, !this.isLinked(groupeId, appId));
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour du rattachement');
    }
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async ajouterGroupe() {
    if (!this.nNom.trim()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.service.createGroupe({
        nom: this.nNom.trim(),
        description: this.nDescription.trim(),
        ordre: Number(this.nOrdre) || this.groupes().length + 1,
        isActive: this.nIsActive,
      });
      this.nNom = '';
      this.nDescription = '';
      this.nOrdre = 0;
      this.nIsActive = true;
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur enregistrement');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Édition en ligne ──────────────────────────────────────────────────────

  startEdit(groupe: PortalGroupe) {
    this.editingId.set(groupe.id);
    this.eNom = groupe.nom;
    this.eDescription = groupe.description;
    this.eOrdre = groupe.ordre;
    this.eIsActive = groupe.isActive;
  }

  cancelEdit() { this.editingId.set(null); }

  async saveEdit(groupe: PortalGroupe) {
    if (!this.eNom.trim()) return;
    this.saving.set(true);
    try {
      await this.service.updateGroupe(groupe.id, {
        nom: this.eNom.trim(),
        description: this.eDescription.trim(),
        ordre: Number(this.eOrdre) || 0,
        isActive: this.eIsActive,
      });
      this.editingId.set(null);
      await this.refresh();
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
      if (this.expandedId() === id) this.expandedId.set(null);
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur suppression');
      this.deletingId.set(null);
    }
  }
}
