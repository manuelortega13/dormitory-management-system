import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';

type AccountType = 'resident' | 'parent';

interface RegisterForm {
  accountType: AccountType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface FieldErrors {
  accountType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  form: RegisterForm = {
    accountType: 'resident',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  };

  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  
  fieldErrors = signal<FieldErrors>({
    accountType: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  constructor() {
    // If already logged in, redirect
    if (this.authService.isLoggedIn()) {
      this.authService.redirectBasedOnRole();
    }
  }

  validateForm(): boolean {
    const errors: FieldErrors = {
      accountType: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: ''
    };

    let isValid = true;

    if (!this.form.accountType) {
      errors.accountType = 'Please select an account type';
      isValid = false;
    }

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
      await this.authService.register({
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim(),
        phone: this.form.phone.trim(),
        password: this.form.password,
        role: this.form.accountType
      });

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
