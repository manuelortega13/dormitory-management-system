import { Component, signal, computed, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentsService } from './data/agents.service';
import { Agent, CreateAgentDto, UpdateAgentDto } from './data/agent.model';
import { AgentEditModalComponent } from './agent-edit-modal/agent-edit-modal.component';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [CommonModule, FormsModule, AgentEditModalComponent],
  templateUrl: './agents.component.html',
  styleUrl: './agents.component.scss',
})
export class AgentsComponent implements OnInit {
  private readonly agentsService = inject(AgentsService);
  private readonly authService = inject(AuthService);

  // Only admins can deactivate (suspend/reactivate) or delete staff
  protected readonly isAdmin = signal(this.authService.getCurrentUser()?.role === 'admin');
  // Admin and Home Dean can reset a staff member's password
  protected readonly canResetPassword = signal(
    ['admin', 'home_dean'].includes(this.authService.getCurrentUser()?.role ?? ''),
  );

  protected readonly searchQuery = signal('');
  protected readonly selectedRole = signal<
    'admin' | 'security_guard' | 'home_dean' | 'vpsas' | 'business_officer' | 'all'
  >('all');
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

  protected readonly showViewModal = signal(false);
  protected readonly viewingAgent = signal<Agent | null>(null);

  protected readonly showReactivateModal = signal(false);
  protected readonly reactivatingAgent = signal<Agent | null>(null);
  protected readonly reactivateSaving = signal(false);
  protected readonly reactivateError = signal('');

  protected readonly showDeleteModal = signal(false);
  protected readonly deletingAgent = signal<Agent | null>(null);
  protected readonly deleteSaving = signal(false);
  protected readonly deleteError = signal('');

  // Reset password modal
  protected readonly showResetModal = signal(false);
  protected readonly resettingAgent = signal<Agent | null>(null);
  protected resetPwd = '';
  protected resetConfirm = '';
  protected readonly resetSaving = signal(false);
  protected readonly resetError = signal('');
  protected readonly resetSuccess = signal('');
  protected readonly showResetPwd = signal(false);

  @ViewChild(AgentEditModalComponent) editModalComponent?: AgentEditModalComponent;

  protected readonly agents = signal<Agent[]>([]);

  // Form fields for adding new agent
  protected readonly newAgent = signal<CreateAgentDto>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'security_guard',
    phone: '',
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
      },
    });
  }

  protected readonly stats = computed(() => {
    const all = this.agents();
    return {
      total: all.length,
      admins: all.filter((a) => a.role === 'admin').length,
      securityGuards: all.filter((a) => a.role === 'security_guard').length,
      homeDeans: all.filter((a) => a.role === 'home_dean').length,
      businessOfficers: all.filter((a) => a.role === 'business_officer').length,
      active: all.filter((a) => a.status === 'active').length,
      suspended: all.filter((a) => a.status === 'suspended').length,
    };
  });

  protected readonly filteredAgents = computed(() => {
    let filtered = this.agents();
    const query = this.searchQuery().toLowerCase();
    const role = this.selectedRole();
    const status = this.selectedStatus();

    if (query) {
      filtered = filtered.filter(
        (a) =>
          a.first_name.toLowerCase().includes(query) ||
          a.last_name.toLowerCase().includes(query) ||
          a.email.toLowerCase().includes(query),
      );
    }

    if (role !== 'all') {
      filtered = filtered.filter((a) => a.role === role);
    }

    if (status !== 'all') {
      filtered = filtered.filter((a) => a.status === status);
    }

    return filtered;
  });

  updateSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  updateRole(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedRole.set(
      select.value as
        'admin' | 'security_guard' | 'home_dean' | 'vpsas' | 'business_officer' | 'all',
    );
  }

  updateStatus(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedStatus.set(select.value as 'active' | 'suspended' | 'all');
  }

  getRoleLabel(role: string, deanType?: 'male' | 'female' | null): string {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'security_guard':
        return 'Security Guard';
      case 'home_dean':
        if (deanType === 'male') return 'Dean for Males';
        if (deanType === 'female') return 'Dean for Females';
        return 'Home Dean';
      case 'vpsas':
        return 'VPSAS';
      case 'business_officer':
        return 'Business Officer';
      default:
        return role;
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
      '#4a90d9',
      '#667eea',
      '#27ae60',
      '#e74c3c',
      '#f39c12',
      '#9b59b6',
      '#1abc9c',
      '#e67e22',
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
      phone: '',
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
    this.newAgent.update((current) => {
      const updated = {
        ...current,
        [field]: input.value,
      };
      // Reset deanType when role changes to non-home_dean
      if (field === 'role' && input.value !== 'home_dean') {
        updated.deanType = undefined;
      }
      return updated;
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
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
      },
    });
  }

  // View agent methods
  openViewModal(agent: Agent): void {
    this.viewingAgent.set(agent);
    this.showViewModal.set(true);
  }

  closeViewModal(): void {
    this.showViewModal.set(false);
    this.viewingAgent.set(null);
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
      },
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
    if (reason.length < 10) {
      this.suspendError.set('Please provide a reason of at least 10 characters');
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
      },
    });
  }

  openReactivateModal(agent: Agent): void {
    this.reactivatingAgent.set(agent);
    this.reactivateError.set('');
    this.showReactivateModal.set(true);
  }

  closeReactivateModal(): void {
    this.showReactivateModal.set(false);
    this.reactivatingAgent.set(null);
    this.reactivateError.set('');
  }

  confirmReactivate(): void {
    const agent = this.reactivatingAgent();
    if (!agent) return;

    this.reactivateSaving.set(true);
    this.reactivateError.set('');

    this.agentsService.reactivateAgent(agent.id).subscribe({
      next: () => {
        this.reactivateSaving.set(false);
        this.showReactivateModal.set(false);
        this.reactivatingAgent.set(null);
        this.loadAgents();
      },
      error: (err) => {
        this.reactivateSaving.set(false);
        this.reactivateError.set(err.error?.error || 'Failed to reactivate staff member');
      },
    });
  }

  // ---- Reset password ----
  openResetModal(agent: Agent): void {
    this.resettingAgent.set(agent);
    this.resetPwd = '';
    this.resetConfirm = '';
    this.resetError.set('');
    this.resetSuccess.set('');
    this.showResetPwd.set(false);
    this.showResetModal.set(true);
  }

  closeResetModal(): void {
    this.showResetModal.set(false);
    this.resettingAgent.set(null);
    this.resetPwd = '';
    this.resetConfirm = '';
    this.resetError.set('');
    this.resetSuccess.set('');
  }

  toggleResetPwdVisibility(): void {
    this.showResetPwd.update((v) => !v);
  }

  confirmReset(): void {
    const agent = this.resettingAgent();
    if (!agent) return;

    const pwd = this.resetPwd.trim();
    if (pwd.length < 6) {
      this.resetError.set('Password must be at least 6 characters');
      return;
    }
    if (pwd !== this.resetConfirm.trim()) {
      this.resetError.set('Passwords do not match');
      return;
    }

    this.resetSaving.set(true);
    this.resetError.set('');
    this.agentsService.resetPassword(agent.id, pwd).subscribe({
      next: () => {
        this.resetSaving.set(false);
        this.resetSuccess.set(`Password reset for ${agent.first_name} ${agent.last_name}.`);
        this.resetPwd = '';
        this.resetConfirm = '';
      },
      error: (err) => {
        this.resetSaving.set(false);
        this.resetError.set(err.error?.error || 'Failed to reset password');
      },
    });
  }

  openDeleteModal(agent: Agent): void {
    this.deletingAgent.set(agent);
    this.deleteError.set('');
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deletingAgent.set(null);
    this.deleteError.set('');
  }

  confirmDelete(): void {
    const agent = this.deletingAgent();
    if (!agent) return;

    this.deleteSaving.set(true);
    this.deleteError.set('');

    this.agentsService.deleteAgent(agent.id).subscribe({
      next: () => {
        this.deleteSaving.set(false);
        this.showDeleteModal.set(false);
        this.deletingAgent.set(null);
        this.loadAgents();
      },
      error: (err) => {
        this.deleteSaving.set(false);
        this.deleteError.set(err.error?.error || 'Failed to delete staff member');
      },
    });
  }
}
