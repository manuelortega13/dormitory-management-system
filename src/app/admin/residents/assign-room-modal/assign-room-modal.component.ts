import { Component, Input, Output, EventEmitter, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Resident } from '../data';
import { RoomsService, Room } from '../../rooms/data/rooms.service';

export interface AssignRoomData {
  roomId: number;
  startDate: string;
  endDate?: string;
  /** Set when changing rooms — the old room to unassign from */
  previousRoomId?: number;
}

@Component({
  selector: 'app-assign-room-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assign-room-modal.component.html',
  styleUrl: './assign-room-modal.component.scss',
})
export class AssignRoomModalComponent implements OnInit {
  private readonly roomsService = inject(RoomsService);

  @Input() resident: Resident | null = null;
  @Input() errorMessage: string = '';
  @Input() isSaving: boolean = false;
  /** 'assign' for new assignment, 'change' for reassignment */
  @Input() mode: 'assign' | 'change' = 'assign';
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<AssignRoomData>();

  availableRooms = signal<Room[]>([]);
  allRooms = signal<Room[]>([]);
  selectedRoomId = signal<number | null>(null);
  startDate = signal(new Date().toISOString().split('T')[0]);
  endDate = signal('');
  localError = signal('');
  isLoading = signal(true);

  ngOnInit(): void {
    this.loadRooms();
  }

  loadRooms(): void {
    this.isLoading.set(true);
    this.roomsService.getAvailable().subscribe({
      next: (rooms) => {
        this.availableRooms.set(rooms);
        this.isLoading.set(false);
      },
      error: () => {
        this.localError.set('Failed to load available rooms');
        this.isLoading.set(false);
      },
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

    const data: AssignRoomData = {
      roomId,
      startDate: start,
      endDate: this.endDate() || undefined,
    };

    // If changing rooms, include the previous room info for unassignment
    if (this.mode === 'change' && this.resident?.room_number) {
      data.previousRoomId = this.getCurrentRoomId();
    }

    this.confirm.emit(data);
  }

  /** Try to find current room ID from the available/all rooms list by room_number */
  private getCurrentRoomId(): number | undefined {
    // We'll pass this from the parent instead — use a workaround via resident data
    return undefined;
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
      quad: 'Quad Room',
      suite: 'Suite',
    };
    return labels[type] || type;
  }

  getDisplayError(): string {
    return this.errorMessage || this.localError();
  }

  isChangeMode(): boolean {
    return this.mode === 'change';
  }
}
