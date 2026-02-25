import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AuthService, User } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // On server-side, allow navigation (client will handle auth)
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  if (authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

// Role-based guard factory
export const roleGuard = (allowedRoles: User['role'][]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const platformId = inject(PLATFORM_ID);

    // On server-side, allow navigation (client will handle auth)
    if (!isPlatformBrowser(platformId)) {
      return true;
    }

    if (!authService.isLoggedIn()) {
      router.navigate(['/login']);
      return false;
    }

    const user = authService.getCurrentUser();
    if (user && allowedRoles.includes(user.role)) {
      return true;
    }

    // Redirect to appropriate dashboard based on role
    authService.redirectBasedOnRole();
    return false;
  };
};

// Pre-configured role guards
export const adminGuard: CanActivateFn = roleGuard(['admin', 'home_dean', 'vpsas']);
export const residentGuard: CanActivateFn = roleGuard(['resident']);
export const securityGuard: CanActivateFn = roleGuard(['security_guard']);
export const parentGuard: CanActivateFn = roleGuard(['parent']);
