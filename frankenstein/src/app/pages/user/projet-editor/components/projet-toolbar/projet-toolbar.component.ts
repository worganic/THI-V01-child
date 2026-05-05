import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../../core/services/auth.service';

export type ToolbarSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-projet-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projet-toolbar.component.html',
})
export class ProjetToolbarComponent {
  @Input() projectTitle = '';
  @Input() saveStatus: ToolbarSaveStatus = 'idle';
  @Output() save = new EventEmitter<void>();

  // Présentation du bouton selon l'état
  get saveLabel(): string {
    switch (this.saveStatus) {
      case 'dirty':  return 'Non sauvegardé';
      case 'saving': return 'Sauvegarde…';
      case 'error':  return 'Erreur';
      default:       return 'Sauvegardé';
    }
  }
  get saveIcon(): string {
    switch (this.saveStatus) {
      case 'dirty':  return 'edit';
      case 'saving': return 'progress_activity';
      case 'error':  return 'error';
      default:       return 'check_circle';
    }
  }
  get saveClass(): string {
    switch (this.saveStatus) {
      case 'dirty':  return 'text-light-text-muted dark:text-white/40 border-light-border dark:border-white/10';
      case 'saving': return 'text-yellow-500 dark:text-yellow-400 border-yellow-400/30 bg-yellow-400/5';
      case 'error':  return 'text-red-500 dark:text-red-400 border-red-400/30 bg-red-400/5';
      default:       return 'text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/5';
    }
  }
  get saveIconSpin(): boolean {
    return this.saveStatus === 'saving';
  }

  constructor(private router: Router, private auth: AuthService) {}

  goHome() { this.router.navigate(['/home']); }
  goProjets() { this.router.navigate(['/projets']); }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/']);
  }
}
