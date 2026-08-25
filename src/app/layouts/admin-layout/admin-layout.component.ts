import { Component, signal, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { NotificationDropdownComponent } from '../../shared/notification-dropdown/notification-dropdown.component';
import { AuthService, User } from '../../auth/auth.service';
import { SettingsService } from '../../services/settings.service';

interface NavItem {
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

  private readonly adminRoles: User['role'][] = ['admin', 'home_dean', 'vpsas'];

  // Primary nav shown in the bottom tab bar. Role-scoped: the admin roles get the
  // dashboard-centric tabs, while business_officer gets its only two reachable pages
  // (every admin route is blocked by adminGuard and would bounce BO back to Payments).
  private readonly allTabItems: NavItem[] = [
    { label: 'Dashboard', icon: '📊', route: '/manage/dashboard', roles: this.adminRoles },
    { label: 'Occupants', icon: '👥', route: '/manage/residents', roles: this.adminRoles },
    { label: 'Leaves', icon: '📋', route: '/manage/leave-requests', roles: this.adminRoles },
    { label: 'Payments', icon: '💰', route: '/manage/payments', roles: ['business_officer'] },
    { label: 'Settings', icon: '⚙️', route: '/manage/settings', roles: ['business_officer'] },
  ];
  protected readonly tabItems = computed(() => this.filterByRole(this.allTabItems));

  // Secondary nav shown in the floating "More" sheet (items not in the bottom tab bar).
  private readonly allMoreItems: NavItem[] = [
    { label: 'Rooms', icon: '🛏️', route: '/manage/rooms', roles: this.adminRoles },
    { label: 'Staff', icon: '👮', route: '/manage/agents', roles: ['admin', 'vpsas'] },
    { label: 'Gatepass', icon: '🎫', route: '/manage/gatepass', roles: ['admin', 'home_dean'] },
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
    // Every /manage role can reach Reports; the page renders the view for their role.
    {
      label: 'Reports',
      icon: '📈',
      route: '/manage/reports',
      roles: ['admin', 'home_dean', 'vpsas', 'business_officer'],
    },
    { label: 'Announcements', icon: '📢', route: '/manage/announcements', roles: this.adminRoles },
    {
      label: 'Settings',
      icon: '⚙️',
      route: '/manage/settings',
      roles: ['admin', 'home_dean', 'vpsas', 'business_officer'],
    },
  ];
  // Drop anything already promoted to the tab bar so it is not listed twice.
  protected readonly moreItems = computed(() => {
    const tabRoutes = new Set(this.tabItems().map((item) => item.route));
    return this.filterByRole(this.allMoreItems).filter((item) => !tabRoutes.has(item.route));
  });

  // The More tab only earns a slot when the sheet has something in it; logout is
  // always reachable from the mobile header.
  protected readonly showMoreTab = computed(() => this.moreItems().length > 0);

  private filterByRole(items: NavItem[]): NavItem[] {
    const role = this.authService.getCurrentUser()?.role;
    return items.filter((item) => !item.roles || (!!role && item.roles.includes(role)));
  }

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
