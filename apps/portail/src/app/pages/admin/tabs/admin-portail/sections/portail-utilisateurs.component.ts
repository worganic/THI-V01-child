import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass, UpperCasePipe } from '@angular/common';
import { AuthService, API_DATA_URL } from '@portail/core-data-access';
import {
  PortalAppsService,
  PortalApp,
  PortalGroupe,
  PortalMetier,
  PortalUser,
  PortalGroupeApp,
  PortalUserGroupe,
  PortalUserApp,
  PortalDroit,
} from '@portail/core-data-access';
import { TableSort, paginate, WorgAdminPaginationComponent } from '@portail/shared-ui';
// Rendu Tailwind des teintes de métier : propre à ce portail, voir metier-badge.ts.
// Variante pleine dans le tableau, comme sur l'autre portail.
import { metierSolidBadgeClass } from '../../../../../shared/metier-badge';

type UserColumn = 'matricule' | 'nom' | 'prenom' | 'email' | 'role' | 'metier' | 'statut';

/**
 * Admin › Portail › Utilisateurs — un seul endroit pour tout ce qui concerne
 * un compte : sa fiche (matricule, nom, prénom, email, rôle, statut, mot de
 * passe), son métier, ses groupes (accès aux applications du groupe) et ses
 * accès directs à une application (avec niveau de droit).
 *
 * Colonnes, filtres et actions repris de l'autre portail — les deux systèmes
 * gèrent désormais la même fiche utilisateur. `username` reste l'identité
 * technique du compte (unique, sert à l'affichage dans l'en-tête) : il est
 * saisi avec le reste et rappelé sous le matricule.
 */
@Component({
  selector: 'app-portail-utilisateurs-section',
  imports: [FormsModule, NgClass, UpperCasePipe, WorgAdminPaginationComponent],
  templateUrl: './portail-utilisateurs.component.html'
})
export class PortailUtilisateursSectionComponent implements OnInit {
  private service = inject(PortalAppsService);
  private authService = inject(AuthService);
  private apiUrl = inject(API_DATA_URL);

  users       = signal<PortalUser[]>([]);
  groupes     = signal<PortalGroupe[]>([]);
  apps        = signal<PortalApp[]>([]);
  metiers     = signal<PortalMetier[]>([]);
  groupeApps  = signal<PortalGroupeApp[]>([]);
  userGroupes = signal<PortalUserGroupe[]>([]);
  userApps    = signal<PortalUserApp[]>([]);
  loading     = signal(true);
  error       = signal('');

  readonly badgeClass = metierSolidBadgeClass;
  readonly droitsOptions: PortalDroit[] = ['lecture', 'ecriture', 'admin'];
  readonly roles: readonly string[] = ['user', 'admin'];

  // ── Création d'un compte (formulaire toujours visible, en tête de page) ────
  newMatricule = '';
  newNom = '';
  newPrenom = '';
  newUsername = '';
  newEmail = '';
  newPassword = '';
  newRole = 'user';
  newMetierId: number | null = null;
  newIsActive = true;
  creatingUser = signal(false);

  // ── Recherche / filtres ───────────────────────────────────────────────────
  searchText   = signal('');
  filterRole   = signal('');
  filterMetier = signal<number | null>(null);
  filterStatus = signal<'' | 'active' | 'inactive'>('');

  // ── Tri / pagination ──────────────────────────────────────────────────────
  readonly sort = new TableSort<UserColumn>('matricule');
  pageSize = signal(10);
  page     = signal(1);

  // ── Édition en ligne / dépliage / suppression ─────────────────────────────
  editingUserId = signal<string | null>(null);
  editMatricule = '';
  editNom = '';
  editPrenom = '';
  editUsername = '';
  editEmail = '';
  editRole = 'user';
  editMetierId: number | null = null;
  editIsActive = true;
  editPassword = '';
  savingAccount = signal(false);

  expandedUserId = signal<string | null>(null);
  deletingUserId = signal<string | null>(null);

  filteredUsers = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    return this.users().filter(u => {
      if (q) {
        const hay = `${u.matricule} ${u.nom} ${u.prenom} ${u.username} ${u.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (this.filterRole() && u.role !== this.filterRole()) return false;
      if (this.filterMetier() !== null && u.metierId !== this.filterMetier()) return false;
      if (this.filterStatus() === 'active' && !u.isActive) return false;
      if (this.filterStatus() === 'inactive' && u.isActive) return false;
      return true;
    });
  });

  sortedUsers = computed(() =>
    this.sort.apply(this.filteredUsers(), (u, col) => {
      switch (col) {
        case 'matricule': return (u.matricule || '').toLowerCase();
        // Repli sur le username : un compte sans nom d'annuaire ne doit pas
        // se retrouver systématiquement regroupé en tête de tri.
        case 'nom':       return (u.nom || u.username).toLowerCase();
        case 'prenom':    return (u.prenom || '').toLowerCase();
        case 'email':     return u.email.toLowerCase();
        case 'role':      return u.role.toLowerCase();
        case 'metier':    return (u.metierNom || '').toLowerCase();
        case 'statut':    return u.isActive ? 0 : 1;
      }
    })
  );

  pagedUsers = computed(() => paginate(this.sortedUsers(), this.pageSize(), this.page()));

  ngOnInit() { this.load(); }

  /** Premier chargement — affiche le spinner plein panneau (`@if (loading())`). */
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.refresh();
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Rechargement des données après une action (bascule groupe/accès, métier,
   * compte…) — ne touche jamais `loading` : le tableau reste monté tel quel,
   * seules les valeurs des signaux changent. Basculer `loading` ici
   * démontait/remontait tout le panneau à chaque clic (via `@if (loading())`
   * dans le template), ce qui faisait sauter le scroll de la page.
   */
  async refresh() {
    this.error.set('');
    try {
      const [users, groupes, apps, metiers, groupeApps, userGroupes, userApps] = await Promise.all([
        this.service.getUsers(),
        this.service.getGroupes(),
        this.service.getApps(),
        this.service.getMetiers(),
        this.service.getGroupeApps(),
        this.service.getUserGroupes(),
        this.service.getUserApps(),
      ]);
      this.users.set(users);
      this.groupes.set(groupes);
      this.apps.set(apps);
      this.metiers.set(metiers);
      this.groupeApps.set(groupeApps);
      this.userGroupes.set(userGroupes);
      this.userApps.set(userApps);
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur chargement des utilisateurs');
    }
  }

  /** Tout changement de filtre ramène en page 1 — sinon on reste sur une page vide. */
  onFilterChange() { this.page.set(1); }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async ajouterUtilisateur() {
    if (!this.newUsername.trim() || !this.newEmail.trim() || !this.newPassword) return;
    this.creatingUser.set(true);
    this.error.set('');
    try {
      const res = await fetch(`${this.apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matricule: this.newMatricule,
          nom: this.newNom,
          prenom: this.newPrenom,
          username: this.newUsername,
          email: this.newEmail,
          password: this.newPassword,
          isActive: this.newIsActive,
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur création');
      }
      const data = await res.json();
      // `register` crée toujours un compte `user` (sauf tout premier compte) et
      // ignore le rôle : on le repositionne juste après, comme sur l'autre portail.
      if (this.newRole === 'admin') {
        await this.authService.updateUser(data.user.id, { role: 'admin' });
      }
      if (this.newMetierId !== null) {
        await this.service.setUserMetier(data.user.id, this.newMetierId);
      }
      this.newMatricule = '';
      this.newNom = '';
      this.newPrenom = '';
      this.newUsername = '';
      this.newEmail = '';
      this.newPassword = '';
      this.newRole = 'user';
      this.newMetierId = null;
      this.newIsActive = true;
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.message || 'Erreur création utilisateur');
    } finally {
      this.creatingUser.set(false);
    }
  }

  // ── Édition en ligne ──────────────────────────────────────────────────────

  startUserEdit(user: PortalUser) {
    this.editingUserId.set(user.id);
    this.editMatricule = user.matricule;
    this.editNom = user.nom;
    this.editPrenom = user.prenom;
    this.editUsername = user.username;
    this.editEmail = user.email;
    this.editRole = user.role;
    this.editMetierId = user.metierId;
    this.editIsActive = user.isActive;
    this.editPassword = '';
  }

  cancelUserEdit() { this.editingUserId.set(null); }

  async saveUserEdit(user: PortalUser) {
    if (!this.editUsername.trim()) return;
    this.savingAccount.set(true);
    try {
      const data: any = {
        matricule: this.editMatricule,
        nom: this.editNom,
        prenom: this.editPrenom,
        username: this.editUsername,
        email: this.editEmail,
        role: this.editRole,
        isActive: this.editIsActive,
      };
      if (this.editPassword) data.password = this.editPassword;
      await this.authService.updateUser(user.id, data);
      // Le métier n'est pas porté par le compte mais par la table de liaison :
      // deux appels, un seul geste côté admin.
      if (this.editMetierId !== user.metierId) {
        await this.service.setUserMetier(user.id, this.editMetierId);
      }
      this.editingUserId.set(null);
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur sauvegarde du compte');
    } finally {
      this.savingAccount.set(false);
    }
  }

  /** Bascule Actif/Inactif depuis la colonne Actions, sans passer par l'édition. */
  async toggleUserStatus(user: PortalUser) {
    try {
      await this.authService.updateUser(user.id, { isActive: !user.isActive });
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour du statut');
    }
  }

  confirmDeleteUser(id: string) { this.deletingUserId.set(id); }
  cancelDeleteUser() { this.deletingUserId.set(null); }

  async deleteUser(id: string) {
    try {
      await this.authService.deleteUser(id);
      this.deletingUserId.set(null);
      if (this.expandedUserId() === id) this.expandedUserId.set(null);
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur suppression utilisateur');
      this.deletingUserId.set(null);
    }
  }

  // ── Droits (ligne dépliée) ────────────────────────────────────────────────

  toggleExpand(userId: string) {
    this.expandedUserId.set(this.expandedUserId() === userId ? null : userId);
  }

  countGroupes(userId: string): number {
    return this.userGroupes().filter(ug => ug.userId === userId).length;
  }

  isInGroupe(userId: string, groupeId: number): boolean {
    return this.userGroupes().some(ug => ug.userId === userId && ug.groupeId === groupeId);
  }

  async toggleGroupe(userId: string, groupeId: number) {
    const linking = !this.isInGroupe(userId, groupeId);
    try {
      await this.service.toggleUserGroupe(userId, groupeId, linking);
      // Par défaut, associer un groupe coche aussi ses applications dans "Accès
      // directs" — purement indicatif pour l'admin (l'accès réel vient déjà du
      // groupe), mais évite d'avoir à recocher une à une les mêmes apps. On ne
      // décoche jamais automatiquement au retrait du groupe : un accès direct
      // laissé coché reste un choix explicite de l'admin.
      if (linking) {
        const appIds = this.groupeApps().filter(ga => ga.groupeId === groupeId).map(ga => ga.appId);
        for (const appId of appIds) {
          if (!this.hasDirectApp(userId, appId)) {
            await this.service.toggleUserApp(userId, appId, true, 'lecture');
          }
        }
      }
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour du groupe');
    }
  }

  hasDirectApp(userId: string, appId: number): boolean {
    return this.userApps().some(ua => ua.userId === userId && ua.appId === appId);
  }

  directDroits(userId: string, appId: number): PortalDroit {
    return this.userApps().find(ua => ua.userId === userId && ua.appId === appId)?.droits || 'lecture';
  }

  async toggleDirectApp(userId: string, appId: number) {
    try {
      await this.service.toggleUserApp(userId, appId, !this.hasDirectApp(userId, appId), this.directDroits(userId, appId));
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour de l\'accès direct');
    }
  }

  async setDroits(userId: string, appId: number, droits: string) {
    try {
      await this.service.toggleUserApp(userId, appId, true, droits as PortalDroit);
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour du niveau de droit');
    }
  }

  // ── Formatage ─────────────────────────────────────────────────────────────

  metierNom(metierId: number | null): string {
    if (!metierId) return '—';
    return this.metiers().find(m => m.id === metierId)?.nom || '—';
  }
}
