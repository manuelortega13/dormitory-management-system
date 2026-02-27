import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface RoomInfo {
  roomNumber: string;
  building: string;
  floor: number;
  type: 'single' | 'double' | 'quad';
  capacity: number;
  currentOccupants: number;
}

interface Roommate {
  id: number;
  name: string;
  course: string;
  year: string;
  moveInDate: string;
}

interface RoomAmenity {
  name: string;
  icon: string;
  status: 'working' | 'needs-repair';
}

@Component({
  selector: 'app-my-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-room.component.html',
  styleUrl: './my-room.component.scss'
})
export class MyRoomComponent {
  mockRoom: RoomInfo = {
    roomNumber: 'A-205',
    building: 'Building A - Male Dormitory',
    floor: 2,
    type: 'double',
    capacity: 2,
    currentOccupants: 2
  };

  mockRoommates: Roommate[] = [
    {
      id: 1,
      name: 'Carlos Lopez',
      course: 'BS Computer Science',
      year: '3rd Year',
      moveInDate: '2024-06-15'
    }
  ];

  mockAmenities: RoomAmenity[] = [
    { name: 'Air Conditioning', icon: '❄️', status: 'working' },
    { name: 'Study Desk', icon: '📚', status: 'working' },
    { name: 'Wardrobe', icon: '🚪', status: 'working' },
    { name: 'Bed & Mattress', icon: '🛏️', status: 'working' },
    { name: 'Electric Fan', icon: '💨', status: 'needs-repair' },
    { name: 'Ceiling Light', icon: '💡', status: 'working' }
  ];

  mockRules = [
    'Quiet hours: 10:00 PM - 6:00 AM',
    'No cooking appliances allowed',
    'Visitors allowed until 8:00 PM only',
    'Keep room clean at all times',
    'Report maintenance issues promptly'
  ];

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getRoomTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      single: 'Single Room',
      double: 'Double Sharing',
      quad: 'Quad Sharing'
    };
    return labels[type] || type;
  }
}
