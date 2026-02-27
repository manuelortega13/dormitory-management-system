import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParentRegistrationService, ParentRegistration, ParentRegistrationDetail } from './data';

@Component({
  selector: 'app-parent-registrations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-registrations.component.html',
  styleUrl: './parent-registrations.component.scss'
})
export class ParentRegistrationsComponent implements OnInit {
  private readonly parentRegistrationService = inject(ParentRegistrationService);

  protected readonly searchQuery = signal('');
  protected readonly selectedStatus = signal<'all' | 'pending' | 'approved' | 'declined'>('pending');
  protected readonly isLoading = signal(false);
  
  // Stats signals - loaded separately to always show accurate counts
  protected readonly stats = signal({ total: 0, pending: 0, approved: 0, declined: 0 });
  
  // Modal state
  protected readonly showDetailModal = signal(false);
  protected readonly selectedRegistration = signal<ParentRegistrationDetail | null>(null);
  protected readonly modalLoading = signal(false);
  protected readonly actionLoading = signal(false);
  protected readonly actionError = signal('');
  
  // Decline modal state
  protected readonly showDeclineModal = signal(false);
  protected readonly declineReason = signal('');
  protected readonly decliningRegistration = signal<ParentRegistration | null>(null);

  protected readonly registrations = signal<ParentRegistration[]>([]);

  ngOnInit(): void {
    this.loadStats();
    this.loadRegistrations();
  }

  loadStats(): void {
    // Always load all registrations for accurate stats
    this.parentRegistrationService.getAllRegistrations().subscribe({
      next: (data) => {
        this.stats.set({
          total: data.length,
          pending: data.filter(r => r.registration_status === 'pending').length,
          approved: data.filter(r => r.registration_status === 'approved').length,
          declined: data.filter(r => r.registration_status === 'declined').length
        });
      },
      error: (err) => {
        console.error('Failed to load stats:', err);
      }
    });
  }

  loadRegistrations(): void {
    this.isLoading.set(true);
    const status = this.selectedStatus() === 'all' ? undefined : this.selectedStatus();
    
    const request = status === 'pending' 
      ? this.parentRegistrationService.getPendingRegistrations()
      : this.parentRegistrationService.getAllRegistrations(status);

    request.subscribe({
      next: (data) => {
        this.registrations.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load parent registrations:', err);
        this.isLoading.set(false);
      }
    });
  }

  protected readonly filteredRegistrations = computed(() => {
    let filtered = this.registrations();
    const query = this.searchQuery().toLowerCase();

    if (query) {
      filtered = filtered.filter(r =>
        r.first_name.toLowerCase().includes(query) ||
        r.last_name.toLowerCase().includes(query) ||
        r.email.toLowerCase().includes(query) ||
        r.student_first_name?.toLowerCase().includes(query) ||
        r.student_last_name?.toLowerCase().includes(query) ||
        r.student_resident_id?.toLowerCase().includes(query)
      );
    }

    return filtered;
  });

  onStatusChange(): void {
    this.loadRegistrations();
  }

  openDetailModal(registration: ParentRegistration): void {
    this.modalLoading.set(true);
    this.showDetailModal.set(true);
    this.actionError.set('');
    
    this.parentRegistrationService.getRegistrationById(registration.id).subscribe({
      next: (data) => {
        this.selectedRegistration.set(data);
        this.modalLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load registration details:', err);
        this.modalLoading.set(false);
        this.actionError.set('Failed to load registration details');
      }
    });
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedRegistration.set(null);
    this.actionError.set('');
  }

  approveRegistration(): void {
    const registration = this.selectedRegistration();
    if (!registration) return;

    this.actionLoading.set(true);
    this.actionError.set('');

    this.parentRegistrationService.approveRegistration(registration.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.closeDetailModal();
        this.loadRegistrations();
        this.loadStats();
      },
      error: (err) => {
        console.error('Failed to approve registration:', err);
        this.actionLoading.set(false);
        this.actionError.set(err.error?.error || 'Failed to approve registration');
      }
    });
  }

  openDeclineModal(registration: ParentRegistration): void {
    this.decliningRegistration.set(registration);
    this.declineReason.set('');
    this.showDeclineModal.set(true);
    this.actionError.set('');
  }

  closeDeclineModal(): void {
    this.showDeclineModal.set(false);
    this.decliningRegistration.set(null);
    this.declineReason.set('');
    this.actionError.set('');
  }

  confirmDecline(): void {
    const registration = this.decliningRegistration();
    if (!registration || !this.declineReason().trim()) return;

    this.actionLoading.set(true);
    this.actionError.set('');

    this.parentRegistrationService.declineRegistration(registration.id, this.declineReason().trim()).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.closeDeclineModal();
        this.closeDetailModal();
        this.loadRegistrations();
        this.loadStats();
      },
      error: (err) => {
        console.error('Failed to decline registration:', err);
        this.actionLoading.set(false);
        this.actionError.set(err.error?.error || 'Failed to decline registration');
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'declined': return 'status-declined';
      default: return '';
    }
  }
}
