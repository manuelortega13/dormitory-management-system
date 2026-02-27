import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Announcement {
  id: number;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  expiresAt: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'draft' | 'published' | 'expired';
  audience: 'all' | 'residents' | 'parents' | 'staff';
}

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss'
})
export class AnnouncementsComponent {
  searchQuery = signal('');

  mockAnnouncements: Announcement[] = [
    {
      id: 1,
      title: 'Holiday Break Schedule',
      content: 'The dormitory will have limited operations during the holiday break from December 20 to January 5. Please ensure you have signed out if leaving the premises.',
      author: 'Admin Office',
      createdAt: '2025-01-10',
      expiresAt: '2025-01-05',
      priority: 'high',
      status: 'published',
      audience: 'all'
    },
    {
      id: 2,
      title: 'Water Interruption Notice',
      content: 'Scheduled water maintenance on January 18, 2025 from 8AM to 12PM. Please store enough water for your needs.',
      author: 'Maintenance Team',
      createdAt: '2025-01-15',
      expiresAt: '2025-01-18',
      priority: 'urgent',
      status: 'published',
      audience: 'residents'
    },
    {
      id: 3,
      title: 'New Quiet Hours Policy',
      content: 'Starting February 1, quiet hours will be strictly enforced from 10PM to 6AM. Violations may result in penalties.',
      author: 'Home Dean',
      createdAt: '2025-01-12',
      expiresAt: null,
      priority: 'normal',
      status: 'published',
      audience: 'residents'
    },
    {
      id: 4,
      title: 'Parent-Teacher Meeting',
      content: 'We invite all parents to attend the quarterly meeting on January 25, 2025 at 2PM in the common area.',
      author: 'Admin Office',
      createdAt: '2025-01-08',
      expiresAt: '2025-01-25',
      priority: 'normal',
      status: 'published',
      audience: 'parents'
    },
    {
      id: 5,
      title: 'Fire Drill Notice',
      content: 'A scheduled fire drill will be conducted on January 20. All residents must participate. Assembly point: Main parking area.',
      author: 'Security Office',
      createdAt: '2025-01-14',
      expiresAt: '2025-01-20',
      priority: 'high',
      status: 'draft',
      audience: 'all'
    },
    {
      id: 6,
      title: 'Wi-Fi Upgrade Complete',
      content: 'The dormitory Wi-Fi has been upgraded. New password will be distributed to all residents.',
      author: 'IT Department',
      createdAt: '2024-12-28',
      expiresAt: '2025-01-05',
      priority: 'low',
      status: 'expired',
      audience: 'residents'
    }
  ];

  stats = {
    total: this.mockAnnouncements.length,
    published: this.mockAnnouncements.filter(a => a.status === 'published').length,
    drafts: this.mockAnnouncements.filter(a => a.status === 'draft').length,
    urgent: this.mockAnnouncements.filter(a => a.priority === 'urgent').length
  };

  getPriorityClass(priority: string): string {
    const classes: Record<string, string> = {
      low: 'low',
      normal: 'normal',
      high: 'high',
      urgent: 'urgent'
    };
    return classes[priority] || 'normal';
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      draft: 'pending',
      published: 'completed',
      expired: 'expired'
    };
    return classes[status] || 'pending';
  }

  getAudienceIcon(audience: string): string {
    const icons: Record<string, string> = {
      all: '👥',
      residents: '🏠',
      parents: '👨‍👩‍👧',
      staff: '👔'
    };
    return icons[audience] || '👥';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
