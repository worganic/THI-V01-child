import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AdminProjetsComponent } from './tabs/admin-projets/admin-projets.component';
import { AdminUsersComponent } from './tabs/admin-users/admin-users.component';
import { AdminDeploymentsComponent } from './tabs/admin-deployments/admin-deployments.component';
import { AdminHelpComponent } from './tabs/admin-help/admin-help.component';
import { ConfigComponent } from '../user/config/config.component';

type AdminTab = 'projects' | 'users' | 'deploiement' | 'help' | 'config';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, AdminProjetsComponent, AdminUsersComponent, AdminDeploymentsComponent, AdminHelpComponent, ConfigComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  activeTab = signal<AdminTab>('projects');

  projectsCount = signal(0);
  usersCount = signal(0);
  helpCount = signal(0);
  versionStatus = signal<any>(null);

  helpEditId = signal<number | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const user = this.authService.currentUser();
    if (!user || user.role !== 'admin') {
      this.router.navigate(['/home']);
      return;
    }

    const params = this.route.snapshot.queryParamMap;
    const tab = (params.get('tab') as AdminTab) || 'projects';
    const editId = params.get('editId');

    this.activeTab.set(tab);
    if (editId) this.helpEditId.set(+editId);

    if (!params.get('tab')) {
      this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
    }
  }

  setTab(tab: AdminTab) {
    this.activeTab.set(tab);
    this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }
}
