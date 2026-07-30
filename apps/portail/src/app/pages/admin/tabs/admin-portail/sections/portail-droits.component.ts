import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import {
  PortalAppsService,
  PortalApp,
  PortalGroupe,
  PortalMetier,
  PortalUser,
  PortalUserGroupe,
  PortalUserApp,
  PortalDroit,
  metierBadgeClass,
} from '@worganic/portail-core/data-access';

/**
 * Admin › Applications › Droits — pour un utilisateur donné : son métier,
 * ses groupes (qui donnent accès aux applications du groupe) et ses accès
 * directs à une application (avec niveau de droit).
 */
@Component({
  selector: 'app-portail-droits-section',
  imports: [FormsModule, NgClass],
  templateUrl: './portail-droits.component.html'
})
export class PortailDroitsSectionComponent implements OnInit {
  private service = inject(PortalAppsService);

  users       = signal<PortalUser[]>([]);
  groupes     = signal<PortalGroupe[]>([]);
  apps        = signal<PortalApp[]>([]);
  metiers     = signal<PortalMetier[]>([]);
  userGroupes = signal<PortalUserGroupe[]>([]);
  userApps    = signal<PortalUserApp[]>([]);
  loading     = signal(true);
  error       = signal('');

  selectedUserId = signal<string | null>(null);
  selectedUser = computed(() => this.users().find(u => u.id === this.selectedUserId()) || null);

  readonly badgeClass = metierBadgeClass;
  readonly droitsOptions: PortalDroit[] = ['lecture', 'ecriture', 'admin'];

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [users, groupes, apps, metiers, userGroupes, userApps] = await Promise.all([
        this.service.getUsers(),
        this.service.getGroupes(),
        this.service.getApps(),
        this.service.getMetiers(),
        this.service.getUserGroupes(),
        this.service.getUserApps(),
      ]);
      this.users.set(users);
      this.groupes.set(groupes);
      this.apps.set(apps);
      this.metiers.set(metiers);
      this.userGroupes.set(userGroupes);
      this.userApps.set(userApps);
      if (!this.selectedUserId() || !users.some(u => u.id === this.selectedUserId())) {
        this.selectedUserId.set(users[0]?.id ?? null);
      }
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur chargement des droits');
    } finally {
      this.loading.set(false);
    }
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
    try {
      await this.service.toggleUserGroupe(userId, groupeId, !this.isInGroupe(groupeId));
      await this.load();
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
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour de l\'accès direct');
    }
  }

  async setDroits(appId: number, droits: string) {
    const userId = this.selectedUserId();
    if (!userId) return;
    try {
      await this.service.toggleUserApp(userId, appId, true, droits as PortalDroit);
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur mise à jour du niveau de droit');
    }
  }

  async setMetier(metierId: string) {
    const userId = this.selectedUserId();
    if (!userId) return;
    try {
      await this.service.setUserMetier(userId, metierId ? Number(metierId) : null);
      await this.load();
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
}
