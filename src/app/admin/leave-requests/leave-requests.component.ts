import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLeaveRequestService, LeaveRequest } from './data/admin-leave-request.service';
import { NotificationService } from '../../services/notification.service';

type TabFilter = 'pending' | 'all';

@Component({
  selector: 'app-leave-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leave-requests.component.html',
  styleUrl: './leave-requests.component.scss'
})
export class LeaveRequestsComponent implements OnInit {
  private leaveRequestService = inject(AdminLeaveRequestService);
  private notificationService = inject(NotificationService);

  requests = signal<LeaveRequest[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  activeTab = signal<TabFilter>('pending');
  searchQuery = signal('');

  // Modal state
  showActionModal = signal(false);
  selectedRequest = signal<LeaveRequest | null>(null);
  actionType = signal<'approve' | 'decline'>('approve');
  adminNotes = signal('');
  isProcessing = signal(false);

  constructor() {
    // Watch for new leave request notifications and refresh the table
    effect(() => {
      const trigger = this.notificationService.newLeaveRequestTrigger();
      if (trigger > 0) {
        this.loadRequests();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.loadRequests();
  }

  async loadRequests() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      if (this.activeTab() === 'pending') {
        const data = await this.leaveRequestService.getPendingRequests();
        this.requests.set(data);
      } else {
        const data = await this.leaveRequestService.getAllRequests();
        this.requests.set(data);
      }
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to load requests');
    } finally {
      this.isLoading.set(false);
    }
  }

  switchTab(tab: TabFilter) {
    this.activeTab.set(tab);
    this.loadRequests();
  }

  filteredRequests() {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.requests();

    return this.requests().filter(req =>
      req.user_name?.toLowerCase().includes(query) ||
      req.destination?.toLowerCase().includes(query) ||
      req.reason?.toLowerCase().includes(query) ||
      req.room_number?.toLowerCase().includes(query)
    );
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending_admin':
      case 'pending_parent':
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

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending_admin':
        return 'Pending Your Review';
      case 'pending_parent':
        return 'Awaiting Parent';
      case 'approved':
        return 'Fully Approved';
      case 'active':
        return 'Currently Out';
      case 'completed':
        return 'Completed';
      case 'declined':
        return 'Declined';
      case 'cancelled':
        return 'Cancelled';
      case 'expired':
        return 'Expired';
      default:
        return status;
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

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    // Parse as UTC and display in user's local timezone
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  openApproveModal(request: LeaveRequest) {
    this.selectedRequest.set(request);
    this.actionType.set('approve');
    this.adminNotes.set('');
    this.showActionModal.set(true);
  }

  openDeclineModal(request: LeaveRequest) {
    this.selectedRequest.set(request);
    this.actionType.set('decline');
    this.adminNotes.set('');
    this.showActionModal.set(true);
  }

  closeModal() {
    this.showActionModal.set(false);
    this.selectedRequest.set(null);
    this.adminNotes.set('');
  }

  async confirmAction() {
    const request = this.selectedRequest();
    if (!request) return;

    this.isProcessing.set(true);

    try {
      if (this.actionType() === 'approve') {
        await this.leaveRequestService.approve(request.id, this.adminNotes());
      } else {
        await this.leaveRequestService.decline(request.id, this.adminNotes());
      }

      this.closeModal();
      await this.loadRequests();
    } catch (error: any) {
      alert(error.message || 'Failed to process request');
    } finally {
      this.isProcessing.set(false);
    }
  }
}
