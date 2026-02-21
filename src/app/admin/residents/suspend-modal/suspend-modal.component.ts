import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Resident } from '../data';

@Component({
  selector: 'app-suspend-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './suspend-modal.component.html',
  styleUrl: './suspend-modal.component.scss'
})
export class SuspendModalComponent {
  @Input() resident: Resident | null = null;
  @Input() errorMessage: string = '';
  @Input() isSaving: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<string>();

  reason = signal('');
  localError = signal('');

  updateReason(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.reason.set(textarea.value);
  }

  onConfirm(): void {
    const reasonText = this.reason().trim();

    if (!reasonText) {
      this.localError.set('Please provide a reason for suspension');
      return;
    }

    if (reasonText.length < 10) {
      this.localError.set('Reason must be at least 10 characters');
      return;
    }

    this.localError.set('');
    this.confirm.emit(reasonText);
  }

  getFullName(): string {
    if (!this.resident) return '';
    return `${this.resident.first_name} ${this.resident.last_name}`;
  }
}
