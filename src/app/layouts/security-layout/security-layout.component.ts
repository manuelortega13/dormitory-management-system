import { Component, signal, inject } from '@angular/core';
// RouterLink/RouterLinkActive go back in the import and the imports array below when the
// guard navigation is restored; the compiler warns about them while every link is
// commented out of the template.
import { RouterOutlet /*, RouterLink, RouterLinkActive*/ } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { NotificationDropdownComponent } from '../../shared/notification-dropdown/notification-dropdown.component';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-security-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, /*RouterLink, RouterLinkActive,*/ NotificationDropdownComponent],
  templateUrl: './security-layout.component.html',
  styleUrl: './security-layout.component.scss'
})
export class SecurityLayoutComponent {
  private readonly authService = inject(AuthService);
  protected readonly settingsService = inject(SettingsService);
  protected readonly isSidebarOpen = signal(false);

  toggleSidebar() {
    this.isSidebarOpen.update(open => !open);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  logout() {
    this.authService.logout();
  }
}
