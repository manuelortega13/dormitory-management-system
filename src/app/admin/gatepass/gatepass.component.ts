import { Component, signal, inject, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminGatepassService } from './data/admin-gatepass.service';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../auth/auth.service';
import { Gatepass, DisciplinaryReview } from '../../models/gatepass.model';
import { Task } from '../../models/task.model';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';
import { ResidentsService } from '../residents/data/residents.service';
import { Resident } from '../residents/data/resident.model';

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
  private residentsService = inject(ResidentsService);

  constructor() {
    effect(() => {
      if (this.notifications.gatepassUpdatedTrigger() > 0) this.loadAll();
    });
  }

  protected readonly role = signal(this.auth.getCurrentUser()?.role ?? '');
  protected readonly isDean = computed(() => ['admin', 'home_dean'].includes(this.role()));
  protected readonly isVpsas = computed(() => ['admin', 'vpsas'].includes(this.role()));

  protected readonly activeTab = signal<'approvals' | 'reviews' | 'passes' | 'tasks'>('approvals');
  protected readonly loading = signal(false);

  protected readonly deanQueue = signal<Gatepass[]>([]);
  protected readonly vpsasQueue = signal<Gatepass[]>([]);
  protected readonly reviews = signal<DisciplinaryReview[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  // Approved / active / completed gatepasses (they have a QR to print)
  protected readonly passes = signal<Gatepass[]>([]);

  // Search (by occupant name or student ID) + task status filter
  protected readonly searchQuery = signal('');
  protected readonly taskStatusFilter = signal<'all' | 'pending' | 'completed'>('all');

  private matchesSearch(name?: string | null, studentId?: string | null): boolean {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return true;
    return (
      (name?.toLowerCase().includes(q) ?? false) || (studentId?.toLowerCase().includes(q) ?? false)
    );
  }

  protected readonly filteredDeanQueue = computed(() =>
    this.deanQueue().filter((g) => this.matchesSearch(g.occupant_name, g.student_resident_id)),
  );
  protected readonly filteredVpsasQueue = computed(() =>
    this.vpsasQueue().filter((g) => this.matchesSearch(g.occupant_name, g.student_resident_id)),
  );
  protected readonly filteredReviews = computed(() =>
    this.reviews().filter((r) => this.matchesSearch(r.occupant_name, r.student_resident_id)),
  );
  protected readonly filteredTasks = computed(() =>
    this.tasks().filter(
      (t) =>
        this.matchesSearch(t.occupant_name, t.student_resident_id) &&
        (this.taskStatusFilter() === 'all' || t.status === this.taskStatusFilter()),
    ),
  );
  protected readonly filteredPasses = computed(() =>
    this.passes().filter((g) => this.matchesSearch(g.occupant_name, g.student_resident_id)),
  );

  // Decline modal
  protected readonly declineTarget = signal<Gatepass | null>(null);
  protected declineNotes = '';
  // Assign-task modal
  protected readonly taskTarget = signal<DisciplinaryReview | null>(null);
  protected taskTitle = '';
  protected taskDesc = '';
  protected taskDue = '';
  protected readonly saving = signal(false);

  // ---- Create-for-occupant modal ----
  protected readonly showCreateModal = signal(false);
  protected readonly createSaving = signal(false);
  protected readonly createError = signal('');
  protected readonly occupants = signal<Resident[]>([]);
  protected readonly occupantQuery = signal('');
  protected readonly selectedOccupant = signal<Resident | null>(null);
  protected readonly filteredOccupants = computed(() => {
    const q = this.occupantQuery().toLowerCase().trim();
    if (!q) return [];
    return this.occupants()
      .filter(
        (r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
          (r.student_resident_id ?? '').toLowerCase().includes(q),
      )
      .slice(0, 25);
  });
  protected cReason = '';
  protected cDestination = '';

  openCreateModal(): void {
    this.createError.set('');
    this.selectedOccupant.set(null);
    this.occupantQuery.set('');
    this.cReason = '';
    this.cDestination = '';
    this.showCreateModal.set(true);
    this.residentsService.getResidents({ status: 'active' }).subscribe({
      next: (list) => this.occupants.set(list),
      error: () => this.createError.set('Failed to load occupants'),
    });
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  selectOccupant(r: Resident): void {
    this.selectedOccupant.set(r);
    this.occupantQuery.set('');
  }

  clearOccupant(): void {
    this.selectedOccupant.set(null);
  }

  async submitCreateForOccupant(): Promise<void> {
    const occ = this.selectedOccupant();
    if (!occ) {
      this.createError.set('Please select an occupant');
      return;
    }
    if (!this.cReason.trim() || !this.cDestination.trim()) {
      this.createError.set('Reason and destination are required');
      return;
    }
    this.createSaving.set(true);
    this.createError.set('');
    try {
      await this.service.createForOccupant({
        userId: occ.id,
        reason: this.cReason.trim(),
        destination: this.cDestination.trim(),
      });
      this.toast.success('Created', `Gatepass created for ${occ.first_name} ${occ.last_name}.`);
      this.showCreateModal.set(false);
      await this.loadAll();
    } catch (err: any) {
      this.createError.set(err?.error?.error || 'Failed to create gatepass');
    } finally {
      this.createSaving.set(false);
    }
  }

  // Print the QR code of an approved gatepass (e.g. for an occupant with no phone)
  printGatepassQR(g: Gatepass): void {
    if (!g.qr_code) {
      this.toast.error('No QR code', 'This gatepass has no QR code yet.');
      return;
    }
    const esc = (s: unknown) =>
      String(s ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
      );
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
      g.qr_code,
    )}`;
    const name = esc(g.occupant_name || 'Occupant');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Gatepass QR — ${name}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; color: #1a1a2e; }
    .pass { max-width: 480px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; padding: 28px; text-align: center; }
    h1 { font-size: 1.15rem; margin: 0 0 2px; }
    .sub { color: #666; font-size: 0.8rem; margin: 0 0 14px; }
    .qr { width: 260px; height: 260px; margin: 4px auto 8px; display: block; }
    .code { font-family: monospace; font-size: 0.72rem; color: #555; word-break: break-all; margin: 0 0 14px; }
    .details { text-align: left; font-size: 0.85rem; border-top: 1px solid #eee; padding-top: 12px; }
    .details div { margin-bottom: 6px; }
    .details .lbl { color: #888; }
    @media print { @page { margin: 12mm; } .pass { border: none; } }
  </style>
</head>
<body>
  <div class="pass">
    <h1>Campus Gatepass</h1>
    <p class="sub">Present this QR code to the security guard</p>
    <img class="qr" src="${qrUrl}" alt="Gatepass QR" />
    <p class="code">${esc(g.qr_code)}</p>
    <div class="details">
      <div><span class="lbl">Occupant:</span> ${name}</div>
      <div><span class="lbl">Room:</span> ${esc(g.room_number || '-')}</div>
      <div><span class="lbl">Destination:</span> ${esc(g.destination)}</div>
      <div><span class="lbl">Reason:</span> ${esc(g.reason)}</div>
    </div>
  </div>
  <script>
    var img = document.querySelector('img');
    function go() { window.focus(); window.print(); }
    if (img.complete) { go(); } else { img.onload = go; img.onerror = go; }
    window.onafterprint = function () { window.close(); };
  </script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1100,height=720');
    if (!w) {
      this.toast.error('Pop-up blocked', 'Allow pop-ups for this site to print the QR code.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  ngOnInit(): void {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const jobs: Promise<any>[] = [];
      if (this.isDean())
        jobs.push(this.service.getPendingDean().then((d) => this.deanQueue.set(d)));
      if (this.isVpsas())
        jobs.push(this.service.getPendingVpsas().then((d) => this.vpsasQueue.set(d)));
      if (this.isDean())
        jobs.push(this.service.getPendingDisciplinary().then((d) => this.reviews.set(d)));
      jobs.push(this.taskService.getAllTasks().then((d) => this.tasks.set(d)));
      // Gatepasses that have a QR (approved/active/completed)
      jobs.push(
        this.service.getAll().then((list) => this.passes.set(list.filter((g) => !!g.qr_code))),
      );
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
      if (g.status === 'pending_dean')
        await this.service.deanDecline(g.id, this.declineNotes.trim() || undefined);
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

  // ---- Disciplinary reviews ----
  openAssign(r: DisciplinaryReview): void {
    this.taskTitle = '';
    this.taskDesc = '';
    this.taskDue = '';
    this.taskTarget.set(r);
  }
  closeAssign(): void {
    this.taskTarget.set(null);
  }
  async confirmAssign(): Promise<void> {
    const r = this.taskTarget();
    if (!r) return;
    if (!this.taskTitle.trim()) {
      this.toast.error('Error', 'A task title is required');
      return;
    }
    this.saving.set(true);
    try {
      await this.service.assignTask(r.id, {
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
  async waive(r: DisciplinaryReview): Promise<void> {
    try {
      await this.service.waive(r.id);
      this.toast.info('Waived', 'Review waived — no disciplinary action.');
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
