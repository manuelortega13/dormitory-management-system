import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  icon?: string;
  onClick?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private nextId = 0;
  toasts = signal<Toast[]>([]);

  show(toast: Omit<Toast, 'id'>): number {
    const id = this.nextId++;
    const newToast: Toast = { ...toast, id };
    
    this.toasts.update(toasts => [...toasts, newToast]);

    // Auto-dismiss after duration (default 5 seconds)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  success(title: string, message: string, onClick?: () => void): number {
    return this.show({ type: 'success', title, message, icon: 'bi-check-circle-fill', onClick });
  }

  error(title: string, message: string): number {
    return this.show({ type: 'error', title, message, icon: 'bi-x-circle-fill', duration: 8000 });
  }

  warning(title: string, message: string): number {
    return this.show({ type: 'warning', title, message, icon: 'bi-exclamation-triangle-fill' });
  }

  info(title: string, message: string, onClick?: () => void): number {
    return this.show({ type: 'info', title, message, icon: 'bi-info-circle-fill', onClick });
  }

  /**
   * Show a notification-style toast (for real-time notifications)
   */
  notification(title: string, message: string, type: string, onClick?: () => void): number {
    let icon = 'bi-bell-fill';
    let toastType: Toast['type'] = 'info';

    switch (type) {
      case 'leave_request_approved':
      case 'leave_request_admin_approved':
        icon = 'bi-check-circle-fill';
        toastType = 'success';
        break;
      case 'leave_request_declined':
      case 'leave_request_cancelled':
        icon = 'bi-x-circle-fill';
        toastType = 'warning';
        break;
      case 'leave_request_new':
      case 'parent_approval_needed':
        icon = 'bi-file-earmark-text-fill';
        toastType = 'info';
        break;
      case 'child_left_campus':
        icon = 'bi-door-open-fill';
        toastType = 'warning';
        break;
      case 'child_returned_campus':
        icon = 'bi-house-fill';
        toastType = 'success';
        break;
    }

    return this.show({ type: toastType, title, message, icon, onClick, duration: 6000 });
  }

  dismiss(id: number): void {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  dismissAll(): void {
    this.toasts.set([]);
  }
}
