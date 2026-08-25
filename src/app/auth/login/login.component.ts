import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';
import { NotificationService } from '../../services/notification.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private http = inject(HttpClient);

  email = signal('');
  password = signal('');
  isLoading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);
  logoUrl = signal<string | null>(null);
  systemName = signal('PAC DMS');

  // "Add to home screen" help, shown as a bottom sheet: someone who does not know the app can
  // be installed will never go looking for instructions, but a modal would stand between them
  // and signing in. Phones only, hidden once installed, and gone for good once closed.
  showInstallSheet = signal(false);
  installTab = signal<'android' | 'iphone'>('android');
  private readonly installDismissedKey = 'pwaInstallHelpDismissed';

  private platformId = inject(PLATFORM_ID);

  constructor() {
    // If already logged in, redirect
    if (this.authService.isLoggedIn()) {
      this.authService.redirectBasedOnRole();
    }

    if (isPlatformBrowser(this.platformId)) {
      const ua = navigator.userAgent;
      const isIos = /iPad|iPhone|iPod/.test(ua);
      // Show the steps that match the phone in the reader's hand.
      if (isIos) {
        this.installTab.set('iphone');
      }

      const installed =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;

      this.showInstallSheet.set(
        (isIos || /Android/.test(ua)) && !installed && !this.installHelpDismissed()
      );
    }
  }

  /** Closing it sticks, so the sheet is never in the way twice. */
  dismissInstallSheet(): void {
    this.showInstallSheet.set(false);
    try {
      localStorage.setItem(this.installDismissedKey, '1');
    } catch {
      // Private browsing can refuse storage; the sheet simply returns next visit.
    }
  }

  private installHelpDismissed(): boolean {
    try {
      return localStorage.getItem(this.installDismissedKey) === '1';
    } catch {
      return false;
    }
  }

  ngOnInit() {
    this.http.get<{ logo: string; name: string }>(`${environment.apiUrl}/settings/public/branding`).subscribe({
      next: (res) => {
        if (res.logo) this.logoUrl.set(res.logo);
        if (res.name) this.systemName.set(res.name);
      }
    });
  }

  async onSubmit() {
    const email = this.email().trim();
    const password = this.password();

    if (!email || !password) {
      this.errorMessage.set('Please enter both email and password');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const response = await this.authService.login(email, password);
      
      // Initialize Socket.IO for real-time notifications
      // Polling will start automatically as fallback if socket disconnects
      this.notificationService.initSocket();
      
      const redirectUrl = this.authService.getRedirectUrl(response.user.role);
      this.router.navigate([redirectUrl]);
    } catch (error: any) {
      if (error.status === 401) {
        this.errorMessage.set('Invalid email or password');
      } else if (error.status === 403) {
        // Parent registration pending or declined
        this.errorMessage.set(error.error?.error || 'Account access restricted. Please contact support.');
      } else {
        this.errorMessage.set(error.error?.error || 'Login failed. Please try again.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }
}
