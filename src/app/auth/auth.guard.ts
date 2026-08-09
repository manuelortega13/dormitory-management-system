import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AuthService, User } from './auth.service';
import { SettingsService } from '../services/settings.service';

// Roles that keep full access while maintenance mode is ON (so they can turn it off).
// Only the admin controls maintenance mode, so only the admin bypasses it.
const MAINTENANCE_BYPASS_ROLES: User['role'][] = ['admin'];

// When maintenance mode is ON, redirect everyone except bypass roles to /maintenance.
// Applied AFTER the role guards on each protected route group.
export const maintenanceGuard: CanActivateFn = async () => {
  const settingsService = inject(SettingsService);
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) return true;

  const on = await settingsService.checkMaintenance();
  if (!on) return true;

  const role = authService.getCurrentUser()?.role;
  if (role && MAINTENANCE_BYPASS_ROLES.includes(role)) return true;

  router.navigate(['/maintenance']);
  return false;
};

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

// Allows entry into the /manage layout. Business Officer is admitted here but is
// restricted to the Payments and Settings children via per-route guards below.
export const manageGuard: CanActivateFn = roleGuard([
  'admin',
  'home_dean',
  'vpsas',
  'business_officer',
]);
// Reports renders a different view per role, so every /manage role is admitted and the
// page itself decides which report to show.
export const reportsGuard: CanActivateFn = roleGuard([
  'admin',
  'home_dean',
  'vpsas',
  'business_officer',
]);
// Payments is limited to admin + business_officer (home_dean/vpsas are blocked).
export const paymentsGuard: CanActivateFn = roleGuard(['admin', 'business_officer']);
// Settings page is reachable by admins and business_officer (BO only sees Payment Settings).
export const settingsGuard: CanActivateFn = roleGuard([
  'admin',
  'home_dean',
  'vpsas',
  'business_officer',
]);
