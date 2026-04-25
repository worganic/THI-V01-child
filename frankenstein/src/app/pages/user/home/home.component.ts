import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  constructor(private router: Router, public auth: AuthService) {}

  goToProjets(): void {
    this.router.navigate(['/projets']);
  }

  goToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  get isAdmin(): boolean {
    return this.auth.currentUser()?.role === 'admin';
  }
}
