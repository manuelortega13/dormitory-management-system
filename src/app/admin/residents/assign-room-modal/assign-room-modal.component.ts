import { Component, Input, Output, EventEmitter, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Resident } from '../data';
import { RoomsService, Room } from '../../rooms/data/rooms.service';

export interface AssignRoomData {
  roomId: number;
  startDate: string;
  endDate?: string;
}

@Component({
  selector: 'app-assign-room-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assign-room-modal.component.html',
  styleUrl: './assign-room-modal.component.scss'
})
export class AssignRoomModalComponent implements OnInit {
  private readonly roomsService = inject(RoomsService);

  @Input() resident: Resident | null = null;
  @Input() errorMessage: string = '';
  @Input() isSaving: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<AssignRoomData>();

  availableRooms = signal<Room[]>([]);
  selectedRoomId = signal<number | null>(null);
  startDate = signal(new Date().toISOString().split('T')[0]);
  endDate = signal('');
  localError = signal('');
  isLoading = signal(true);

  ngOnInit(): void {
    this.loadAvailableRooms();
  }

  loadAvailableRooms(): void {
    this.isLoading.set(true);
    this.roomsService.getAvailable().subscribe({
      next: (rooms) => {
        this.availableRooms.set(rooms);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load available rooms:', err);
        this.localError.set('Failed to load available rooms');
        this.isLoading.set(false);
      }
    });
  }

  onConfirm(): void {
    const roomId = this.selectedRoomId();
    const start = this.startDate();

    if (!roomId) {
      this.localError.set('Please select a room');
      return;
    }

    if (!start) {
      this.localError.set('Please select a start date');
      return;
    }

    this.localError.set('');
    this.confirm.emit({
      roomId,
      startDate: start,
      endDate: this.endDate() || undefined
    });
  }

  getFullName(): string {
    if (!this.resident) return '';
    return `${this.resident.first_name} ${this.resident.last_name}`;
  }

  getRoomTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      single: 'Single Room',
      double: 'Double Room',
      triple: 'Triple Room',
      suite: 'Suite'
    };
    return labels[type] || type;
  }

  getDisplayError(): string {
    return this.errorMessage || this.localError();
  }
}
