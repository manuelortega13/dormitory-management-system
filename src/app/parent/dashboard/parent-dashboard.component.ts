import { Component, inject, signal, OnInit, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParentService } from '../data/parent.service';
import { LeaveRequest } from '../../models/leave-request.model';
import { NotificationService } from '../../services/notification.service';

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
      'errand': 'Errand',
      'overnight': 'Overnight',
      'weekend': 'Weekend',
      'emergency': 'Emergency',
      'other': 'Other'
    };
    return types[type] || type;
  }

  getLeaveTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'errand': '🛒',
      'overnight': '🌙',
      'weekend': '🏠',
      'emergency': '🚨',
      'other': '📝'
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
        } else {
          // Retry with longer delay if element not ready
          setTimeout(() => {
            if (this.videoElement?.nativeElement && this.mediaStream) {
              this.videoElement.nativeElement.srcObject = this.mediaStream;
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
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.cameraActive.set(false);
  }

  capturePhoto() {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Resize to max 640px width to reduce file size
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    // Draw the current video frame (scaled down)
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get the image as base64 with reduced quality
    const imageData = canvas.toDataURL('image/jpeg', 0.7);
    this.capturedFaceImage.set(imageData);
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
        // Handle HTTP error response
        const errorMessage = error?.error?.error || error?.message || 'Face verification failed. Please try again.';
        
        if (errorMessage.toLowerCase().includes('face') || 
            errorMessage.toLowerCase().includes('verification') ||
            errorMessage.toLowerCase().includes('match')) {
          this.verificationError.set(errorMessage);
        } else {
          alert(errorMessage);
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
        alert(errorMessage);
      } finally {
        this.isProcessing.set(false);
      }
    }
  }
}
