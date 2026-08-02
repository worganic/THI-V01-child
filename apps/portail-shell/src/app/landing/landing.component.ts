import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PORTAL_AUTH_ROUTES } from '@portail/core-auth';

/**
 * Page publique par défaut de la racine (`''`). La route applique déjà
 * `guestGuard` (renvoie un utilisateur connecté vers `/home` avant même que
 * ce composant ne se monte) : ce composant n'a donc qu'à rediriger un
 * visiteur non connecté vers l'écran de connexion.
 *
 * Surchargeable par un portail via `apps/portail-shell-special/src/app/landing/landing.component.ts`
 * (voir docs/architecture-sous-applications.md, section "Surcharge de page
 * par présence de fichier").
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  template: ''
})
export class LandingComponent implements OnInit {
  private router = inject(Router);
  private routes = inject(PORTAL_AUTH_ROUTES);

  ngOnInit(): void {
    this.router.navigateByUrl(this.routes.login);
  }
}
