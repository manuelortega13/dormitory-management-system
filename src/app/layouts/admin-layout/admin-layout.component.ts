import { Component, signal, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { NotificationDropdownComponent } from '../../shared/notification-dropdown/notification-dropdown.component';
import { AuthService, User } from '../../auth/auth.service';
import { SettingsService } from '../../services/settings.service';

interface MoreItem {
  label: string;
  icon: string;
  route: string;
  roles?: User['role'][];
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SidebarComponent,
    CommonModule,
    NotificationDropdownComponent,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);
  protected readonly settingsService = inject(SettingsService);
  protected readonly showMobileMore = signal(false);

  // Secondary nav shown in the floating "More" sheet (items not in the bottom tab bar).
  private readonly adminRoles: User['role'][] = ['admin', 'home_dean', 'vpsas'];
  private readonly allMoreItems: MoreItem[] = [
    { label: 'Rooms', icon: '🛏️', route: '/manage/rooms', roles: this.adminRoles },
    { label: 'Staff', icon: '👮', route: '/manage/agents', roles: this.adminRoles },
    { label: 'Gatepass', icon: '🎫', route: '/manage/gatepass', roles: this.adminRoles },
    {
      label: 'Parent Approvals',
      icon: '👨‍👩‍👦',
      route: '/manage/parent-registrations',
      roles: this.adminRoles,
    },
    {
      label: 'Payments',
      icon: '💰',
      route: '/manage/payments',
      roles: ['admin', 'business_officer'],
    },
    { label: 'Announcements', icon: '📢', route: '/manage/announcements', roles: this.adminRoles },
    {
      label: 'Settings',
      icon: '⚙️',
      route: '/manage/settings',
      roles: ['admin', 'home_dean', 'vpsas', 'business_officer'],
    },
  ];
  protected readonly moreItems = computed(() => {
    const role = this.authService.getCurrentUser()?.role;
    return this.allMoreItems.filter((item) => !item.roles || (!!role && item.roles.includes(role)));
  });

  toggleMobileMore(): void {
    this.showMobileMore.update((v) => !v);
  }

  closeMobileMore(): void {
    this.showMobileMore.set(false);
  }

  logout(): void {
    this.authService.logout();
  }
}
