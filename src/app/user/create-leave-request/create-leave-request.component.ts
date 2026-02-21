import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LeaveRequestService } from '../data/leave-request.service';

interface GoOutRequestForm {
  leaveType: 'errand' | 'overnight' | 'weekend' | 'emergency' | 'other';
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  destination: string;
  reason: string;
  emergencyContact: string;
  emergencyPhone: string;
}

interface FieldErrors {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  destination: string;
  reason: string;
  emergencyContact: string;
  emergencyPhone: string;
}

@Component({
  selector: 'app-create-leave-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-leave-request.component.html',
  styleUrl: './create-leave-request.component.scss'
})
export class CreateLeaveRequestComponent {
  private router = inject(Router);
  private leaveRequestService = inject(LeaveRequestService);

  isSubmitting = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  
  fieldErrors = signal<FieldErrors>({
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    destination: '',
    reason: '',
    emergencyContact: '',
    emergencyPhone: ''
  });

  form: GoOutRequestForm = {
    leaveType: 'errand',
    startDate: this.getTodayDate(),
    startTime: this.getCurrentTime(),
    endDate: this.getTodayDate(),
    endTime: '18:00',
    destination: '',
    reason: '',
    emergencyContact: '',
    emergencyPhone: ''
  };

  leaveTypes = [
    { value: 'errand', label: 'Errand', description: 'Quick trip (shopping, appointments, etc.)' },
    { value: 'overnight', label: 'Overnight', description: 'Staying overnight outside campus' },
    { value: 'weekend', label: 'Weekend', description: 'Weekend trip home or elsewhere' },
    { value: 'emergency', label: 'Emergency', description: 'Urgent family or personal matter' },
    { value: 'other', label: 'Other', description: 'Other reasons' }
  ];

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  getCurrentTime(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  getMinEndDate(): string {
    return this.form.startDate || this.getTodayDate();
  }

  getMinStartTime(): string {
    // If start date is today, return current time; otherwise no minimum
    if (this.form.startDate === this.getTodayDate()) {
      return this.getCurrentTime();
    }
    return '';
  }

  isFormValid(): boolean {
    return !!(
      this.form.leaveType &&
      this.form.startDate &&
      this.form.startTime &&
      this.form.endDate &&
      this.form.endTime &&
      this.form.destination.trim() &&
      this.form.reason.trim() &&
      this.form.emergencyContact.trim() &&
      this.form.emergencyPhone.trim()
    );
  }

  validateForm(): boolean {
    const errors: FieldErrors = {
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      destination: '',
      reason: '',
      emergencyContact: '',
      emergencyPhone: ''
    };

    let isValid = true;
    const now = new Date();

    // Validate required fields
    if (!this.form.startDate) {
      errors.startDate = 'Departure date is required';
      isValid = false;
    }

    if (!this.form.startTime) {
      errors.startTime = 'Departure time is required';
      isValid = false;
    }

    if (!this.form.endDate) {
      errors.endDate = 'Return date is required';
      isValid = false;
    }

    if (!this.form.endTime) {
      errors.endTime = 'Return time is required';
      isValid = false;
    }

    if (!this.form.destination.trim()) {
      errors.destination = 'Destination is required';
      isValid = false;
    }

    if (!this.form.reason.trim()) {
      errors.reason = 'Reason for leave is required';
      isValid = false;
    }

    if (!this.form.emergencyContact.trim()) {
      errors.emergencyContact = 'Emergency contact name is required';
      isValid = false;
    }

    if (!this.form.emergencyPhone.trim()) {
      errors.emergencyPhone = 'Emergency contact phone is required';
      isValid = false;
    } else if (!/^[0-9+\-\s()]{7,15}$/.test(this.form.emergencyPhone.trim())) {
      errors.emergencyPhone = 'Please enter a valid phone number';
      isValid = false;
    }

    // Validate date/time logic if basic fields are filled
    if (this.form.startDate && this.form.startTime) {
      const startDateTime = new Date(`${this.form.startDate}T${this.form.startTime}`);
      if (startDateTime < now) {
        errors.startDate = 'Departure date/time cannot be in the past';
        errors.startTime = 'Departure date/time cannot be in the past';
        isValid = false;
      }

      if (this.form.endDate && this.form.endTime) {
        const endDateTime = new Date(`${this.form.endDate}T${this.form.endTime}`);
        if (endDateTime <= startDateTime) {
          errors.endDate = 'Return must be after departure';
          errors.endTime = 'Return must be after departure';
          isValid = false;
        }
      }
    }

    this.fieldErrors.set(errors);
    return isValid;
  }

  clearFieldError(field: keyof FieldErrors): void {
    this.fieldErrors.update(errors => ({ ...errors, [field]: '' }));
  }

  async onSubmit() {
    if (!this.validateForm()) {
      this.errorMessage.set('Please fix the errors below.');
      this.scrollToTop();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const requestData = {
        leaveType: this.form.leaveType,
        startDate: `${this.form.startDate} ${this.form.startTime}:00`,
        endDate: `${this.form.endDate} ${this.form.endTime}:00`,
        destination: this.form.destination.trim(),
        reason: this.form.reason.trim(),
        emergencyContact: this.form.emergencyContact.trim(),
        emergencyPhone: this.form.emergencyPhone.trim()
      };

      await this.leaveRequestService.create(requestData);
      
      this.successMessage.set('Your go-out request has been submitted successfully! It will be reviewed by the admin/dean.');
      this.scrollToTop();
      
      // Reset form
      this.form = {
        leaveType: 'errand',
        startDate: this.getTodayDate(),
        startTime: this.getCurrentTime(),
        endDate: this.getTodayDate(),
        endTime: '18:00',
        destination: '',
        reason: '',
        emergencyContact: '',
        emergencyPhone: ''
      };

      // Navigate to my requests after a delay
      setTimeout(() => {
        this.router.navigate(['/my-requests']);
      }, 2000);

    } catch (error: any) {
      this.errorMessage.set(error.error?.error || error.message || 'Failed to submit request. Please try again.');
      this.scrollToTop();
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
