import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_DATA_URL } from './tokens';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  // Fiche d'annuaire — facultative ici : la session et l'en-tête n'en ont pas
  // besoin, seule l'administration des utilisateurs les renseigne.
  // Voir PortalUser (portal-apps.models.ts) pour la fiche complète.
  matricule?: string;
  nom?: string;
  prenom?: string;
  /** Un compte inactif est conservé mais ne peut plus se connecter. */
  isActive?: boolean;
  createdAt?: string;
  lastLogin?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = inject(API_DATA_URL);
  private readonly TOKEN_KEY = 'frankenstein_token';
  private readonly USER_KEY = 'frankenstein_user';

  isAuthenticated = signal(false);
  currentUser = signal<AuthUser | null>(null);

  /** Promesse qui se résout quand la vérification initiale du token est terminée. */
  readonly initDone: Promise<void>;
  private _resolveInit!: () => void;

  constructor(private http: HttpClient) {
    this.initDone = new Promise<void>(resolve => { this._resolveInit = resolve; });
    this.initFromStorage();
  }

  private initFromStorage() {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userStr = localStorage.getItem(this.USER_KEY);

    if (token && userStr) {
      try {
        const user: AuthUser = JSON.parse(userStr);
        this.isAuthenticated.set(true);
        this.currentUser.set(user);
        // Defer verify() to avoid circular DI: the interceptor injects AuthService
        // which is still being constructed at this point in the constructor call stack.
        Promise.resolve().then(() => {
          this.verify()
            .catch(() => { this.clearSession(); })
            .finally(() => { this._resolveInit(); });
        });
        return;
      } catch {
        this.clearSession();
        this._resolveInit();
      }
    }
    this._resolveInit();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Retourne un objet d'en-têtes SIMPLE (et non une instance HttpHeaders) : Angular accepte
   * un objet plat partout pour `{ headers }`, et surtout cet objet peut être étalé sans risque
   * (`{ ...getAuthHeaders() }`). Étaler une instance HttpHeaders copiait ses champs internes
   * (`headers: undefined`, `normalizedNames`, `lazyUpdate`…) → `new HttpHeaders({ headers: undefined })`
   * levait « Unexpected value of the `headers` header … got: undefined » et cassait la sauvegarde.
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const res: any = await firstValueFrom(
      this.http.post(`${this.apiUrl}/api/auth/login`, { email, password })
    );
    this.setSession(res.token, res.user);
    return res.user;
  }

  async register(username: string, email: string, password: string): Promise<AuthUser> {
    const res: any = await firstValueFrom(
      this.http.post(`${this.apiUrl}/api/auth/register`, { username, email, password })
    );
    this.setSession(res.token, res.user);
    return res.user;
  }

  async verify(): Promise<AuthUser> {
    const res: any = await firstValueFrom(
      this.http.get(`${this.apiUrl}/api/auth/verify`, { headers: this.getAuthHeaders() })
    );
    this.currentUser.set(res.user);
    this.isAuthenticated.set(true);
    return res.user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/api/auth/logout`, {}, { headers: this.getAuthHeaders() })
      );
    } catch { /* ignore */ }
    this.clearSession();
  }

  async getUsers(): Promise<AuthUser[]> {
    return firstValueFrom(
      this.http.get<AuthUser[]>(`${this.apiUrl}/api/auth/users`, { headers: this.getAuthHeaders() })
    );
  }

  async deleteUser(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/api/auth/users/${id}`, { headers: this.getAuthHeaders() })
    );
  }

  async updateUser(id: string, data: Partial<AuthUser & { password: string }>): Promise<AuthUser> {
    return firstValueFrom(
      this.http.put<AuthUser>(`${this.apiUrl}/api/auth/users/${id}`, data, { headers: this.getAuthHeaders() })
    );
  }

  private setSession(token: string, user: AuthUser) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.isAuthenticated.set(true);
    this.currentUser.set(user);
  }

  private clearSession() {
    this.clearSessionPublic();
  }

  clearSessionPublic() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
  }
}
