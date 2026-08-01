import { Component, OnInit, signal, inject, computed } from '@angular/core';
import {
  PortalAppsService,
  PortalApp,
  PortalGroupe,
  PortalUser,
  PortalGroupeApp,
  PortalUserGroupe,
  PortalUserApp,
} from '@portail/core-data-access';

/** Ensemble des données d'habilitation, telles que lues côté serveur. */
interface FullExportData {
  users: PortalUser[];
  groupes: PortalGroupe[];
  apps: PortalApp[];
  groupeApps: PortalGroupeApp[];
  userGroupes: PortalUserGroupe[];
  userApps: PortalUserApp[];
}

/** Bloc « socle » : tout le système transverse du portail. */
interface PortailExportBlock {
  portail: string;
  users: PortalUser[];
  groupes: PortalGroupe[];
  userGroupes: PortalUserGroupe[];
  apps: PortalApp[];
  userApps: PortalUserApp[];
  groupeApps: PortalGroupeApp[];
}

/** Bloc « application » : une sous-application et uniquement ce qui la concerne. */
interface ApplicationExportBlock {
  app: PortalApp;
  groupeApps: PortalGroupeApp[];
  groupes: PortalGroupe[];
  userApps: PortalUserApp[];
  userGroupes: PortalUserGroupe[];
  users: PortalUser[];
}

type ExportBlock = PortailExportBlock | ApplicationExportBlock;

/**
 * Admin › Portail › Export JSON — même page que sur l'autre portail : un
 * sélecteur de périmètre (tout / socle / une application) et le JSON
 * correspondant, prêt à être copié.
 *
 * L'export d'une application ne retient que les groupes qui lui sont rattachés
 * et les utilisateurs qui y accèdent (par groupe ou par accès direct) : c'est
 * ce qui rend le bloc utilisable seul, pour initialiser la sous-application
 * ailleurs.
 */
@Component({
  selector: 'app-portail-export-section',
  templateUrl: './portail-export.component.html'
})
export class PortailExportSectionComponent implements OnInit {
  private service = inject(PortalAppsService);

  loading = signal(true);
  error   = signal('');
  copied  = signal(false);

  data = signal<FullExportData | null>(null);
  /** `null` = tout, `'portail'` = le socle seul, sinon l'id d'une application. */
  selection = signal<number | 'portail' | null>(null);

  apps = computed(() => this.data()?.apps ?? []);

  json = computed(() => {
    const data = this.data();
    if (!data) return '';
    const selection = this.selection();

    if (selection === 'portail') {
      return JSON.stringify(this.buildPortailBlock(data), null, 2);
    }
    if (selection === null) {
      const blocks: ExportBlock[] = [
        this.buildPortailBlock(data),
        ...data.apps.map(app => this.buildAppBlock(data, app)),
      ];
      return JSON.stringify(blocks, null, 2);
    }
    const app = data.apps.find(a => a.id === selection);
    return JSON.stringify(app ? this.buildAppBlock(data, app) : {}, null, 2);
  });

  selectionLabel = computed(() => {
    const selection = this.selection();
    if (selection === null) return 'Tout le portail et ses applications';
    if (selection === 'portail') return 'Socle du portail (utilisateurs & habilitations)';
    return this.apps().find(a => a.id === selection)?.nom ?? '';
  });

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [users, groupes, apps, groupeApps, userGroupes, userApps] = await Promise.all([
        this.service.getUsers(),
        this.service.getGroupes(),
        this.service.getApps(),
        this.service.getGroupeApps(),
        this.service.getUserGroupes(),
        this.service.getUserApps(),
      ]);
      this.data.set({ users, groupes, apps, groupeApps, userGroupes, userApps });
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Erreur lors de la récupération des données d\'export');
    } finally {
      this.loading.set(false);
    }
  }

  select(selection: number | 'portail' | null) {
    this.selection.set(selection);
    this.copied.set(false);
  }

  private buildPortailBlock(data: FullExportData): PortailExportBlock {
    return {
      portail: 'Portail — système transverse',
      users: data.users,
      groupes: data.groupes,
      userGroupes: data.userGroupes,
      apps: data.apps,
      userApps: data.userApps,
      groupeApps: data.groupeApps,
    };
  }

  private buildAppBlock(data: FullExportData, app: PortalApp): ApplicationExportBlock {
    const groupeApps = data.groupeApps.filter(ga => ga.appId === app.id);
    const groupeIds = new Set(groupeApps.map(ga => ga.groupeId));

    const groupes = data.groupes.filter(g => groupeIds.has(g.id));
    const userApps = data.userApps.filter(ua => ua.appId === app.id);
    const userGroupes = data.userGroupes.filter(ug => groupeIds.has(ug.groupeId));

    const userIds = new Set([
      ...userApps.map(ua => ua.userId),
      ...userGroupes.map(ug => ug.userId),
    ]);

    return {
      app,
      groupeApps,
      groupes,
      userApps,
      userGroupes,
      users: data.users.filter(u => userIds.has(u.id)),
    };
  }

  async copy() {
    const json = this.json();
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      this.error.set('Copie impossible : le presse-papiers est refusé par le navigateur.');
    }
  }
}
