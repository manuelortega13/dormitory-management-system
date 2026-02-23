import { Injectable, inject, signal, PLATFORM_ID, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppNotification, NotificationResponse, UnreadCountResponse } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = `${environment.apiUrl}/notifications`;
  private pushApiUrl = `${environment.apiUrl}/push`;

  notifications = signal<AppNotification[]>([]);
  unreadCount = signal<number>(0);
  loading = signal<boolean>(false);
  pushEnabled = signal<boolean>(false);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async initPushNotifications(): Promise<void> {
    if (!this.isBrowser) return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Push notification permission denied');
        return;
      }

      this.registration = await navigator.serviceWorker.register('/push-sw.js');
      console.log('Service Worker registered for push');

      const response = await firstValueFrom(
        this.http.get<{ publicKey: string }>(`${this.pushApiUrl}/vapid-public-key`)
      );

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(response.publicKey)
      });

      await firstValueFrom(
        this.http.post(`${this.pushApiUrl}/subscribe`, { subscription })
      );

      this.pushEnabled.set(true);
      console.log('Push notifications enabled');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  private urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
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

  startPolling(): void {
    if (!this.isBrowser || this.pollingInterval) return;
    
    this.fetchUnreadCount();
    this.fetchNotifications();
    
    this.pollingInterval = setInterval(() => {
      this.fetchUnreadCount();
    }, 30000);
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
      case 'leave_request_declined':
        return 'bi-check-circle';
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
