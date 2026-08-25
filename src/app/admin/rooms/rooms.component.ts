import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomsService } from './data/rooms.service';
import { Room, RoomStatus, RoomType, RoomGender } from './data/room.model';
import { ResidentsService } from '../residents/data/residents.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../auth/auth.service';
import { Resident } from '../residents/data/resident.model';

interface RoomFormData {
  roomNumber: string;
  floor: number;
  capacity: number;
  roomType: RoomType;
  /** '' until chosen; the server refuses a room with no wing. */
  gender: 'male' | 'female' | '';
  pricePerMonth: number;
  amenities: string;
}

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.scss'
})
export class RoomsComponent implements OnInit {
  private readonly roomsService = inject(RoomsService);
  private readonly residentsService = inject(ResidentsService);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);

  // A home dean runs one wing, so every room they add or edit belongs to it and the choice
  // is theirs to see, not to make. Null for the admin and the VP, who pick per room.
  protected readonly deanWing: RoomGender = (() => {
    const user = this.authService.getCurrentUser();
    return user?.role === 'home_dean' ? (user.deanType ?? null) : null;
  })();

  protected readonly searchQuery = signal('');
  protected readonly selectedStatus = signal<RoomStatus | 'all'>('all');
  protected readonly selectedFloor = signal<number | 'all'>('all');
  protected readonly viewMode = signal<'grid' | 'list'>('grid');
  protected readonly loading = signal(false);

  protected readonly rooms = signal<Room[]>([]);

  // Add / Edit Room Modal state
  protected readonly showAddModal = signal(false);
  protected readonly editingRoom = signal<Room | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected readonly formData = signal<RoomFormData>({
    roomNumber: '',
    floor: 1,
    capacity: 1,
    roomType: 'single',
    gender: '',
    pricePerMonth: 0,
    amenities: ''
  });

  // View Details Modal state
  protected readonly showDetailsModal = signal(false);
  protected readonly selectedRoom = signal<Room | null>(null);

  // Delete Room Modal state
  protected readonly showDeleteModal = signal(false);
  protected readonly deletingRoom = signal<Room | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal('');

  // Assign Modal state
  protected readonly showAssignModal = signal(false);
  protected readonly assigningRoom = signal<Room | null>(null);
  protected readonly availableResidents = signal<Resident[]>([]);
  protected readonly selectedResidentId = signal<number | null>(null);
  protected readonly assignStartDate = signal('');
  protected readonly assignEndDate = signal('');
  protected readonly assigning = signal(false);

  ngOnInit(): void {
    this.loadRooms();
  }

  loadRooms(): void {
    this.loading.set(true);
    this.roomsService.getAllWithOccupants().subscribe({
      next: (rooms) => {
        this.rooms.set(rooms);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load rooms:', err);
        this.loading.set(false);
      }
    });
  }

  protected readonly floors = computed(() => {
    const floorSet = new Set(this.rooms().map(r => r.floor));
    return Array.from(floorSet).sort((a, b) => a - b);
  });

  protected readonly filteredRooms = computed(() => {
    let filtered = this.rooms();

    if (this.searchQuery()) {
      const query = this.searchQuery().toLowerCase();
      filtered = filtered.filter(room =>
        room.roomNumber.toLowerCase().includes(query) ||
        room.occupants.some(o => !o.restricted && o.name.toLowerCase().includes(query))
      );
    }

    if (this.selectedStatus() !== 'all') {
      filtered = filtered.filter(room => room.status === this.selectedStatus());
    }

    if (this.selectedFloor() !== 'all') {
      filtered = filtered.filter(room => room.floor === this.selectedFloor());
    }

    return filtered;
  });

  protected readonly stats = computed(() => {
    const all = this.rooms();
    return {
      total: all.length,
      occupied: all.filter(r => r.status === 'occupied').length,
      available: all.filter(r => r.status === 'available').length,
      maintenance: all.filter(r => r.status === 'maintenance').length,
      reserved: all.filter(r => r.status === 'reserved').length
    };
  });

  updateSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  updateStatus(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedStatus.set(select.value as RoomStatus | 'all');
  }

  updateFloor(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.selectedFloor.set(value === 'all' ? 'all' : parseInt(value, 10));
  }

  setViewMode(mode: 'grid' | 'list') {
    this.viewMode.set(mode);
  }

  getStatusClass(status: RoomStatus): string {
    return `status-${status}`;
  }

  getRoomTypeLabel(type: RoomType): string {
    const labels: Record<RoomType, string> = {
      single: 'Single Room',
      double: 'Double Room',
      triple: 'Triple Room',
      quad: 'Quad Room',
      suite: 'Suite'
    };
    return labels[type];
  }

  // Modal methods
  openAddModal(): void {
    this.formError.set('');
    this.editingRoom.set(null);
    this.formData.set({
      roomNumber: '',
      floor: 1,
      capacity: 1,
      roomType: 'single',
      // A dean's rooms can only be their own wing's, so it is filled in for them.
      gender: this.deanWing ?? '',
      pricePerMonth: 0,
      amenities: ''
    });
    this.showAddModal.set(true);
  }

  openEditModal(room: Room): void {
    this.formError.set('');
    this.editingRoom.set(room);
    this.formData.set({
      roomNumber: room.roomNumber,
      floor: room.floor,
      capacity: room.capacity,
      roomType: room.type,
      gender: this.deanWing ?? room.gender ?? '',
      pricePerMonth: room.monthlyRent,
      amenities: room.amenities.join(', ')
    });
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.editingRoom.set(null);
    this.formError.set('');
  }

  updateFormField<K extends keyof RoomFormData>(field: K, value: RoomFormData[K]): void {
    this.formData.update(data => ({ ...data, [field]: value }));
  }

  saveRoom(): void {
    const data = this.formData();
    if (!data.roomNumber.trim()) {
      this.formError.set('Room number is required');
      return;
    }
    if (!data.gender) {
      this.formError.set('Choose whether this room is for male or female occupants');
      return;
    }

    this.saving.set(true);
    this.formError.set('');
    const amenitiesArray = data.amenities
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);

    const room = this.editingRoom();
    const payload = {
      roomNumber: data.roomNumber,
      floor: data.floor,
      capacity: data.capacity,
      roomType: data.roomType,
      gender: data.gender as RoomGender,
      pricePerMonth: data.pricePerMonth,
      amenities: amenitiesArray
    };

    const request = room
      ? this.roomsService.update(room.id, { ...payload, status: room.status })
      : this.roomsService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAddModal();
        this.toast.success(
          room ? 'Room updated' : 'Room added',
          `Room ${data.roomNumber} has been ${room ? 'updated' : 'added'}.`
        );
        this.loadRooms();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(
          err?.error?.error || `Failed to ${room ? 'update' : 'create'} the room. Please try again.`
        );
      }
    });
  }

  /** How a room's wing reads on screen, worded to match the "Room For" picker. */
  protected genderLabel(gender: RoomGender): string {
    if (gender === 'male') return 'Male occupants';
    if (gender === 'female') return 'Female occupants';
    return 'Anyone';
  }

  // View Details Modal methods
  openDetailsModal(room: Room): void {
    this.selectedRoom.set(room);
    this.showDetailsModal.set(true);
  }

  closeDetailsModal(): void {
    this.showDetailsModal.set(false);
    this.selectedRoom.set(null);
  }

  // Assign Modal methods
  openAssignModal(room: Room): void {
    this.assigningRoom.set(room);
    this.selectedResidentId.set(null);
    this.assignStartDate.set(new Date().toISOString().split('T')[0]);
    this.assignEndDate.set('');
    this.loadAvailableResidents();
    this.showAssignModal.set(true);
  }

  closeAssignModal(): void {
    this.showAssignModal.set(false);
    this.assigningRoom.set(null);
    this.availableResidents.set([]);
  }

  loadAvailableResidents(): void {
    // Load residents without a room assignment
    this.residentsService.getResidents({ status: 'active' }).subscribe({
      next: (residents) => {
        // Only occupants without a room, and only those this room takes: a men's room lists
        // men, a women's room women. A room with no wing set still takes either.
        const wing = this.assigningRoom()?.gender ?? null;
        const available = residents.filter(
          r => !r.room_number && (!wing || r.gender === wing)
        );
        this.availableResidents.set(available);
      },
      error: (err) => {
        console.error('Failed to load residents:', err);
      }
    });
  }

  assignResident(): void {
    const room = this.assigningRoom();
    const residentId = this.selectedResidentId();
    const startDate = this.assignStartDate();

    if (!room || !residentId || !startDate) {
      alert('Please select an occupant and start date');
      return;
    }

    this.assigning.set(true);
    this.roomsService.assignResident(room.id, {
      userId: residentId,
      startDate: startDate,
      endDate: this.assignEndDate() || undefined
    }).subscribe({
      next: () => {
        this.assigning.set(false);
        this.closeAssignModal();
        this.loadRooms();
      },
      error: (err) => {
        console.error('Failed to assign resident:', err);
        this.assigning.set(false);
        alert('Failed to assign occupant. Please try again.');
      }
    });
  }

  removeOccupant(roomId: number, occupantId: number, occupantName: string): void {
    if (!confirm(`Are you sure you want to remove ${occupantName} from this room?`)) {
      return;
    }

        this.roomsService.unassignResident(roomId, occupantId).subscribe({
      next: () => {
        // Refresh the selected room data
        this.loadRooms();
        // Update the selected room if it's open
        const currentRoom = this.selectedRoom();
        if (currentRoom && currentRoom.id === roomId) {
          const updatedOccupants = currentRoom.occupants.filter(o => o.id !== occupantId);
          this.selectedRoom.set({ ...currentRoom, occupants: updatedOccupants });
        }
      },
      error: (err) => {
        console.error('Failed to remove occupant:', err);
        alert('Failed to remove occupant. Please try again.');
      }
    });
  }

  openDeleteModal(room: Room): void {
    this.deleteError.set('');
    this.deleting.set(false);
    this.deletingRoom.set(room);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deletingRoom.set(null);
    this.deleteError.set('');
  }

  confirmDeleteRoom(): void {
    const room = this.deletingRoom();
    if (!room) return;

    this.deleting.set(true);
    this.deleteError.set('');
    this.roomsService.delete(room.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.closeDeleteModal();
        // The details modal may be open on the room that just went away.
        if (this.selectedRoom()?.id === room.id) {
          this.closeDetailsModal();
        }
        this.toast.success('Room deleted', `Room ${room.roomNumber} has been deleted.`);
        this.loadRooms();
      },
      error: (err) => {
        this.deleting.set(false);
        // The server refuses to delete an occupied room; show its reason in place.
        this.deleteError.set(err?.error?.error || 'Failed to delete the room. Please try again.');
      }
    });
  }

  setRoomStatus(roomId: number, status: RoomStatus): void {
    this.roomsService.updateStatus(roomId, status).subscribe({
      next: () => {
        this.loadRooms();
        // Update the selected room if it's open
        const currentRoom = this.selectedRoom();
        if (currentRoom && currentRoom.id === roomId) {
          this.selectedRoom.set({ ...currentRoom, status });
        }
      },
      error: (err) => {
        console.error('Failed to update room status:', err);
        alert('Failed to update room status. Please try again.');
      }
    });
  }
}
