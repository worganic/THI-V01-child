import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { Application, AppUser, Groupe, GroupeApplication, UserApplication, UserGroupe } from '../../../models/admin.models';
import { forkJoin, of } from 'rxjs';
import { take, catchError, timeout } from 'rxjs/operators';

export interface FullExportData {
  users: AppUser[];
  groupes: Groupe[];
  applications: Application[];
  userGroupes: UserGroupe[];
  groupeApplications: GroupeApplication[];
  userApplications: UserApplication[];
}

export interface ApplicationExportBlock {
  application: Application;
  groupeApplications: GroupeApplication[];
  groupes: Groupe[];
  userApplications: UserApplication[];
  userGroupes: UserGroupe[];
  users: AppUser[];
}

export interface PortailShellExportBlock {
  portail: string;
  users: AppUser[];
  groupes: Groupe[];
  userGroupes: UserGroupe[];
  applications: Application[];
  userApplications: UserApplication[];
  groupeApplications: GroupeApplication[];
}

export type ExportBlock = PortailShellExportBlock | ApplicationExportBlock;

@Component({
  selector: 'app-admin-export',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-export.component.html',
  styleUrls: ['../admin.component.scss']
})
export class AdminExportComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  isExporting = false;
  exportError = false;
  exportedDataJson = '';
  isCopied = false;
  fullData: FullExportData | null = null;
  selectedAppId: number | 'portail' | null = null;

  ngOnInit(): void {
    this.exportData();
  }

  exportData(): void {
    this.isExporting = true;
    this.exportError = false;
    this.cdr.detectChanges();

    forkJoin({
      users: this.adminService.getUsers().pipe(take(1), catchError(err => { console.error('Erreur users:', err); return of([]); })),
      groupes: this.adminService.getGroupes().pipe(take(1), catchError(err => { console.error('Erreur groupes:', err); return of([]); })),
      applications: this.adminService.getApplications().pipe(take(1), catchError(err => { console.error('Erreur applications:', err); return of([]); })),
      userGroupes: this.adminService.getUserGroupes().pipe(take(1), catchError(err => { console.error('Erreur userGroupes:', err); return of([]); })),
      groupeApplications: this.adminService.getGroupeApplications().pipe(take(1), catchError(err => { console.error('Erreur groupeApplications:', err); return of([]); })),
      userApplications: this.adminService.getAllUserApplications().pipe(take(1), catchError(err => { console.error('Erreur userApplications:', err); return of([]); }))
    }).pipe(
      timeout(8000),
      catchError(err => {
        console.error("Erreur globale ou délai dépassé lors de l'export:", err);
        return of(null);
      })
    ).subscribe({
      next: (data) => {
        if (data) {
          this.fullData = data as FullExportData;
          this.exportError = false;
          this.filterAndRenderData();
        } else {
          this.exportError = true;
        }
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Erreur critique lors de la récupération des données d'export", err);
        this.exportError = true;
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectApp(appId: number | 'portail' | null): void {
    this.selectedAppId = appId;
    this.filterAndRenderData();
  }

  getSelectedAppName(): string {
    if (this.selectedAppId === 'portail') {
      return 'Portail Shell (Users & Habilitations)';
    }
    if (this.selectedAppId === null || !this.fullData) return '';
    const found = this.fullData.applications.find(a => Number(a.id) === Number(this.selectedAppId));
    return found ? found.nom : '';
  }

  filterAndRenderData(): void {
    if (!this.fullData) {
      this.exportedDataJson = '';
      return;
    }

    if (this.selectedAppId === 'portail') {
      // Bouton "Portail Shell" : Export des utilisateurs, groupes et données globales du socle
      const portailBlock = this.buildPortailShellExportBlock();
      this.exportedDataJson = JSON.stringify(portailBlock, null, 2);
    } else if (this.selectedAppId === null) {
      // Bouton "Tous" : Inclut le bloc Portail Shell ET les blocs pour TOUTES les applications
      const portailBlock = this.buildPortailShellExportBlock();
      const allAppsDataBlocks: ApplicationExportBlock[] = this.fullData.applications.map(app => {
        return this.buildAppExportBlock(app);
      });

      const fullExportList: ExportBlock[] = [
        portailBlock,
        ...allAppsDataBlocks
      ];

      this.exportedDataJson = JSON.stringify(fullExportList, null, 2);
    } else {
      // Filtrer les données spécifiques à l'application sélectionnée uniquement
      const targetAppId = Number(this.selectedAppId);
      const app = this.fullData.applications.find(a => Number(a.id) === targetAppId);
      
      if (app) {
        const singleAppBlock = this.buildAppExportBlock(app);
        this.exportedDataJson = JSON.stringify(singleAppBlock, null, 2);
      } else {
        this.exportedDataJson = JSON.stringify({}, null, 2);
      }
    }
  }

  private buildPortailShellExportBlock(): PortailShellExportBlock {
    if (!this.fullData) {
      return {
        portail: 'Portail Shell Base System',
        users: [],
        groupes: [],
        userGroupes: [],
        applications: [],
        userApplications: [],
        groupeApplications: []
      };
    }

    return {
      portail: 'Portail Shell Base System',
      users: this.fullData.users,
      groupes: this.fullData.groupes,
      userGroupes: this.fullData.userGroupes,
      applications: this.fullData.applications,
      userApplications: this.fullData.userApplications,
      groupeApplications: this.fullData.groupeApplications
    };
  }

  private buildAppExportBlock(app: Application): ApplicationExportBlock {
    if (!this.fullData) {
      return {
        application: app,
        groupeApplications: [],
        groupes: [],
        userApplications: [],
        userGroupes: [],
        users: []
      };
    }

    const targetAppId = Number(app.id);
    const groupeApps = this.fullData.groupeApplications.filter(ga => Number(ga.application_id) === targetAppId);
    const associatedGroupIds = new Set(groupeApps.map(ga => Number(ga.groupe_id)));
    
    const groupes = this.fullData.groupes.filter(g => associatedGroupIds.has(Number(g.id)));
    
    const userApps = this.fullData.userApplications.filter(ua => Number(ua.application_id) === targetAppId);
    const userGroupes = this.fullData.userGroupes.filter(ug => associatedGroupIds.has(Number(ug.groupe_id)));
    
    const associatedUserIds = new Set([
      ...userApps.map(ua => Number(ua.user_id)),
      ...userGroupes.map(ug => Number(ug.user_id))
    ]);
    const users = this.fullData.users.filter(u => associatedUserIds.has(Number(u.id)));

    return {
      application: app,
      groupeApplications: groupeApps,
      groupes: groupes,
      userApplications: userApps,
      userGroupes: userGroupes,
      users: users
    };
  }

  copyToClipboard(): void {
    if (!this.exportedDataJson) return;
    navigator.clipboard.writeText(this.exportedDataJson).then(() => {
      this.isCopied = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.isCopied = false;
        this.cdr.detectChanges();
      }, 2500);
    });
  }
}