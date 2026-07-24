import { Injectable, inject, ApplicationRef } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { Router, NavigationStart } from '@angular/router';
import { concat, interval } from 'rxjs';
import { filter, first } from 'rxjs/operators';
import { ToastService } from './toast.service';

/**
 * Keeps the PWA up to date so users automatically move to the latest build
 * (e.g. after the API URL changes) without needing to manually clear caches.
 *
 * Strategy: when a new version has been downloaded, we don't reload immediately —
 * that could interrupt the user mid-action. Instead we wait for their next route
 * change and apply the update then, doing a full navigation to the target URL so
 * the page loads fresh on the new version. Until that happens, ngsw keeps serving
 * the current version's assets to the running tab, so the old app stays consistent.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private updateReady = false;

  // Short delay so the "updating" toast is visible before the page reloads.
  private static readonly RELOAD_DELAY_MS = 1200;

  init(): void {
    // Disabled in dev and on the server (SSR) — safe no-op there.
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // Flag when a new version has finished downloading (don't reload yet).
    this.swUpdate.versionUpdates
      .pipe(filter((event) => event.type === 'VERSION_READY'))
      .subscribe(() => (this.updateReady = true));

    // Apply the pending update on the user's next navigation.
    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe((event) => {
        if (this.updateReady) {
          this.updateReady = false;
          // Let the user know, then activate the downloaded version and do a full
          // load of the target route so it comes up on the new build.
          this.toast.info('Updating', 'Loading the latest version…');
          this.swUpdate.activateUpdate().finally(() => {
            setTimeout(() => {
              document.location.href = event.url;
            }, AppUpdateService.RELOAD_DELAY_MS);
          });
        }
      });

    // If the cached app ends up in an unrecoverable state, reload to recover.
    this.swUpdate.unrecoverable.subscribe(() => document.location.reload());

    // Proactively look for new versions: once the app is stable, then hourly,
    // and whenever the tab becomes visible again (covers users who leave it open).
    const appIsStable$ = this.appRef.isStable.pipe(first((isStable) => isStable === true));
    const everyHour$ = interval(60 * 60 * 1000);
    concat(appIsStable$, everyHour$).subscribe(() => {
      this.swUpdate.checkForUpdate().catch(() => {});
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.swUpdate.checkForUpdate().catch(() => {});
      }
    });
  }
}
