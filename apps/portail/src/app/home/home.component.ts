import { Component, OnInit, inject, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

import { toObservable } from '@angular/core/rxjs-interop';
import { PORTAL_SESSION } from '@portail/core-auth';
import { AdminService } from '../../services/admin.service';
import { Groupe } from '../../models/admin.models';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    standalone: true,
    imports: [CommonModule]
})
export class HomeComponent implements OnInit {
  
  // Session vue à travers le contrat commun aux deux portails : cet écran ne
  // connaît ni le matricule d'un côté ni le jeton de l'autre.
  private readonly session = inject(PORTAL_SESSION);
  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  
  private readonly cdr = inject(ChangeDetectorRef); 

  isAdmin: boolean = false;
  categories: Groupe[] = [];
  isLoading = true;
  errorMessage: string | null = null;

  ngOnInit(): void {
    toObservable(this.session.user).pipe(
      switchMap(user => {
        this.isAdmin = user?.role === 'admin';

        if (user?.id) {
          return this.adminService.getUserByMatricule(user.id);
        }
        return of(null);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (user) => {
        if (user && user.id) {
          this.loadUserDashboard(user.id, user.role);
        } else {
          this.errorMessage = "Votre compte n'est pas reconnu par le système.";
          this.isLoading = false; 
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error("🏠 [Home] Erreur de récupération de l'utilisateur", err);
        this.errorMessage = "Impossible de récupérer vos informations.";
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadUserDashboard(user_id: string, role: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.detectChanges();
    
    this.adminService.getHomeDashboard(user_id, role)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groupes) => {
          this.categories = groupes;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error("🏠 [Home] Erreur de chargement du dashboard", err);
          this.errorMessage = "Erreur lors du chargement de vos applications.";
          this.isLoading = false;
          this.cdr.detectChanges();
        }
    });
  }

  naviguerVersApp(url: string | undefined): void {
    if (url) {
      if (url.startsWith('http')) {
        window.open(url, '_blank');
      } else {
        this.router.navigate([url]);
      }
    }
  }

  getIconUrl(icon: string | undefined): string {
    if (!icon) return '';
    if (icon.startsWith('http')) return icon;
    if (icon.includes('assets/')) return icon.startsWith('/') ? icon : '/' + icon;
    return '/assets/img/' + icon;
  }
}