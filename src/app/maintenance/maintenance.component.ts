import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsService } from '../services/settings.service';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [],
  template: `
    <div class="maintenance-page">
      <div class="maintenance-card">
        @if (settingsService.systemLogo()) {
          <img
            class="logo"
            [src]="settingsService.systemLogo()!"
            [alt]="settingsService.systemName()"
          />
        } @else {
          <div class="logo-icon">🏠</div>
        }

        <div class="wrench">🔧</div>
        <h1>Under Maintenance</h1>
        <p class="lead">
          {{ settingsService.systemName() }} is temporarily unavailable while we perform scheduled
          maintenance. We'll be back shortly — thanks for your patience.
        </p>

        <button class="retry-btn" (click)="retry()" [disabled]="checking()">
          {{ checking() ? 'Checking…' : 'Try Again' }}
        </button>

        @if (stillDown()) {
          <p class="still-down">Still under maintenance. Please check back in a little while.</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .maintenance-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      }
      .maintenance-card {
        background: #fff;
        border-radius: 16px;
        padding: 2.5rem 2rem;
        max-width: 420px;
        width: 100%;
        text-align: center;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
      }
      .logo {
        height: 56px;
        width: auto;
        margin: 0 auto 0.5rem;
        display: block;
        border-radius: 8px;
      }
      .logo-icon {
        font-size: 2.5rem;
        margin-bottom: 0.25rem;
      }
      .wrench {
        font-size: 3.5rem;
        margin: 0.5rem 0 0.75rem;
      }
      h1 {
        margin: 0 0 0.75rem;
        font-size: 1.5rem;
        color: #1a1a2e;
      }
      .lead {
        margin: 0 0 1.5rem;
        color: #6c757d;
        font-size: 0.95rem;
        line-height: 1.55;
      }
      .retry-btn {
        background: linear-gradient(90deg, #4a90d9 0%, #667eea 100%);
        color: #fff;
        border: none;
        padding: 0.75rem 1.75rem;
        border-radius: 10px;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .retry-btn:hover:not(:disabled) {
        opacity: 0.9;
      }
      .retry-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .still-down {
        margin: 1rem 0 0;
        color: #e03131;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class MaintenanceComponent {
  protected settingsService = inject(SettingsService);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected readonly checking = signal(false);
  protected readonly stillDown = signal(false);

  async retry(): Promise<void> {
    this.checking.set(true);
    this.stillDown.set(false);
    try {
      const stillOn = await this.settingsService.checkMaintenance();
      if (!stillOn) {
        // Maintenance lifted — send the user back to where they belong
        if (this.auth.isLoggedIn()) {
          this.auth.redirectBasedOnRole();
        } else {
          this.router.navigate(['/login']);
        }
      } else {
        this.stillDown.set(true);
      }
    } finally {
      this.checking.set(false);
    }
  }
}
