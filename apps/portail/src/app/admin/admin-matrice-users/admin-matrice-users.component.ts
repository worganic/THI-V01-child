import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { AppUser, Groupe, UserGroupe } from '../../../models/admin.models';

@Component({
  selector: 'app-admin-matrice-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-matrice-users.component.html',
  styleUrls: ['../admin.component.scss']
})
export class AdminMatriceUsersComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  users: AppUser[] = [];
  groupes: Groupe[] = [];
  userGroupes: UserGroupe[] = [];
  selectedgroupe_idForUsers: number | null = null;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    forkJoin({
      users: this.adminService.getUsers(),
      groupes: this.adminService.getGroupes(),
      usrGrp: this.adminService.getUserGroupes()
    }).subscribe({
      next: (data) => {
        this.users = data.users || [];
        this.groupes = data.groupes || [];
        this.userGroupes = data.usrGrp || [];
        
        if (this.groupes.length > 0 && !this.selectedgroupe_idForUsers) {
          this.selectedgroupe_idForUsers = this.groupes[0].id;
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur chargement matrice utilisateurs', err)
    });
  }

  isUserInGroupe(user_id: number, groupe_id: number | null): boolean {
    if (!groupe_id) return false;
    return this.userGroupes.some(ug => ug.user_id === user_id && ug.groupe_id === groupe_id);
  }

  toggleUserGroupe(user_id: number, groupe_id: number | null, event: any): void {
    if (!groupe_id) return;
    const isChecked = event.target.checked;
    this.adminService.toggleUserGroupe(user_id, groupe_id, isChecked).subscribe({
      next: () => this.loadData(),
      error: () => this.loadData()
    });
  }
}
