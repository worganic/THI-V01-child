import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { Groupe, Application, GroupeApplication } from '../../../models/admin.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-groupes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-groupes.component.html',
  styleUrls: ['../admin.component.scss']
})
export class AdminGroupesComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  // GESTIONNAIRE D'ÉTAT : Remplplace le mécanisme natif JS Bootstrap absent
  isFormOpen = false;

  groupes: Groupe[] = [];
  applications: Application[] = [];
  groupeApplications: GroupeApplication[] = [];

  newGroupe: Partial<Groupe> = { nom: '', description: '', ordre: 0, is_active: true };
  editingGroupId: number | null = null;
  editingGroupObj: Partial<Groupe> = {};

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    forkJoin({
      groupes: this.adminService.getGroupes(),
      apps: this.adminService.getApplications(),
      groupeApps: this.adminService.getGroupeApplications()
    }).subscribe({
      next: (data) => {
        this.groupes = data.groupes || [];
        this.applications = data.apps || [];
        this.groupeApplications = data.groupeApps || [];
        this.cdr.detectChanges();
      },
      error: (err: unknown) => console.error('Erreur chargement des groupes et applications', err)
    });
  }

  toggleForm(): void {
    this.isFormOpen = !this.isFormOpen;
  }

  ajouterGroupe(): void {
    if (!this.newGroupe.nom) return;
    this.adminService.insertGroupe(this.newGroupe).subscribe(() => {
      this.newGroupe = { nom: '', description: '', ordre: 0, is_active: true };
      this.isFormOpen = false; // Réinitialisation automatique du formulaire après création
      this.loadData();
    });
  }

  startEdit(groupe: Groupe): void {
    this.editingGroupId = groupe.id;
    this.editingGroupObj = { ...groupe };
  }

  saveEdit(): void {
    if (this.editingGroupObj.id) {
      this.adminService.updateGroupe(this.editingGroupObj as Groupe).subscribe(() => {
        this.editingGroupId = null;
        this.loadData();
      });
    }
  }

  cancelEdit(): void {
    this.editingGroupId = null;
    this.editingGroupObj = {};
  }

  deleteGroupe(id: number): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce groupe ?')) {
      this.adminService.deleteGroupe(id).subscribe(() => this.loadData());
    }
  }

  isAppInGroup(groupId: number, appId: number): boolean {
    return this.groupeApplications.some(ga => ga.groupe_id === groupId && ga.application_id === appId);
  }

  toggleAppGroup(groupId: number, appId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.adminService.toggleGroupeApplication(groupId, appId, checked).subscribe(() => {
      this.loadData();
    });
  }
}