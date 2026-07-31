import { Component, inject, signal, OnInit, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLeaveRequestService, LeaveRequest } from './data/admin-leave-request.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../auth/auth.service';
import { ResidentsService } from '../residents/data/residents.service';
import { Resident } from '../residents/data/resident.model';
import { ToastService } from '../../services/toast.service';

type TabFilter = 'pending' | 'all';

@Component({
  selector: 'app-leave-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leave-requests.component.html',
  styleUrl: './leave-requests.component.scss',
})
export class LeaveRequestsComponent implements OnInit {
  private leaveRequestService = inject(AdminLeaveRequestService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private residentsService = inject(ResidentsService);
  private toast = inject(ToastService);

  requests = signal<LeaveRequest[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  activeTab = signal<TabFilter>('pending');
  searchQuery = signal('');

  // Which request rows have their details expanded
  expandedRows = signal<Set<number>>(new Set<number>());
  isExpanded(id: number): boolean {
    return this.expandedRows().has(id);
  }
  toggleDetails(id: number): void {
    this.expandedRows.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // User role detection
  currentUserRole = computed(() => this.authService.getCurrentUser()?.role || 'admin');
  isVpsas = computed(() => this.currentUserRole() === 'vpsas');
  // Admin & Home Dean can create a leave request on an occupant's behalf
  canCreateForOccupant = computed(() => ['admin', 'home_dean'].includes(this.currentUserRole()));

  // Modal state
  showActionModal = signal(false);
  selectedRequest = signal<LeaveRequest | null>(null);
  actionType = signal<'approve' | 'decline'>('approve');
  adminNotes = signal('');

  // ---- Create-for-occupant modal ----
  readonly leaveTypes = ['errand', 'overnight', 'weekend', 'emergency', 'other'];
  showCreateModal = signal(false);
  createSaving = signal(false);
  createError = signal('');
  // occupant picker
  occupants = signal<Resident[]>([]);
  occupantQuery = signal('');
  selectedOccupant = signal<Resident | null>(null);
  filteredOccupants = computed(() => {
    const q = this.occupantQuery().toLowerCase().trim();
    const list = this.occupants();
    if (!q) return list.slice(0, 25);
    return list
      .filter(
        (r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
          (r.student_resident_id ?? '').toLowerCase().includes(q),
      )
      .slice(0, 25);
  });
  // form fields
  cLeaveType = signal('errand');
  cReason = signal('');
  cDestination = signal('');
  cStart = signal('');
  cEnd = signal('');
  cSpendingWith = signal('');
  cEmergencyContact = signal('');
  cEmergencyPhone = signal('');
  isProcessing = signal(false);

  constructor() {
    // Watch for new leave request notifications and refresh the table
    effect(
      () => {
        const trigger = this.notificationService.newLeaveRequestTrigger();
        if (trigger > 0) {
          this.loadRequests();
        }
      },
      { allowSignalWrites: true },
    );
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

  // ---- Create for occupant ----
  openCreateModal(): void {
    this.createError.set('');
    this.selectedOccupant.set(null);
    this.occupantQuery.set('');
    this.cLeaveType.set('errand');
    this.cReason.set('');
    this.cDestination.set('');
    this.cStart.set('');
    this.cEnd.set('');
    this.cSpendingWith.set('');
    this.cEmergencyContact.set('');
    this.cEmergencyPhone.set('');
    this.showCreateModal.set(true);
    // Load active occupants (gender-scoped server-side for the Home Dean)
    this.residentsService.getResidents({ status: 'active' }).subscribe({
      next: (list) => this.occupants.set(list),
      error: () => this.createError.set('Failed to load occupants'),
    });
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  selectOccupant(r: Resident): void {
    this.selectedOccupant.set(r);
    this.occupantQuery.set('');
  }

  clearOccupant(): void {
    this.selectedOccupant.set(null);
  }

  async submitCreateForOccupant(): Promise<void> {
    const occ = this.selectedOccupant();
    if (!occ) {
      this.createError.set('Please select an occupant');
      return;
    }
    if (!this.cReason().trim() || !this.cDestination().trim()) {
      this.createError.set('Reason and destination are required');
      return;
    }
    if (!this.cStart() || !this.cEnd()) {
      this.createError.set('Date and time of leave and expected return are required');
      return;
    }
    if (new Date(this.cEnd()) <= new Date(this.cStart())) {
      this.createError.set('Expected return must be after the date of leave');
      return;
    }

    this.createSaving.set(true);
    this.createError.set('');
    try {
      await this.leaveRequestService.createForOccupant({
        userId: occ.id,
        leaveType: this.cLeaveType(),
        startDate: new Date(this.cStart()).toISOString(),
        endDate: new Date(this.cEnd()).toISOString(),
        reason: this.cReason().trim(),
        destination: this.cDestination().trim(),
        spendingLeaveWith: this.cSpendingWith().trim() || undefined,
        emergencyContact: this.cEmergencyContact().trim() || undefined,
        emergencyPhone: this.cEmergencyPhone().trim() || undefined,
      });
      this.toast.success(
        'Created',
        `Leave request created for ${occ.first_name} ${occ.last_name}.`,
      );
      this.showCreateModal.set(false);
      this.loadRequests();
    } catch (err: any) {
      this.createError.set(err?.error?.error || 'Failed to create leave request');
    } finally {
      this.createSaving.set(false);
    }
  }

  // Print the QR code of an approved request (e.g. for an occupant with no phone)
  printQR(request: LeaveRequest): void {
    if (!request.qr_code) {
      this.toast.error('No QR code', 'This request has no QR code yet (not fully approved).');
      return;
    }
    const esc = (s: unknown) =>
      String(s ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
      );
    const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : '-');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
      request.qr_code,
    )}`;
    const name = esc(request.user_name || 'Occupant');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Leave Pass QR — ${name}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; color: #1a1a2e; }
    .pass { max-width: 480px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; padding: 28px; text-align: center; }
    h1 { font-size: 1.15rem; margin: 0 0 2px; }
    .sub { color: #666; font-size: 0.8rem; margin: 0 0 14px; }
    .qr { width: 260px; height: 260px; margin: 4px auto 8px; display: block; }
    .code { font-family: monospace; font-size: 0.72rem; color: #555; word-break: break-all; margin: 0 0 14px; }
    .details { text-align: left; font-size: 0.85rem; border-top: 1px solid #eee; padding-top: 12px; }
    .details div { margin-bottom: 6px; }
    .details .lbl { color: #888; }
    @media print { @page { margin: 12mm; } .pass { border: none; } }
  </style>
</head>
<body>
  <div class="pass">
    <h1>Campus Leave Pass</h1>
    <p class="sub">Present this QR code to the security guard</p>
    <img class="qr" src="${qrUrl}" alt="Leave Pass QR" />
    <p class="code">${esc(request.qr_code)}</p>
    <div class="details">
      <div><span class="lbl">Occupant:</span> ${name}</div>
      <div><span class="lbl">Room:</span> ${esc(request.room_number || '-')}</div>
      <div><span class="lbl">Leave Type:</span> ${esc(this.getLeaveTypeLabel(request.leave_type))}</div>
      <div><span class="lbl">Destination:</span> ${esc(request.destination)}</div>
      <div><span class="lbl">Leave:</span> ${esc(fmt(request.start_date))}</div>
      <div><span class="lbl">Return:</span> ${esc(fmt(request.end_date))}</div>
      <div><span class="lbl">Reason:</span> ${esc(request.reason)}</div>
    </div>
  </div>
  <script>
    var img = document.querySelector('img');
    function go() { window.focus(); window.print(); }
    if (img.complete) { go(); } else { img.onload = go; img.onerror = go; }
    window.onafterprint = function () { window.close(); };
  </script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1400,height=800');
    if (!w) {
      this.toast.error('Pop-up blocked', 'Allow pop-ups for this site to print the QR code.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  filteredRequests() {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.requests();

    return this.requests().filter(
      (req) =>
        req.user_name?.toLowerCase().includes(query) ||
        req.destination?.toLowerCase().includes(query) ||
        req.reason?.toLowerCase().includes(query) ||
        req.room_number?.toLowerCase().includes(query),
    );
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

  getStatusLabel(status: string): string {
    const userRole = this.currentUserRole();
    switch (status) {
      case 'pending_dean':
      case 'pending_admin':
        return userRole === 'home_dean' || userRole === 'admin'
          ? 'Pending Your Review'
          : 'Awaiting Home Dean';
      case 'pending_parent':
        return 'Awaiting Parent';
      case 'pending_vpsas':
        return userRole === 'vpsas' ? 'Pending Your Review' : 'Awaiting VPSAS';
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
      errand: 'Errand',
      overnight: 'Overnight',
      weekend: 'Weekend',
      emergency: 'Emergency',
      other: 'Other',
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
      minute: '2-digit',
    });
  }

  getInitials(name?: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
