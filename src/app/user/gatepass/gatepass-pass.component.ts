import { Component, signal, inject, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GatepassService } from '../data/gatepass.service';
import { Gatepass, GatepassExtension } from '../../models/gatepass.model';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';
import { compressImage } from '../../shared/utils/image.util';

@Component({
  selector: 'app-gatepass-pass',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="gp-pass">
      <a routerLink="/gatepass" class="back">← Back</a>

      @if (loading()) {
        <div class="state">Loading…</div>
      } @else if (!gp()) {
        <div class="state">Gatepass not found.</div>
      } @else {
        <div class="pass-card">
          <h2>{{ gp()!.destination }}</h2>
          <p class="reason">{{ gp()!.reason }}</p>

          @if (gp()!.status === 'approved') {
            <p class="hint">Show this QR to the guard at the gate.</p>
            <img class="qr" [src]="qrUrl()" alt="Gatepass QR" />
          } @else if (gp()!.status === 'active') {
            <div class="timer" [class.overdue]="overdue()">
              <span class="timer-label">{{ overdue() ? 'OVERDUE BY' : 'Time remaining' }}</span>
              <span class="timer-value">{{ remainingText() }}</span>
            </div>
            <p class="hint">Show this QR to the guard when you return.</p>
            <img class="qr" [src]="qrUrl()" alt="Gatepass QR" />
            <button class="btn-primary" (click)="openExtend()">⏱ Extend (+1 hour)</button>
          } @else {
            <p class="hint">This gatepass is {{ gp()!.status }}.</p>
          }
        </div>

        @if (extensions().length > 0) {
          <div class="ext-list">
            <h3>Extensions</h3>
            @for (e of extensions(); track e.id) {
              <div class="ext-item">
                <span class="ext-reason">{{ e.reason }}</span>
                <span class="ext-status" [class]="e.review_status">{{
                  reviewLabel(e.review_status)
                }}</span>
                <span class="ext-date">{{ e.created_at | date: 'short' }}</span>
              </div>
            }
          </div>
        }
      }
    </div>

    @if (showExtend()) {
      <div class="modal-overlay" (click)="closeExtend()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Extend Gatepass</h2>
          <p class="sub">Add another hour. A reason and a supporting photo are required.</p>
          @if (extError()) {
            <div class="error">{{ extError() }}</div>
          }
          <label>Reason <span class="req">*</span></label>
          <textarea
            rows="3"
            [(ngModel)]="extReason"
            placeholder="Why do you need more time?"
          ></textarea>
          <label>Supporting photo <span class="req">*</span></label>
          <input type="file" accept="image/*" (change)="onImage($event)" />
          @if (extImage()) {
            <img class="preview" [src]="extImage()" alt="preview" />
          }
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeExtend()" [disabled]="extSaving()">
              Cancel
            </button>
            <button class="btn-primary" (click)="submitExtend()" [disabled]="extSaving()">
              {{ extSaving() ? 'Submitting…' : 'Extend' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .gp-pass {
        padding: 1rem;
        max-width: 480px;
        margin: 0 auto;
      }
      .back {
        color: #4361ee;
        text-decoration: none;
        font-size: 0.9rem;
      }
      .state {
        padding: 2rem;
        text-align: center;
        color: #6c757d;
      }
      .pass-card {
        background: #fff;
        border: 1px solid #eee;
        border-radius: 14px;
        padding: 1.5rem;
        text-align: center;
        margin-top: 0.75rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }
      .pass-card h2 {
        margin: 0 0 0.25rem;
      }
      .reason {
        color: #495057;
        margin: 0 0 1rem;
      }
      .hint {
        color: #6c757d;
        font-size: 0.85rem;
      }
      .qr {
        width: 230px;
        height: 230px;
        margin: 0.5rem auto;
        display: block;
      }
      .timer {
        background: #cfe2ff;
        border-radius: 12px;
        padding: 1rem;
        margin: 0.5rem 0 1rem;
      }
      .timer.overdue {
        background: #f8d7da;
      }
      .timer-label {
        display: block;
        font-size: 0.75rem;
        color: #084298;
        letter-spacing: 0.05em;
      }
      .timer.overdue .timer-label {
        color: #842029;
      }
      .timer-value {
        font-size: 2rem;
        font-weight: 700;
        color: #084298;
      }
      .timer.overdue .timer-value {
        color: #842029;
      }
      .btn-primary {
        background: #4361ee;
        color: #fff;
        border: none;
        padding: 0.7rem 1.2rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        margin-top: 0.75rem;
      }
      .btn-secondary {
        background: #f1f3f5;
        border: 1px solid #dee2e6;
        padding: 0.7rem 1.2rem;
        border-radius: 8px;
        cursor: pointer;
      }
      .btn-primary:disabled,
      .btn-secondary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .ext-list {
        margin-top: 1.25rem;
      }
      .ext-item {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        align-items: center;
        background: #fff;
        border: 1px solid #eee;
        border-radius: 8px;
        padding: 0.6rem 0.8rem;
        margin-bottom: 0.4rem;
      }
      .ext-reason {
        flex: 1;
        font-size: 0.85rem;
      }
      .ext-status {
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.15rem 0.5rem;
        border-radius: 12px;
      }
      .ext-status.pending_review {
        background: #fff3cd;
        color: #856404;
      }
      .ext-status.task_assigned {
        background: #f8d7da;
        color: #842029;
      }
      .ext-status.waived {
        background: #d1e7dd;
        color: #0f5132;
      }
      .ext-date {
        font-size: 0.7rem;
        color: #adb5bd;
      }
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1100;
        padding: 1rem;
      }
      .modal {
        background: #fff;
        border-radius: 12px;
        padding: 1.5rem;
        width: 100%;
        max-width: 440px;
      }
      .modal h2 {
        margin: 0 0 0.25rem;
      }
      .sub {
        color: #6c757d;
        font-size: 0.85rem;
        margin: 0 0 1rem;
      }
      .modal label {
        display: block;
        margin: 0.75rem 0 0.3rem;
        font-weight: 600;
        font-size: 0.85rem;
      }
      .modal textarea,
      .modal input {
        width: 100%;
        padding: 0.6rem;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        font-family: inherit;
      }
      .preview {
        max-width: 100%;
        margin-top: 0.5rem;
        border-radius: 8px;
        max-height: 160px;
      }
      .req {
        color: #dc3545;
      }
      .error {
        background: #f8d7da;
        color: #842029;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        font-size: 0.85rem;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1.25rem;
      }
    `,
  ],
})
export class GatepassPassComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private service = inject(GatepassService);
  private toast = inject(ToastService);
  private notifications = inject(NotificationService);
  private passId = 0;

  constructor() {
    effect(() => {
      if (this.notifications.gatepassUpdatedTrigger() > 0 && this.passId)
        this.loadPass(this.passId);
    });
  }

  protected readonly gp = signal<Gatepass | null>(null);
  protected readonly extensions = signal<GatepassExtension[]>([]);
  protected readonly loading = signal(true);
  private readonly now = signal(Date.now());
  private tick?: any;

  protected readonly showExtend = signal(false);
  protected readonly extSaving = signal(false);
  protected readonly extError = signal('');
  protected readonly extImage = signal('');
  protected extReason = '';

  protected readonly qrUrl = computed(() => {
    const code = this.gp()?.qr_code;
    return code
      ? `https://api.qrserver.com/v1/create-qr-code/?size=230x230&data=${encodeURIComponent(code)}`
      : '';
  });

  private readonly remainingMs = computed(() => {
    const dl = this.gp()?.deadline;
    if (!dl) return 0;
    return new Date(dl).getTime() - this.now();
  });
  protected readonly overdue = computed(() => this.remainingMs() < 0);
  protected readonly remainingText = computed(() => {
    let ms = Math.abs(this.remainingMs());
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  });

  ngOnInit(): void {
    this.passId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadPass(this.passId);
    this.tick = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    if (this.tick) clearInterval(this.tick);
  }

  async loadPass(id: number): Promise<void> {
    this.loading.set(true);
    try {
      const [pass, exts] = await Promise.all([
        this.service.getById(id),
        this.service.getExtensions(id),
      ]);
      this.gp.set(pass);
      this.extensions.set(exts);
    } catch {
      this.toast.error('Error', 'Failed to load gatepass');
    } finally {
      this.loading.set(false);
    }
  }

  reviewLabel(s: string): string {
    return (
      { pending_review: 'Pending review', task_assigned: 'Task assigned', waived: 'Waived' }[s] || s
    );
  }

  openExtend(): void {
    this.extReason = '';
    this.extImage.set('');
    this.extError.set('');
    this.showExtend.set(true);
  }
  closeExtend(): void {
    this.showExtend.set(false);
  }

  async onImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.extError.set('Please select an image file');
      return;
    }
    this.extError.set('');
    try {
      // Compress (downscale + re-encode) so large phone photos don't get rejected
      this.extImage.set(await compressImage(file));
    } catch {
      this.extError.set('Could not process that image. Please try another.');
    }
  }

  async submitExtend(): Promise<void> {
    if (!this.extReason.trim() || !this.extImage()) {
      this.extError.set('A reason and a photo are required');
      return;
    }
    this.extSaving.set(true);
    this.extError.set('');
    try {
      await this.service.extend(this.gp()!.id, this.extReason.trim(), this.extImage());
      this.showExtend.set(false);
      this.toast.success('Extended', 'Your gatepass has been extended by an hour.');
      await this.loadPass(this.gp()!.id);
    } catch (e: any) {
      this.extError.set(e?.error?.error || 'Failed to extend gatepass');
    } finally {
      this.extSaving.set(false);
    }
  }
}
