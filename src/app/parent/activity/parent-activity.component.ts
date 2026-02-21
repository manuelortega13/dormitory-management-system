import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParentService, ChildActivityLog } from '../data/parent.service';

@Component({
  selector: 'app-parent-activity',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parent-activity.component.html',
  styleUrl: './parent-activity.component.scss'
})
export class ParentActivityComponent implements OnInit {
  private parentService = inject(ParentService);

  activities = signal<ChildActivityLog[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  ngOnInit() {
    this.loadActivities();
  }

  async loadActivities() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const data = await this.parentService.getChildrenActivityLogs();
      this.activities.set(data);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to load activities');
    } finally {
      this.isLoading.set(false);
    }
  }

  getActivityIcon(type: string): string {
    return type === 'check-out' ? '🚪' : '🏠';
  }

  getActivityLabel(type: string): string {
    return type === 'check-out' ? 'Left Campus' : 'Returned to Campus';
  }

  getLeaveTypeLabel(type: string): string {
    const types: Record<string, string> = {
      'errand': 'Errand',
      'overnight': 'Overnight',
      'weekend': 'Weekend',
      'emergency': 'Emergency',
      'other': 'Other'
    };
    return types[type] || type || 'Leave';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return this.formatDate(dateStr);
  }
}
