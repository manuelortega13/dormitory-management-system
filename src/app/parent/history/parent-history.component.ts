import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParentService } from '../data/parent.service';
import { ParentGatepassService } from '../data/parent-gatepass.service';
import { LeaveRequest } from '../../models/leave-request.model';

interface HistoryItem {
  kind: 'leave' | 'gatepass';
  id: number;
  created_at: string;
  childName: string;
  typeLabel: string;
  status: string;
  destination: string;
  reason: string;
  spendingWith?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  room?: string | null;
  parentNotes?: string | null;
  deanNotes?: string | null;
  vpsasNotes?: string | null;
}

@Component({
  selector: 'app-parent-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parent-history.component.html',
  styleUrl: './parent-history.component.scss'
})
export class ParentHistoryComponent implements OnInit {
  private parentService = inject(ParentService);
  private gatepassService = inject(ParentGatepassService);

  items = signal<HistoryItem[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  ngOnInit() {
    this.loadHistory();
  }

  async loadHistory() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const [leaves, gatepasses] = await Promise.all([
        this.parentService.getChildRequests(),
        this.gatepassService.getAll(),
      ]);

      const merged: HistoryItem[] = [
        ...leaves.map((l: LeaveRequest) => ({
          kind: 'leave' as const,
          id: l.id,
          created_at: l.created_at,
          childName: (l as any).user_name ?? '',
          typeLabel: this.getLeaveTypeLabel(l.leave_type) + ' Leave',
          status: l.status,
          destination: l.destination,
          reason: l.reason,
          spendingWith: (l as any).spending_leave_with ?? null,
          startDate: l.start_date,
          endDate: l.end_date,
          room: (l as any).room_number ?? null,
          parentNotes: (l as any).parent_notes ?? null,
          deanNotes: (l as any).admin_notes ?? null,
          vpsasNotes: (l as any).vpsas_notes ?? null,
        })),
        ...gatepasses.map((g) => ({
          kind: 'gatepass' as const,
          id: g.id,
          created_at: g.created_at,
          childName: g.occupant_name ?? '',
          typeLabel: 'Gatepass',
          status: g.status,
          destination: g.destination,
          reason: g.reason,
          room: (g as any).room_number ?? null,
          parentNotes: g.parent_notes ?? null,
          deanNotes: g.dean_notes ?? null,
          vpsasNotes: g.vpsas_notes ?? null,
        })),
      ];

      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      this.items.set(merged);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to load history');
    } finally {
      this.isLoading.set(false);
    }
  }

  getLeaveTypeLabel(type: string): string {
    const types: Record<string, string> = {
      'special_pass': 'Special Pass',
      'campus_leave': 'Campus Leave'
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
