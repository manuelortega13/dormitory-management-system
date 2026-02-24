import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification-prompt',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (showPrompt()) {
      <div class="notification-prompt">
        <div class="prompt-content">
          <div class="prompt-icon">
            <i class="bi bi-bell"></i>
          </div>
          <div class="prompt-text">
            <h4>Enable Notifications</h4>
            <p>Get notified when your leave requests are approved or when your child leaves campus.</p>
          </div>
          <div class="prompt-actions">
            <button class="btn-enable" (click)="enableNotifications()">
              <i class="bi bi-check2"></i> Enable
            </button>
            <button class="btn-dismiss" (click)="dismiss()">
              Not now
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .notification-prompt {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      max-width: 480px;
      width: calc(100% - 2rem);
      animation: slideUp 0.3s ease-out;
    }

    .prompt-content {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 1rem;
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
      color: white;
    }

    .prompt-icon {
      width: 3rem;
      height: 3rem;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      i {
        font-size: 1.5rem;
      }
    }

    .prompt-text {
      flex: 1;
      min-width: 0;

      h4 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
        font-weight: 600;
      }

      p {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.9;
        line-height: 1.4;
      }
    }

    .prompt-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .btn-enable {
      background: white;
      color: #667eea;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      transition: transform 0.2s;

      &:hover {
        transform: scale(1.05);
      }
    }

    .btn-dismiss {
      background: transparent;
      color: rgba(255, 255, 255, 0.8);
      border: none;
      padding: 0.25rem;
      font-size: 0.8rem;
      cursor: pointer;

      &:hover {
        color: white;
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(100%);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    @media (max-width: 576px) {
      .prompt-content {
        flex-direction: column;
        text-align: center;
      }

      .prompt-actions {
        flex-direction: row;
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class NotificationPromptComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);
  
  showPrompt = signal(false);
  
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    
    // Check if we should show the prompt
    setTimeout(() => this.checkShouldShowPrompt(), 2000);
  }

  private checkShouldShowPrompt(): void {
    // Don't show if notifications aren't supported
    if (!('Notification' in window)) return;
    
    // Don't show if already granted or denied
    if (Notification.permission !== 'default') return;
    
    // Don't show if user dismissed it recently (check localStorage)
    const dismissed = localStorage.getItem('notification_prompt_dismissed');
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const hoursSince = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) return; // Don't show for 24 hours after dismissal
    }

    this.showPrompt.set(true);
  }

  async enableNotifications(): Promise<void> {
    const permission = await this.notificationService.requestBrowserNotificationPermission();
    
    if (permission === 'granted') {
      // Show a test notification
      new Notification('Notifications Enabled!', {
        body: 'You will now receive notifications for important updates.',
        icon: '/icons/icon.svg'
      });
    }
    
    this.showPrompt.set(false);
  }

  dismiss(): void {
    localStorage.setItem('notification_prompt_dismissed', new Date().toISOString());
    this.showPrompt.set(false);
  }
}
