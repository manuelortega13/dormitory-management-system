import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../auth/auth.service';
import { environment } from '../../../environments/environment';

interface RoomData {
  id: number;
  room_number: string;
  floor: number;
  room_type: string;
  capacity: number;
  current_occupants: number;
  status: string;
  price_per_month: number | null;
  amenities: string[] | null;
}

interface Assignment {
  id: number;
  start_date: string;
  end_date: string | null;
}

interface Roommate {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  course: string | null;
  year_level: number | null;
  gender: string | null;
  start_date: string;
}

interface PendingBill {
  id: number;
  type: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_amount: number;
}

interface MyRoomResponse {
  room: RoomData;
  assignment: Assignment;
  roommates: Roommate[];
  pending_bills: PendingBill[];
}

@Component({
  selector: 'app-my-room',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-room.component.html',
  styleUrl: './my-room.component.scss',
})
export class MyRoomComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  loading = signal(true);
  error = signal<string | null>(null);
  room = signal<RoomData | null>(null);
  assignment = signal<Assignment | null>(null);
  roommates = signal<Roommate[]>([]);
  pendingBills = signal<PendingBill[]>([]);
  hasRoom = signal(false);

  ngOnInit() {
    this.loadRoomData();
  }

  loadRoomData() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.error.set('Unable to identify user');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.http.get<MyRoomResponse>(`${environment.apiUrl}/users/${user.id}/room`).subscribe({
      next: (res) => {
        this.room.set(res.room);
        this.assignment.set(res.assignment);
        this.roommates.set(res.roommates);
        this.pendingBills.set(res.pending_bills);
        this.hasRoom.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        if (err.status === 404) {
          this.hasRoom.set(false);
        } else {
          this.error.set('Failed to load room data. Please try again.');
        }
        this.loading.set(false);
      },
    });
  }

  getRoomTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      single: 'Single',
      double: 'Double Sharing',
      triple: 'Triple Sharing',
      quad: 'Quad Sharing',
    };
    return labels[type] || type;
  }

  getYearLabel(year: number | null): string {
    if (!year) return '';
    const labels: Record<number, string> = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year' };
    return labels[year] || `${year}th Year`;
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getStayDuration(): string {
    const assignment = this.assignment();
    if (!assignment) return '';
    const start = new Date(assignment.start_date);
    const now = new Date();
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (months < 1) {
      const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years}y ${rem}m` : `${years} year${years !== 1 ? 's' : ''}`;
  }

  getOccupancyPercent(): number {
    const r = this.room();
    if (!r || !r.capacity) return 0;
    return Math.round((r.current_occupants / r.capacity) * 100);
  }

  getBillRemaining(bill: PendingBill): number {
    return Math.max(0, bill.amount - bill.paid_amount);
  }

  isDueSoon(dueDate: string): boolean {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  }

  isOverdue(dueDate: string): boolean {
    return new Date(dueDate) < new Date();
  }

  getAmenityIcon(amenity: string): string {
    const icons: Record<string, string> = {
      'Air Conditioning': '❄️',
      'AC': '❄️',
      'WiFi': '📶',
      'Wi-Fi': '📶',
      'Study Desk': '📚',
      'Desk': '📚',
      'Wardrobe': '👔',
      'Closet': '👔',
      'Bed': '🛏️',
      'Bed & Mattress': '🛏️',
      'Electric Fan': '💨',
      'Fan': '💨',
      'Ceiling Light': '💡',
      'Light': '💡',
      'Bathroom': '🚿',
      'Private Bathroom': '🚿',
      'Refrigerator': '🧊',
      'Mirror': '🪞',
      'Curtains': '🪟',
      'Bookshelf': '📖',
      'Chair': '🪑',
    };
    const key = Object.keys(icons).find((k) => amenity.toLowerCase().includes(k.toLowerCase()));
    return key ? icons[key] : '✓';
  }
}
