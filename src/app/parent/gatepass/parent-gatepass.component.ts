import { Component, signal, inject, OnInit, OnDestroy, ElementRef, viewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParentGatepassService } from '../data/parent-gatepass.service';
import { Gatepass } from '../../models/gatepass.model';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-parent-gatepass',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pg-page">
      <header><h1>🎫 Gatepass Approvals</h1><p class="subtitle">Approve your child's gatepass requests</p></header>

      @if (loading()) {
        <div class="state">Loading…</div>
      } @else if (pending().length === 0) {
        <div class="state empty">No gatepasses awaiting your approval.</div>
      } @else {
        <div class="list">
          @for (g of pending(); track g.id) {
            <div class="card">
              <div class="info">
                <span class="name">{{ g.occupant_name }}</span>
                <span class="dest">📍 {{ g.destination }}</span>
                <span class="reason">{{ g.reason }}</span>
                <span class="date">Requested {{ g.created_at | date: 'medium' }}</span>
              </div>
              <div class="actions">
                <button class="btn-approve" (click)="startApprove(g)">Approve</button>
                <button class="btn-decline" (click)="startDecline(g)">Decline</button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Face verification approve modal -->
    @if (approving()) {
      <div class="modal-overlay" (click)="closeApprove()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Face Verification</h2>
          <p class="sub">Verify your identity to approve {{ approving()!.occupant_name }}'s gatepass.</p>
          @if (faceError()) { <div class="error">{{ faceError() }}</div> }
          @if (!captured()) {
            <video #video autoplay playsinline class="cam"></video>
            <button class="btn-primary" (click)="capture()" [disabled]="!cameraReady()">📸 Capture</button>
          } @else {
            <img [src]="captured()" class="cam" alt="captured" />
            <div class="modal-actions">
              <button class="btn-secondary" (click)="retake()" [disabled]="saving()">Retake</button>
              <button class="btn-primary" (click)="confirmApprove()" [disabled]="saving()">
                {{ saving() ? 'Verifying…' : 'Verify & Approve' }}
              </button>
            </div>
          }
          <canvas #canvas hidden></canvas>
          <button class="btn-link" (click)="closeApprove()">Cancel</button>
        </div>
      </div>
    }

    <!-- Decline modal -->
    @if (declining()) {
      <div class="modal-overlay" (click)="closeDecline()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Decline Gatepass</h2>
          <label>Reason (optional)</label>
          <textarea rows="3" [(ngModel)]="declineNotes"></textarea>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeDecline()" [disabled]="saving()">Cancel</button>
            <button class="btn-decline" (click)="confirmDecline()" [disabled]="saving()">
              {{ saving() ? 'Declining…' : 'Decline' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .pg-page { padding: 1rem; max-width: 720px; margin: 0 auto; }
      header h1 { margin: 0; font-size: 1.4rem; }
      .subtitle { color: #6c757d; margin: 0.2rem 0 1rem; font-size: 0.85rem; }
      .state { padding: 2rem; text-align: center; color: #6c757d; }
      .list { display: flex; flex-direction: column; gap: 0.75rem; }
      .card { display: flex; justify-content: space-between; gap: 1rem; background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 1rem; }
      .info { display: flex; flex-direction: column; gap: 0.2rem; }
      .name { font-weight: 600; }
      .dest { font-size: 0.85rem; color: #495057; }
      .reason { font-size: 0.85rem; color: #6c757d; }
      .date { font-size: 0.72rem; color: #adb5bd; }
      .actions { display: flex; flex-direction: column; gap: 0.4rem; }
      .btn-approve { background: #2f9e44; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; }
      .btn-decline { background: #e03131; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; }
      .btn-primary { background: #4361ee; color: #fff; border: none; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; }
      .btn-secondary { background: #f1f3f5; border: 1px solid #dee2e6; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; }
      .btn-link { background: none; border: none; color: #6c757d; cursor: pointer; margin-top: 0.5rem; }
      button:disabled { opacity: 0.6; cursor: not-allowed; }
      .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem; }
      .modal { background: #fff; border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 420px; text-align: center; }
      .modal h2 { margin: 0 0 0.25rem; }
      .sub { color: #6c757d; font-size: 0.85rem; margin: 0 0 1rem; }
      .cam { width: 100%; max-width: 320px; border-radius: 10px; background: #000; aspect-ratio: 4/3; object-fit: cover; }
      label { display: block; text-align: left; margin: 0.5rem 0 0.3rem; font-weight: 600; font-size: 0.85rem; }
      textarea { width: 100%; padding: 0.6rem; border: 1px solid #dee2e6; border-radius: 8px; font-family: inherit; }
      .error { background: #f8d7da; color: #842029; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.85rem; }
      .modal-actions { display: flex; justify-content: center; gap: 0.5rem; margin-top: 1rem; }
    `,
  ],
})
export class ParentGatepassComponent implements OnInit, OnDestroy {
  private service = inject(ParentGatepassService);
  private toast = inject(ToastService);
  private notifications = inject(NotificationService);

  constructor() {
    effect(() => {
      if (this.notifications.gatepassUpdatedTrigger() > 0) this.load();
    });
  }

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly pending = signal<Gatepass[]>([]);
  protected readonly loading = signal(true);
  protected readonly approving = signal<Gatepass | null>(null);
  protected readonly declining = signal<Gatepass | null>(null);
  protected readonly saving = signal(false);
  protected readonly captured = signal('');
  protected readonly cameraReady = signal(false);
  protected readonly faceError = signal('');
  protected declineNotes = '';
  private stream: MediaStream | null = null;

  ngOnInit(): void {
    this.load();
  }
  ngOnDestroy(): void {
    this.stopCamera();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.pending.set(await this.service.getPending());
    } finally {
      this.loading.set(false);
    }
  }

  async startApprove(g: Gatepass): Promise<void> {
    this.captured.set('');
    this.faceError.set('');
    this.cameraReady.set(false);
    this.approving.set(g);
    // Wait a tick for the <video> to render
    setTimeout(() => this.startCamera(), 0);
  }

  private async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      const v = this.video()?.nativeElement;
      if (v) {
        v.srcObject = this.stream;
        this.cameraReady.set(true);
      }
    } catch {
      this.faceError.set('Unable to access the camera. Please allow camera permission.');
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  capture(): void {
    const v = this.video()?.nativeElement;
    const c = this.canvas()?.nativeElement;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    this.captured.set(c.toDataURL('image/jpeg', 0.8));
    this.stopCamera();
  }

  retake(): void {
    this.captured.set('');
    this.faceError.set('');
    this.cameraReady.set(false);
    setTimeout(() => this.startCamera(), 0);
  }

  closeApprove(): void {
    this.stopCamera();
    this.approving.set(null);
    this.captured.set('');
  }

  async confirmApprove(): Promise<void> {
    const g = this.approving();
    if (!g || !this.captured()) return;
    this.saving.set(true);
    this.faceError.set('');
    try {
      await this.service.approve(g.id, undefined, this.captured());
      this.toast.success('Approved', 'Gatepass approved. Awaiting Home Dean.');
      this.closeApprove();
      await this.load();
    } catch (e: any) {
      this.faceError.set(e?.error?.error || 'Face verification failed. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  startDecline(g: Gatepass): void {
    this.declineNotes = '';
    this.declining.set(g);
  }
  closeDecline(): void {
    this.declining.set(null);
  }
  async confirmDecline(): Promise<void> {
    const g = this.declining();
    if (!g) return;
    this.saving.set(true);
    try {
      await this.service.decline(g.id, this.declineNotes.trim() || undefined);
      this.toast.info('Declined', 'Gatepass declined.');
      this.closeDecline();
      await this.load();
    } catch {
      this.toast.error('Error', 'Failed to decline');
    } finally {
      this.saving.set(false);
    }
  }
}
