import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type RoomStatus = 'occupied' | 'available' | 'maintenance' | 'reserved';
type RoomType = 'single' | 'double' | 'triple' | 'suite';

interface Occupant {
  id: number;
  name: string;
  email: string;
  phone: string;
  checkInDate: Date;
  expectedCheckOut: Date;
  photo?: string;
}

interface Room {
  id: number;
  roomNumber: string;
  floor: number;
  type: RoomType;
  capacity: number;
  status: RoomStatus;
  monthlyRent: number;
  amenities: string[];
  occupants: Occupant[];
}

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.scss'
})
export class RoomsComponent {
  protected readonly searchQuery = signal('');
  protected readonly selectedStatus = signal<RoomStatus | 'all'>('all');
  protected readonly selectedFloor = signal<number | 'all'>('all');
  protected readonly viewMode = signal<'grid' | 'list'>('grid');

  protected readonly rooms = signal<Room[]>([
    {
      id: 1,
      roomNumber: '101',
      floor: 1,
      type: 'double',
      capacity: 2,
      status: 'occupied',
      monthlyRent: 850,
      amenities: ['AC', 'WiFi', 'Attached Bath'],
      occupants: [
        {
          id: 1,
          name: 'John Doe',
          email: 'john.doe@email.com',
          phone: '+1 234 567 8901',
          checkInDate: new Date('2025-09-01'),
          expectedCheckOut: new Date('2026-06-30')
        },
        {
          id: 2,
          name: 'Mike Smith',
          email: 'mike.smith@email.com',
          phone: '+1 234 567 8902',
          checkInDate: new Date('2025-09-01'),
          expectedCheckOut: new Date('2026-06-30')
        }
      ]
    },
    {
      id: 2,
      roomNumber: '102',
      floor: 1,
      type: 'single',
      capacity: 1,
      status: 'occupied',
      monthlyRent: 650,
      amenities: ['AC', 'WiFi'],
      occupants: [
        {
          id: 3,
          name: 'Sarah Johnson',
          email: 'sarah.j@email.com',
          phone: '+1 234 567 8903',
          checkInDate: new Date('2025-08-15'),
          expectedCheckOut: new Date('2026-05-31')
        }
      ]
    },
    {
      id: 3,
      roomNumber: '103',
      floor: 1,
      type: 'double',
      capacity: 2,
      status: 'available',
      monthlyRent: 850,
      amenities: ['AC', 'WiFi', 'Attached Bath'],
      occupants: []
    },
    {
      id: 4,
      roomNumber: '201',
      floor: 2,
      type: 'suite',
      capacity: 2,
      status: 'occupied',
      monthlyRent: 1200,
      amenities: ['AC', 'WiFi', 'Attached Bath', 'Balcony', 'Mini Fridge'],
      occupants: [
        {
          id: 4,
          name: 'Emily Brown',
          email: 'emily.b@email.com',
          phone: '+1 234 567 8904',
          checkInDate: new Date('2025-07-01'),
          expectedCheckOut: new Date('2026-06-30')
        }
      ]
    },
    {
      id: 5,
      roomNumber: '202',
      floor: 2,
      type: 'triple',
      capacity: 3,
      status: 'occupied',
      monthlyRent: 1050,
      amenities: ['AC', 'WiFi', 'Attached Bath'],
      occupants: [
        {
          id: 5,
          name: 'David Wilson',
          email: 'david.w@email.com',
          phone: '+1 234 567 8905',
          checkInDate: new Date('2025-09-01'),
          expectedCheckOut: new Date('2026-06-30')
        },
        {
          id: 6,
          name: 'James Lee',
          email: 'james.l@email.com',
          phone: '+1 234 567 8906',
          checkInDate: new Date('2025-09-01'),
          expectedCheckOut: new Date('2026-06-30')
        },
        {
          id: 7,
          name: 'Chris Taylor',
          email: 'chris.t@email.com',
          phone: '+1 234 567 8907',
          checkInDate: new Date('2025-10-15'),
          expectedCheckOut: new Date('2026-06-30')
        }
      ]
    },
    {
      id: 6,
      roomNumber: '203',
      floor: 2,
      type: 'double',
      capacity: 2,
      status: 'maintenance',
      monthlyRent: 850,
      amenities: ['AC', 'WiFi', 'Attached Bath'],
      occupants: []
    },
    {
      id: 7,
      roomNumber: '301',
      floor: 3,
      type: 'single',
      capacity: 1,
      status: 'reserved',
      monthlyRent: 700,
      amenities: ['AC', 'WiFi', 'Balcony'],
      occupants: []
    },
    {
      id: 8,
      roomNumber: '302',
      floor: 3,
      type: 'double',
      capacity: 2,
      status: 'available',
      monthlyRent: 900,
      amenities: ['AC', 'WiFi', 'Attached Bath', 'Balcony'],
      occupants: []
    }
  ]);

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
}
