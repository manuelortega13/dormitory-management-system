import { Component, signal, ElementRef, ViewChild, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SecurityService, CheckLog } from '../data/security.service';
import { LeaveRequest } from '../../models/leave-request.model';
import jsQR from 'jsqr';

type ScanStatus = 'idle' | 'scanning' | 'verifying' | 'success' | 'error';

interface VerificationResult {
  valid: boolean;
  message: string;
  leaveRequest?: LeaveRequest;
  action?: 'exit' | 'return';
}

interface RecentActivity {
  id: number;
  name: string;
  roomNumber: string;
  leaveType: string;
  action: 'exit' | 'return';
  timestamp: Date;
}

@Component({
  selector: 'app-check-in-out',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './check-in-out.component.html',
  styleUrl: './check-in-out.component.scss'
})
export class CheckInOutComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
  
  private securityService = inject(SecurityService);

  protected readonly scanStatus = signal<ScanStatus>('idle');
  protected readonly verificationResult = signal<VerificationResult | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly currentTime = signal(new Date());
  protected readonly manualQRInput = signal('');
  
  // Camera control signals
  protected readonly isFrontCamera = signal(false);
  protected readonly cameraError = signal('');
  protected readonly isProcessing = signal(false);
  protected readonly scannerSupported = signal(true);
  
  private mediaStream: MediaStream | null = null;
  private timeInterval: any;
  private scanInterval: any;
  private barcodeDetector: any = null;

  protected readonly recentActivities = signal<RecentActivity[]>([]);
  protected readonly todayStats = signal({ exits: 0, returns: 0, total: 0 });

  constructor() {
    // Update current time every second
    this.timeInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    // Check if BarcodeDetector is supported (optional, we have jsQR fallback)
    if ('BarcodeDetector' in window) {
      this.barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    }
    // Scanner is always supported now with jsQR fallback
    this.scannerSupported.set(true);
  }

  ngOnInit() {
    this.loadTodayLogs();
  }

  async loadTodayLogs() {
    try {
      const response = await this.securityService.getTodayLogs();
      
      // Map backend logs to RecentActivity format
      const activities: RecentActivity[] = response.logs.map(log => ({
        id: log.id,
        name: `${log.first_name} ${log.last_name}`,
        roomNumber: log.room_number || '-',
        leaveType: log.leave_type || 'leave',
        action: log.type === 'check-out' ? 'exit' : 'return',
        timestamp: new Date(log.created_at)
      }));

      this.recentActivities.set(activities);
      this.todayStats.set({
        exits: response.stats.checkOuts,
        returns: response.stats.checkIns,
        total: response.stats.total
      });
    } catch (error) {
      console.error('Failed to load today logs:', error);
    }
  }

  async startScanning() {
    this.scanStatus.set('scanning');
    this.errorMessage.set('');
    this.cameraError.set('');
    this.verificationResult.set(null);

    // Check for HTTPS (required for camera on iOS)
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      this.cameraError.set('Camera requires HTTPS. Please access the app via HTTPS or enter QR code manually.');
      return;
    }

    // Check if mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.cameraError.set('Camera not supported on this device. Please enter QR code manually.');
      return;
    }

    try {
      // For iOS, use simpler constraints first
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const constraints: MediaStreamConstraints = {
        video: isIOS ? {
          facingMode: { ideal: this.isFrontCamera() ? 'user' : 'environment' }
        } : {
          facingMode: this.isFrontCamera() ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (this.videoElement?.nativeElement && this.mediaStream) {
        const video = this.videoElement.nativeElement;
        video.srcObject = this.mediaStream;
        
        // iOS requires explicit play after srcObject is set
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        
        try {
          await video.play();
          this.startQRScanning();
        } catch (playError) {
          console.error('Video play error:', playError);
          // Try play on user interaction
          this.cameraError.set('Tap the video area to start camera');
          video.onclick = async () => {
            try {
              await video.play();
              this.cameraError.set('');
              this.startQRScanning();
            } catch (e) {
              this.cameraError.set('Unable to start camera. Please enter QR code manually.');
            }
          };
        }
      }

    } catch (error: any) {
      console.error('Camera access error:', error);
      let errorMsg = 'Unable to access camera. ';
      if (error.name === 'NotAllowedError') {
        errorMsg += 'Camera permission denied. Please allow camera access in Settings > Safari > Camera.';
      } else if (error.name === 'NotFoundError') {
        errorMsg += 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMsg += 'Camera is in use by another app.';
      } else {
        errorMsg += 'Please check permissions or enter QR code manually.';
      }
      this.cameraError.set(errorMsg);
      this.scanStatus.set('idle');
    }
  }

  stopScanning() {
    this.stopCameraStream();
    this.scanStatus.set('idle');
  }

  private stopCameraStream() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.srcObject = null;
    }
  }

  private startQRScanning() {
    if (!this.videoElement?.nativeElement) {
      return;
    }

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement?.nativeElement;
    
    this.scanInterval = setInterval(async () => {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        return;
      }

      try {
        // Try native BarcodeDetector first if available
        if (this.barcodeDetector) {
          const barcodes = await this.barcodeDetector.detect(video);
          if (barcodes.length > 0) {
            const qrCode = barcodes[0].rawValue;
            if (qrCode) {
              clearInterval(this.scanInterval);
              this.scanInterval = null;
              await this.processQRCode(qrCode);
              return;
            }
          }
        }
        
        // Fallback to jsQR (works on all browsers including iOS)
        if (canvas) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });
            
            if (code && code.data) {
              clearInterval(this.scanInterval);
              this.scanInterval = null;
              await this.processQRCode(code.data);
            }
          }
        }
      } catch (error) {
        console.error('QR scan error:', error);
      }
    }, 200);
  }

  ngOnDestroy() {
    this.stopCameraStream();
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  async switchCamera() {
    if (this.scanStatus() !== 'scanning') return;
    this.isFrontCamera.update(front => !front);
    
    this.stopCameraStream();
    
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const constraints: MediaStreamConstraints = {
        video: isIOS ? {
          facingMode: { ideal: this.isFrontCamera() ? 'user' : 'environment' }
        } : {
          facingMode: this.isFrontCamera() ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.videoElement?.nativeElement && this.mediaStream) {
        const video = this.videoElement.nativeElement;
        video.srcObject = this.mediaStream;
        video.muted = true;
        await video.play();
        this.startQRScanning();
      }
    } catch (error) {
      console.error('Camera switch error:', error);
      this.cameraError.set('Unable to switch camera');
    }
  }

  updateManualQR(event: Event) {
    const input = event.target as HTMLInputElement;
    this.manualQRInput.set(input.value);
  }

  async submitManualQR() {
    const qrCode = this.manualQRInput().trim();
    if (!qrCode) {
      this.errorMessage.set('Please enter a valid QR code');
      return;
    }
    await this.processQRCode(qrCode);
  }

  // This would be called by QR scanner library when a QR code is detected
  async onQRCodeDetected(qrCode: string) {
    await this.processQRCode(qrCode);
  }

  private async processQRCode(qrCode: string) {
    this.scanStatus.set('verifying');
    this.errorMessage.set('');
    this.verificationResult.set(null);
    this.stopCameraStream();

    try {
      const result = await this.securityService.verifyQRCode(qrCode);
      
      if (result.valid && result.leave_request) {
        // Determine if this is an exit or return based on current status
        const action: 'exit' | 'return' = result.leave_request.status === 'approved' ? 'exit' : 'return';
        
        this.verificationResult.set({
          valid: true,
          message: result.message,
          leaveRequest: result.leave_request,
          action
        });
        this.scanStatus.set('success');
      } else {
        this.verificationResult.set({
          valid: false,
          message: result.message
        });
        this.scanStatus.set('error');
        this.errorMessage.set(result.message);
      }
    } catch (error: any) {
      this.scanStatus.set('error');
      this.errorMessage.set(error.message || 'Failed to verify QR code');
    }
  }

  async confirmAction() {
    const result = this.verificationResult();
    if (!result?.valid || !result.leaveRequest) return;

    this.isProcessing.set(true);

    try {
      if (result.action === 'exit') {
        await this.securityService.recordExit(result.leaveRequest.id);
      } else {
        await this.securityService.recordReturn(result.leaveRequest.id);
      }

      // Reload today's logs from backend
      await this.loadTodayLogs();
      this.resetScan();
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to record action');
    } finally {
      this.isProcessing.set(false);
    }
  }

  resetScan() {
    this.stopCameraStream();
    this.scanStatus.set('idle');
    this.verificationResult.set(null);
    this.errorMessage.set('');
    this.manualQRInput.set('');
    this.cameraError.set('');
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

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    // Parse as UTC and display in user's local timezone
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
