import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, AppConfigService, DbStatusService } from '@portail/core-data-access';
import { ThemeService } from '@portail/shared-ui';

/**
 * Surcharge THI de la landing publique (slot `landing`, voir
 * docs/architecture-sous-applications.md § 10) : page de présentation design
 * héritée de l'ancien portail THI (avant unification sur `apps/portail-shell/`),
 * portée depuis `THI-V01-child-user3` pré-migration
 * (`apps/portail/src/app/pages/public/landing/`).
 *
 * La route `''` applique déjà `guestGuard` (voir app.routes.ts) : un visiteur
 * déjà connecté est renvoyé vers `/home` avant que ce composant ne se monte —
 * pas besoin de revérifier `isAuthenticated()` ici.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  public db = inject(DbStatusService);
  public appConfig = inject(AppConfigService);

  get appName()         { return this.appConfig.appName(); }
  get copyrightYear()   { return this.appConfig.copyrightYear(); }
  get copyrightHolder() { return this.appConfig.copyrightHolder(); }

  showLoginModal = false;
  showRegisterModal = false;

  loginEmail = '';
  loginPassword = '';
  loginError = '';
  loginLoading = false;

  registerUsername = '';
  registerEmail = '';
  registerPassword = '';
  registerPasswordConfirm = '';
  registerError = '';
  registerLoading = false;

  particles: { x: number; y: number; size: number; duration: number; delay: number }[] = [];

  retrying = false;

  get dbError(): boolean {
    return this.db.status() === 'error';
  }

  async retryDb(): Promise<void> {
    this.retrying = true;
    await this.db.check();
    this.retrying = false;
  }

  ngOnInit(): void {
    this.themeService.applyTheme('dark');

    if (this.dbError) {
      return;
    }

    this.particles = Array.from({ length: 30 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 15 + 8,
      delay: Math.random() * 10
    }));
  }

  openLogin(): void {
    this.showRegisterModal = false;
    this.loginError = '';
    this.loginEmail = 'admin@admin.com';
    this.loginPassword = 'admin';
    this.showLoginModal = true;
  }

  openRegister(): void {
    this.showLoginModal = false;
    this.registerError = '';
    this.registerUsername = '';
    this.registerEmail = '';
    this.registerPassword = '';
    this.registerPasswordConfirm = '';
    this.showRegisterModal = true;
  }

  closeModals(): void {
    this.showLoginModal = false;
    this.showRegisterModal = false;
  }

  async submitLogin(): Promise<void> {
    if (!this.loginEmail || !this.loginPassword) {
      this.loginError = 'Veuillez remplir tous les champs';
      return;
    }
    this.loginLoading = true;
    this.loginError = '';
    try {
      await this.auth.login(this.loginEmail, this.loginPassword);
      this.closeModals();
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.loginError = err?.error?.error || 'Erreur de connexion';
    } finally {
      this.loginLoading = false;
    }
  }

  async submitRegister(): Promise<void> {
    if (!this.registerUsername || !this.registerEmail || !this.registerPassword) {
      this.registerError = 'Veuillez remplir tous les champs';
      return;
    }
    if (this.registerPassword !== this.registerPasswordConfirm) {
      this.registerError = 'Les mots de passe ne correspondent pas';
      return;
    }
    if (this.registerPassword.length < 6) {
      this.registerError = 'Le mot de passe doit faire au moins 6 caractères';
      return;
    }
    this.registerLoading = true;
    this.registerError = '';
    try {
      await this.auth.register(this.registerUsername, this.registerEmail, this.registerPassword);
      this.closeModals();
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.registerError = err?.error?.error || "Erreur lors de l'inscription";
    } finally {
      this.registerLoading = false;
    }
  }
}
