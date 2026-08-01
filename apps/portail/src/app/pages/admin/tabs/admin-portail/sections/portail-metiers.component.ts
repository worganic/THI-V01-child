import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import {
  PortalAppsService,
  PortalMetier,
  PortalUser,
} from '@portail/core-data-access';
import { TableSort, paginate, WorgAdminPaginationComponent } from '@portail/shared-ui';
// Rendu Tailwind des teintes de métier : propre à ce portail, voir metier-badge.ts.
import { METIER_COLORS, metierBadgeClass } from '../../../../../shared/metier-badge';

type MetierColumn = 'nom' | 'couleur' | 'utilisateurs' | 'statut';

/**
 * Admin › Portail › Métiers — CRUD des métiers.
 * Un métier qualifie la fiche utilisateur, il n'accorde aucun droit.
 *
 * Même présentation que l'autre portail : formulaire d'ajout avec aperçu du
 * badge, tableau triable avec édition en ligne, et sous chaque métier la liste
 * des utilisateurs concernés — avec de quoi en rattacher ou en retirer un.
 */
@Component({
  selector: 'app-portail-metiers-section',
  imports: [FormsModule, NgClass, WorgAdminPaginationComponent],
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
  expandedId = signal<number | null>(null);

  readonly colors = METIER_COLORS;
  readonly badgeClass = metierBadgeClass;

  // ── Création ──────────────────────────────────────────────────────────────
  nNom = '';
  nColor = METIER_COLORS[0].value;
  nIsActive = true;

  // ── Édition en ligne ──────────────────────────────────────────────────────
  editingId = signal<number | null>(null);
  eNom = '';
  eColor = METIER_COLORS[0].value;
  eIsActive = true;

  // ── Rattachement d'un utilisateur (ligne dépliée) ─────────────────────────
  userQuery = signal('');

  // ── Recherche / filtres ───────────────────────────────────────────────────
  searchText   = signal('');
  filterStatus = signal<'' | 'active' | 'inactive'>('');

  // ── Tri / pagination ──────────────────────────────────────────────────────
  readonly sort = new TableSort<MetierColumn>('nom');
  pageSize = signal(10);
  page     = signal(1);

  filteredMetiers = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    return this.metiers().filter(m => {
      if (q && !m.nom.toLowerCase().includes(q)) return false;
      if (this.filterStatus() === 'active' && !m.isActive) return false;
      if (this.filterStatus() === 'inactive' && m.isActive) return false;
      return true;
    });
  });

  sortedMetiers = computed(() =>
    this.sort.apply(this.filteredMetiers(), (m, col) => {
      switch (col) {
        case 'nom':          return m.nom.toLowerCase();
        case 'couleur':      return m.color;
        case 'utilisateurs': return this.countUsers(m.id);
        case 'statut':       return m.isActive ? 0 : 1;
      }
    })
  );

  pagedMetiers = computed(() => paginate(this.sortedMetiers(), this.pageSize(), this.page()));

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
      const [metiers, users] = await Promise.all([this.service.getMetiers(), this.service.getUsers()]);
      this.metiers.set(metiers);
      this.users.set(users);
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur chargement des métiers');
    }
  }

  onFilterChange() { this.page.set(1); }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
  }

  // ── Utilisateurs d'un métier ──────────────────────────────────────────────

  countUsers(metierId: number): number {
    return this.users().filter(u => u.metierId === metierId).length;
  }

  usersFor(metierId: number): PortalUser[] {
    return this.users().filter(u => u.metierId === metierId);
  }

  toggleExpand(id: number) {
    this.expandedId.set(this.expandedId() === id ? null : id);
    this.userQuery.set('');
  }

  /** Utilisateurs proposés au rattachement : ceux qui n'ont pas déjà ce métier. */
  suggestionsFor(metierId: number): PortalUser[] {
    const q = this.userQuery().trim().toLowerCase();
    return this.users()
      .filter(u => u.metierId !== metierId)
      .filter(u => !q || `${u.matricule} ${u.nom} ${u.prenom} ${u.username} ${u.email}`.toLowerCase().includes(q))
      .slice(0, 8);
  }

  /**
   * Identité affichée : « Prénom NOM » dès que la fiche d'annuaire est
   * renseignée, sinon le nom d'utilisateur — un compte créé avant l'ajout de
   * ces champs reste identifiable.
   */
  displayName(user: PortalUser): string {
    const identite = `${user.prenom} ${user.nom}`.trim();
    return identite || user.username;
  }

  async assignUser(metierId: number, user: PortalUser) {
    try {
      await this.service.setUserMetier(user.id, metierId);
      this.userQuery.set('');
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur rattachement de l\'utilisateur');
    }
  }

  async unassignUser(user: PortalUser) {
    try {
      await this.service.setUserMetier(user.id, null);
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur retrait du métier');
    }
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async ajouterMetier() {
    if (!this.nNom.trim()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.service.createMetier({
        nom: this.nNom.trim(),
        color: this.nColor,
        isActive: this.nIsActive,
      });
      this.nNom = '';
      this.nColor = METIER_COLORS[0].value;
      this.nIsActive = true;
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur enregistrement');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Édition en ligne ──────────────────────────────────────────────────────

  startEdit(metier: PortalMetier) {
    this.editingId.set(metier.id);
    this.eNom = metier.nom;
    this.eColor = metier.color;
    this.eIsActive = metier.isActive;
  }

  cancelEdit() { this.editingId.set(null); }

  async saveEdit(metier: PortalMetier) {
    if (!this.eNom.trim()) return;
    this.saving.set(true);
    try {
      await this.service.updateMetier(metier.id, {
        nom: this.eNom.trim(),
        color: this.eColor,
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
      await this.service.deleteMetier(id);
      this.deletingId.set(null);
      if (this.expandedId() === id) this.expandedId.set(null);
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur suppression');
      this.deletingId.set(null);
    }
  }
}
