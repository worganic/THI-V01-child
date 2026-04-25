import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { DbStatusService } from '../services/db-status.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const db = inject(DbStatusService);

  if (db.status() === 'error') {
    router.navigate(['/']);
    return false;
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  router.navigate(['/']);
  return false;
};
