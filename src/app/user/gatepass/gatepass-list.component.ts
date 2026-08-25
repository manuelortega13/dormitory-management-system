import { Component, signal, inject, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GatepassService } from '../data/gatepass.service';
import { Gatepass } from '../../models/gatepass.model';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-gatepass-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="gp-page">
      <header class="gp-header">
        <div>
          <h1>🎫 Gatepass</h1>
          <p class="subtitle">Request a short off-campus pass</p>
        </div>
        <button class="btn-primary" (click)="openCreate()">➕ New Gatepass</button>
      </header>

      @if (loading()) {
        <div class="state">Loading…</div>
      } @else if (gatepasses().length === 0) {
        <div class="state empty">No gatepasses yet. Tap “New Gatepass” to request one.</div>
      } @else {
        <div class="gp-list">
          @for (g of gatepasses(); track g.id) {
            <div class="gp-card">
              <div class="gp-card-top" (click)="open(g)">
                <div class="gp-card-main">
                  <span class="gp-dest">{{ g.destination }}</span>
                  <span class="gp-reason">{{ g.reason }}</span>
                  <span class="gp-date">Requested {{ g.created_at | date: 'medium' }}</span>
                </div>
                <div class="gp-card-side">
                  <span class="badge" [class]="statusClass(g.status)">{{ statusLabel(g.status) }}</span>
                  @if (canCancel(g)) {
                    <button class="btn-link danger" (click)="cancel(g, $event)">Cancel</button>
                  }
                  @if (g.status === 'approved' || g.status === 'active') {
                    <span class="go">View pass →</span>
                  }
                </div>
              </div>

              <!-- Approval chain -->
              <div class="approval-timeline">
                @if (g.parent_status !== 'not_required') {
                  <div class="timeline-item" [class.completed]="g.parent_status === 'approved'" [class.declined]="g.parent_status === 'declined'">
                    <span class="timeline-icon">
                      @if (g.parent_status === 'approved') { ✓ }
                      @else if (g.parent_status === 'declined') { ✗ }
                      @else { ○ }
                    </span>
                    <span class="timeline-label">Parent</span>
                  </div>
                  <div class="timeline-line" [class.completed]="g.parent_status === 'approved'"></div>
                }
                <div class="timeline-item" [class.completed]="g.dean_status === 'approved'" [class.declined]="g.dean_status === 'declined'">
                  <span class="timeline-icon">
                    @if (g.dean_status === 'approved') { ✓ }
                    @else if (g.dean_status === 'declined') { ✗ }
                    @else { ○ }
                  </span>
                  <span class="timeline-label">Home Dean</span>
                </div>
                <div class="timeline-line" [class.completed]="g.dean_status === 'approved'"></div>
                <div class="timeline-item" [class.completed]="g.qr_code">
                  <span class="timeline-icon">@if (g.qr_code) { ✓ } @else { ○ }</span>
                  <span class="timeline-label">QR Code</span>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (showCreate()) {
      <div class="modal-overlay" (click)="closeCreate()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>New Gatepass</h2>
          @if (formError()) { <div class="error">{{ formError() }}</div> }
          <label>Reason <span class="req">*</span></label>
          <textarea rows="3" [(ngModel)]="reason" placeholder="Why do you need to leave?"></textarea>
          <label>Destination <span class="req">*</span></label>
          <input type="text" [(ngModel)]="destination" placeholder="Where are you going?" />
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeCreate()" [disabled]="saving()">Cancel</button>
            <button class="btn-primary" (click)="submit()" [disabled]="saving()">
              {{ saving() ? 'Submitting…' : 'Submit Request' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .gp-page { padding: 1rem; max-width: 720px; margin: 0 auto; }
      .gp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; }
      .gp-header h1 { margin: 0; font-size: 1.4rem; }
      .subtitle { color: #6c757d; margin: 0.2rem 0 0; font-size: 0.85rem; }
      .btn-primary { background: #4361ee; color: #fff; border: none; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
      .btn-secondary { background: #f1f3f5; color: #333; border: 1px solid #dee2e6; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; }
      .btn-primary:disabled, .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
      .state { padding: 2rem; text-align: center; color: #6c757d; }
      .gp-list { display: flex; flex-direction: column; gap: 0.75rem; }
      .gp-card { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
      .gp-card-top { display: flex; justify-content: space-between; gap: 1rem; cursor: pointer; }
      .gp-card-main { display: flex; flex-direction: column; gap: 0.2rem; }
      .gp-dest { font-weight: 600; color: #1a1a2e; }
      .gp-reason { font-size: 0.85rem; color: #495057; }
      .gp-date { font-size: 0.75rem; color: #adb5bd; }
      .gp-card-side { display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; }
      .badge { padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
      .badge.pending { background: #fff3cd; color: #856404; }
      .badge.approved { background: #d1e7dd; color: #0f5132; }
      .badge.active { background: #cfe2ff; color: #084298; }
      .badge.completed { background: #e2e3e5; color: #41464b; }
      .badge.declined, .badge.cancelled { background: #f8d7da; color: #842029; }
      .go { font-size: 0.75rem; color: #4361ee; font-weight: 600; }
      .approval-timeline { display: flex; align-items: flex-start; margin-top: 0.9rem; padding-top: 0.75rem; border-top: 1px dashed #eee; }
      .timeline-item { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; flex-shrink: 0; }
      .timeline-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; background: #e9ecef; color: #adb5bd; }
      .timeline-item.completed .timeline-icon { background: #d1e7dd; color: #0f5132; }
      .timeline-item.declined .timeline-icon { background: #f8d7da; color: #842029; }
      .timeline-item.na .timeline-icon { background: #e2e3e5; color: #6c757d; }
      .timeline-label { font-size: 0.66rem; color: #6c757d; white-space: nowrap; }
      .timeline-item.completed .timeline-label { color: #0f5132; }
      .timeline-line { flex: 1; height: 2px; background: #e9ecef; margin: 11px 0.25rem 0; }
      .timeline-line.completed { background: #74c69d; }
      .btn-link { background: none; border: none; cursor: pointer; font-size: 0.78rem; padding: 0; }
      .btn-link.danger { color: #dc3545; }
      .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem; }
      .modal { background: #fff; border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 440px; }
      .modal h2 { margin: 0 0 1rem; }
      .modal label { display: block; margin: 0.75rem 0 0.3rem; font-weight: 600; font-size: 0.85rem; }
      .modal textarea, .modal input { width: 100%; padding: 0.6rem; border: 1px solid #dee2e6; border-radius: 8px; font-family: inherit; }
      .req { color: #dc3545; }
      .error { background: #f8d7da; color: #842029; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.85rem; }
      .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; }
    `,
  ],
})
export class GatepassListComponent implements OnInit {
  private service = inject(GatepassService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private notifications = inject(NotificationService);

  constructor() {
    // Refresh in real time when a gatepass notification arrives
    effect(() => {
      if (this.notifications.gatepassUpdatedTrigger() > 0) this.load();
    });
  }

  protected readonly gatepasses = signal<Gatepass[]>([]);
  protected readonly loading = signal(true);
  protected readonly showCreate = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected reason = '';
  protected destination = '';

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.gatepasses.set(await this.service.getMyGatepasses());
    } catch {
      this.toast.error('Error', 'Failed to load gatepasses');
    } finally {
      this.loading.set(false);
    }
  }

  statusLabel(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  statusClass(s: string): string {
    if (s.startsWith('pending')) return 'pending';
    return s;
  }
  canCancel(g: Gatepass): boolean {
    return ['pending_parent', 'pending_dean', 'approved'].includes(g.status);
  }

  open(g: Gatepass): void {
    if (g.status === 'approved' || g.status === 'active') {
      this.router.navigate(['/gatepass', g.id]);
    }
  }

  openCreate(): void {
    this.reason = '';
    this.destination = '';
    this.formError.set('');
    this.showCreate.set(true);
  }
  closeCreate(): void {
    this.showCreate.set(false);
  }

  async submit(): Promise<void> {
    if (!this.reason.trim() || !this.destination.trim()) {
      this.formError.set('Reason and destination are required');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    try {
      await this.service.create({ reason: this.reason.trim(), destination: this.destination.trim() });
      this.showCreate.set(false);
      this.toast.success('Submitted', 'Your gatepass request was submitted for approval.');
      await this.load();
    } catch (e: any) {
      this.formError.set(e?.error?.error || 'Failed to submit gatepass');
    } finally {
      this.saving.set(false);
    }
  }

  async cancel(g: Gatepass, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.service.cancel(g.id);
      this.toast.info('Cancelled', 'Gatepass cancelled.');
      await this.load();
    } catch {
      this.toast.error('Error', 'Failed to cancel gatepass');
    }
  }
}
