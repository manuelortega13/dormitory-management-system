import { Component, inject, signal, OnInit } from '@angular/core';
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
  spendingLeaveWith: string;
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
export class CreateLeaveRequestComponent implements OnInit {
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
    startDate: this.getInitialStartDate(),
    startTime: this.getInitialStartTime(),
    endDate: this.getInitialEndDate(),
    endTime: this.getInitialEndTime(),
    destination: '',
    spendingLeaveWith: '',
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

  ngOnInit(): void {
    this.prefillEmergencyContact();
  }

  private async prefillEmergencyContact(): Promise<void> {
    try {
      const requests = await this.leaveRequestService.getMyRequests();
      if (requests.length > 0) {
        // Get the most recent request (already sorted by created_at DESC from backend)
        const lastRequest = requests[0];
        if (lastRequest.emergency_contact) {
          this.form.emergencyContact = lastRequest.emergency_contact;
        }
        if (lastRequest.emergency_phone) {
          this.form.emergencyPhone = lastRequest.emergency_phone;
        }
      }
    } catch (error) {
      // Silently fail - prefill is not critical
      console.error('Failed to prefill emergency contact:', error);
    }
  }

  getTodayDate(): string {
    const now = new Date();
    return this.formatDateLocal(now);
  }

  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTimeLocal(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  getInitialStartDate(): string {
    const startDateTime = new Date();
    startDateTime.setMinutes(startDateTime.getMinutes() + 5);
    return this.formatDateLocal(startDateTime);
  }

  getInitialStartTime(): string {
    const startDateTime = new Date();
    startDateTime.setMinutes(startDateTime.getMinutes() + 5);
    return this.formatTimeLocal(startDateTime);
  }

  getInitialEndDate(): string {
    const endDateTime = new Date();
    endDateTime.setMinutes(endDateTime.getMinutes() + 65); // 5 mins for start + 60 mins for return
    return this.formatDateLocal(endDateTime);
  }

  getInitialEndTime(): string {
    const endDateTime = new Date();
    endDateTime.setMinutes(endDateTime.getMinutes() + 65); // 5 mins for start + 60 mins for return
    return this.formatTimeLocal(endDateTime);
  }

  getCurrentTime(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  getTimePlusMins(minutes: number): string {
    const time = new Date();
    time.setMinutes(time.getMinutes() + minutes);
    return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
  }

  getMinEndDate(): string {
    return this.form.startDate || this.getTodayDate();
  }

  getMinEndTime(): string {
    // If return date equals departure date, return time must be after departure time
    if (this.form.endDate === this.form.startDate && this.form.startTime) {
      // Add 1 minute to departure time as minimum
      const [hours, minutes] = this.form.startTime.split(':').map(Number);
      const minTime = new Date();
      minTime.setHours(hours, minutes + 1, 0, 0);
      return `${String(minTime.getHours()).padStart(2, '0')}:${String(minTime.getMinutes()).padStart(2, '0')}`;
    }
    return '';
  }

  onStartDateTimeChange(): void {
    // Auto-adjust return date if it's before departure date
    if (this.form.endDate < this.form.startDate) {
      this.form.endDate = this.form.startDate;
    }
    
    // Auto-adjust return time if same date and return time is not after departure time
    if (this.form.endDate === this.form.startDate && this.form.startTime && this.form.endTime) {
      if (this.form.endTime <= this.form.startTime) {
        // Set return time to 1 hour after departure time
        const [hours, minutes] = this.form.startTime.split(':').map(Number);
        const newEndTime = new Date();
        newEndTime.setHours(hours + 1, minutes, 0, 0);
        this.form.endTime = `${String(newEndTime.getHours()).padStart(2, '0')}:${String(newEndTime.getMinutes()).padStart(2, '0')}`;
      }
    }
  }

  onEndDateChange(): void {
    this.clearFieldError('endDate');
    // If end date changed to same as start date, check time conflict
    if (this.form.endDate === this.form.startDate && this.form.startTime && this.form.endTime) {
      if (this.form.endTime <= this.form.startTime) {
        // Set return time to 1 hour after departure time
        const [hours, minutes] = this.form.startTime.split(':').map(Number);
        const newEndTime = new Date();
        newEndTime.setHours(hours + 1, minutes, 0, 0);
        this.form.endTime = `${String(newEndTime.getHours()).padStart(2, '0')}:${String(newEndTime.getMinutes()).padStart(2, '0')}`;
      }
    }
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
      // Convert local date/time to UTC ISO format
      const startDateTime = new Date(`${this.form.startDate}T${this.form.startTime}:00`);
      const endDateTime = new Date(`${this.form.endDate}T${this.form.endTime}:00`);
      
      const requestData = {
        leaveType: this.form.leaveType,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        destination: this.form.destination.trim(),
        spendingLeaveWith: this.form.spendingLeaveWith.trim() || undefined,
        reason: this.form.reason.trim(),
        emergencyContact: this.form.emergencyContact.trim(),
        emergencyPhone: this.form.emergencyPhone.trim()
      };

      await this.leaveRequestService.create(requestData);
      
      this.successMessage.set('Your go-out request has been submitted successfully! It will be reviewed by the Home Dean.');
      this.scrollToTop();
      
      // Reset form
      this.form = {
        leaveType: 'errand',
        startDate: this.getTodayDate(),
        startTime: this.getCurrentTime(),
        endDate: this.getTodayDate(),
        endTime: '18:00',
        destination: '',
        spendingLeaveWith: '',
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
