import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResidentsService, Resident, ResidentStatus, CreateResidentDto, UpdateResidentDto, Parent } from './data';
import { ResidentFormModalComponent } from './resident-form-modal/resident-form-modal.component';
import { SuspendModalComponent } from './suspend-modal/suspend-modal.component';

@Component({
  selector: 'app-residents',
  standalone: true,
  imports: [CommonModule, FormsModule, ResidentFormModalComponent, SuspendModalComponent],
  templateUrl: './residents.component.html',
  styleUrl: './residents.component.scss'
})
export class ResidentsComponent implements OnInit {
  private readonly residentsService = inject(ResidentsService);

  protected readonly searchQuery = signal('');
  protected readonly selectedStatus = signal<ResidentStatus | 'all'>('all');
  protected readonly selectedFloor = signal<number | 'all'>('all');
  protected readonly viewMode = signal<'grid' | 'list'>('list');
  protected readonly showAddModal = signal(false);
  protected readonly showEditModal = signal(false);
  protected readonly selectedResident = signal<Resident | null>(null);
  protected readonly editingResident = signal<Resident | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly modalError = signal('');
  protected readonly modalSaving = signal(false);
  protected readonly showSuspendModal = signal(false);
  protected readonly suspendingResident = signal<Resident | null>(null);
  protected readonly suspendError = signal('');
  protected readonly suspendSaving = signal(false);

  protected readonly residents = signal<Resident[]>([]);
  protected readonly parents = signal<Parent[]>([]);

  ngOnInit(): void {
    this.loadResidents();
  }

  loadResidents(): void {
    this.isLoading.set(true);
    this.residentsService.getResidents().subscribe({
      next: (data) => {
        this.residents.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load residents:', err);
        this.isLoading.set(false);
      }
    });
  }

  protected readonly stats = computed(() => {
    const all = this.residents();
    return {
      total: all.length,
      active: all.filter(r => r.status === 'active').length,
      inactive: all.filter(r => r.status === 'inactive').length,
      pending: all.filter(r => r.status === 'pending').length,
      suspended: all.filter(r => r.status === 'suspended').length
    };
  });

  protected readonly floors = computed(() => {
    const floorSet = new Set<number>();
    this.residents().forEach(r => {
      if (r.floor) floorSet.add(r.floor);
    });
    return Array.from(floorSet).sort((a, b) => a - b);
  });

  protected readonly filteredResidents = computed(() => {
    let filtered = this.residents();
    const query = this.searchQuery().toLowerCase();
    const status = this.selectedStatus();
    const floor = this.selectedFloor();

    if (query) {
      filtered = filtered.filter(r =>
        r.first_name.toLowerCase().includes(query) ||
        r.last_name.toLowerCase().includes(query) ||
        r.email.toLowerCase().includes(query) ||
        r.room_number?.toLowerCase().includes(query)
      );
    }

    if (status !== 'all') {
      filtered = filtered.filter(r => r.status === status);
    }

    if (floor !== 'all') {
      filtered = filtered.filter(r => r.floor === floor);
    }

    return filtered;
  });

  updateSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  updateStatus(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedStatus.set(select.value as ResidentStatus | 'all');
  }

  updateFloor(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedFloor.set(select.value === 'all' ? 'all' : parseInt(select.value));
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode.set(mode);
  }

  getStatusClass(status: ResidentStatus): string {
    return `status-${status}`;
  }

  getFullName(resident: Resident): string {
    return `${resident.first_name} ${resident.last_name}`;
  }

  getInitials(resident: Resident): string {
    return `${resident.first_name.charAt(0)}${resident.last_name.charAt(0)}`;
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#4a90d9', '#667eea', '#27ae60', '#e74c3c', '#f39c12',
      '#9b59b6', '#1abc9c', '#e67e22', '#3498db', '#e91e63'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  openAddModal(): void {
    this.modalError.set('');
    this.modalSaving.set(false);
    this.loadParents();
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.modalError.set('');
  }

  onAddResident(data: CreateResidentDto | UpdateResidentDto): void {
    this.modalSaving.set(true);
    this.modalError.set('');

    this.residentsService.createResident(data as CreateResidentDto).subscribe({
      next: () => {
        this.modalSaving.set(false);
        this.closeAddModal();
        this.loadResidents();
      },
      error: (err) => {
        this.modalError.set(err.error?.error || 'Failed to create resident');
        this.modalSaving.set(false);
      }
    });
  }

  viewResident(resident: Resident): void {
    this.selectedResident.set(resident);
  }

  closeResidentDetail(): void {
    this.selectedResident.set(null);
  }

  editResident(resident: Resident): void {
    this.modalError.set('');
    this.modalSaving.set(false);
    this.editingResident.set(resident);
    this.loadParents();
    this.showEditModal.set(true);
  }

  loadParents(): void {
    this.residentsService.getParents().subscribe({
      next: (data) => this.parents.set(data),
      error: (err) => console.error('Failed to load parents:', err)
    });
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingResident.set(null);
    this.modalError.set('');
  }

  onEditResident(data: CreateResidentDto | UpdateResidentDto): void {
    const resident = this.editingResident();
    if (!resident) return;

    this.modalSaving.set(true);
    this.modalError.set('');

    this.residentsService.updateResident(resident.id, data as UpdateResidentDto).subscribe({
      next: () => {
        this.modalSaving.set(false);
        this.closeEditModal();
        this.closeResidentDetail();
        this.loadResidents();
      },
      error: (err) => {
        this.modalError.set(err.error?.error || 'Failed to update resident');
        this.modalSaving.set(false);
      }
    });
  }

  deleteResident(resident: Resident): void {
    if (confirm(`Are you sure you want to delete ${this.getFullName(resident)}?`)) {
      this.residentsService.deleteResident(resident.id).subscribe({
        next: () => {
          this.residents.update(residents => residents.filter(r => r.id !== resident.id));
          this.closeResidentDetail();
        },
        error: (err) => console.error('Failed to delete resident:', err)
      });
    }
  }

  assignRoom(resident: Resident): void {
    console.log('Assign room to:', resident);
    // TODO: Implement room assignment
  }

  openSuspendModal(resident: Resident): void {
    this.suspendError.set('');
    this.suspendSaving.set(false);
    this.suspendingResident.set(resident);
    this.showSuspendModal.set(true);
  }

  closeSuspendModal(): void {
    this.showSuspendModal.set(false);
    this.suspendingResident.set(null);
    this.suspendError.set('');
  }

  onSuspendResident(reason: string): void {
    const resident = this.suspendingResident();
    if (!resident) return;

    this.suspendSaving.set(true);
    this.suspendError.set('');

    this.residentsService.suspendResident(resident.id, reason).subscribe({
      next: () => {
        this.suspendSaving.set(false);
        this.closeSuspendModal();
        this.closeResidentDetail();
        this.loadResidents();
      },
      error: (err) => {
        this.suspendError.set(err.error?.error || 'Failed to suspend resident');
        this.suspendSaving.set(false);
      }
    });
  }

  reactivateResident(resident: Resident): void {
    if (confirm(`Are you sure you want to reactivate ${this.getFullName(resident)}?`)) {
      this.residentsService.reactivateResident(resident.id).subscribe({
        next: () => {
          this.closeResidentDetail();
          this.loadResidents();
        },
        error: (err) => console.error('Failed to reactivate resident:', err)
      });
    }
  }
}
