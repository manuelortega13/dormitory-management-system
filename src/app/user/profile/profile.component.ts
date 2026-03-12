import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { environment } from '../../../environments/environment';

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string | null;
  photo_url: string | null;
  status: string;
  student_resident_id: string | null;
  gender: string | null;
  address: string | null;
  course: string | null;
  year_level: number | null;
  created_at: string;
}

interface RoomAssignment {
  room_number: string;
  floor: number;
  room_type: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/users`;

  profile = signal<UserProfile | null>(null);
  room = signal<RoomAssignment | null>(null);
  isLoading = signal(true);
  isEditing = signal(false);
  isSaving = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  // Editable form fields
  formFirstName = signal('');
  formLastName = signal('');
  formPhone = signal('');
  formGender = signal('');
  formAddress = signal('');
  formCourse = signal('');
  formYearLevel = signal<number | null>(null);
  formPhotoPreview = signal<string | null>(null);

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const [profileRes, roomRes] = await Promise.all([
        firstValueFrom(this.http.get<UserProfile>(`${this.apiUrl}/${user.id}`)),
        firstValueFrom(this.http.get<RoomAssignment>(`${this.apiUrl}/${user.id}/room`)).catch(
          () => null,
        ),
      ]);

      this.profile.set(profileRes);
      this.room.set(roomRes);
      this.populateForm(profileRes);
    } catch (error) {
      this.errorMessage.set('Failed to load profile');
    } finally {
      this.isLoading.set(false);
    }
  }

  private populateForm(p: UserProfile) {
    this.formFirstName.set(p.first_name || '');
    this.formLastName.set(p.last_name || '');
    this.formPhone.set(p.phone || '');
    this.formGender.set(p.gender || '');
    this.formAddress.set(p.address || '');
    this.formCourse.set(p.course || '');
    this.formYearLevel.set(p.year_level);
    this.formPhotoPreview.set(p.photo_url);
  }

  startEditing() {
    const p = this.profile();
    if (p) this.populateForm(p);
    this.isEditing.set(true);
  }

  cancelEditing() {
    const p = this.profile();
    if (p) this.populateForm(p);
    this.isEditing.set(false);
    this.errorMessage.set('');
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage.set('Photo must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.formPhotoPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async saveProfile() {
    if (!this.formFirstName().trim() || !this.formLastName().trim()) {
      this.errorMessage.set('First name and last name are required');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');

    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const body: any = {
        firstName: this.formFirstName().trim(),
        lastName: this.formLastName().trim(),
        phone: this.formPhone().trim() || null,
        gender: this.formGender() || null,
        address: this.formAddress().trim() || null,
        course: this.formCourse().trim() || null,
        yearLevel: this.formYearLevel(),
      };

      // Only include photoUrl if changed
      const currentPhoto = this.profile()?.photo_url || null;
      if (this.formPhotoPreview() !== currentPhoto) {
        body.photoUrl = this.formPhotoPreview();
      }

      await firstValueFrom(this.http.put(`${this.apiUrl}/${user.id}`, body));

      this.successMessage.set('Profile updated successfully!');
      this.isEditing.set(false);
      await this.loadProfile();

      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (error: any) {
      this.errorMessage.set(error?.error?.error || 'Failed to update profile');
    } finally {
      this.isSaving.set(false);
    }
  }

  get photoDisplay(): string | null {
    return this.formPhotoPreview() || this.profile()?.photo_url || null;
  }

  get initials(): string {
    const p = this.profile();
    if (!p) return '?';
    return `${(p.first_name || '').charAt(0)}${(p.last_name || '').charAt(0)}`.toUpperCase();
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  getRoomTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      single: 'Single',
      double: 'Double',
      triple: 'Triple',
      quad: 'Quad',
    };
    return labels[type] || type;
  }
}
