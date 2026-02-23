import { Component, inject, OnInit, OnDestroy, HostListener, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../auth/auth.service';
import { Notification } from '../../models/notification.model';

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
    this.notificationService.startPolling();
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
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

  handleNotificationClick(notification: Notification): void {
    if (!notification.is_read) {
      this.notificationService.markAsRead(notification.id);
    }

    this.isOpen.set(false);

    const user = this.authService.getCurrentUser();
    if (!user) return;

    // Navigate based on notification type and user role
    switch (notification.type) {
      case 'leave_request_new':
        // Admin receives this for new leave requests
        if (user.role === 'admin' || user.role === 'dean') {
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

      default:
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
      default:
        return '🔔';
    }
  }
}
