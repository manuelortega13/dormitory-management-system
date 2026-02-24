import { Injectable, inject, signal, PLATFORM_ID, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AppNotification, NotificationResponse, UnreadCountResponse } from '../models/notification.model';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private toastService = inject(ToastService);
  private apiUrl = `${environment.apiUrl}/notifications`;
  private socket: Socket | null = null;

  notifications = signal<AppNotification[]>([]);
  unreadCount = signal<number>(0);
  loading = signal<boolean>(false);
  connected = signal<boolean>(false);
  browserNotificationPermission = signal<NotificationPermission>('default');
  
  // Signal to notify components when new leave request arrives (for admin)
  // Increments each time a new leave_request_new notification is detected
  newLeaveRequestTrigger = signal<number>(0);
  
  // Signal to notify components when leave request status changes (for resident)
  // Increments when leave_request_approved or leave_request_declined notification is detected
  requestStatusUpdateTrigger = signal<number>(0);
  
  // Signal to notify parent dashboard when child's request needs approval
  // Increments when parent_approval_needed notification is detected
  parentApprovalNeededTrigger = signal<number>(0);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private lastNotificationIds = new Set<number>();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    // Check browser notification permission on init
    if (this.isBrowser && 'Notification' in window) {
      this.browserNotificationPermission.set(Notification.permission);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.disconnectSocket();
  }

  /**
   * Request browser notification permission
   */
  async requestBrowserNotificationPermission(): Promise<NotificationPermission> {
    if (!this.isBrowser || !('Notification' in window)) {
      console.warn('Browser notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      this.browserNotificationPermission.set('granted');
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.browserNotificationPermission.set(permission);
      return permission;
    }

    return Notification.permission;
  }

  /**
   * Show browser notification (for PWA/background)
   */
  private showBrowserNotification(notification: AppNotification): void {
    if (!this.isBrowser || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // Don't show browser notification if page is visible/focused
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      return;
    }

    const options: NotificationOptions = {
      body: notification.message,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag: `notification-${notification.id}`,
      data: {
        notificationId: notification.id,
        referenceId: notification.reference_id,
        referenceType: notification.reference_type
      }
    };

    const browserNotif = new Notification(notification.title, options);

    browserNotif.onclick = () => {
      window.focus();
      browserNotif.close();
      // Navigate based on notification type if needed
    };

    // Auto-close after 10 seconds
    setTimeout(() => browserNotif.close(), 10000);
  }

  /**
   * Show in-app toast notification
   */
  private showToastNotification(notification: AppNotification): void {
    this.toastService.notification(
      notification.title,
      notification.message,
      notification.type
    );
  }

  /**
   * Initialize Socket.IO connection for real-time notifications
   */
  initSocket(): void {
    if (!this.isBrowser) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('[Socket] No auth token available');
      return;
    }

    // Disconnect existing socket if any
    this.disconnectSocket();

    // Connect directly to socket server (bypasses Vite proxy in dev)
    const serverUrl = environment.socketUrl || environment.apiUrl.replace('/api', '');
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected');
      this.connected.set(true);
      // Stop polling when socket is connected
      this.stopPolling();
      // Fetch initial data
      this.fetchUnreadCount();
      this.fetchNotifications();
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      this.connected.set(false);
      // Start polling as fallback when socket disconnects
      this.startPolling();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      this.connected.set(false);
      // Start polling as fallback on connection error
      if (!this.pollingInterval) {
        this.startPolling();
      }
    });

    // Listen for real-time notifications
    this.socket.on('notification', (notification: AppNotification) => {
      console.log('📬 Real-time notification received:', notification);
      this.handleNewNotification(notification);
    });
  }

  /**
   * Handle incoming real-time notification
   */
  private handleNewNotification(notification: AppNotification): void {
    // Add to notifications list
    this.notifications.update(notifs => [notification, ...notifs]);
    
    // Update unread count
    if (!notification.is_read) {
      this.unreadCount.update(count => count + 1);
    }
    
    // Track notification ID
    this.lastNotificationIds.add(notification.id);
    
    // Show in-app toast notification
    this.showToastNotification(notification);
    
    // Show browser notification (for background/PWA)
    this.showBrowserNotification(notification);
    
    // Trigger appropriate component updates based on notification type
    if (notification.type === 'leave_request_new' || notification.type === 'leave_request_cancelled') {
      this.newLeaveRequestTrigger.update(v => v + 1);
    }
    if (notification.type === 'leave_request_approved' || 
        notification.type === 'leave_request_declined' ||
        notification.type === 'leave_request_admin_approved') {
      this.requestStatusUpdateTrigger.update(v => v + 1);
    }
    if (notification.type === 'parent_approval_needed') {
      this.parentApprovalNeededTrigger.update(v => v + 1);
    }
  }

  /**
   * Disconnect Socket.IO connection
   */
  disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected.set(false);
    }
  }

  async fetchNotifications(): Promise<void> {
    if (!this.isBrowser) return;
    
    try {
      this.loading.set(true);
      const response = await firstValueFrom(
        this.http.get<NotificationResponse>(this.apiUrl)
      );
      const newNotifications = response.data || [];
      
      // Only check for new notifications if we've already loaded before (not initial load)
      const isInitialLoad = this.lastNotificationIds.size === 0;
      
      // Check for new notifications by type
      let hasNewLeaveRequest = false;
      let hasStatusUpdate = false;
      let hasParentApprovalNeeded = false;
      
      for (const notif of newNotifications) {
        if (!isInitialLoad && !this.lastNotificationIds.has(notif.id)) {
          // New leave request or cancelled notification (for admin)
          if (notif.type === 'leave_request_new' || notif.type === 'leave_request_cancelled') {
            hasNewLeaveRequest = true;
          }
          // Request status update notification (for resident)
          if (notif.type === 'leave_request_approved' || 
              notif.type === 'leave_request_declined' ||
              notif.type === 'leave_request_admin_approved') {
            hasStatusUpdate = true;
          }
          // Parent approval needed notification (for parent)
          if (notif.type === 'parent_approval_needed') {
            hasParentApprovalNeeded = true;
          }
        }
        this.lastNotificationIds.add(notif.id);
      }
      
      // Trigger updates for watching components (not on initial load)
      if (hasNewLeaveRequest) {
        this.newLeaveRequestTrigger.update(v => v + 1);
      }
      if (hasStatusUpdate) {
        this.requestStatusUpdateTrigger.update(v => v + 1);
      }
      if (hasParentApprovalNeeded) {
        this.parentApprovalNeededTrigger.update(v => v + 1);
      }
      
      this.notifications.set(newNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchUnreadCount(): Promise<void> {
    if (!this.isBrowser) return;
    
    try {
      const response = await firstValueFrom(
        this.http.get<UnreadCountResponse>(`${this.apiUrl}/unread-count`)
      );
      this.unreadCount.set(response.count || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }

  startPolling(): void {
    if (!this.isBrowser || this.pollingInterval) return;
    
    this.fetchUnreadCount();
    this.fetchNotifications();
    
    this.pollingInterval = setInterval(() => {
      this.fetchUnreadCount();
      this.fetchNotifications(); // Also fetch notifications to detect new ones
    }, 10000); // Poll every 10 seconds
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async markAsRead(id: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/${id}/read`, {})
      );
      
      this.notifications.update(notifs => 
        notifs.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      this.unreadCount.update(count => Math.max(0, count - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/mark-all-read`, {})
      );
      
      this.notifications.update(notifs => 
        notifs.map(n => ({ ...n, is_read: true }))
      );
      this.unreadCount.set(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }

  async deleteNotification(id: number): Promise<void> {
    try {
      const notification = this.notifications().find(n => n.id === id);
      
      await firstValueFrom(
        this.http.delete(`${this.apiUrl}/${id}`)
      );
      
      this.notifications.update(notifs => notifs.filter(n => n.id !== id));
      if (notification && !notification.is_read) {
        this.unreadCount.update(count => Math.max(0, count - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'leave_request':
      case 'leave_request_new':
        return 'bi-file-text';
      case 'parent_approval_needed':
        return 'bi-exclamation-circle';
      case 'leave_request_approved':
      case 'leave_request_admin_approved':
        return 'bi-check-circle';
      case 'leave_request_declined':
      case 'leave_request_cancelled':
        return 'bi-x-circle';
      case 'child_left_campus':
      case 'child_returned_campus':
        return 'bi-door-open';
      default:
        return 'bi-bell';
    }
  }

  getTimeAgo(date: Date | string | null | undefined): string {
    if (!date) return '';
    
    const now = new Date();
    const notifDate = new Date(date);
    
    if (isNaN(notifDate.getTime())) {
      return '';
    }
    
    const diffMs = now.getTime() - notifDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notifDate.toLocaleDateString();
  }
}
