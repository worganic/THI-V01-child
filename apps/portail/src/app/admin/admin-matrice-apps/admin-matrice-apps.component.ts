import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { Application, Groupe, GroupeApplication } from '../../../models/admin.models';

@Component({
  selector: 'app-admin-matrice-apps',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-matrice-apps.component.html',
  styleUrls: ['../admin.component.scss']
})
export class AdminMatriceAppsComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  applications: Application[] = [];
  groupes: Groupe[] = [];
  groupeApplications: GroupeApplication[] = [];
  selectedgroupe_idForApps: number | null = null;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    forkJoin({
      apps: this.adminService.getApplications(),
      groupes: this.adminService.getGroupes(),
      grpApps: this.adminService.getGroupeApplications()
    }).subscribe({
      next: (data) => {
        this.applications = (data.apps || []).map((app: any) => ({
          ...app,
          is_active: app.is_active === 1 || app.is_active === '1' || app.is_active === true
        }));
        this.groupes = data.groupes || [];
        this.groupeApplications = data.grpApps || [];
        
        if (this.groupes.length > 0 && !this.selectedgroupe_idForApps) {
          this.selectedgroupe_idForApps = this.groupes[0].id;
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur chargement matrice applications', err)
    });
  }

  isAppInGroupe(groupe_id: number | null, appId: number): boolean {
    if (!groupe_id) return false;
    return this.groupeApplications.some(ga => ga.groupe_id === groupe_id && ga.application_id === appId);
  }

  toggleAppGroupe(groupe_id: number | null, appId: number, event: any): void {
    if (!groupe_id) return;
    const isChecked = event.target.checked;
    this.adminService.toggleGroupeApplication(groupe_id, appId, isChecked).subscribe({
      next: () => this.loadData(),
      error: () => this.loadData()
    });
  }
}
