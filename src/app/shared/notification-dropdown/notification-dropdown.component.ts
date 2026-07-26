import { Component, inject, OnInit, OnDestroy, HostListener, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../auth/auth.service';
import { AppNotification } from '../../models/notification.model';

@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-dropdown.component.html',
  styleUrl: './notification-dropdown.component.scss'
})
export class NotificationDropdownComponent implements OnInit, OnDestroy {
  notificationService = inject(NotificationService);
  private router = inject(Router);
  private authService = inject(AuthService);
  private elementRef = inject(ElementRef);

  isOpen = signal(false);

  ngOnInit(): void {
    // Initialize Socket.IO for real-time notifications
    // Polling will start automatically as fallback if socket disconnects
    this.notificationService.initSocket();
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
    this.notificationService.disconnectSocket();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  toggleDropdown(): void {
    const wasOpen = this.isOpen();
    this.isOpen.set(!wasOpen);
    
    if (!wasOpen) {
      this.notificationService.fetchNotifications();
    }
  }

  handleNotificationClick(notification: AppNotification): void {
    if (!notification.is_read) {
      this.notificationService.markAsRead(notification.id);
    }

    this.isOpen.set(false);

    const user = this.authService.getCurrentUser();
    if (!user) return;

    // Navigate based on notification type and user role
    switch (notification.type) {
      case 'leave_request_new':
        // Admin/Home Dean receives this for new leave requests
        if (user.role === 'admin' || user.role === 'home_dean' || user.role === 'vpsas') {
          this.router.navigate(['/manage/leave-requests']);
        }
        break;

      case 'vpsas_approval_needed':
        // VPSAS receives this when a request needs final approval
        if (user.role === 'vpsas' || user.role === 'admin') {
          this.router.navigate(['/manage/leave-requests']);
        }
        break;

      case 'parent_approval_needed':
        // Parent receives this when child's request needs approval
        if (user.role === 'parent') {
          this.router.navigate(['/parent']);
        }
        break;

      case 'leave_request_approved':
      case 'leave_request_declined':
      case 'leave_request_dean_approved':
      case 'leave_request_parent_approved':
      case 'leave_request_vpsas_approved':
        // Resident receives this when their request is approved/declined
        if (user.role === 'resident') {
          this.router.navigate(['/my-requests']);
        }
        break;

      case 'child_left_campus':
      case 'child_returned_campus':
        // Parent receives this when child has left/returned
        if (user.role === 'parent') {
          this.router.navigate(['/parent/activity']);
        }
        break;

      case 'registration':
        // Admin/Home Dean receives this when a new parent registers
        if (user.role === 'admin' || user.role === 'home_dean') {
          this.router.navigate(['/manage/parent-registrations']);
        }
        break;

      case 'payment':
        if (user.role === 'resident') this.router.navigate(['/my-payments']);
        else if (user.role === 'parent') this.router.navigate(['/parent/payments']);
        else if (user.role === 'admin' || user.role === 'business_officer') this.router.navigate(['/manage/payments']);
        break;

      case 'announcement':
        if (user.role === 'resident') this.router.navigate(['/announcements']);
        else if (user.role === 'admin' || user.role === 'home_dean' || user.role === 'vpsas') {
          this.router.navigate(['/manage/announcements']);
        }
        break;

      case 'gatepass_new':
      case 'gatepass_parent_approved':
      case 'gatepass_dean_approved':
      case 'gatepass_approved':
      case 'gatepass_declined':
      case 'gatepass_exit':
      case 'gatepass_returned':
      case 'gatepass_overdue':
      case 'gatepass_extended':
      case 'gatepass_cancelled':
      case 'gatepass_task_assigned':
        this.navigateForGatepass(notification, user.role);
        break;

      default:
        break;
    }
  }

  /** Gatepass notifications reach different roles, so route by the current user's role. */
  private navigateForGatepass(notification: AppNotification, role: string): void {
    // Occupant's disciplinary task
    if (notification.type === 'gatepass_task_assigned') {
      this.router.navigate(['/my-tasks']);
      return;
    }

    switch (role) {
      case 'admin':
      case 'home_dean':
      case 'vpsas':
        this.router.navigate(['/manage/gatepass']);
        break;
      case 'security_guard':
        this.router.navigate(['/security-guard/check-in-out']);
        break;
      case 'parent':
        // Approval request -> Requests page; movement/updates -> History
        this.router.navigate([notification.type === 'gatepass_new' ? '/parent' : '/parent/history']);
        break;
      case 'resident':
      default:
        // Occupant: open the pass when the QR is ready, otherwise the gatepass list
        if (notification.type === 'gatepass_approved' && notification.reference_id) {
          this.router.navigate(['/gatepass', notification.reference_id]);
        } else {
          this.router.navigate(['/gatepass']);
        }
        break;
    }
  }

  markAllRead(): void {
    this.notificationService.markAllAsRead();
  }

  deleteNotification(event: MouseEvent, id: number): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(id);
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'leave_request_new':
        return '📝';
      case 'parent_approval_needed':
        return '⚠️';
      case 'leave_request_approved':
        return '✅';
      case 'leave_request_declined':
        return '❌';
      case 'child_left_campus':
        return '🚶';
      case 'child_returned_campus':
        return '🏠';
      case 'registration':
        return '👨‍👩‍👦';
      case 'payment':
        return '💳';
      default:
        return '🔔';
    }
  }
}
