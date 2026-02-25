import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { NotificationDropdownComponent } from '../../shared/notification-dropdown/notification-dropdown.component';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, CommonModule, NotificationDropdownComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);
  protected readonly isMobileSidebarOpen = signal(false);

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update(v => !v);
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  handleSidebarClick(event: Event): void {
    // Close sidebar when clicking menu items on mobile
    const target = event.target as HTMLElement;
    if (target.closest('.menu-item') || target.closest('.logout-btn')) {
      if (window.innerWidth <= 768) {
        this.closeMobileSidebar();
      }
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
