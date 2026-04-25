import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface NavItem {
  route: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

export interface LandingConfig {
  heroBadge?: string;
  heroTitleLine1?: string;
  heroTitleHighlight?: string;
  heroTitleLine2?: string;
  heroSubtitle?: string;
  ctaTitle?: string;
  ctaSubtitle?: string;
}

export interface HomeConfig {
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  primaryButtonLabel?: string;
  primaryButtonRoute?: string;
  primaryButtonIcon?: string;
}

const API = environment.apiDataUrl;

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  appName        = signal(environment.appName);
  appTagline     = signal(environment.copyrightTagline);
  logoIcon       = signal('rocket_launch');
  copyrightHolder = signal(environment.copyrightHolder);
  copyrightYear  = signal(environment.copyrightYear);
  copyrightTagline = signal(environment.copyrightTagline);

  childNavItems  = signal<NavItem[]>([]);
  landingConfig  = signal<LandingConfig>({});
  homeConfig     = signal<HomeConfig>({});

  constructor(private http: HttpClient) {}

  async load(): Promise<void> {
    const [app, theme, nav, landing, home] = await Promise.allSettled([
      firstValueFrom(this.http.get<any>(`${API}/api/child/config/app`)),
      firstValueFrom(this.http.get<any>(`${API}/api/child/config/theme`)),
      firstValueFrom(this.http.get<any>(`${API}/api/child/config/nav`)),
      firstValueFrom(this.http.get<any>(`${API}/api/child/config/landing`)),
      firstValueFrom(this.http.get<any>(`${API}/api/child/config/home`)),
    ]);

    if (app.status === 'fulfilled' && app.value) {
      const a = app.value;
      if (a.appName)         this.appName.set(a.appName);
      if (a.appTagline)      this.appTagline.set(a.appTagline);
      if (a.logoIcon)        this.logoIcon.set(a.logoIcon);
      if (a.copyrightHolder) this.copyrightHolder.set(a.copyrightHolder);
      if (a.copyrightYear)   this.copyrightYear.set(a.copyrightYear);
      if (a.copyrightTagline) this.copyrightTagline.set(a.copyrightTagline);
    }

    if (theme.status === 'fulfilled' && theme.value?.cssVars) {
      const vars = theme.value.cssVars as Record<string, string>;
      Object.entries(vars).forEach(([k, v]) => {
        document.documentElement.style.setProperty(k, v);
      });
    }

    if (nav.status === 'fulfilled' && Array.isArray(nav.value?.items)) {
      this.childNavItems.set(nav.value.items);
    }

    if (landing.status === 'fulfilled' && landing.value) {
      this.landingConfig.set(landing.value);
    }

    if (home.status === 'fulfilled' && home.value) {
      this.homeConfig.set(home.value);
    }
  }
}
