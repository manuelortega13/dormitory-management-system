import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomsService } from './data/rooms.service';
import { Room, RoomStatus, RoomType } from './data/room.model';
import { ResidentsService } from '../residents/data/residents.service';
import { Resident } from '../residents/data/resident.model';

interface RoomFormData {
  roomNumber: string;
  floor: number;
  capacity: number;
  roomType: RoomType;
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

  protected readonly searchQuery = signal('');
  protected readonly selectedStatus = signal<RoomStatus | 'all'>('all');
  protected readonly selectedFloor = signal<number | 'all'>('all');
  protected readonly viewMode = signal<'grid' | 'list'>('grid');
  protected readonly loading = signal(false);

  protected readonly rooms = signal<Room[]>([]);

  // Add Room Modal state
  protected readonly showAddModal = signal(false);
  protected readonly saving = signal(false);
  protected readonly formData = signal<RoomFormData>({
    roomNumber: '',
    floor: 1,
    capacity: 1,
    roomType: 'single',
    pricePerMonth: 0,
    amenities: ''
  });

  // View Details Modal state
  protected readonly showDetailsModal = signal(false);
  protected readonly selectedRoom = signal<Room | null>(null);

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
        room.occupants.some(o => o.name.toLowerCase().includes(query))
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
      suite: 'Suite'
    };
    return labels[type];
  }

  // Modal methods
  openAddModal(): void {
    this.formData.set({
      roomNumber: '',
      floor: 1,
      capacity: 1,
      roomType: 'single',
      pricePerMonth: 0,
      amenities: ''
    });
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  updateFormField<K extends keyof RoomFormData>(field: K, value: RoomFormData[K]): void {
    this.formData.update(data => ({ ...data, [field]: value }));
  }

  saveRoom(): void {
    const data = this.formData();
    if (!data.roomNumber.trim()) {
      alert('Room number is required');
      return;
    }

    this.saving.set(true);
    const amenitiesArray = data.amenities
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);

    this.roomsService.create({
      roomNumber: data.roomNumber,
      floor: data.floor,
      capacity: data.capacity,
      roomType: data.roomType,
      pricePerMonth: data.pricePerMonth,
      amenities: amenitiesArray
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAddModal();
        this.loadRooms();
      },
      error: (err) => {
        console.error('Failed to create room:', err);
        this.saving.set(false);
        alert('Failed to create room. Please try again.');
      }
    });
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
        // Filter only residents without a room
        const available = residents.filter(r => !r.room_number);
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
      alert('Please select a resident and start date');
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
        alert('Failed to assign resident. Please try again.');
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
