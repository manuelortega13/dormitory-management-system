import { Component, signal, computed, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentsService } from './data/agents.service';
import { Agent, CreateAgentDto, UpdateAgentDto } from './data/agent.model';
import { AgentEditModalComponent } from './agent-edit-modal/agent-edit-modal.component';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [CommonModule, FormsModule, AgentEditModalComponent],
  templateUrl: './agents.component.html',
  styleUrl: './agents.component.scss'
})
export class AgentsComponent implements OnInit {
  private readonly agentsService = inject(AgentsService);

  protected readonly searchQuery = signal('');
  protected readonly selectedRole = signal<'admin' | 'security_guard' | 'home_dean' | 'vpsas' | 'all'>('all');
  protected readonly selectedStatus = signal<'active' | 'suspended' | 'all'>('all');
  protected readonly isLoading = signal(false);
  protected readonly showAddModal = signal(false);
  protected readonly modalSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly showSuspendModal = signal(false);
  protected readonly suspendingAgent = signal<Agent | null>(null);
  protected readonly suspendReason = signal('');
  protected readonly suspendSaving = signal(false);
  protected readonly suspendError = signal('');
  protected readonly showPassword = signal(false);

  protected readonly showEditModal = signal(false);
  protected readonly editingAgent = signal<Agent | null>(null);

  @ViewChild(AgentEditModalComponent) editModalComponent?: AgentEditModalComponent;

  protected readonly agents = signal<Agent[]>([]);

  // Form fields for adding new agent
  protected readonly newAgent = signal<CreateAgentDto>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'security_guard',
    phone: ''
  });

  ngOnInit(): void {
    this.loadAgents();
  }

  loadAgents(): void {
    this.isLoading.set(true);
    this.agentsService.getAgents().subscribe({
      next: (data) => {
        this.agents.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load agents:', err);
        this.isLoading.set(false);
      }
    });
  }

  protected readonly stats = computed(() => {
    const all = this.agents();
    return {
      total: all.length,
      admins: all.filter(a => a.role === 'admin').length,
      securityGuards: all.filter(a => a.role === 'security_guard').length,
      homeDeans: all.filter(a => a.role === 'home_dean').length,
      active: all.filter(a => a.status === 'active').length,
      suspended: all.filter(a => a.status === 'suspended').length
    };
  });

  protected readonly filteredAgents = computed(() => {
    let filtered = this.agents();
    const query = this.searchQuery().toLowerCase();
    const role = this.selectedRole();
    const status = this.selectedStatus();

    if (query) {
      filtered = filtered.filter(a =>
        a.first_name.toLowerCase().includes(query) ||
        a.last_name.toLowerCase().includes(query) ||
        a.email.toLowerCase().includes(query)
      );
    }

    if (role !== 'all') {
      filtered = filtered.filter(a => a.role === role);
    }

    if (status !== 'all') {
      filtered = filtered.filter(a => a.status === status);
    }

    return filtered;
  });

  updateSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  updateRole(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedRole.set(select.value as 'admin' | 'security_guard' | 'home_dean' | 'vpsas' | 'all');
  }

  updateStatus(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedStatus.set(select.value as 'active' | 'suspended' | 'all');
  }

  getRoleLabel(role: string, deanType?: 'male' | 'female' | null): string {
    switch (role) {
      case 'admin': return 'Admin';
      case 'security_guard': return 'Security Guard';
      case 'home_dean':
        if (deanType === 'male') return 'Dean for Males';
        if (deanType === 'female') return 'Dean for Females';
        return 'Home Dean';
      case 'vpsas': return 'VPSAS';
      default: return role;
    }
  }

  getRoleClass(role: string): string {
    return `role-${role.replace('_', '-')}`;
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  getInitials(agent: Agent): string {
    return `${agent.first_name.charAt(0)}${agent.last_name.charAt(0)}`.toUpperCase();
  }

  getFullName(agent: Agent): string {
    return `${agent.first_name} ${agent.last_name}`;
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#4a90d9', '#667eea', '#27ae60', '#e74c3c',
      '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  openAddModal(): void {
    this.newAgent.set({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'security_guard',
      deanType: undefined,
      phone: ''
    });
    this.modalError.set('');
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.modalError.set('');
  }

  updateNewAgentField(field: keyof CreateAgentDto, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    this.newAgent.update(current => {
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

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  saveNewAgent(): void {
    const agent = this.newAgent();

    // Validation
    if (!agent.email || !agent.password || !agent.firstName || !agent.lastName || !agent.role) {
      this.modalError.set('Please fill in all required fields');
      return;
    }

    // Validate deanType for home_dean role
    if (agent.role === 'home_dean' && !agent.deanType) {
      this.modalError.set('Please select a dean type');
      return;
    }

    if (agent.password.length < 6) {
      this.modalError.set('Password must be at least 6 characters');
      return;
    }

    this.modalSaving.set(true);
    this.modalError.set('');

    this.agentsService.createAgent(agent).subscribe({
      next: () => {
        this.modalSaving.set(false);
        this.showAddModal.set(false);
        this.loadAgents();
      },
      error: (err) => {
        this.modalSaving.set(false);
        this.modalError.set(err.error?.error || 'Failed to create agent');
      }
    });
  }

  // Edit agent methods
  openEditModal(agent: Agent): void {
    this.editingAgent.set(agent);
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingAgent.set(null);
  }

  saveAgentEdit(event: { id: number; data: UpdateAgentDto }): void {
    this.agentsService.updateAgent(event.id, event.data).subscribe({
      next: () => {
        this.showEditModal.set(false);
        this.editingAgent.set(null);
        this.loadAgents();
      },
      error: (err) => {
        if (this.editModalComponent) {
          this.editModalComponent.setError(err.error?.error || 'Failed to update agent');
        }
      }
    });
  }

  openSuspendModal(agent: Agent): void {
    this.suspendingAgent.set(agent);
    this.suspendReason.set('');
    this.suspendError.set('');
    this.showSuspendModal.set(true);
  }

  closeSuspendModal(): void {
    this.showSuspendModal.set(false);
    this.suspendingAgent.set(null);
    this.suspendError.set('');
  }

  updateSuspendReason(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.suspendReason.set(input.value);
  }

  confirmSuspend(): void {
    const agent = this.suspendingAgent();
    if (!agent) return;

    const reason = this.suspendReason().trim();
    if (!reason) {
      this.suspendError.set('Please provide a reason for suspension');
      return;
    }

    this.suspendSaving.set(true);
    this.suspendError.set('');

    this.agentsService.suspendAgent(agent.id, reason).subscribe({
      next: () => {
        this.suspendSaving.set(false);
        this.showSuspendModal.set(false);
        this.suspendingAgent.set(null);
        this.loadAgents();
      },
      error: (err) => {
        this.suspendSaving.set(false);
        this.suspendError.set(err.error?.error || 'Failed to suspend agent');
      }
    });
  }

  reactivateAgent(agent: Agent): void {
    if (!confirm(`Are you sure you want to reactivate ${this.getFullName(agent)}?`)) {
      return;
    }

    this.agentsService.reactivateAgent(agent.id).subscribe({
      next: () => {
        this.loadAgents();
      },
      error: (err) => {
        console.error('Failed to reactivate agent:', err);
        alert('Failed to reactivate agent');
      }
    });
  }

  deleteAgent(agent: Agent): void {
    if (!confirm(`Are you sure you want to delete ${this.getFullName(agent)}? This action cannot be undone.`)) {
      return;
    }

    this.agentsService.deleteAgent(agent.id).subscribe({
      next: () => {
        this.loadAgents();
      },
      error: (err) => {
        console.error('Failed to delete agent:', err);
        alert('Failed to delete agent');
      }
    });
  }
}
