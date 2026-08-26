import { Component, inject, signal, OnInit, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParentService } from '../data/parent.service';
import { LeaveRequest } from '../../models/leave-request.model';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';
import { captureFrame } from '../../shared/utils/face-verification.util';

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-dashboard.component.html',
  styleUrl: './parent-dashboard.component.scss'
})
export class ParentDashboardComponent implements OnInit {
  private parentService = inject(ParentService);
  private notificationService = inject(NotificationService);
  private toast = inject(ToastService);

  @ViewChild('verificationVideo') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('verificationCanvas') canvasElement!: ElementRef<HTMLCanvasElement>;

  requests = signal<LeaveRequest[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  // Modal state
  showActionModal = signal(false);
  selectedRequest = signal<LeaveRequest | null>(null);
  actionType = signal<'approve' | 'decline'>('approve');
  parentNotes = signal('');
  isProcessing = signal(false);

  // Face verification state
  showFaceVerification = signal(false);
  cameraActive = signal(false);
  cameraError = signal('');
  capturedFaceImage = signal<string | null>(null);
  isVerifying = signal(false);
  verificationError = signal('');
  private mediaStream: MediaStream | null = null;

  // Auto-capture state
  autoCapturing = signal(false);
  countdown = signal(0);
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Watch for new approval requests and refresh the list
    effect(() => {
      const trigger = this.notificationService.parentApprovalNeededTrigger();
      if (trigger > 0) {
        this.loadRequests();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.loadRequests();
  }

  async loadRequests() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const data = await this.parentService.getPendingRequests();
      this.requests.set(data);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to load requests');
    } finally {
      this.isLoading.set(false);
    }
  }

  getLeaveTypeLabel(type: string): string {
    const types: Record<string, string> = {
      'special_pass': 'Special Pass',
      'campus_leave': 'Campus Leave'
    };
    return types[type] || type;
  }

  getLeaveTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'special_pass': '🛒',
      'campus_leave': '🏠'
    };
    return icons[type] || '📋';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    // Parse as UTC and display in user's local timezone
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatShortDate(dateStr: string): string {
    if (!dateStr) return '-';
    // Parse as UTC and display in user's local timezone
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  openApproveModal(request: LeaveRequest) {
    this.selectedRequest.set(request);
    this.actionType.set('approve');
    this.parentNotes.set('');
    this.showActionModal.set(true);
    // Reset face verification state
    this.showFaceVerification.set(false);
    this.capturedFaceImage.set(null);
    this.verificationError.set('');
  }

  openDeclineModal(request: LeaveRequest) {
    this.selectedRequest.set(request);
    this.actionType.set('decline');
    this.parentNotes.set('');
    this.showActionModal.set(true);
  }

  closeModal() {
    this.stopCamera();
    this.showActionModal.set(false);
    this.showFaceVerification.set(false);
    this.selectedRequest.set(null);
    this.parentNotes.set('');
    this.capturedFaceImage.set(null);
    this.verificationError.set('');
  }

  // Start face verification process for approval
  startFaceVerification() {
    this.showFaceVerification.set(true);
    this.verificationError.set('');
    this.startCamera();
  }

  async startCamera() {
    this.cameraError.set('');
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      
      // Set cameraActive first so the video element appears in the DOM
      this.cameraActive.set(true);
      
      // Wait for Angular to render the video element, then attach the stream
      setTimeout(() => {
        if (this.videoElement?.nativeElement && this.mediaStream) {
          this.videoElement.nativeElement.srcObject = this.mediaStream;
          // Start auto-capture countdown after video is playing
          this.videoElement.nativeElement.onloadedmetadata = () => {
            this.startAutoCapture();
          };
        } else {
          // Retry with longer delay if element not ready
          setTimeout(() => {
            if (this.videoElement?.nativeElement && this.mediaStream) {
              this.videoElement.nativeElement.srcObject = this.mediaStream;
              this.videoElement.nativeElement.onloadedmetadata = () => {
                this.startAutoCapture();
              };
            } else {
              this.cameraError.set('Failed to initialize camera. Please try again.');
              this.stopCamera();
            }
          }, 200);
        }
      }, 50);
    } catch (error: any) {
      console.error('Camera error:', error);
      this.cameraError.set('Unable to access camera. Please ensure camera permissions are granted.');
    }
  }

  stopCamera() {
    this.stopAutoCapture();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.cameraActive.set(false);
  }

  startAutoCapture() {
    // Don't start if already capturing
    if (this.autoCapturing()) return;
    
    this.autoCapturing.set(true);
    this.countdown.set(3);

    this.countdownInterval = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        this.stopAutoCapture();
        this.capturePhoto();
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  stopAutoCapture() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.autoCapturing.set(false);
    this.countdown.set(0);
  }

  capturePhoto() {
    // Stop auto-capture if running (for manual capture)
    this.stopAutoCapture();
    
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

    // Same quality bar as the other capture flows: a blurry or dark frame yields
    // an unreliable descriptor and the server rejects it, so catch it here and
    // let the parent retake instead of burning an attempt.
    const result = captureFrame(
      this.videoElement.nativeElement,
      this.canvasElement.nativeElement
    );

    if ('error' in result) {
      this.verificationError.set(result.error);
      // This flow captures on a countdown, so restart it rather than leaving the
      // parent staring at a live camera that will not fire again on its own.
      if (this.cameraActive()) {
        this.startAutoCapture();
      }
      return;
    }

    this.verificationError.set('');
    this.capturedFaceImage.set(result.image);
    this.stopCamera();
  }

  retakePhoto() {
    this.capturedFaceImage.set(null);
    this.verificationError.set('');
    this.startCamera();
  }

  cancelFaceVerification() {
    this.stopCamera();
    this.showFaceVerification.set(false);
    this.capturedFaceImage.set(null);
    this.verificationError.set('');
  }

  async confirmAction() {
    const request = this.selectedRequest();
    if (!request) return;

    // For approval, require face verification
    if (this.actionType() === 'approve') {
      if (!this.capturedFaceImage()) {
        // Show face verification step first
        this.startFaceVerification();
        return;
      }

      // Submit with face verification
      this.isVerifying.set(true);
      this.verificationError.set('');

      try {
        await this.parentService.approveRequest(request.id, this.parentNotes(), this.capturedFaceImage()!);
        this.closeModal();
        await this.loadRequests();
      } catch (error: any) {
        const errorMessage =
          error?.error?.error || error?.message || 'Face verification failed. Please try again.';

        if (error?.status === 429) {
          // Locked out after repeated failures - close the modal, it is no use now.
          this.toast.error('Temporarily locked', errorMessage);
          this.closeModal();
        } else if (error?.status === 403 || error?.status === 400 || error?.status === 503) {
          this.verificationError.set(errorMessage);
          // Drop the rejected frame so the parent retakes rather than resubmitting.
          this.capturedFaceImage.set(null);
        } else {
          this.toast.error('Error', errorMessage);
        }
      } finally {
        this.isVerifying.set(false);
      }
    } else {
      // For decline, no face verification needed
      this.isProcessing.set(true);

      try {
        await this.parentService.declineRequest(request.id, this.parentNotes());
        this.closeModal();
        await this.loadRequests();
      } catch (error: any) {
        const errorMessage = error?.error?.error || error?.message || 'Failed to process request';
        this.toast.error('Error', errorMessage);
      } finally {
        this.isProcessing.set(false);
      }
    }
  }
}
