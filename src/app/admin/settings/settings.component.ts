import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface SettingSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  settings: Setting[];
}

interface Setting {
  id: string;
  label: string;
  description: string;
  type: 'toggle' | 'text' | 'number' | 'select';
  value: any;
  options?: string[];
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  mockSettings: SettingSection[] = [
    {
      id: 'general',
      title: 'General Settings',
      icon: '⚙️',
      description: 'Basic system configuration',
      settings: [
        {
          id: 'dorm_name',
          label: 'Dormitory Name',
          description: 'Name displayed throughout the system',
          type: 'text',
          value: 'University Dormitory'
        },
        {
          id: 'timezone',
          label: 'Timezone',
          description: 'System timezone for all timestamps',
          type: 'select',
          value: 'Asia/Manila',
          options: ['Asia/Manila', 'Asia/Singapore', 'UTC']
        },
        {
          id: 'maintenance_mode',
          label: 'Maintenance Mode',
          description: 'Enable to prevent user access during maintenance',
          type: 'toggle',
          value: false
        }
      ]
    },
    {
      id: 'notifications',
      title: 'Notification Settings',
      icon: '🔔',
      description: 'Configure system notifications',
      settings: [
        {
          id: 'email_notifications',
          label: 'Email Notifications',
          description: 'Send email notifications for important events',
          type: 'toggle',
          value: true
        },
        {
          id: 'sms_notifications',
          label: 'SMS Notifications',
          description: 'Send SMS for urgent notifications',
          type: 'toggle',
          value: false
        },
        {
          id: 'notification_digest',
          label: 'Notification Digest',
          description: 'How often to send notification summaries',
          type: 'select',
          value: 'daily',
          options: ['realtime', 'hourly', 'daily', 'weekly']
        }
      ]
    },
    {
      id: 'security',
      title: 'Security Settings',
      icon: '🔒',
      description: 'Security and access control',
      settings: [
        {
          id: 'session_timeout',
          label: 'Session Timeout (minutes)',
          description: 'Auto logout after inactivity',
          type: 'number',
          value: 30
        },
        {
          id: 'two_factor_auth',
          label: 'Two-Factor Authentication',
          description: 'Require 2FA for admin accounts',
          type: 'toggle',
          value: false
        },
        {
          id: 'password_expiry',
          label: 'Password Expiry (days)',
          description: 'Force password change after days (0 = never)',
          type: 'number',
          value: 90
        }
      ]
    },
    {
      id: 'booking',
      title: 'Booking & Reservations',
      icon: '📅',
      description: 'Configure booking policies',
      settings: [
        {
          id: 'max_booking_days',
          label: 'Max Advance Booking (days)',
          description: 'How far in advance bookings can be made',
          type: 'number',
          value: 30
        },
        {
          id: 'auto_approve_bookings',
          label: 'Auto-approve Bookings',
          description: 'Automatically approve facility bookings',
          type: 'toggle',
          value: false
        },
        {
          id: 'require_deposit',
          label: 'Require Deposit',
          description: 'Require deposit for facility bookings',
          type: 'toggle',
          value: true
        }
      ]
    },
    {
      id: 'payments',
      title: 'Payment Settings',
      icon: '💳',
      description: 'Configure payment options',
      settings: [
        {
          id: 'currency',
          label: 'Currency',
          description: 'Default currency for payments',
          type: 'select',
          value: 'PHP',
          options: ['PHP', 'USD', 'EUR']
        },
        {
          id: 'late_fee_percentage',
          label: 'Late Fee (%)',
          description: 'Percentage charged for late payments',
          type: 'number',
          value: 5
        },
        {
          id: 'grace_period_days',
          label: 'Grace Period (days)',
          description: 'Days after due date before late fees apply',
          type: 'number',
          value: 7
        }
      ]
    }
  ];

  activeSection = signal('general');

  setActiveSection(sectionId: string): void {
    this.activeSection.set(sectionId);
  }

  getActiveSettings(): SettingSection | undefined {
    return this.mockSettings.find(s => s.id === this.activeSection());
  }
}
