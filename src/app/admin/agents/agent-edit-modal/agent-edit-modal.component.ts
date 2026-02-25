import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Agent, UpdateAgentDto } from '../data/agent.model';

@Component({
  selector: 'app-agent-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-edit-modal.component.html',
  styleUrls: ['./agent-edit-modal.component.scss']
})
export class AgentEditModalComponent implements OnInit {
  @Input({ required: true }) agent!: Agent;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ id: number; data: UpdateAgentDto }>();

  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected readonly formData = signal<UpdateAgentDto>({
    firstName: '',
    lastName: '',
    email: '',
    role: 'security_guard',
    deanType: undefined,
    phone: ''
  });

  ngOnInit(): void {
    this.formData.set({
      firstName: this.agent.first_name,
      lastName: this.agent.last_name,
      email: this.agent.email,
      role: this.agent.role,
      deanType: this.agent.dean_type || undefined,
      phone: this.agent.phone || ''
    });
  }

  updateField(field: keyof UpdateAgentDto, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    this.formData.update(current => {
      const updated = {
        ...current,
        [field]: input.value
      };
      // Reset deanType when role changes to non-home_dean
      if (field === 'role' && input.value !== 'home_dean') {
        updated.deanType = undefined;
      }
      return updated;
    });
  }

  onClose(): void {
    this.close.emit();
  }

  onSave(): void {
    const data = this.formData();

    // Validation
    if (!data.email || !data.firstName || !data.lastName || !data.role) {
      this.error.set('Please fill in all required fields');
      return;
    }

    // Validate deanType for home_dean role
    if (data.role === 'home_dean' && !data.deanType) {
      this.error.set('Please select a dean type');
      return;
    }

    this.error.set('');
    this.saving.set(true);

    this.save.emit({ id: this.agent.id, data });
  }

  setError(message: string): void {
    this.error.set(message);
    this.saving.set(false);
  }

  setSaving(value: boolean): void {
    this.saving.set(value);
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'admin': return 'Admin';
      case 'security_guard': return 'Security Guard';
      case 'home_dean': return 'Home Dean';
      case 'vpsas': return 'VPSAS';
      default: return role;
    }
  }
}
