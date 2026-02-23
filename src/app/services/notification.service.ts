import { Injectable, inject, signal, PLATFORM_ID, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AppNotification, NotificationResponse, UnreadCountResponse } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = `${environment.apiUrl}/notifications`;

  // Signals for reactive state
  notifications = signal<AppNotification[]>([]);
  unreadCount = signal<number>(0);
  loading = signal<boolean>(false);
  connected = signal<boolean>(false);

  private socket: Socket | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Connect to WebSocket for real-time notifications
   */
  connect(): void {
    // Prevent duplicate connections - check if socket exists (connecting or connected)
    if (!this.isBrowser || this.socket) return;

    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No auth token, falling back to polling');
      this.startPolling();
      return;
    }

    // Get WebSocket URL (same as API but without /api path)
    const wsUrl = environment.apiUrl.replace('/api', '');

    this.socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      this.connected.set(true);
      this.reconnectAttempts = 0;
      this.stopPolling(); // Stop polling when WebSocket is connected
      this.fetchUnreadCount(); // Get initial count
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      this.connected.set(false);
      
      // Start polling as fallback if disconnected unexpectedly
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.startPolling();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('Max reconnection attempts reached, falling back to polling');
        this.socket?.disconnect();
        this.startPolling();
      }
    });

    // Listen for real-time notifications
    this.socket.on('notification', (notification: AppNotification) => {
      console.log('📬 Real-time notification received:', notification);
      
      // Check if notification already exists (prevent duplicates)
      const exists = this.notifications().some(n => n.id === notification.id);
      if (!exists) {
        // Add to notifications list at the beginning
        this.notifications.update(notifs => [notification, ...notifs]);
        
        // Increment unread count only if notification is new
        this.unreadCount.update(count => count + 1);
        
        // Show browser notification
        this.showBrowserNotification(notification);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.stopPolling();
    this.connected.set(false);
  }

  /**
   * Show browser notification (if permitted)
   */
  private async showBrowserNotification(notification: AppNotification): Promise<void> {
    if (!this.isBrowser || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico'
      });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico'
        });
      }
    }
  }

  async fetchNotifications(): Promise<void> {
    if (!this.isBrowser) return;
    
    try {
      this.loading.set(true);
      const response = await firstValueFrom(
        this.http.get<NotificationResponse>(this.apiUrl)
      );
      this.notifications.set(response.data || []);
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

  async markAsRead(id: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/${id}/read`, {})
      );
      
      // Update local state
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
      
      // Update local state
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
      
      // Update local state
      this.notifications.update(notifs => notifs.filter(n => n.id !== id));
      if (notification && !notification.is_read) {
        this.unreadCount.update(count => Math.max(0, count - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  // Start polling for notifications (fallback when WebSocket is unavailable)
  private startPolling(): void {
    if (!this.isBrowser || this.pollingInterval) return;
    
    console.log('📡 Starting polling fallback for notifications');
    
    // Initial fetch
    this.fetchUnreadCount();
    
    // Poll every 30 seconds
    this.pollingInterval = setInterval(() => {
      this.fetchUnreadCount();
    }, 30000);
  }

  // Stop polling (internal use)
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Get notification icon based on type
  getNotificationIcon(type: string): string {
    switch (type) {
      case 'leave_request':
        return 'bi-file-text';
      case 'approval_needed':
        return 'bi-exclamation-circle';
      case 'request_status':
        return 'bi-check-circle';
      case 'child_movement':
        return 'bi-door-open';
      default:
        return 'bi-bell';
    }
  }

  // Get time ago string
  getTimeAgo(date: Date | string | null | undefined): string {
    if (!date) return '';
    
    const now = new Date();
    const notifDate = new Date(date);
    
    // Check for invalid date
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
