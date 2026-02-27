import { Component, signal, inject, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../auth/auth.service';
import { AdminLeaveRequestService } from '../admin/leave-requests/data/admin-leave-request.service';
import { ParentRegistrationService } from '../admin/parent-registrations/data/parent-registration.service';
import { NotificationService } from '../services/notification.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private leaveRequestService = inject(AdminLeaveRequestService);
  private parentRegistrationService = inject(ParentRegistrationService);
  private notificationService = inject(NotificationService);
  private subscription: Subscription | null = null;
  protected readonly isCollapsed = signal(false);
  protected readonly pendingLeaveRequestsCount = signal(0);
  protected readonly pendingParentRegistrationsCount = signal(0);
  protected readonly currentUser = signal<User | null>(null);

  constructor() {
    // Watch for new leave request notifications
    effect(() => {
      const trigger = this.notificationService.newLeaveRequestTrigger();
      if (trigger > 0) {
        this.loadPendingLeaveRequestsCount();
      }
    });
    
    // Watch for new parent registration notifications
    effect(() => {
      const trigger = this.notificationService.newParentRegistrationTrigger();
      if (trigger > 0) {
        this.loadPendingParentRegistrationsCount();
      }
    });
  }

  protected readonly userDisplayName = computed(() => {
    const user = this.currentUser();
    if (!user) return 'User';
    return `${user.firstName} ${user.lastName}`;
  });

  protected readonly userRoleDisplay = computed(() => {
    const user = this.currentUser();
    if (!user) return '';
    switch (user.role) {
      case 'admin': return 'Administrator';
      case 'home_dean': return 'Home Dean';
      case 'security_guard': return 'Security Guard';
      default: return user.role;
    }
  });

  protected readonly userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return '?';
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  });

  protected readonly menuSections = signal<MenuSection[]>([
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: '📊', route: '/manage/dashboard' }
      ]
    },
    {
      title: 'Management',
      items: [
        { label: 'Rooms', icon: '🛏️', route: '/manage/rooms' },
        { label: 'Residents', icon: '👥', route: '/manage/residents' },
        { label: 'Agents', icon: '👮', route: '/manage/agents' },
        { label: 'Leave Requests', icon: '🚪', route: '/manage/leave-requests' },
        { label: 'Parent Approvals', icon: '👨‍👩‍👦', route: '/manage/parent-registrations' }
      ]
    },
    {
      title: 'Operations',
      items: [
        { label: 'Maintenance', icon: '🔧', route: '/manage/maintenance' },
        { label: 'Payments', icon: '💰', route: '/manage/payments' },
        { label: 'Inventory', icon: '📦', route: '/manage/inventory' }
      ]
    },
    {
      title: 'Reports & Settings',
      items: [
        { label: 'Reports', icon: '📈', route: '/manage/reports' },
        { label: 'Announcements', icon: '📢', route: '/manage/announcements' },
        { label: 'Settings', icon: '⚙️', route: '/manage/settings' }
      ]
    }
  ]);

  private parentRegistrationSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser());
    this.loadPendingLeaveRequestsCount();
    this.loadPendingParentRegistrationsCount();
    
    // Subscribe to leave request updates
    this.subscription = this.leaveRequestService.leaveRequestUpdated$.subscribe(() => {
      this.loadPendingLeaveRequestsCount();
    });
    
    // Subscribe to parent registration updates (approved/declined)
    this.parentRegistrationSubscription = this.parentRegistrationService.registrationUpdated$.subscribe(() => {
      this.loadPendingParentRegistrationsCount();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.parentRegistrationSubscription?.unsubscribe();
  }

  private async loadPendingLeaveRequestsCount(): Promise<void> {
    try {
      const pendingRequests = await this.leaveRequestService.getPendingRequests();
      this.pendingLeaveRequestsCount.set(pendingRequests.length);
      this.updateLeaveRequestsBadge(pendingRequests.length);
    } catch (error) {
      console.error('Failed to load pending leave requests count:', error);
    }
  }

  private updateLeaveRequestsBadge(count: number): void {
    this.menuSections.update(sections => 
      sections.map(section => ({
        ...section,
        items: section.items.map(item => 
          item.label === 'Leave Requests' 
            ? { ...item, badge: count > 0 ? count : undefined }
            : item
        )
      }))
    );
  }

  private loadPendingParentRegistrationsCount(): void {
    this.parentRegistrationService.getPendingCount().subscribe({
      next: (response) => {
        this.pendingParentRegistrationsCount.set(response.count);
        this.updateParentApprovalsBadge(response.count);
      },
      error: (error) => {
        console.error('Failed to load pending parent registrations count:', error);
      }
    });
  }

  private updateParentApprovalsBadge(count: number): void {
    this.menuSections.update(sections => 
      sections.map(section => ({
        ...section,
        items: section.items.map(item => 
          item.label === 'Parent Approvals' 
            ? { ...item, badge: count > 0 ? count : undefined }
            : item
        )
      }))
    );
  }

  toggleSidebar() {
    this.isCollapsed.update(value => !value);
  }

  logout() {
    this.authService.logout();
  }
}
