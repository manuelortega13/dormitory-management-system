import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Resident } from '../data';

@Component({
  selector: 'app-reactivate-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reactivate-modal.component.html',
  styleUrl: './reactivate-modal.component.scss',
})
export class ReactivateModalComponent {
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
