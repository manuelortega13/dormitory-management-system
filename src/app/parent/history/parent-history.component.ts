import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParentService } from '../data/parent.service';
import { LeaveRequest } from '../../models/leave-request.model';

@Component({
  selector: 'app-parent-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parent-history.component.html',
  styleUrl: './parent-history.component.scss'
})
export class ParentHistoryComponent implements OnInit {
  private parentService = inject(ParentService);

  requests = signal<LeaveRequest[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  ngOnInit() {
    this.loadHistory();
  }

  async loadHistory() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const data = await this.parentService.getChildRequests();
      this.requests.set(data);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to load history');
    } finally {
      this.isLoading.set(false);
    }
  }

  getLeaveTypeLabel(type: string): string {
    const types: Record<string, string> = {
      'errand': 'Errand',
      'overnight': 'Overnight',
      'weekend': 'Weekend',
      'emergency': 'Emergency',
      'other': 'Other'
    };
    return types[type] || type;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending_dean':
      case 'pending_admin': return 'Pending Home Dean';
      case 'pending_parent': return 'Pending Your Review';
      case 'pending_vpsas': return 'Pending VPSAS';
      case 'approved': return 'Approved';
      case 'active': return 'Currently Out';
      case 'completed': return 'Completed';
      case 'declined': return 'Declined';
      case 'cancelled': return 'Cancelled';
      case 'expired': return 'Expired';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending_dean':
      case 'pending_admin':
      case 'pending_parent':
      case 'pending_vpsas':
        return 'status-pending';
      case 'approved':
        return 'status-approved';
      case 'active':
        return 'status-active';
      case 'completed':
        return 'status-completed';
      case 'declined':
      case 'cancelled':
      case 'expired':
        return 'status-declined';
      default:
        return '';
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    // Parse as UTC and display in user's local timezone
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
