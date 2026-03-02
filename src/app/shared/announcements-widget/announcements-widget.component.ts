import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../services/notification.service';

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  audience: 'all' | 'residents' | 'parents' | 'staff';
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  author_name?: string;
}

@Component({
  selector: 'app-announcements-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcements-widget.component.html',
  styleUrls: ['./announcements-widget.component.scss']
})
export class AnnouncementsWidgetComponent implements OnInit {
  private http = inject(HttpClient);
  private notificationService = inject(NotificationService);

  announcements = signal<Announcement[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  expandedId = signal<number | null>(null);

  urgentAnnouncements = computed(() =>
    this.announcements().filter(a => a.priority === 'urgent')
  );

  regularAnnouncements = computed(() =>
    this.announcements().filter(a => a.priority !== 'urgent')
  );

  constructor() {
    // Watch for new announcement notifications and reload the list
    effect(() => {
      const trigger = this.notificationService.newAnnouncementTrigger();
      if (trigger > 0) {
        this.loadAnnouncements();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.loadAnnouncements();
  }

  loadAnnouncements() {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<{ data: Announcement[] }>(
      `${environment.apiUrl}/announcements/published`
    ).subscribe({
      next: (response) => {
        this.announcements.set(response.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load announcements:', err);
        this.error.set('Failed to load announcements');
        this.loading.set(false);
      }
    });
  }

  toggleExpand(id: number) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  isExpanded(id: number): boolean {
    return this.expandedId() === id;
  }

  getPriorityClass(priority: string): string {
    return `priority-${priority}`;
  }

  getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '⚠️';
      case 'normal': return '📢';
      case 'low': return 'ℹ️';
      default: return '📢';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  truncateContent(content: string, maxLength: number = 150): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  }
}
