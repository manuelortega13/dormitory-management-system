import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Resident } from '../data';

@Component({
  selector: 'app-resident-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resident-detail-modal.component.html',
  styleUrls: ['./resident-detail-modal.component.scss']
})
export class ResidentDetailModalComponent {
  @Input({ required: true }) resident!: Resident;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Resident>();
  @Output() delete = new EventEmitter<Resident>();
  @Output() suspend = new EventEmitter<Resident>();
  @Output() reactivate = new EventEmitter<Resident>();

  getFullName(): string {
    return `${this.resident.first_name} ${this.resident.last_name}`;
  }

  getInitials(): string {
    return `${this.resident.first_name.charAt(0)}${this.resident.last_name.charAt(0)}`;
  }

  getAvatarColor(): string {
    const colors = [
      '#4a90d9', '#667eea', '#27ae60', '#e74c3c', '#f39c12',
      '#9b59b6', '#1abc9c', '#e67e22', '#3498db', '#e91e63'
    ];
    const index = this.resident.first_name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  getYearLevelLabel(level: number): string {
    const labels: { [key: number]: string } = {
      1: '1st Year',
      2: '2nd Year',
      3: '3rd Year',
      4: '4th Year',
      5: '5th Year'
    };
    return labels[level] || `${level}th Year`;
  }

  onClose(): void {
    this.close.emit();
  }

  onEdit(): void {
    this.edit.emit(this.resident);
  }

  onDelete(): void {
    this.delete.emit(this.resident);
  }

  onSuspend(): void {
    this.suspend.emit(this.resident);
  }

  onReactivate(): void {
    this.reactivate.emit(this.resident);
  }
}
