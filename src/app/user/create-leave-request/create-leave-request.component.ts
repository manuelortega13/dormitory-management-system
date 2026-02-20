import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface LeaveRequestForm {
  expectedLeaveDate: string;
  reason: string;
  additionalNotes: string;
  confirmChecklist: {
    clearedDues: boolean;
    returnedKeys: boolean;
    roomInspection: boolean;
    forwardingAddress: boolean;
  };
}

@Component({
  selector: 'app-create-leave-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-leave-request.component.html',
  styleUrl: './create-leave-request.component.scss'
})
export class CreateLeaveRequestComponent {
  protected readonly isSubmitting = signal(false);
  protected readonly isSubmitted = signal(false);
  protected readonly errorMessage = signal('');

  // Mock current user data
  protected readonly currentUser = {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@email.com',
    phone: '+1 234 567 8901',
    roomNumber: '101',
    floor: 1,
    checkInDate: new Date('2025-09-01'),
    avatar: 'JD'
  };

  protected readonly formData = signal<LeaveRequestForm>({
    expectedLeaveDate: '',
    reason: '',
    additionalNotes: '',
    confirmChecklist: {
      clearedDues: false,
      returnedKeys: false,
      roomInspection: false,
      forwardingAddress: false
    }
  });

  protected readonly reasonOptions = [
    'Completing studies/Graduation',
    'Transferring to another institution',
    'Moving to off-campus housing',
    'Family emergency',
    'Internship/Job opportunity',
    'Study abroad program',
    'Personal reasons',
    'Other'
  ];

  protected readonly minDate = signal(this.getMinDate());

  constructor(private router: Router) {}

  private getMinDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 14); // Minimum 2 weeks notice
    return date.toISOString().split('T')[0];
  }

  updateLeaveDate(event: Event) {
    const input = event.target as HTMLInputElement;
    this.formData.update(form => ({
      ...form,
      expectedLeaveDate: input.value
    }));
  }

  updateReason(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.formData.update(form => ({
      ...form,
      reason: select.value
    }));
  }

  updateNotes(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.formData.update(form => ({
      ...form,
      additionalNotes: textarea.value
    }));
  }

  updateChecklist(field: keyof LeaveRequestForm['confirmChecklist'], event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.formData.update(form => ({
      ...form,
      confirmChecklist: {
        ...form.confirmChecklist,
        [field]: checkbox.checked
      }
    }));
  }

  isFormValid(): boolean {
    const form = this.formData();
    return !!(
      form.expectedLeaveDate &&
      form.reason &&
      form.confirmChecklist.clearedDues &&
      form.confirmChecklist.returnedKeys &&
      form.confirmChecklist.roomInspection &&
      form.confirmChecklist.forwardingAddress
    );
  }

  getDaysUntilLeave(): number {
    const leaveDate = new Date(this.formData().expectedLeaveDate);
    const today = new Date();
    const diffTime = leaveDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  submitRequest() {
    if (!this.isFormValid()) {
      this.errorMessage.set('Please complete all required fields and confirm the checklist items.');
      return;
    }

    this.errorMessage.set('');
    this.isSubmitting.set(true);

    // Simulate API call
    setTimeout(() => {
      this.isSubmitting.set(false);
      this.isSubmitted.set(true);
    }, 1500);
  }

  createNewRequest() {
    this.isSubmitted.set(false);
    this.formData.set({
      expectedLeaveDate: '',
      reason: '',
      additionalNotes: '',
      confirmChecklist: {
        clearedDues: false,
        returnedKeys: false,
        roomInspection: false,
        forwardingAddress: false
      }
    });
  }

  goToDashboard() {
    this.router.navigate(['/']);
  }
}
