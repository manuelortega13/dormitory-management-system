import { Component, signal, inject, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminGatepassService } from './data/admin-gatepass.service';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../auth/auth.service';
import { Gatepass, GatepassExtension } from '../../models/gatepass.model';
import { Task } from '../../models/task.model';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-admin-gatepass',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gatepass.component.html',
  styleUrl: './gatepass.component.scss',
})
export class AdminGatepassComponent implements OnInit {
  private service = inject(AdminGatepassService);
  private taskService = inject(TaskService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private notifications = inject(NotificationService);

  constructor() {
    effect(() => {
      if (this.notifications.gatepassUpdatedTrigger() > 0) this.loadAll();
    });
  }

  protected readonly role = signal(this.auth.getCurrentUser()?.role ?? '');
  protected readonly isDean = computed(() => ['admin', 'home_dean'].includes(this.role()));
  protected readonly isVpsas = computed(() => ['admin', 'vpsas'].includes(this.role()));

  protected readonly activeTab = signal<'approvals' | 'reviews' | 'tasks'>('approvals');
  protected readonly loading = signal(false);

  protected readonly deanQueue = signal<Gatepass[]>([]);
  protected readonly vpsasQueue = signal<Gatepass[]>([]);
  protected readonly reviews = signal<GatepassExtension[]>([]);
  protected readonly tasks = signal<Task[]>([]);

  // Decline modal
  protected readonly declineTarget = signal<Gatepass | null>(null);
  protected declineNotes = '';
  // Assign-task modal
  protected readonly taskTarget = signal<GatepassExtension | null>(null);
  protected taskTitle = '';
  protected taskDesc = '';
  protected taskDue = '';
  protected readonly saving = signal(false);

  ngOnInit(): void {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const jobs: Promise<any>[] = [];
      if (this.isDean()) jobs.push(this.service.getPendingDean().then((d) => this.deanQueue.set(d)));
      if (this.isVpsas()) jobs.push(this.service.getPendingVpsas().then((d) => this.vpsasQueue.set(d)));
      if (this.isDean()) jobs.push(this.service.getPendingExtensionReviews().then((d) => this.reviews.set(d)));
      jobs.push(this.taskService.getAllTasks().then((d) => this.tasks.set(d)));
      await Promise.all(jobs);
    } catch {
      this.toast.error('Error', 'Failed to load gatepasses');
    } finally {
      this.loading.set(false);
    }
  }

  statusLabel(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ---- Approvals ----
  async approve(g: Gatepass): Promise<void> {
    try {
      if (g.status === 'pending_dean') await this.service.deanApprove(g.id);
      else await this.service.vpsasApprove(g.id);
      this.toast.success('Approved', 'Gatepass approved.');
      await this.loadAll();
    } catch (e: any) {
      this.toast.error('Error', e?.error?.error || 'Failed to approve');
    }
  }
  openDecline(g: Gatepass): void {
    this.declineNotes = '';
    this.declineTarget.set(g);
  }
  async confirmDecline(): Promise<void> {
    const g = this.declineTarget();
    if (!g) return;
    this.saving.set(true);
    try {
      if (g.status === 'pending_dean') await this.service.deanDecline(g.id, this.declineNotes.trim() || undefined);
      else await this.service.vpsasDecline(g.id, this.declineNotes.trim() || undefined);
      this.toast.info('Declined', 'Gatepass declined.');
      this.declineTarget.set(null);
      await this.loadAll();
    } catch {
      this.toast.error('Error', 'Failed to decline');
    } finally {
      this.saving.set(false);
    }
  }

  // ---- Extension reviews ----
  openAssign(e: GatepassExtension): void {
    this.taskTitle = '';
    this.taskDesc = '';
    this.taskDue = '';
    this.taskTarget.set(e);
  }
  closeAssign(): void {
    this.taskTarget.set(null);
  }
  async confirmAssign(): Promise<void> {
    const e = this.taskTarget();
    if (!e) return;
    if (!this.taskTitle.trim()) {
      this.toast.error('Error', 'A task title is required');
      return;
    }
    this.saving.set(true);
    try {
      await this.service.assignTask(e.id, {
        title: this.taskTitle.trim(),
        description: this.taskDesc.trim() || undefined,
        due_date: this.taskDue || undefined,
      });
      this.toast.success('Assigned', 'Disciplinary task assigned.');
      this.taskTarget.set(null);
      await this.loadAll();
    } catch (err: any) {
      this.toast.error('Error', err?.error?.error || 'Failed to assign task');
    } finally {
      this.saving.set(false);
    }
  }
  async waive(e: GatepassExtension): Promise<void> {
    try {
      await this.service.waiveExtension(e.id);
      this.toast.info('Waived', 'Extension waived — no disciplinary action.');
      await this.loadAll();
    } catch {
      this.toast.error('Error', 'Failed to waive');
    }
  }

  // ---- Tasks ----
  async completeTask(t: Task): Promise<void> {
    try {
      await this.taskService.completeTask(t.id);
      this.toast.success('Done', 'Task marked completed.');
      await this.loadAll();
    } catch {
      this.toast.error('Error', 'Failed to complete task');
    }
  }
}
