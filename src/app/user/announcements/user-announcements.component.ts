import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Announcement {
  id: number;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
}

@Component({
  selector: 'app-user-announcements',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-announcements.component.html',
  styleUrl: './user-announcements.component.scss'
})
export class UserAnnouncementsComponent {
  mockAnnouncements: Announcement[] = [
    {
      id: 1,
      title: 'Water Interruption Notice',
      content: 'Scheduled water maintenance on January 18, 2025 from 8AM to 12PM. Please store enough water for your needs.',
      author: 'Maintenance Team',
      createdAt: '2025-01-15',
      priority: 'urgent',
      category: 'Maintenance'
    },
    {
      id: 2,
      title: 'New Quiet Hours Policy',
      content: 'Starting February 1, quiet hours will be strictly enforced from 10PM to 6AM. Violations may result in penalties.',
      author: 'Home Dean',
      createdAt: '2025-01-12',
      priority: 'high',
      category: 'Rules & Policies'
    },
    {
      id: 3,
      title: 'Fire Drill Schedule',
      content: 'A scheduled fire drill will be conducted on January 20 at 10AM. All residents must participate. Assembly point: Main parking area.',
      author: 'Security Office',
      createdAt: '2025-01-14',
      priority: 'high',
      category: 'Safety'
    },
    {
      id: 4,
      title: 'Wi-Fi Upgrade Complete',
      content: 'The dormitory Wi-Fi has been upgraded. New network name: DormHub_5G. Password will be posted in common areas.',
      author: 'IT Department',
      createdAt: '2025-01-10',
      priority: 'normal',
      category: 'Facilities'
    },
    {
      id: 5,
      title: 'Holiday Break Reminder',
      content: 'The admin office will be closed from December 24-26 and December 31-January 1. Emergency contact: 0917-XXX-XXXX.',
      author: 'Admin Office',
      createdAt: '2025-01-08',
      priority: 'normal',
      category: 'General'
    },
    {
      id: 6,
      title: 'Laundry Room Schedule',
      content: 'New laundry room schedule: Mon-Sat 6AM-10PM, Sunday 8AM-8PM. Please follow the booking system.',
      author: 'Admin Office',
      createdAt: '2025-01-05',
      priority: 'low',
      category: 'Facilities'
    }
  ];

  getPriorityClass(priority: string): string {
    return priority;
  }

  getPriorityIcon(priority: string): string {
    const icons: Record<string, string> = {
      urgent: '🚨',
      high: '⚠️',
      normal: '📢',
      low: 'ℹ️'
    };
    return icons[priority] || '📢';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getTimeAgo(date: string): string {
    const now = new Date();
    const past = new Date(date);
    const diffDays = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return this.formatDate(date);
  }
}
