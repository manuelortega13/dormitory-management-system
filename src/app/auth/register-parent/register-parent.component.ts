import { Component, inject, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';

interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  studentResidentId: string;
  password: string;
  confirmPassword: string;
}

interface FieldErrors {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  studentResidentId: string;
  password: string;
  confirmPassword: string;
  faceImage: string;
}

@Component({
  selector: 'app-register-parent',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register-parent.component.html',
  styleUrl: './register-parent.component.scss'
})
export class RegisterParentComponent implements OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  private mediaStream: MediaStream | null = null;
  private detectionInterval: any = null;
  private countdownInterval: any = null;

  form: RegisterForm = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    studentResidentId: '',
    password: '',
    confirmPassword: ''
  };

  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  registrationComplete = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  
  // Face capture states
  cameraActive = signal(false);
  faceImageCaptured = signal('');
  cameraError = signal('');
  isValidatingFace = signal(false);
  faceDetected = signal(false);
  autoCapturing = signal(false);
  countdown = signal(0);
  
  fieldErrors = signal<FieldErrors>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    studentResidentId: '',
    password: '',
    confirmPassword: '',
    faceImage: ''
  });

  constructor() {
    if (this.authService.isLoggedIn()) {
      this.authService.redirectBasedOnRole();
    }
  }

  ngOnDestroy() {
    this.stopCamera();
    this.clearIntervals();
  }

  private clearIntervals() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  // Face capture methods
  async startCamera() {
    this.cameraError.set('');
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      this.cameraActive.set(true);
      
      // Wait for next tick to ensure video element is rendered
      setTimeout(() => {
        if (this.videoElement?.nativeElement) {
          this.videoElement.nativeElement.srcObject = this.mediaStream;
          // Start continuous face detection after video starts playing
          this.videoElement.nativeElement.onloadedmetadata = () => {
            this.startFaceDetectionLoop();
          };
        }
      }, 100);
    } catch (error: any) {
      console.error('Camera error:', error);
      if (error.name === 'NotAllowedError') {
        this.cameraError.set('Camera access denied. Please allow camera access to continue.');
      } else if (error.name === 'NotFoundError') {
        this.cameraError.set('No camera found. Please connect a camera and try again.');
      } else {
        this.cameraError.set('Failed to access camera. Please try again.');
      }
    }
  }

  stopCamera() {
    this.clearIntervals();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.cameraActive.set(false);
    this.faceDetected.set(false);
    this.autoCapturing.set(false);
    this.countdown.set(0);
  }

  private startFaceDetectionLoop() {
    // Clear any existing interval
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }

    // Check for face every 500ms
    this.detectionInterval = setInterval(async () => {
      if (!this.cameraActive() || this.isValidatingFace()) return;

      const isValid = await this.checkFaceInFrame();
      this.faceDetected.set(isValid);

      if (isValid && !this.autoCapturing()) {
        // Face detected and not currently capturing - start auto capture
        this.startAutoCapture();
      } else if (!isValid && this.autoCapturing()) {
        // Face lost during auto capture - cancel and wait for face to return
        this.cancelAutoCapture();
      }
      // If face is valid and already auto-capturing, let the countdown continue
      // If face is invalid and not auto-capturing, just wait for face to appear
    }, 500);
  }

  private async checkFaceInFrame(): Promise<boolean> {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return false;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0) return false;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Check for blur
    const isBlurry = this.detectBlur(context, canvas.width, canvas.height);
    if (isBlurry) return false;

    // Check for face
    const hasFace = await this.detectFace(canvas);
    return hasFace;
  }

  private startAutoCapture() {
    this.autoCapturing.set(true);
    this.countdown.set(3);
    this.cameraError.set('');

    this.countdownInterval = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        this.performCapture();
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  private cancelAutoCapture() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.autoCapturing.set(false);
    this.countdown.set(0);
  }

  private async performCapture() {
    this.clearIntervals();
    await this.capturePhoto();
  }

  async capturePhoto() {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Resize to max 640px width while maintaining aspect ratio to reduce file size
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    // Draw the current video frame (scaled down)
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get the image as base64 with reduced quality
    const imageData = canvas.toDataURL('image/jpeg', 0.7);
    
    // Validate the captured image
    this.isValidatingFace.set(true);
    this.cameraError.set('');
    
    try {
      // Check for blur
      const isBlurry = this.detectBlur(context, canvas.width, canvas.height);
      if (isBlurry) {
        this.cameraError.set('Image is too blurry. Please hold steady and try again.');
        this.isValidatingFace.set(false);
        return;
      }

      // Check for human face
      const hasFace = await this.detectFace(canvas);
      if (!hasFace) {
        this.cameraError.set('No human face detected. Please position your face clearly in the frame.');
        this.isValidatingFace.set(false);
        return;
      }

      // Validation passed
      this.faceImageCaptured.set(imageData);
      this.stopCamera();
      this.clearFieldError('faceImage');
    } catch (error) {
      console.error('Face validation error:', error);
      // If validation APIs are not available, accept the image with a warning
      this.faceImageCaptured.set(imageData);
      this.stopCamera();
      this.clearFieldError('faceImage');
    } finally {
      this.isValidatingFace.set(false);
    }
  }

  // Detect blur using Laplacian variance
  private detectBlur(context: CanvasRenderingContext2D, width: number, height: number): boolean {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Convert to grayscale and calculate Laplacian variance
    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    // Calculate Laplacian (simplified edge detection)
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        // Laplacian kernel: center * 4 - neighbors
        const laplacian = 4 * gray[idx] - 
          gray[idx - 1] - gray[idx + 1] - 
          gray[idx - width] - gray[idx + width];
        
        sum += laplacian;
        sumSq += laplacian * laplacian;
        count++;
      }
    }

    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);

    // Lower variance indicates more blur (threshold determined empirically)
    const blurThreshold = 100;
    return variance < blurThreshold;
  }

  // Detect human face using FaceDetector API or fallback
  private async detectFace(canvas: HTMLCanvasElement): Promise<boolean> {
    // Try using the FaceDetector API (available in Chrome/Edge)
    if ('FaceDetector' in window) {
      try {
        const faceDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const faces = await faceDetector.detect(canvas);
        return faces.length > 0;
      } catch (error) {
        console.warn('FaceDetector API failed:', error);
      }
    }

    // Fallback: Use basic skin tone detection as a heuristic
    return this.detectSkinTone(canvas);
  }

  // Fallback face detection using skin tone analysis
  private detectSkinTone(canvas: HTMLCanvasElement): boolean {
    const context = canvas.getContext('2d');
    if (!context) return true; // Allow if we can't check

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let skinPixels = 0;
    const totalPixels = data.length / 4;

    // Check center region of the image (where face should be)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const regionSize = Math.min(canvas.width, canvas.height) * 0.4;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        // Only check center region
        if (Math.abs(x - centerX) > regionSize || Math.abs(y - centerY) > regionSize) continue;

        const idx = (y * canvas.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Skin tone detection (works for various skin tones)
        // Based on RGB color space skin detection rules
        if (r > 95 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15 &&
            (Math.max(r, g, b) - Math.min(r, g, b)) > 15) {
          skinPixels++;
        }
      }
    }

    // Calculate skin tone percentage in center region
    const centerPixels = (regionSize * 2) * (regionSize * 2);
    const skinPercentage = (skinPixels / centerPixels) * 100;

    // Require at least 15% skin tone in center region
    return skinPercentage > 15;
  }

  retakePhoto() {
    this.faceImageCaptured.set('');
    this.startCamera();
  }

  validateForm(): boolean {
    const errors: FieldErrors = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      studentResidentId: '',
      password: '',
      confirmPassword: '',
      faceImage: ''
    };

    let isValid = true;

    if (!this.form.firstName.trim()) {
      errors.firstName = 'First name is required';
      isValid = false;
    }

    if (!this.form.lastName.trim()) {
      errors.lastName = 'Last name is required';
      isValid = false;
    }

    if (!this.form.email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!this.form.phone.trim()) {
      errors.phone = 'Phone number is required';
      isValid = false;
    } else if (!/^[0-9+\-\s()]{7,15}$/.test(this.form.phone.trim())) {
      errors.phone = 'Please enter a valid phone number';
      isValid = false;
    }

    if (!this.form.studentResidentId.trim()) {
      errors.studentResidentId = 'Student Resident ID is required';
      isValid = false;
    } else if (!/^PAC-[A-Z0-9]{6}$/.test(this.form.studentResidentId.trim().toUpperCase())) {
      errors.studentResidentId = 'Please enter a valid Student Resident ID (e.g., PAC-ABC123)';
      isValid = false;
    }

    if (!this.form.password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (this.form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (!this.form.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (this.form.password !== this.form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    if (!this.faceImageCaptured()) {
      errors.faceImage = 'Face capture is required for identity verification';
      isValid = false;
    }

    this.fieldErrors.set(errors);
    return isValid;
  }

  clearFieldError(field: keyof FieldErrors): void {
    this.fieldErrors.update(errors => ({ ...errors, [field]: '' }));
  }

  async onSubmit() {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.validateForm()) {
      this.errorMessage.set('Please fix the errors below.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.isLoading.set(true);

    try {
      const registerData = {
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim(),
        phone: this.form.phone.trim(),
        studentResidentId: this.form.studentResidentId.trim().toUpperCase(),
        password: this.form.password,
        role: 'parent' as const,
        faceImage: this.faceImageCaptured()
      };

      const response = await this.authService.register(registerData);

      if (response.requiresApproval) {
        this.registrationComplete.set(true);
        this.successMessage.set('Registration submitted! Your account is pending admin approval. You will be notified once approved.');
        // Reset form
        this.form = {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          studentResidentId: '',
          password: '',
          confirmPassword: ''
        };
        this.faceImageCaptured.set('');
        this.stopCamera();
      } else {
        this.successMessage.set('Registration successful! Redirecting to your dashboard...');
        setTimeout(() => {
          this.authService.redirectBasedOnRole();
        }, 1500);
      }
    } catch (error: any) {
      if (error.status === 400) {
        this.errorMessage.set(error.error?.error || 'Email already registered');
      } else {
        this.errorMessage.set(error.error?.error || 'Registration failed. Please try again.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      this.isLoading.set(false);
    }
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update(v => !v);
  }
}
