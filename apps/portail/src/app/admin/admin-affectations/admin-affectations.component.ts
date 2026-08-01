import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { AppUser, Application, UserApplication } from '../../../models/admin.models';

@Component({
  selector: 'app-admin-affectations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-affectations.component.html',
  styleUrls: ['../admin.component.scss']
})
export class AdminAffectationsComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  users: AppUser[] = [];
  applications: Application[] = [];
  userApplications: UserApplication[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    forkJoin({
      users: this.adminService.getUsers(),
      apps: this.adminService.getApplications(),
      userApps: this.adminService.getAllUserApplications()
    }).subscribe({
      next: (data) => {
        this.users = data.users || [];
        this.applications = (data.apps || []).map((app: any) => ({
          ...app,
          is_active: app.is_active === 1 || app.is_active === '1' || app.is_active === true
        }));
        this.userApplications = data.userApps || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur chargement affectations', err)
    });
  }

  getRights(user_id: number, application_id: number): string {
    const ua = this.userApplications.find(x => x.user_id === user_id && x.application_id === application_id);
    return ua ? ua.droits : '';
  }

  onRightsChange(user_id: number, application_id: number, newDroits: string): void {
    const existing = this.userApplications.find(x => x.user_id === user_id && x.application_id === application_id);
    
    if (!newDroits) {
      if (existing) {
        this.adminService.deleteUserApplication(user_id, application_id).subscribe(() => this.loadData());
      }
    } 
    else if (existing) {
      existing.droits = newDroits;
      this.adminService.updateUserApplication(existing).subscribe(() => this.loadData());
    } 
    else {
      const newUserApp: UserApplication = { user_id, application_id, droits: newDroits };
      this.adminService.insertUserApplication(newUserApp).subscribe(() => this.loadData());
    }
  }
}
