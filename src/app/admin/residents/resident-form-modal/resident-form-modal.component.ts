import { Component, Input, Output, EventEmitter, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Resident, CreateResidentDto, UpdateResidentDto, Parent, Gender } from '../data';

export interface ResidentFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  parentId: number | null;
  gender: Gender | null;
  address: string;
  course: string;
  yearLevel: number | null;
}

@Component({
  selector: 'app-resident-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resident-form-modal.component.html',
  styleUrl: './resident-form-modal.component.scss'
})
export class ResidentFormModalComponent implements OnChanges {
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() resident: Resident | null = null;
  @Input() parents: Parent[] = [];
  @Input() errorMessage: string = '';
  @Input() isSaving: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<CreateResidentDto | UpdateResidentDto>();

  formData = signal<ResidentFormData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    parentId: null,
    gender: null,
    address: '',
    course: '',
    yearLevel: null
  });

  localError = signal('');

  ngOnChanges(changes: SimpleChanges) {
    if (changes['resident'] && this.resident && this.mode === 'edit') {
      this.formData.set({
        email: this.resident.email,
        password: '',
        firstName: this.resident.first_name,
        lastName: this.resident.last_name,
        phone: this.resident.phone || '',
        parentId: this.resident.parent_id,
        gender: this.resident.gender,
        address: this.resident.address || '',
        course: this.resident.course || '',
        yearLevel: this.resident.year_level
      });
    }
  }

  updateField(field: keyof ResidentFormData, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.formData.update(form => ({ ...form, [field]: input.value }));
  }

  updateParent(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.formData.update(form => ({ ...form, parentId: value ? parseInt(value) : null }));
  }

  updateGender(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value as Gender | '';
    this.formData.update(form => ({ ...form, gender: value || null }));
  }

  updateYearLevel(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.formData.update(form => ({ ...form, yearLevel: value ? parseInt(value) : null }));
  }

  getParentFullName(parent: Parent): string {
    return `${parent.first_name} ${parent.last_name}`;
  }

  onSave(): void {
    const form = this.formData();
    
    if (this.mode === 'add') {
      if (!form.email || !form.password || !form.firstName || !form.lastName) {
        this.localError.set('Please fill in all required fields');
        return;
      }
      
      this.localError.set('');
      const data: CreateResidentDto = {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        parentId: form.parentId,
        gender: form.gender,
        address: form.address || undefined,
        course: form.course || undefined,
        yearLevel: form.yearLevel
      };
      
      this.save.emit(data);
    } else {
      if (!form.firstName || !form.lastName) {
        this.localError.set('First name and last name are required');
        return;
      }

      this.localError.set('');
      const data: UpdateResidentDto = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        parentId: form.parentId,
        gender: form.gender,
        address: form.address || undefined,
        course: form.course || undefined,
        yearLevel: form.yearLevel
      };

      if (form.password) {
        data.password = form.password;
      }

      this.save.emit(data);
    }
  }
}
