import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Notification, NotificationResponse, UnreadCountResponse } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = `${environment.apiUrl}/notifications`;

  // Signals for reactive state
  notifications = signal<Notification[]>([]);
  unreadCount = signal<number>(0);
  loading = signal<boolean>(false);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
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

  // Start polling for notifications (every 30 seconds)
  startPolling(): void {
    if (!this.isBrowser || this.pollingInterval) return;
    
    // Initial fetch
    this.fetchUnreadCount();
    
    // Poll every 30 seconds
    this.pollingInterval = setInterval(() => {
      this.fetchUnreadCount();
    }, 30000);
  }

  // Stop polling
  stopPolling(): void {
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
