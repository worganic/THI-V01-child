const { test, expect } = require('@playwright/test');

test.describe('Frankenstein Child - Authentication Flows', () => {

  test.beforeEach(async ({ page }) => {
    // Naviguer vers la page d'accueil avant chaque test et nettoyer le localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  // ==========================================
  // CAS PASSANTS (HAPPY PATHS)
  // ==========================================

  test('1.3. Bascule et fermeture des modals', async ({ page }) => {
    // Ouvrir le modal de connexion
    await page.click('.btn-login');
    await expect(page.locator('.modal-box')).toBeVisible();
    await expect(page.locator('.modal-title')).toHaveText('Connexion');

    // Basculer vers l'inscription
    await page.click('.modal-box button.link-btn:has-text("Créer un compte")');
    await expect(page.locator('.modal-title')).toHaveText('Créer un compte');

    // Rebasculer vers la connexion
    await page.click('.modal-box button.link-btn:has-text("Se connecter")');
    await expect(page.locator('.modal-title')).toHaveText('Connexion');

    // Fermer le modal
    await page.click('.modal-box button.modal-close');
    await expect(page.locator('.modal-box')).not.toBeVisible();
  });

  test('1.1. Connexion réussie avec le compte administrateur existant', async ({ page }) => {
    // Ouvrir le modal de connexion
    await page.click('.btn-login');
    await expect(page.locator('.modal-box')).toBeVisible();

    // Remplir les identifiants admin connus (admin / admin@admin.com)
    await page.fill('#login-email', 'admin@admin.com');
    await page.fill('#login-password', 'admin');

    // Soumettre le formulaire
    await page.click('.modal-box button[type="submit"].btn-submit');

    // Vérifier la redirection vers l'app projets (port 4203)
    await expect(page).toHaveURL(/localhost:4203/);

    // Attendre que l'application traite les paramètres d'URL et enregistre le token
    await page.waitForFunction(() => localStorage.getItem('frankenstein_token') !== null, [], { timeout: 10000 });

    // Vérifier la présence du token d'authentification
    const token = await page.evaluate(() => localStorage.getItem('frankenstein_token'));
    expect(token).not.toBeNull();
    expect(token.length).toBeGreaterThan(10);
  });

  test('1.2. Création de compte puis connexion automatique réussie', async ({ page }) => {
    const timestamp = Date.now();
    const testUsername = `user_${timestamp}`;
    const testEmail = `test_${timestamp}@worganic.com`;
    const testPassword = 'Password123!';

    // Ouvrir le modal d'inscription
    await page.click('.btn-register');
    await expect(page.locator('.modal-box')).toBeVisible();
    await expect(page.locator('.modal-title')).toHaveText('Créer un compte');

    // Remplir le formulaire d'inscription
    await page.fill('#reg-username', testUsername);
    await page.fill('#reg-email', testEmail);
    await page.fill('#reg-password', testPassword);
    await page.fill('#reg-password2', testPassword);

    // Soumettre l'inscription
    await page.click('.modal-box button[type="submit"].btn-submit.btn-green');

    // L'inscription devrait connecter l'utilisateur et le rediriger vers l'app projets (port 4203)
    await expect(page).toHaveURL(/localhost:4203/);

    // Attendre que l'application traite les paramètres d'URL et enregistre le token
    await page.waitForFunction(() => localStorage.getItem('frankenstein_token') !== null, [], { timeout: 10000 });

    // Vérifier le token
    const token = await page.evaluate(() => localStorage.getItem('frankenstein_token'));
    expect(token).not.toBeNull();
  });

  // ==========================================
  // CAS NON PASSANTS (NEGATIVE CASES)
  // ==========================================

  test('2.1. Connexion avec mot de passe incorrect', async ({ page }) => {
    await page.click('.btn-login');
    
    await page.fill('#login-email', 'admin@admin.com');
    await page.fill('#login-password', 'mauvais_mot_de_passe');
    await page.click('.modal-box button[type="submit"].btn-submit');

    // Attendre l'affichage de l'erreur
    const errorBanner = page.locator('.modal-box .modal-error');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/Email ou mot de passe incorrect/i);

    // Le token ne doit pas exister
    const token = await page.evaluate(() => localStorage.getItem('frankenstein_token'));
    expect(token).toBeNull();
  });

  test('2.2. Inscription avec mot de passe trop court', async ({ page }) => {
    await page.click('.btn-register');
    
    await page.fill('#reg-username', 'shortpwduser');
    await page.fill('#reg-email', `short_${Date.now()}@test.com`);
    await page.fill('#reg-password', '12345'); // < 6 caractères
    await page.fill('#reg-password2', '12345');

    // Soumettre l'inscription
    await page.click('.modal-box button[type="submit"].btn-submit.btn-green');

    // Attendre et vérifier le message d'erreur
    const errorBanner = page.locator('.modal-box .modal-error');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/au moins 6 caractères/i);

    // Pas de token et pas de redirection
    const token = await page.evaluate(() => localStorage.getItem('frankenstein_token'));
    expect(token).toBeNull();
    await expect(page).not.toHaveURL(/\/home/);
  });

  test('2.3. Inscription avec mots de passe non identiques', async ({ page }) => {
    await page.click('.btn-register');
    
    await page.fill('#reg-username', 'diffpwduser');
    await page.fill('#reg-email', `diff_${Date.now()}@test.com`);
    await page.fill('#reg-password', 'password123');
    await page.fill('#reg-password2', 'differentpassword'); // Ne correspond pas

    // Si l'application utilise une validation Angular native réactive,
    // le bouton submit de création peut être désactivé ou renvoyer une erreur.
    // Vérifions si le bouton submit est désactivé
    const submitBtn = page.locator('.modal-box button[type="submit"].btn-submit.btn-green');
    const isBtnDisabled = await submitBtn.isDisabled();

    if (isBtnDisabled) {
      // Cas passant pour le test de validation du formulaire si le bouton est désactivé
      expect(isBtnDisabled).toBe(true);
    } else {
      // Si le bouton est actif mais que la soumission génère une erreur
      await submitBtn.click();
      const errorBanner = page.locator('.modal-box .modal-error');
      // On s'attend à un message d'erreur si la validation côté client/serveur est faite
      await expect(errorBanner).toBeVisible();
      // On vérifie qu'on n'a pas été redirigé
      await expect(page).not.toHaveURL(/\/home/);
    }
  });

  test('2.4. Inscription avec un email déjà utilisé', async ({ page }) => {
    await page.click('.btn-register');
    
    // Utiliser l'email déjà existant "admin@admin.com"
    await page.fill('#reg-username', `newadmin_${Date.now()}`);
    await page.fill('#reg-email', 'admin@admin.com');
    await page.fill('#reg-password', 'password123');
    await page.fill('#reg-password2', 'password123');

    await page.click('.modal-box button[type="submit"].btn-submit.btn-green');

    // Vérifier l'apparition de l'erreur d'email utilisé
    const errorBanner = page.locator('.modal-box .modal-error');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/email/i);

    // Pas de redirection
    await expect(page).not.toHaveURL(/\/home/);
  });
});
