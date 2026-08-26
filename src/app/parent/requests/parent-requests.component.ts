import { Component, signal, inject, OnInit, OnDestroy, ElementRef, viewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParentService } from '../data/parent.service';
import { ParentGatepassService } from '../data/parent-gatepass.service';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';
import { LeaveRequest } from '../../models/leave-request.model';
import { captureFrame } from '../../shared/utils/face-verification.util';

interface RequestItem {
  kind: 'leave' | 'gatepass';
  id: number;
  created_at: string;
  childName: string;
  icon: string;
  typeLabel: string;
  destination: string;
  reason: string;
  room?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

@Component({
  selector: 'app-parent-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-requests.component.html',
  styleUrl: './parent-requests.component.scss',
})
export class ParentRequestsComponent implements OnInit, OnDestroy {
  private parentService = inject(ParentService);
  private gatepassService = inject(ParentGatepassService);
  private notifications = inject(NotificationService);
  private toast = inject(ToastService);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly requests = signal<RequestItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly approving = signal<RequestItem | null>(null);
  protected readonly declining = signal<RequestItem | null>(null);
  protected readonly saving = signal(false);
  protected readonly captured = signal('');
  protected readonly cameraReady = signal(false);
  protected readonly faceError = signal('');
  protected declineNotes = '';
  private stream: MediaStream | null = null;

  constructor() {
    // Auto-refresh the merged list whenever a leave OR gatepass notification arrives
    effect(() => {
      this.notifications.parentApprovalNeededTrigger();
      this.notifications.gatepassUpdatedTrigger();
      this.load();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [leaves, gatepasses] = await Promise.all([
        this.parentService.getPendingRequests(),
        this.gatepassService.getPending(),
      ]);

      const items: RequestItem[] = [
        ...leaves.map((l: LeaveRequest) => ({
          kind: 'leave' as const,
          id: l.id,
          created_at: l.created_at,
          childName: (l as any).user_name ?? '',
          icon: this.getLeaveTypeIcon(l.leave_type),
          typeLabel: this.getLeaveTypeLabel(l.leave_type) + ' Leave',
          destination: l.destination ?? '',
          reason: l.reason ?? '',
          room: (l as any).room_number ?? null,
          startDate: l.start_date,
          endDate: l.end_date,
        })),
        ...gatepasses.map((g) => ({
          kind: 'gatepass' as const,
          id: g.id,
          created_at: g.created_at,
          childName: g.occupant_name ?? '',
          icon: '🎫',
          typeLabel: 'Gatepass',
          destination: g.destination,
          reason: g.reason,
          room: (g as any).room_number ?? null,
        })),
      ];

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      this.requests.set(items);
    } catch {
      this.toast.error('Error', 'Failed to load requests');
    } finally {
      this.loading.set(false);
    }
  }

  private getLeaveTypeLabel(type?: string): string {
    const map: Record<string, string> = {
      special_pass: 'Special Pass',
      campus_leave: 'Campus Leave',
    };
    return type ? map[type] ?? type : '';
  }

  private getLeaveTypeIcon(type?: string): string {
    const map: Record<string, string> = {
      special_pass: '🏃',
      campus_leave: '🌙',
    };
    return type ? map[type] ?? '📋' : '📋';
  }

  // ---- Approve (face-verified) ----
  startApprove(r: RequestItem): void {
    this.captured.set('');
    this.faceError.set('');
    this.cameraReady.set(false);
    this.approving.set(r);
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

    // Same quality bar the registration capture applies. A blurry or dark frame
    // produces an unreliable descriptor, and the server rejects it anyway - catch
    // it here so the parent can simply retake instead of burning an attempt.
    const result = captureFrame(v, c);
    if ('error' in result) {
      this.faceError.set(result.error);
      return;
    }

    this.faceError.set('');
    this.captured.set(result.image);
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
    const r = this.approving();
    if (!r || !this.captured()) return;
    this.saving.set(true);
    this.faceError.set('');
    try {
      if (r.kind === 'leave') {
        await this.parentService.approveRequest(r.id, undefined, this.captured());
      } else {
        await this.gatepassService.approve(r.id, undefined, this.captured());
      }
      this.toast.success('Approved', 'Request approved.');
      this.closeApprove();
      await this.load();
    } catch (e: any) {
      const message = e?.error?.error || 'Face verification failed. Please try again.';
      this.faceError.set(message);

      if (e?.status === 429) {
        // Locked out after repeated failures - the modal is no use now.
        this.toast.error('Temporarily locked', message);
        this.closeApprove();
      } else {
        // Drop the rejected frame so the parent retakes rather than resubmitting
        // the same photo.
        this.captured.set('');
      }
    } finally {
      this.saving.set(false);
    }
  }

  // ---- Decline ----
  startDecline(r: RequestItem): void {
    this.declineNotes = '';
    this.declining.set(r);
  }
  closeDecline(): void {
    this.declining.set(null);
  }
  async confirmDecline(): Promise<void> {
    const r = this.declining();
    if (!r) return;
    this.saving.set(true);
    try {
      const notes = this.declineNotes.trim() || undefined;
      if (r.kind === 'leave') {
        await this.parentService.declineRequest(r.id, notes);
      } else {
        await this.gatepassService.decline(r.id, notes);
      }
      this.toast.info('Declined', 'Request declined.');
      this.closeDecline();
      await this.load();
    } catch {
      this.toast.error('Error', 'Failed to decline');
    } finally {
      this.saving.set(false);
    }
  }
}
