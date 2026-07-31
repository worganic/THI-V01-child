import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_DATA_URL } from './tokens';
import { AuthService } from './auth.service';
import {
  PortalApp,
  PortalGroupe,
  PortalMetier,
  PortalUser,
  PortalGroupeApp,
  PortalUserGroupe,
  PortalUserApp,
  PortalHomeDashboard,
  PortalDroit,
} from './portal-apps.models';

/**
 * Accès aux sous-applications du portail et à leurs droits.
 * Toutes les données viennent de MySQL via /api/portal/*.
 */
@Injectable({ providedIn: 'root' })
export class PortalAppsService {
  private apiUrl = inject(API_DATA_URL);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  private h() { return this.auth.getAuthHeaders(); }
  private url(p: string) { return `${this.apiUrl}/api/portal${p}`; }

  // ── Page d'accueil ─────────────────────────────────────────────────────────

  /**
   * Applications réellement autorisées pour l'utilisateur connecté (groupes +
   * accès directs — même filtrage que `/home`, un admin voit tout). Dérivées
   * de chaque appel à `getHomeDashboard()`, partagées par toute la session
   * (service `providedIn: 'root'`) : la barre de navigation (`NavComponent`)
   * doit lire CE signal, pas `apps` ci-dessous, qui est le catalogue brut
   * (toutes les apps actives, sans égard aux permissions de l'utilisateur) —
   * ne sert qu'à l'admin des applications.
   */
  private authorizedAppsSignal = signal<PortalApp[]>([]);
  readonly authorizedApps = this.authorizedAppsSignal.asReadonly();

  async getHomeDashboard(): Promise<PortalHomeDashboard> {
    const dashboard = await firstValueFrom(this.http.get<PortalHomeDashboard>(this.url('/home'), { headers: this.h() }));
    const byCode = new Map<string, PortalApp>();
    for (const g of dashboard.groupes) for (const a of g.apps) byCode.set(a.code, a);
    this.authorizedAppsSignal.set([...byCode.values()]);
    return dashboard;
  }

  // ── Applications ───────────────────────────────────────────────────────────

  /**
   * Catalogue brut de TOUTES les sous-applications (actives ou non), tenu à
   * jour par chaque appel à getApps() — réservé à l'admin des applications
   * (CRUD, activer/désactiver). Ne pas utiliser pour un menu utilisateur :
   * ne reflète pas les permissions (groupes/accès directs), voir
   * `authorizedApps` ci-dessus.
   */
  private appsSignal = signal<PortalApp[]>([]);
  readonly apps = this.appsSignal.asReadonly();

  async getApps(): Promise<PortalApp[]> {
    const apps = await firstValueFrom(this.http.get<PortalApp[]>(this.url('/apps'), { headers: this.h() }));
    this.appsSignal.set(apps);
    return apps;
  }

  createApp(app: Partial<PortalApp>): Promise<PortalApp> {
    return firstValueFrom(this.http.post<PortalApp>(this.url('/apps'), app, { headers: this.h() }));
  }

  updateApp(id: number, app: Partial<PortalApp>): Promise<PortalApp> {
    return firstValueFrom(this.http.put<PortalApp>(this.url(`/apps/${id}`), app, { headers: this.h() }));
  }

  deleteApp(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/apps/${id}`), { headers: this.h() }));
  }

  // ── Groupes ────────────────────────────────────────────────────────────────

  getGroupes(): Promise<PortalGroupe[]> {
    return firstValueFrom(this.http.get<PortalGroupe[]>(this.url('/groupes'), { headers: this.h() }));
  }

  createGroupe(groupe: Partial<PortalGroupe>): Promise<PortalGroupe> {
    return firstValueFrom(this.http.post<PortalGroupe>(this.url('/groupes'), groupe, { headers: this.h() }));
  }

  updateGroupe(id: number, groupe: Partial<PortalGroupe>): Promise<PortalGroupe> {
    return firstValueFrom(this.http.put<PortalGroupe>(this.url(`/groupes/${id}`), groupe, { headers: this.h() }));
  }

  deleteGroupe(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/groupes/${id}`), { headers: this.h() }));
  }

  // ── Métiers ────────────────────────────────────────────────────────────────

  getMetiers(): Promise<PortalMetier[]> {
    return firstValueFrom(this.http.get<PortalMetier[]>(this.url('/metiers'), { headers: this.h() }));
  }

  createMetier(metier: Partial<PortalMetier>): Promise<PortalMetier> {
    return firstValueFrom(this.http.post<PortalMetier>(this.url('/metiers'), metier, { headers: this.h() }));
  }

  updateMetier(id: number, metier: Partial<PortalMetier>): Promise<PortalMetier> {
    return firstValueFrom(this.http.put<PortalMetier>(this.url(`/metiers/${id}`), metier, { headers: this.h() }));
  }

  deleteMetier(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/metiers/${id}`), { headers: this.h() }));
  }

  // ── Utilisateurs ───────────────────────────────────────────────────────────

  getUsers(): Promise<PortalUser[]> {
    return firstValueFrom(this.http.get<PortalUser[]>(this.url('/users'), { headers: this.h() }));
  }

  setUserMetier(userId: string, metierId: number | null): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(this.url(`/users/${userId}/metier`), { metierId }, { headers: this.h() })
    );
  }

  // ── Matrices de droits ─────────────────────────────────────────────────────

  getGroupeApps(): Promise<PortalGroupeApp[]> {
    return firstValueFrom(this.http.get<PortalGroupeApp[]>(this.url('/groupe-apps'), { headers: this.h() }));
  }

  toggleGroupeApp(groupeId: number, appId: number, linked: boolean): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.url('/groupe-apps'), { groupeId, appId, linked }, { headers: this.h() })
    );
  }

  getUserGroupes(): Promise<PortalUserGroupe[]> {
    return firstValueFrom(this.http.get<PortalUserGroupe[]>(this.url('/user-groupes'), { headers: this.h() }));
  }

  toggleUserGroupe(userId: string, groupeId: number, linked: boolean): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.url('/user-groupes'), { userId, groupeId, linked }, { headers: this.h() })
    );
  }

  getUserApps(): Promise<PortalUserApp[]> {
    return firstValueFrom(this.http.get<PortalUserApp[]>(this.url('/user-apps'), { headers: this.h() }));
  }

  toggleUserApp(userId: string, appId: number, linked: boolean, droits: PortalDroit = 'lecture'): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.url('/user-apps'), { userId, appId, linked, droits }, { headers: this.h() })
    );
  }
}
