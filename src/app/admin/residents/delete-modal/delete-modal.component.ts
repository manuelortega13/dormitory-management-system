import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Resident } from '../data';

@Component({
  selector: 'app-delete-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './delete-modal.component.html',
  styleUrl: './delete-modal.component.scss',
})
export class DeleteModalComponent {
  @Input() resident: Resident | null = null;
  @Input() errorMessage: string = '';
  @Input() isSaving: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  getFullName(): string {
    if (!this.resident) return '';
    return `${this.resident.first_name} ${this.resident.last_name}`;
  }
}
