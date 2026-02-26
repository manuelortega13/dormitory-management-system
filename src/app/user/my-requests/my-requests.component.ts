import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LeaveRequestService, LeaveRequest } from '../data/leave-request.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-my-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-requests.component.html',
  styleUrl: './my-requests.component.scss'
})
export class MyRequestsComponent implements OnInit {
  private router = inject(Router);
  private leaveRequestService = inject(LeaveRequestService);
  private notificationService = inject(NotificationService);

  requests = signal<LeaveRequest[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  
  activeQRCode = signal<string | null>(null);
  activeRequest = signal<LeaveRequest | null>(null);
  showQRModal = signal(false);
  copiedFeedback = signal(false);

  constructor() {
    // Watch for request status updates and refresh the list
    effect(() => {
      const trigger = this.notificationService.requestStatusUpdateTrigger();
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
      const data = await this.leaveRequestService.getMyRequests();
      this.requests.set(data);

      // Check if there's an active QR code
      const qrData = await this.leaveRequestService.getMyQRCode();
      if (qrData) {
        this.activeQRCode.set(qrData.qr_code);
        this.activeRequest.set(qrData.leave_request);
      }
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to load requests');
    } finally {
      this.isLoading.set(false);
    }
  }

  isExpired(request: LeaveRequest): boolean {
    // A request is expired if end_date is past and status is not completed/cancelled/declined/active
    const endDate = new Date(request.end_date);
    const now = new Date();
    const terminatedStatuses = ['completed', 'cancelled', 'declined', 'expired'];
    return endDate < now && !terminatedStatuses.includes(request.status);
  }

  getEffectiveStatus(request: LeaveRequest): string {
    if (this.isExpired(request)) {
      return 'expired';
    }
    return request.status;
  }

  getStatusClass(request: LeaveRequest): string {
    const status = this.getEffectiveStatus(request);
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

  getStatusLabel(request: LeaveRequest): string {
    const status = this.getEffectiveStatus(request);
    switch (status) {
      case 'pending_dean':
      case 'pending_admin':
        return 'Awaiting Home Dean Approval';
      case 'pending_parent':
        return 'Awaiting Parent Approval';
      case 'pending_vpsas':
        return 'Awaiting VPSAS Approval';
      case 'approved':
        return 'Approved - Ready to Go';
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

  async cancelRequest(request: LeaveRequest) {
    if (!confirm('Are you sure you want to cancel this request?')) {
      return;
    }

    try {
      await this.leaveRequestService.cancel(request.id);
      await this.loadRequests();
    } catch (error: any) {
      alert(error.message || 'Failed to cancel request');
    }
  }

  viewQRCode(request: LeaveRequest) {
    if (request.qr_code) {
      // Navigate to the leave pass page
      this.router.navigate(['/leave-pass', request.id]);
    }
  }

  closeQRModal() {
    this.showQRModal.set(false);
  }

  async copyQRCode(): Promise<void> {
    const qrCode = this.activeQRCode();
    if (qrCode) {
      try {
        await navigator.clipboard.writeText(qrCode);
        this.copiedFeedback.set(true);
        setTimeout(() => this.copiedFeedback.set(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  }

  getQRCodeUrl(qrCode: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`;
  }

  createNewRequest() {
    this.router.navigate(['/my-leave-request']);
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
