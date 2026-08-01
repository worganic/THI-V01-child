import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { AppUser, Metier } from '../../../models/admin.models';
import { METIER_COLOR_OPTIONS, DEFAULT_METIER_COLOR, metierBadgeClass } from '../../../utils/metier-colors';

/**
 * Gestion des métiers (Dev/Infra/Media/Instructeurs...) — même design et mêmes interactions que
 * les catégories de projet de l'agenda (apps/appli-agenda/.../categories-projet.component.ts) :
 * un métier utilisé par au moins un utilisateur ne peut plus être supprimé (bouton désactivé,
 * pas de confirm() natif), et le renommer/recolorer se fait par un vrai update, pas un
 * delete+recreate. Le badge (.metier-badge / metierBadgeClass) reste celui déjà utilisé par la
 * colonne Métier d'Admin > Utilisateurs (voir admin.component.scss, partagé via styleUrls) —
 * une seule définition de couleur pour les deux écrans.
 */
@Component({
  selector: 'app-admin-metiers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-metiers.component.html',
  styleUrls: ['../admin.component.scss', './admin-metiers.component.scss']
})
export class AdminMetiersComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  metiers: Metier[] = [];
  users: AppUser[] = [];

  readonly colorOptions = METIER_COLOR_OPTIONS;
  readonly badgeClass = metierBadgeClass;

  editingId: number | null = null;
  form = this.emptyForm();

  // Ajout d'un utilisateur à un métier via un champ texte + autocomplétion, clé = id du métier
  // dont le champ est actuellement rempli/ouvert (voir suggestionsFor/assignUser/onSearchBlur).
  userQuery: Record<number, string> = {};
  openSuggestionsFor: number | null = null;

  private emptyForm() {
    return { nom: '', color: DEFAULT_METIER_COLOR, is_active: true };
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    forkJoin({
      metiers: this.adminService.getMetiers(),
      users: this.adminService.getUsers()
    }).subscribe({
      next: (data) => {
        this.metiers = data.metiers || [];
        this.users = data.users || [];
        this.cdr.detectChanges();
      },
      error: (err: unknown) => console.error('Erreur chargement des métiers', err)
    });
  }

  /** Métiers triés par nom : une liste de config se parcourt alphabétiquement, pas par id. */
  get sortedMetiers(): Metier[] {
    return [...this.metiers].sort((a, b) => a.nom.localeCompare(b.nom));
  }

  userCount(metierId: number): number {
    return this.usersFor(metierId).length;
  }

  isUsed(metierId: number): boolean {
    return this.userCount(metierId) > 0;
  }

  usersFor(metierId: number): AppUser[] {
    return this.users.filter(u => u.metier_id === metierId);
  }

  /** Suggestions d'utilisateurs pour l'autocomplétion d'un métier donné : exclut ceux qui y sont
   *  déjà (ils apparaissent en re-suggestion sinon), ne s'affiche qu'à partir d'1 caractère saisi. */
  suggestionsFor(metierId: number): AppUser[] {
    const q = (this.userQuery[metierId] || '').trim().toLowerCase();
    if (!q) return [];
    return this.users
      .filter(u => u.metier_id !== metierId)
      .filter(u =>
        `${u.prenom} ${u.nom}`.toLowerCase().includes(q) ||
        (u.matricule || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }

  onUserSearchFocus(metierId: number): void {
    this.openSuggestionsFor = metierId;
  }

  // Délai avant fermeture pour laisser le (mousedown) d'une suggestion s'exécuter avant que le
  // blur du champ ne referme la liste (sinon le clic sur une suggestion ne fait jamais rien).
  onUserSearchBlur(): void {
    setTimeout(() => { this.openSuggestionsFor = null; }, 150);
  }

  assignUser(metierId: number, user: AppUser): void {
    this.adminService.updateUser({ ...user, metier_id: metierId }).subscribe(() => {
      this.userQuery[metierId] = '';
      this.openSuggestionsFor = null;
      this.loadData();
    });
  }

  unassignUser(user: AppUser): void {
    this.adminService.updateUser({ ...user, metier_id: null }).subscribe(() => this.loadData());
  }

  startEdit(metier: Metier): void {
    this.editingId = metier.id;
    this.form = { nom: metier.nom, color: metier.color, is_active: metier.is_active };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.form = this.emptyForm();
  }

  onSubmit(): void {
    const nom = this.form.nom.trim();
    if (!nom) return;

    const payload = { nom, color: this.form.color, is_active: this.form.is_active };

    if (this.editingId !== null) {
      this.adminService.updateMetier({ id: this.editingId, ...payload }).subscribe(() => {
        this.cancelEdit();
        this.loadData();
      });
    } else {
      this.adminService.insertMetier(payload).subscribe(() => {
        this.cancelEdit();
        this.loadData();
      });
    }
  }

  onDelete(metier: Metier): void {
    // Filet de sécurité : le bouton est déjà désactivé quand isUsed() est vrai (voir template).
    if (this.isUsed(metier.id)) return;
    if (this.editingId === metier.id) this.cancelEdit();
    this.adminService.deleteMetier(metier.id).subscribe(() => this.loadData());
  }
}
