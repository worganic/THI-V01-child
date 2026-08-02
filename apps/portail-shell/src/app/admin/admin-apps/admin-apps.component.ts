import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, Route } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { Application } from '../../../models/admin.models';

@Component({
  selector: 'app-admin-apps',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-apps.component.html',
  styleUrls: ['../admin.component.scss']
})
export class AdminAppsComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  applications: Application[] = [];
  localUnregisteredApps: Partial<Application>[] = [];
  availableApps: Partial<Application>[] = [];

  newApp: Partial<Application> = { nom: '', description: '', url_path: '', icone: '', is_active: true };
  editingAppId: number | null = null;
  editingAppObj: Application = {} as Application;

  ngOnInit(): void {
    console.log('🌐 [ngOnInit]');
    this.loadApps();
  }

  loadApps() {
    console.log('🔍 [AUTO-DÉTECTION] 1. Début du chargement des applications enregistrées en BDD...');
    this.adminService.getApplications().subscribe({
      next: (data) => {
        this.applications = (data || []).map((app: any) => ({
          ...app,
          is_active: app.is_active === 1 || app.is_active === '1' || app.is_active === true
        }));
        console.log('📊 [AUTO-DÉTECTION] 2. Applications actuellement en BDD:', this.applications.map(a => a.url_path));
        this.detectLocalApps();
        this.loadAvailableApps();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('❌ [AUTO-DÉTECTION] Erreur chargement BDD:', err)
    });
  }

  /** Dossiers apps/appli-* non encore ajoutés au catalogue (voir AdminService.getAvailableApps). */
  loadAvailableApps() {
    this.adminService.getAvailableApps().subscribe(apps => {
      this.availableApps = apps;
      this.cdr.detectChanges();
    });
  }

  ajouterApplicationAuto(app: Partial<Application>) {
    const appToSave = {
      nom: app.nom || '',
      description: app.description || '',
      url_path: app.url_path || '',
      icone: app.icone || 'apps',
      is_active: false
    };
    this.adminService.insertApplication(appToSave as any).subscribe(() => this.loadApps());
  }

  /** Ajoute séquentiellement (pas en parallèle : la dérivation du code côté serveur repose sur
   * l'unicité déjà en base au moment de chaque insertion). */
  async ajouterToutesApplications() {
    for (const app of [...this.availableApps]) {
      await new Promise<void>(resolve => {
        this.adminService.insertApplication({
          nom: app.nom || '',
          description: app.description || '',
          url_path: app.url_path || '',
          icone: app.icone || 'apps',
          is_active: false
        } as any).subscribe(() => resolve());
      });
    }
    this.loadApps();
  }

  detectLocalApps() {
    this.localUnregisteredApps = [];
    const routes = this.router.config;
    
    console.log('🌐 [AUTO-DÉTECTION] 3. Analyse de la configuration du Router Angular (this.router.config):');

    const inspectRoutes = (routeList: Route[], depth: number = 0) => {
      const indent = '  '.repeat(depth);
      routeList.forEach(route => {
        const hasLoadChildren = !!route.loadChildren;
        console.log(`${indent}➡️ Route examinée: path="${route.path}" | Has loadChildren? ${hasLoadChildren}`);

        if (route.path && route.loadChildren) {
          const expectedUrl = `/${route.path}`;
          const existsInDb = this.applications.some(app => app.url_path === expectedUrl || app.url_path === route.path);

          if (existsInDb) {
            console.log(`${indent}   ✅ Route "${expectedUrl}" : Déjà présente en BDD.`);
          } else {
            console.log(`${indent}   🚨 Route "${expectedUrl}" : NON TROUVÉE EN BDD ! Ajout à la liste d'auto-détection.`);
            this.localUnregisteredApps.push({
              nom: route.path.charAt(0).toUpperCase() + route.path.slice(1), 
              url_path: expectedUrl,
              description: `Auto-détectée via le code`,
              icone: `/assets/img/ico-menu-${route.path}.png`,
              is_active: true
            });
          }
        }

        if (route.children && route.children.length > 0) {
          console.log(`${indent}   📂 Exploration des sous-routes (children)...`);
          inspectRoutes(route.children, depth + 1);
        }
      });
    };

    inspectRoutes(routes);

    console.log('🏁 [AUTO-DÉTECTION] 4. Résultat final des applications non enregistrées:', this.localUnregisteredApps);
  }

  registerLocalApp(app: Partial<Application>) {
    this.newApp = {
      nom: app.nom || '',
      url_path: app.url_path || '',
      description: app.description || '',
      icone: app.icone || '',
      is_active: app.is_active !== undefined ? app.is_active : true
    };
    this.cdr.detectChanges();
    document.getElementById('form-ajout-app')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  getIconUrl(icon: string): string {
    if (!icon) return '';
    if (icon.startsWith('http')) return icon;
    if (icon.includes('assets/')) return icon.startsWith('/') ? icon : '/' + icon;
    if (!icon.includes('/')) return '/assets/img/' + icon;
    return icon.startsWith('/') ? icon : '/' + icon;
  }

  handleImageError(event: any) {
    if (event.target) event.target.style.display = 'none';
  }

  ajouterApplication() {
    if (!this.newApp.nom || !this.newApp.url_path) return;
    const appToSave = { ...this.newApp, is_active: this.newApp.is_active ? 1 : 0 };
    this.adminService.insertApplication(appToSave as any).subscribe(() => {
      this.newApp = { nom: '', description: '', url_path: '', icone: '', is_active: true };
      this.loadApps();
    });
  }

  startAppEdit(app: Application) {
    this.editingAppId = app.id;
    this.editingAppObj = { ...app };
  }

  saveAppEdit() {
    if (!this.editingAppObj.nom) return;
    const updatedApp = { ...this.editingAppObj, is_active: this.editingAppObj.is_active ? 1 : 0 };
    this.applications = this.applications.map(a => a.id === updatedApp.id ? { ...updatedApp, is_active: !!updatedApp.is_active } as any : a);
    this.editingAppId = null;
    this.adminService.updateApplication(updatedApp as any).subscribe(() => this.loadApps());
  }

  cancelAppEdit() {
    this.editingAppId = null;
    this.editingAppObj = {} as Application;
  }

  deleteApplication(appId: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette application ?')) {
      this.adminService.deleteApplication(appId).subscribe(() => this.loadApps());
    }
  }

  toggleAppStatus(app: Application) {
    const newStatusBoolean = !app.is_active;
    const updatedApp = { ...app, is_active: newStatusBoolean ? 1 : 0 };
    this.applications = this.applications.map(a => a.id === app.id ? { ...app, is_active: newStatusBoolean } : a);
    this.adminService.updateApplication(updatedApp as any).subscribe(() => {}, () => this.loadApps());
  }
}