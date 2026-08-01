import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { PORTAL_SESSION } from '@portail/core-auth';
import { AppUser, Groupe, Application, UserGroupe, GroupeApplication, UserApplication, Metier } from '../../../models/admin.models';
import { metierBadgeClass } from '../../../utils/metier-colors';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['../admin.component.scss']
})
export class AdminUsersComponent implements OnInit {
  private adminService = inject(AdminService);
  private session = inject(PORTAL_SESSION);
  private cdr = inject(ChangeDetectorRef);

  currentUserRole: string = 'USER';
  users: AppUser[] = [];
  groupes: Groupe[] = [];
  applications: Application[] = [];
  userGroupes: UserGroupe[] = [];
  groupeApplications: GroupeApplication[] = [];
  userApplications: UserApplication[] = [];
  metiers: Metier[] = [];

  newUser = {
    matricule: '',
    nom: '',
    prenom: '',
    email: '',
    role: 'INVITE',
    is_active: false,
    metier_id: null as number | null
  };
  editinguser_id: number | null = null;
  editingUserObj: AppUser = {} as AppUser;
  expandedUserId: number | null = null;

  // --- Recherche / filtres ---
  searchText = '';
  filterRole = '';
  filterMetierId: number | null = null;
  filterStatus: '' | 'active' | 'inactive' = '';

  // --- Tri ---
  sortColumn: 'matricule' | 'nom' | 'prenom' | 'email' | 'role' | 'metier' | 'status' | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  // --- Pagination (pageSize = 0 : "Tous") ---
  readonly pageSizeOptions = [10, 25, 50, 0];
  pageSize = 10;
  currentPage = 1;

  ngOnInit(): void {
    // `rawRole` et non `role` : cet écran distingue le super-administrateur
    // ('SU') de l'administrateur, distinction que le rôle normalisé fusionne.
    this.currentUserRole = this.session.user()?.rawRole || 'USER';
    this.loadAllData();
  }

  loadAllData() {
    forkJoin({
      users: this.adminService.getUsers(),
      groupes: this.adminService.getGroupes(),
      apps: this.adminService.getApplications(),
      userGroupes: this.adminService.getUserGroupes(),
      groupeApps: this.adminService.getGroupeApplications(),
      userApps: this.adminService.getAllUserApplications(),
      metiers: this.adminService.getMetiers()
    }).subscribe({
      next: (data) => {
        this.users = data.users || [];
        this.groupes = data.groupes || [];
        this.applications = data.apps || [];
        this.userGroupes = data.userGroupes || [];
        this.groupeApplications = data.groupeApps || [];
        this.userApplications = data.userApps || [];
        this.metiers = data.metiers || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur chargement des données matricielles', err)
    });
  }

  // --- Recherche / filtres / tri / pagination ---

  get filteredUsers(): AppUser[] {
    const q = this.searchText.trim().toLowerCase();
    return this.users.filter(u => {
      if (q) {
        const hay = `${u.matricule} ${u.nom} ${u.prenom} ${u.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (this.filterRole && u.role !== this.filterRole) return false;
      if (this.filterMetierId !== null && u.metier_id !== this.filterMetierId) return false;
      if (this.filterStatus === 'active' && !u.is_active) return false;
      if (this.filterStatus === 'inactive' && u.is_active) return false;
      return true;
    });
  }

  get sortedUsers(): AppUser[] {
    const list = [...this.filteredUsers];
    if (!this.sortColumn) return list;
    const dir = this.sortDirection === 'asc' ? 1 : -1;
    const col = this.sortColumn;
    list.sort((a, b) => {
      const va = this.sortValue(a, col);
      const vb = this.sortValue(b, col);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return list;
  }

  private sortValue(u: AppUser, col: NonNullable<AdminUsersComponent['sortColumn']>): string {
    switch (col) {
      case 'matricule': return (u.matricule || '').toLowerCase();
      case 'nom': return (u.nom || '').toLowerCase();
      case 'prenom': return (u.prenom || '').toLowerCase();
      case 'email': return (u.email || '').toLowerCase();
      case 'role': return (u.role || '').toLowerCase();
      case 'metier': return this.metierName(u.metier_id).toLowerCase();
      case 'status': return u.is_active ? '0' : '1';
    }
  }

  setSort(col: NonNullable<AdminUsersComponent['sortColumn']>): void {
    if (this.sortColumn === col) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = col;
      this.sortDirection = 'asc';
    }
  }

  sortIcon(col: NonNullable<AdminUsersComponent['sortColumn']>): string {
    if (this.sortColumn !== col) return '↕';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

  get totalPages(): number {
    if (this.pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(this.sortedUsers.length / this.pageSize));
  }

  get pagedUsers(): AppUser[] {
    if (this.pageSize <= 0) return this.sortedUsers;
    const page = Math.min(this.currentPage, this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.sortedUsers.slice(start, start + this.pageSize);
  }

  setPageSize(size: string): void {
    this.pageSize = Number(size);
    this.currentPage = 1;
  }

  goToPage(p: number): void {
    this.currentPage = Math.min(Math.max(1, p), this.totalPages);
  }

  canModifyUser(targetUser: AppUser): boolean {
    if (targetUser.role === 'SU' && this.currentUserRole !== 'SU') return false;
    return true;
  }

  ajouterUtilisateur() {
    if (!this.newUser.nom || !this.newUser.prenom || !this.newUser.matricule) return;
    this.adminService.insertUser(this.newUser as any).subscribe({
      next: () => {
        this.newUser = { matricule: '', nom: '', prenom: '', email: '', role: 'INVITE', is_active: false, metier_id: null };
        this.loadAllData();
      },
      error: (err) => console.error(err)
    });
  }

  readonly badgeClass = metierBadgeClass;

  metierName(metierId: number | null | undefined): string {
    if (!metierId) return '—';
    return this.metiers.find(m => m.id === metierId)?.nom || '—';
  }

  metierColor(metierId: number | null | undefined): string | undefined {
    return this.metiers.find(m => m.id === metierId)?.color;
  }

  startUserEdit(user: AppUser) {
    if (!this.canModifyUser(user)) {
      alert("Accès Refusé : Seul un profil SU (Super User) peut modifier un autre Super User.");
      return;
    }
    this.editinguser_id = user.id;
    this.editingUserObj = { ...user };
    this.cdr.detectChanges();
  }

  saveUserEdit() {
    if (!this.editingUserObj.nom) return;
    if (this.editingUserObj.role === 'SU' && this.currentUserRole !== 'SU') {
      alert("Accès Refusé : Impossible d'attribuer le rôle SU si vous ne l'êtes pas.");
      return;
    }
    const updatedUser = { ...this.editingUserObj };
    this.editinguser_id = null;
    this.adminService.updateUser(updatedUser).subscribe({
      next: () => this.loadAllData(),
      error: () => this.loadAllData()
    });
  }

  cancelUserEdit() {
    this.editinguser_id = null;
    this.editingUserObj = {} as AppUser;
    this.cdr.detectChanges();
  }

  deleteUser(user: AppUser) {
    if (!this.canModifyUser(user)) {
      alert("Accès Refusé : Impossible de supprimer un Super User.");
      return;
    }
    if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur du système ?')) {
      this.adminService.deleteUser(user.id).subscribe({
        next: () => this.loadAllData(),
        error: () => this.loadAllData()
      });
    }
  }

  toggleUserStatus(user: AppUser) {
    if (!this.canModifyUser(user)) {
      alert("Accès Refusé : Statut verrouillé par les droits SU.");
      return;
    }
    const updatedUser: AppUser = { ...user, is_active: !user.is_active };
    this.adminService.updateUser(updatedUser).subscribe({
      next: () => this.loadAllData(), 
      error: () => this.loadAllData()
    });
  }

  toggleExpand(userId: number) {
    this.expandedUserId = this.expandedUserId === userId ? null : userId;
  }

  isUserInGroup(userId: number, groupId: number): boolean {
    return this.userGroupes.some(ug => Number(ug.user_id) === Number(userId) && Number(ug.groupe_id) === Number(groupId));
  }

  toggleUserGroup(user: AppUser, grp: Groupe, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    
    if (checked) {
        this.userGroupes.push({ user_id: user.id, groupe_id: grp.id } as UserGroupe);
    } else {
        this.userGroupes = this.userGroupes.filter(ug => !(Number(ug.user_id) === Number(user.id) && Number(ug.groupe_id) === Number(grp.id)));
    }

    this.adminService.toggleUserGroupe(user.id, grp.id, checked).subscribe({
      next: () => {}, 
      error: (err) => {
        console.error(err);
        this.loadAllData();
      }
    });
  }

  getUserGroups(userId: number): Groupe[] {
    const groupIds = this.userGroupes
      .filter(ug => Number(ug.user_id) === Number(userId))
      .map(ug => Number(ug.groupe_id));
    return this.groupes.filter(g => groupIds.includes(Number(g.id)));
  }

  getGroupApps(groupId: number): Application[] {
    const appIds = this.groupeApplications
      .filter(ga => Number(ga.groupe_id) === Number(groupId))
      .map(ga => Number(ga.application_id));
    return this.applications.filter(a => appIds.includes(Number(a.id)));
  }

  getUserAppRight(userId: number, appId: number): string {
    const ua = this.userApplications.find(u => Number(u.user_id) === Number(userId) && Number(u.application_id) === Number(appId));
    return ua ? ua.droits : 'INVITE';
  }

  setUserAppRight(userId: number, appId: number, rights: string) {
    const existingIndex = this.userApplications.findIndex(
      u => Number(u.user_id) === Number(userId) && Number(u.application_id) === Number(appId)
    );

    // On récupère l'élément s'il a été trouvé dans le tableau
    const existingItem = existingIndex !== -1 ? this.userApplications[existingIndex] : null;

    console.log("🔍 existingIndex:", existingIndex);
    console.log("🔍 existingItem:", existingItem);

    // CONDITION CRITIQUE : on vérifie s'il existe ET s'il possède un vrai 'id' technique de la BDD
    if (existingItem && existingItem.id !== undefined && existingItem.id !== null) {
      
      // ==========================================
      // 1. C'EST UN UPDATE (La ligne existe dans la BDD)
      // ==========================================
      const updatedItem = {
        ...existingItem,
        droits: rights,
        user_id: Number(userId),
        application_id: Number(appId)
      };
      
      // Mise à jour visuelle optimiste
      this.userApplications[existingIndex] = updatedItem;

      console.log("🛠️ Envoi de l'UPDATE au serveur :", updatedItem);

      this.adminService.updateUserApplication(updatedItem).subscribe({
        next: () => console.log("✅ UPDATE réussi"),
        error: (err) => {
          console.error("❌ Erreur UPDATE", err);
          this.loadAllData(); // Rollback visuel en cas de crash
        }
      });

    } else {
      
      // ==========================================
      // 2. C'EST UN INSERT (Ligne absente ou "fantôme" sans ID)
      // ==========================================
      const newUa = { 
        user_id: Number(userId), 
        application_id: Number(appId), 
        droits: rights 
      } as UserApplication;
      
      // Mise à jour visuelle optimiste
      if (existingIndex !== -1) {
        // Si on avait une ligne fantôme, on modifie juste son texte pour le visuel
        this.userApplications[existingIndex].droits = rights;
      } else {
        // Sinon on l'ajoute vraiment au tableau
        this.userApplications.push(newUa);
      }

      console.log("🛠️ Envoi de l'INSERT au serveur :", newUa);

      this.adminService.insertUserApplication(newUa).subscribe({
        next: () => {
          console.log("✅ INSERT réussi");
          // CRITIQUE : Après un INSERT, il faut recharger les données pour qu'Angular 
          // récupère le nouvel 'id' que MySQL vient tout juste de générer !
          this.loadAllData();
        },
        error: (err) => {
          console.error("❌ Erreur INSERT", err);
          this.loadAllData(); // Rollback visuel
        }
      });
    }
  }
}