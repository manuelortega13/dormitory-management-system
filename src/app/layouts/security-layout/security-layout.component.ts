import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { NotificationDropdownComponent } from '../../shared/notification-dropdown/notification-dropdown.component';

@Component({
  selector: 'app-security-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NotificationDropdownComponent],
  templateUrl: './security-layout.component.html',
  styleUrl: './security-layout.component.scss'
})
export class SecurityLayoutComponent {
  private readonly authService = inject(AuthService);
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
