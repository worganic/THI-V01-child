import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
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
// Rendu Tailwind des teintes de métier : propre à ce portail, voir metier-badge.ts.
import { metierBadgeClass } from '../../../../../shared/metier-badge';

/**
 * Admin › Portail › Utilisateurs — un seul endroit pour tout ce qui concerne
 * un compte : ses informations (nom, email, rôle, mot de passe), son métier,
 * ses groupes (accès aux applications du groupe) et ses accès directs à une
 * application (avec niveau de droit). Fusionne l'ancien onglet séparé
 * « Admin › Utilisateurs » (CRUD de compte) avec l'ancienne section « Droits ».
 */
@Component({
  selector: 'app-portail-utilisateurs-section',
  imports: [FormsModule, NgClass],
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

  selectedUserId = signal<string | null>(null);
  selectedUser = computed(() => this.users().find(u => u.id === this.selectedUserId()) || null);

  readonly badgeClass = metierBadgeClass;
  readonly droitsOptions: PortalDroit[] = ['lecture', 'ecriture', 'admin'];
  readonly roles: readonly string[] = ['user', 'admin'];

  // ── Recherche ─────────────────────────────────────────────────────────────
  searchQuery = signal('');
  filteredUsers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.users();
    return this.users().filter(u =>
      u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  // ── Édition du compte (nom, email, rôle, mot de passe) ──────────────────────
  editingAccount = signal(false);
  editUsername = '';
  editEmail = '';
  editRole = 'user';
  editPassword = '';
  savingAccount = signal(false);

  // ── Création d'un compte ─────────────────────────────────────────────────
  showNewUserModal = signal(false);
  newUsername = '';
  newEmail = '';
  newPassword = '';
  newRole = 'user';
  creatingUser = signal(false);

  deletingUserId = signal<string | null>(null);

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
   * compte…) — ne touche jamais `loading` : le panneau détail reste monté tel
   * quel, seules les valeurs des signaux changent. Basculer `loading` ici
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
      if (!this.selectedUserId() || !users.some(u => u.id === this.selectedUserId())) {
        this.selectedUserId.set(users[0]?.id ?? null);
      }
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur chargement des utilisateurs');
    }
  }

  selectUser(id: string) {
    this.selectedUserId.set(id);
    this.editingAccount.set(false);
  }

  countGroupes(userId: string): number {
    return this.userGroupes().filter(ug => ug.userId === userId).length;
  }

  isInGroupe(groupeId: number): boolean {
    const userId = this.selectedUserId();
    return !!userId && this.userGroupes().some(ug => ug.userId === userId && ug.groupeId === groupeId);
  }

  async toggleGroupe(groupeId: number) {
    const userId = this.selectedUserId();
    if (!userId) return;
    const linking = !this.isInGroupe(groupeId);
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
          if (!this.hasDirectApp(appId)) {
            await this.service.toggleUserApp(userId, appId, true, 'lecture');
          }
        }
      }
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour du groupe');
    }
  }

  hasDirectApp(appId: number): boolean {
    const userId = this.selectedUserId();
    return !!userId && this.userApps().some(ua => ua.userId === userId && ua.appId === appId);
  }

  directDroits(appId: number): PortalDroit {
    const userId = this.selectedUserId();
    return this.userApps().find(ua => ua.userId === userId && ua.appId === appId)?.droits || 'lecture';
  }

  async toggleDirectApp(appId: number) {
    const userId = this.selectedUserId();
    if (!userId) return;
    try {
      await this.service.toggleUserApp(userId, appId, !this.hasDirectApp(appId), this.directDroits(appId));
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour de l\'accès direct');
    }
  }

  async setDroits(appId: number, droits: string) {
    const userId = this.selectedUserId();
    if (!userId) return;
    try {
      await this.service.toggleUserApp(userId, appId, true, droits as PortalDroit);
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour du niveau de droit');
    }
  }

  async setMetier(metierId: string) {
    const userId = this.selectedUserId();
    if (!userId) return;
    try {
      await this.service.setUserMetier(userId, metierId ? Number(metierId) : null);
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour du métier');
    }
  }

  /** Applications héritées des groupes de l'utilisateur (lecture seule, informatif). */
  appsViaGroupes = computed(() => {
    const userId = this.selectedUserId();
    if (!userId) return [] as string[];
    return this.groupes()
      .filter(g => this.userGroupes().some(ug => ug.userId === userId && ug.groupeId === g.id))
      .map(g => g.nom);
  });

  // ── Édition du compte ────────────────────────────────────────────────────

  openEditAccount() {
    const user = this.selectedUser();
    if (!user) return;
    this.editUsername = user.username;
    this.editEmail = user.email;
    this.editRole = user.role;
    this.editPassword = '';
    this.editingAccount.set(true);
  }

  closeEditAccount() { this.editingAccount.set(false); }

  async saveAccount() {
    const user = this.selectedUser();
    if (!user) return;
    this.savingAccount.set(true);
    try {
      const data: any = { username: this.editUsername, email: this.editEmail, role: this.editRole };
      if (this.editPassword) data.password = this.editPassword;
      await this.authService.updateUser(user.id, data);
      this.editingAccount.set(false);
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur sauvegarde du compte');
    } finally {
      this.savingAccount.set(false);
    }
  }

  confirmDeleteUser(id: string) { this.deletingUserId.set(id); }
  cancelDeleteUser() { this.deletingUserId.set(null); }

  async deleteUser(id: string) {
    try {
      await this.authService.deleteUser(id);
      this.deletingUserId.set(null);
      if (this.selectedUserId() === id) this.selectedUserId.set(null);
      await this.refresh();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur suppression utilisateur');
      this.deletingUserId.set(null);
    }
  }

  // ── Création de compte ───────────────────────────────────────────────────

  openNewUserModal() {
    this.newUsername = '';
    this.newEmail = '';
    this.newPassword = '';
    this.newRole = 'user';
    this.showNewUserModal.set(true);
  }

  closeNewUserModal() { this.showNewUserModal.set(false); }

  async createUser() {
    if (!this.newUsername.trim() || !this.newEmail.trim() || !this.newPassword) return;
    this.creatingUser.set(true);
    this.error.set('');
    try {
      const res = await fetch(`${this.apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.newUsername, email: this.newEmail, password: this.newPassword })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur création');
      }
      const data = await res.json();
      if (this.newRole === 'admin') {
        await this.authService.updateUser(data.user.id, { role: 'admin' });
      }
      this.closeNewUserModal();
      await this.refresh();
      this.selectedUserId.set(data.user.id);
    } catch (e: any) {
      this.error.set(e?.message || 'Erreur création utilisateur');
    } finally {
      this.creatingUser.set(false);
    }
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
