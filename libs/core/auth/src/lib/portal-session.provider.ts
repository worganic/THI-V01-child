import { Injectable, Provider, computed, inject } from '@angular/core';
import { AuthService } from '@portail/core-data-access';
import { PortalSession, PortalSessionUser, PORTAL_SESSION } from './portal-session';

/**
 * Adapte l'`AuthService` de CE portail au contrat `PortalSession`.
 *
 * Le contrat (portal-session.ts) est identique dans les deux monorepos ; la
 * façon de le satisfaire ne l'est pas, et n'a pas à l'être : ici la session
 * repose sur un jeton Bearer et un `currentUser` {id, username, email, role},
 * là-bas sur un matricule et des signaux. C'est précisément ce que cette
 * couche isole, pour qu'une sous-application n'ait jamais à connaître l'un ou
 * l'autre. Voir docs/architecture-sous-applications.md, section « Découplage ».
 */
@Injectable({ providedIn: 'root' })
export class PortalSessionAdapter implements PortalSession {
  private auth = inject(AuthService);

  /** Rôles de ce portail ('admin'|'user'|…) vers le vocabulaire commun. */
  private static normalizeRole(role: string | undefined): PortalSessionUser['role'] {
    switch ((role || '').toLowerCase()) {
      case 'admin':  return 'admin';
      case 'invite': return 'invite';
      default:       return 'user';
    }
  }

  readonly user = computed<PortalSessionUser | null>(() => {
    const u = this.auth.currentUser();
    if (!u) return null;
    return {
      id: u.id,
      displayName: u.username,
      email: u.email ?? null,
      role: PortalSessionAdapter.normalizeRole(u.role),
      rawRole: u.role ?? null,
    };
  });

  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  getAuthHeaders(): Record<string, string> {
    return this.auth.getAuthHeaders();
  }

  logout(): void {
    // AuthService.logout() est asynchrone ; le contrat ne rend pas la main sur
    // la fin de l'appel réseau, la session locale étant vidée dans tous les cas.
    void this.auth.logout();
  }
}

export function providePortalSession(): Provider[] {
  return [{ provide: PORTAL_SESSION, useExisting: PortalSessionAdapter }];
}
