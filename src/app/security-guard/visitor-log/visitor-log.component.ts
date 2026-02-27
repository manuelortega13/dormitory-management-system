import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Visitor {
  id: number;
  name: string;
  purpose: string;
  visitingResident: string;
  roomNumber: string;
  checkInTime: string;
  checkOutTime: string | null;
  status: 'checked-in' | 'checked-out';
  idType: string;
  idNumber: string;
}

@Component({
  selector: 'app-visitor-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './visitor-log.component.html',
  styleUrl: './visitor-log.component.scss'
})
export class VisitorLogComponent {
  searchQuery = signal('');

  mockVisitors: Visitor[] = [
    {
      id: 1,
      name: 'Juan Dela Cruz Sr.',
      purpose: 'Visiting son',
      visitingResident: 'Juan Dela Cruz Jr.',
      roomNumber: 'A-205',
      checkInTime: '2025-01-15T09:30:00',
      checkOutTime: '2025-01-15T11:45:00',
      status: 'checked-out',
      idType: 'Drivers License',
      idNumber: 'N01-12-345678'
    },
    {
      id: 2,
      name: 'Maria Santos',
      purpose: 'Delivery',
      visitingResident: 'Ana Garcia',
      roomNumber: 'B-102',
      checkInTime: '2025-01-15T10:15:00',
      checkOutTime: '2025-01-15T10:30:00',
      status: 'checked-out',
      idType: 'Company ID',
      idNumber: 'DEL-001'
    },
    {
      id: 3,
      name: 'Pedro Reyes',
      purpose: 'Parent visit',
      visitingResident: 'Carlos Reyes',
      roomNumber: 'C-310',
      checkInTime: '2025-01-15T14:00:00',
      checkOutTime: null,
      status: 'checked-in',
      idType: 'National ID',
      idNumber: '1234-5678-9012'
    },
    {
      id: 4,
      name: 'Tech Solutions Inc.',
      purpose: 'AC Repair',
      visitingResident: 'Maintenance - Room D-401',
      roomNumber: 'D-401',
      checkInTime: '2025-01-15T08:00:00',
      checkOutTime: null,
      status: 'checked-in',
      idType: 'Company ID',
      idNumber: 'TECH-042'
    },
    {
      id: 5,
      name: 'Rosa Martinez',
      purpose: 'Friend visit',
      visitingResident: 'Jenny Lopez',
      roomNumber: 'A-108',
      checkInTime: '2025-01-15T15:30:00',
      checkOutTime: null,
      status: 'checked-in',
      idType: 'Student ID',
      idNumber: '2024-00123'
    }
  ];

  stats = {
    totalToday: this.mockVisitors.length,
    currentlyInside: this.mockVisitors.filter(v => v.status === 'checked-in').length,
    checkedOut: this.mockVisitors.filter(v => v.status === 'checked-out').length,
    avgDuration: '1.5 hrs'
  };

  formatTime(dateTime: string | null): string {
    if (!dateTime) return '-';
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusClass(status: string): string {
    return status;
  }
}
