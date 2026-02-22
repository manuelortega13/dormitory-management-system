import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParentService } from '../data/parent.service';
import { LeaveRequest } from '../../models/leave-request.model';

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-dashboard.component.html',
  styleUrl: './parent-dashboard.component.scss'
})
export class ParentDashboardComponent implements OnInit {
  private parentService = inject(ParentService);

  requests = signal<LeaveRequest[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  // Modal state
  showActionModal = signal(false);
  selectedRequest = signal<LeaveRequest | null>(null);
  actionType = signal<'approve' | 'decline'>('approve');
  parentNotes = signal('');
  isProcessing = signal(false);

  ngOnInit() {
    this.loadRequests();
  }

  async loadRequests() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const data = await this.parentService.getPendingRequests();
      this.requests.set(data);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to load requests');
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

  getLeaveTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'errand': '🛒',
      'overnight': '🌙',
      'weekend': '🏠',
      'emergency': '🚨',
      'other': '📝'
    };
    return icons[type] || '📋';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    // Parse as UTC and display in user's local timezone
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatShortDate(dateStr: string): string {
    if (!dateStr) return '-';
    // Parse as UTC and display in user's local timezone
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  openApproveModal(request: LeaveRequest) {
    this.selectedRequest.set(request);
    this.actionType.set('approve');
    this.parentNotes.set('');
    this.showActionModal.set(true);
  }

  openDeclineModal(request: LeaveRequest) {
    this.selectedRequest.set(request);
    this.actionType.set('decline');
    this.parentNotes.set('');
    this.showActionModal.set(true);
  }

  closeModal() {
    this.showActionModal.set(false);
    this.selectedRequest.set(null);
    this.parentNotes.set('');
  }

  async confirmAction() {
    const request = this.selectedRequest();
    if (!request) return;

    this.isProcessing.set(true);

    try {
      if (this.actionType() === 'approve') {
        await this.parentService.approveRequest(request.id, this.parentNotes());
      } else {
        await this.parentService.declineRequest(request.id, this.parentNotes());
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
