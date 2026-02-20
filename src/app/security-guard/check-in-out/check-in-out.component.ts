import { Component, signal, computed, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type ScanMode = 'check-in' | 'check-out';
type ScanStatus = 'idle' | 'scanning' | 'success' | 'error';

interface ScanResult {
  residentId: string;
  name: string;
  roomNumber: string;
  floor: number;
  photo: string;
  status: 'resident' | 'visitor';
}

interface RecentActivity {
  id: number;
  name: string;
  roomNumber: string;
  type: 'check-in' | 'check-out';
  timestamp: Date;
}

@Component({
  selector: 'app-check-in-out',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './check-in-out.component.html',
  styleUrl: './check-in-out.component.scss'
})
export class CheckInOutComponent implements OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  
  protected readonly scanMode = signal<ScanMode>('check-in');
  protected readonly scanStatus = signal<ScanStatus>('idle');
  protected readonly scanResult = signal<ScanResult | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly currentTime = signal(new Date());
  protected readonly manualIdInput = signal('');
  
  // Camera control signals
  protected readonly isFlashlightOn = signal(false);
  protected readonly isFrontCamera = signal(false);
  protected readonly zoomLevel = signal(1);
  protected readonly cameraError = signal('');
  
  private mediaStream: MediaStream | null = null;

  protected readonly recentActivities = signal<RecentActivity[]>([
    { id: 1, name: 'John Doe', roomNumber: '101', type: 'check-out', timestamp: new Date('2026-02-20T14:30:00') },
    { id: 2, name: 'Sarah Johnson', roomNumber: '205', type: 'check-in', timestamp: new Date('2026-02-20T14:15:00') },
    { id: 3, name: 'Mike Smith', roomNumber: '302', type: 'check-out', timestamp: new Date('2026-02-20T13:45:00') },
    { id: 4, name: 'Emily Brown', roomNumber: '108', type: 'check-in', timestamp: new Date('2026-02-20T13:20:00') },
    { id: 5, name: 'David Wilson', roomNumber: '210', type: 'check-in', timestamp: new Date('2026-02-20T12:50:00') }
  ]);

  protected readonly todayStats = computed(() => {
    const activities = this.recentActivities();
    return {
      checkIns: activities.filter(a => a.type === 'check-in').length,
      checkOuts: activities.filter(a => a.type === 'check-out').length,
      total: activities.length
    };
  });

  // Mock resident database
  private readonly mockResidents: Record<string, ScanResult> = {
    'RES001': { residentId: 'RES001', name: 'John Doe', roomNumber: '101', floor: 1, photo: 'JD', status: 'resident' },
    'RES002': { residentId: 'RES002', name: 'Sarah Johnson', roomNumber: '205', floor: 2, photo: 'SJ', status: 'resident' },
    'RES003': { residentId: 'RES003', name: 'Mike Smith', roomNumber: '302', floor: 3, photo: 'MS', status: 'resident' },
    'RES004': { residentId: 'RES004', name: 'Emily Brown', roomNumber: '108', floor: 1, photo: 'EB', status: 'resident' },
    'RES005': { residentId: 'RES005', name: 'David Wilson', roomNumber: '210', floor: 2, photo: 'DW', status: 'resident' }
  };

  setScanMode(mode: ScanMode) {
    this.scanMode.set(mode);
    this.resetScan();
  }

  async startScanning() {
    this.scanStatus.set('scanning');
    this.errorMessage.set('');
    this.cameraError.set('');
    this.scanResult.set(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.isFrontCamera() ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Wait for DOM to update with video element
      setTimeout(() => {
        if (this.videoElement?.nativeElement && this.mediaStream) {
          this.videoElement.nativeElement.srcObject = this.mediaStream;
          this.videoElement.nativeElement.play();
        }
      }, 100);

      // Simulate QR detection after camera is active (in production, use a QR library)
      setTimeout(() => {
        if (this.scanStatus() === 'scanning') {
          const randomIds = Object.keys(this.mockResidents);
          const randomId = randomIds[Math.floor(Math.random() * randomIds.length)];
          this.processScanResult(randomId);
        }
      }, 5000);

    } catch (error) {
      console.error('Camera access error:', error);
      this.cameraError.set('Unable to access camera. Please check permissions.');
      this.scanStatus.set('error');
      this.errorMessage.set('Camera access denied or not available');
    }
  }

  stopScanning() {
    this.stopCameraStream();
    this.scanStatus.set('idle');
    this.isFlashlightOn.set(false);
  }

  private stopCameraStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.srcObject = null;
    }
  }

  ngOnDestroy() {
    this.stopCameraStream();
  }

  toggleFlashlight() {
    if (this.scanStatus() !== 'scanning') return;
    this.isFlashlightOn.update(on => !on);
    // In production, this would interface with the device camera API
    console.log(`Flashlight ${this.isFlashlightOn() ? 'ON' : 'OFF'}`);
  }

  async switchCamera() {
    if (this.scanStatus() !== 'scanning') return;
    this.isFrontCamera.update(front => !front);
    
    // Stop current stream and restart with new camera
    this.stopCameraStream();
    
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.isFrontCamera() ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.videoElement?.nativeElement && this.mediaStream) {
        this.videoElement.nativeElement.srcObject = this.mediaStream;
        this.videoElement.nativeElement.play();
      }
    } catch (error) {
      console.error('Camera switch error:', error);
      this.cameraError.set('Unable to switch camera');
    }
  }

  adjustZoom(direction: 'in' | 'out') {
    if (this.scanStatus() !== 'scanning') return;
    this.zoomLevel.update(level => {
      if (direction === 'in') {
        return Math.min(level + 0.5, 3);
      } else {
        return Math.max(level - 0.5, 1);
      }
    });
    console.log(`Zoom level: ${this.zoomLevel()}x`);
  }

  updateManualId(event: Event) {
    const input = event.target as HTMLInputElement;
    this.manualIdInput.set(input.value.toUpperCase());
  }

  submitManualId() {
    const id = this.manualIdInput().trim();
    if (!id) {
      this.errorMessage.set('Please enter a valid ID');
      return;
    }
    this.scanStatus.set('scanning');
    
    // Simulate processing
    setTimeout(() => {
      this.processScanResult(id);
    }, 500);
  }

  private processScanResult(id: string) {
    const resident = this.mockResidents[id];
    
    // Stop camera stream once we have a result
    this.stopCameraStream();
    
    if (resident) {
      this.scanResult.set(resident);
      this.scanStatus.set('success');
      this.errorMessage.set('');
    } else {
      this.scanStatus.set('error');
      this.errorMessage.set(`No resident found with ID: ${id}`);
      this.scanResult.set(null);
    }
  }

  confirmAction() {
    const result = this.scanResult();
    if (!result) return;

    const newActivity: RecentActivity = {
      id: Date.now(),
      name: result.name,
      roomNumber: result.roomNumber,
      type: this.scanMode(),
      timestamp: new Date()
    };

    this.recentActivities.update(activities => [newActivity, ...activities]);
    this.resetScan();
  }

  resetScan() {
    this.stopCameraStream();
    this.scanStatus.set('idle');
    this.scanResult.set(null);
    this.errorMessage.set('');
    this.manualIdInput.set('');
    this.cameraError.set('');
  }

  getAvatarColor(initials: string): string {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    ];
    const index = initials.charCodeAt(0) % colors.length;
    return colors[index];
  }
}
