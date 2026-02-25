import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LeaveRequestService, LeaveRequest } from '../data/leave-request.service';
import { AuthService, User } from '../../auth/auth.service';

@Component({
  selector: 'app-leave-pass',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leave-pass.component.html',
  styleUrl: './leave-pass.component.scss'
})
export class LeavePassComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private leaveRequestService = inject(LeaveRequestService);
  private authService = inject(AuthService);

  leaveRequest = signal<LeaveRequest | null>(null);
  user = signal<User | null>(null);
  qrCode = signal<string | null>(null);
  isLoading = signal(true);
  errorMessage = signal('');
  copiedFeedback = signal(false);

  // Temporary placeholder data for fields not in schema
  placeholderData = {
    address: 'Dormitory Block A, Room 101',
    courseYearLevel: 'BSCS - 3rd Year',
    spendingLeaveWith: 'Family',
    parentPhone: '+63 912 345 6789',
    adviser: 'Prof. Maria Santos',
    homeDean: 'Dr. Juan Dela Cruz',
    vpsas: 'Dr. Roberto Garcia'
  };

  ngOnInit(): void {
    this.user.set(this.authService.getCurrentUser());
    this.loadLeavePass();
  }

  async loadLeavePass(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      // Try to get the request ID from route params
      const requestId = this.route.snapshot.paramMap.get('id');
      
      if (requestId) {
        // Load specific request (future enhancement)
        // For now, just load the active QR
        const data = await this.leaveRequestService.getMyQRCode();
        if (data) {
          this.qrCode.set(data.qr_code);
          this.leaveRequest.set(data.leave_request);
        } else {
          this.errorMessage.set('No active leave pass found');
        }
      } else {
        // Load current active QR code
        const data = await this.leaveRequestService.getMyQRCode();
        if (data) {
          this.qrCode.set(data.qr_code);
          this.leaveRequest.set(data.leave_request);
        } else {
          this.errorMessage.set('No active leave pass found');
        }
      }
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to load leave pass');
    } finally {
      this.isLoading.set(false);
    }
  }

  goBack(): void {
    this.location.back();
  }

  getQRCodeUrl(qrCode: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateOnly(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getLeaveTypeLabel(type: string): string {
    const types: Record<string, string> = {
      'errand': 'Errand Leave',
      'overnight': 'Overnight Leave',
      'weekend': 'Weekend Leave',
      'emergency': 'Emergency Leave',
      'other': 'Other Leave'
    };
    return types[type] || type;
  }

  getResidentName(): string {
    const user = this.user();
    if (user) {
      return `${user.firstName} ${user.lastName}`;
    }
    return 'N/A';
  }

  async copyQRCode(): Promise<void> {
    const code = this.qrCode();
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
        this.copiedFeedback.set(true);
        setTimeout(() => this.copiedFeedback.set(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  }
}
