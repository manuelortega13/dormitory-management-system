import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';

type Gender = 'male' | 'female' | '';

interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  gender: Gender;
  address: string;
  course: string;
  yearLevel: number | null;
}

interface FieldErrors {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  gender: string;
  address: string;
  course: string;
  yearLevel: string;
}

@Component({
  selector: 'app-register-resident',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register-resident.component.html',
  styleUrl: './register-resident.component.scss'
})
export class RegisterResidentComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  form: RegisterForm = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    gender: '',
    address: '',
    course: '',
    yearLevel: null
  };

  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  
  fieldErrors = signal<FieldErrors>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    gender: '',
    address: '',
    course: '',
    yearLevel: ''
  });

  constructor() {
    if (this.authService.isLoggedIn()) {
      this.authService.redirectBasedOnRole();
    }
  }

  validateForm(): boolean {
    const errors: FieldErrors = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      gender: '',
      address: '',
      course: '',
      yearLevel: ''
    };

    let isValid = true;

    if (!this.form.firstName.trim()) {
      errors.firstName = 'First name is required';
      isValid = false;
    }

    if (!this.form.lastName.trim()) {
      errors.lastName = 'Last name is required';
      isValid = false;
    }

    if (!this.form.email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!this.form.phone.trim()) {
      errors.phone = 'Phone number is required';
      isValid = false;
    } else if (!/^[0-9+\-\s()]{7,15}$/.test(this.form.phone.trim())) {
      errors.phone = 'Please enter a valid phone number';
      isValid = false;
    }

    if (!this.form.password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (this.form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (!this.form.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (this.form.password !== this.form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    if (!this.form.gender) {
      errors.gender = 'Please select your gender';
      isValid = false;
    }

    if (!this.form.course.trim()) {
      errors.course = 'Course/Program is required';
      isValid = false;
    }

    if (!this.form.yearLevel) {
      errors.yearLevel = 'Please select your year level';
      isValid = false;
    }

    this.fieldErrors.set(errors);
    return isValid;
  }

  clearFieldError(field: keyof FieldErrors): void {
    this.fieldErrors.update(errors => ({ ...errors, [field]: '' }));
  }

  async onSubmit() {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.validateForm()) {
      this.errorMessage.set('Please fix the errors below.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.isLoading.set(true);

    try {
      const registerData = {
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim(),
        phone: this.form.phone.trim(),
        password: this.form.password,
        role: 'resident' as const,
        gender: this.form.gender || null,
        address: this.form.address.trim() || null,
        course: this.form.course.trim() || null,
        yearLevel: this.form.yearLevel
      };

      await this.authService.register(registerData);

      this.successMessage.set('Registration successful! Redirecting to your dashboard...');
      
      setTimeout(() => {
        this.authService.redirectBasedOnRole();
      }, 1500);
    } catch (error: any) {
      if (error.status === 400) {
        this.errorMessage.set(error.error?.error || 'Email already registered');
      } else {
        this.errorMessage.set(error.error?.error || 'Registration failed. Please try again.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      this.isLoading.set(false);
    }
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update(v => !v);
  }
}
