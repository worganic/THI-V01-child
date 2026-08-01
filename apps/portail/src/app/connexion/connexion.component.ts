import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@portail/core-data-access';

/**
 * Écran de connexion de CE portail.
 *
 * Même chemin, même sélecteur, même gabarit et même feuille de style que dans
 * l'autre monorepo — seul l'échange d'identifiants diffère, et c'est
 * précisément la partie « connexion à la base » que les deux portails ne
 * peuvent pas partager : ici un couple e-mail/mot de passe contre un jeton
 * Bearer, là-bas un matricule vérifié auprès de l'annuaire d'entreprise.
 *
 * Le formulaire garde le nom de champ `matricule` pour que le gabarit reste
 * identique des deux côtés ; il porte ici l'adresse e-mail du compte.
 */
@Component({
  selector: 'app-connexion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './connexion.component.html',
  styleUrls: ['./connexion.component.scss']
})
export class ConnexionComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  autorise = true;
  ipAddress = '';

  errorMessage = '';
  successMessage = '';
  isLoading = false;

  ngOnInit(): void {
    this.form = this.fb.group({
      matricule: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  login(): void {
    if (this.form.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { matricule, password } = this.form.value;

    this.auth.login(String(matricule).trim(), password)
      .then(() => {
        this.router.navigate(['/home']);
      })
      .catch((err) => {
        console.error('Erreur de connexion', err);
        this.errorMessage = err?.error?.message || 'Identifiants invalides.';
      })
      .finally(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }
}
