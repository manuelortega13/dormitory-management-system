import { Component, signal, inject, viewChild, ElementRef, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, Bill, Payment, MakePaymentRequest, PaymentSettings, PaginationMeta } from '../../services/payment.service';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';
import { downloadImage } from '../../shared/utils/image.util';
import { composeQrCard } from '../../shared/utils/qr-card.util';
import { resolveQrImage } from '../../shared/utils/qr-render.util';

@Component({
  selector: 'app-my-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-payments.component.html',
  styleUrl: './my-payments.component.scss'
})
export class MyPaymentsComponent implements OnInit, OnDestroy {
  private paymentService = inject(PaymentService);
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastService);

  // Tab management
  activeTab = signal<'bills' | 'history'>('bills');

  // Data
  bills = signal<Bill[]>([]);
  payments = signal<Payment[]>([]);
  settings = signal<PaymentSettings | null>(null);
  isLoading = signal(true);
  errorMessage = signal('');
  successMessage = signal('');
  modalErrorMessage = signal('');

  // Stats
  totalPaid = signal(0);
  pendingAmount = signal(0);
  overdueAmount = signal(0);
  nextDueDate = signal<string | null>(null);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(10);
  pagination = signal<PaginationMeta | null>(null);

  // Payment Modal
  showPaymentModal = signal(false);
  selectedBill = signal<Bill | null>(null);
  paymentAmount = signal<number>(0);
  paymentMethod = signal<'cash' | 'gcash' | 'maya' | 'other'>('gcash');
  paymentReference = signal('');
  paymentNotes = signal('');
  receiptImage = signal<string | null>(null);
  receiptFileName = signal<string>('');
  isSubmitting = signal(false);

  constructor() {
    // Auto-reload when payment status changes (verified/rejected by admin)
    effect(() => {
      const trigger = this.notificationService.paymentStatusUpdateTrigger();
      if (trigger > 0) {
        this.loadData();
      }
    });
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      await Promise.all([
        this.loadBills(),
        this.loadPayments(),
        this.loadSettings()
      ]);
      this.calculateStats();
    } catch (error: any) {
      this.errorMessage.set('Failed to load payment data');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadBills() {
    await this.paymentService.getMyBills();
    this.bills.set(this.paymentService.myBills());
  }

  async loadPayments() {
    await this.paymentService.getMyPayments(this.currentPage(), this.pageSize());
    this.payments.set(this.paymentService.myPayments());
    this.pagination.set(this.paymentService.paymentsPagination());
  }

  async loadSettings() {
    await this.paymentService.getPaymentSettings();
    this.settings.set(this.paymentService.settings());
    await this.refreshQrSources();
  }

  calculateStats() {
    const bills = this.bills();
    const payments = this.payments();

    // Total paid from verified payments
    const paid = payments
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    this.totalPaid.set(paid);

    // Pending amount
    const pending = bills
      .filter(b => b.status === 'unpaid' || b.status === 'partial')
      .reduce((sum, b) => sum + Number(b.amount) - (Number(b.amount_paid) || 0), 0);
    this.pendingAmount.set(pending);

    // Overdue amount
    const overdue = bills
      .filter(b => b.status === 'overdue')
      .reduce((sum, b) => sum + Number(b.amount) - (Number(b.amount_paid) || 0), 0);
    this.overdueAmount.set(overdue);

    // Next due date
    const unpaidBills = bills.filter(b => b.status === 'unpaid' || b.status === 'partial');
    if (unpaidBills.length > 0) {
      const sorted = unpaidBills.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      this.nextDueDate.set(sorted[0].due_date);
    } else {
      this.nextDueDate.set(null);
    }
  }

  // Tab switching
  switchTab(tab: 'bills' | 'history') {
    this.activeTab.set(tab);
  }

  // Get unpaid bills for display
  get unpaidBills(): Bill[] {
    return this.bills().filter(b => b.status !== 'paid' && b.status !== 'cancelled');
  }

  get paidBills(): Bill[] {
    return this.bills().filter(b => b.status === 'paid');
  }

  // Payment Modal
  openPaymentModal(bill: Bill) {
    this.selectedBill.set(bill);
    const remaining = bill.amount - (bill.amount_paid || 0) - (bill.pending_amount || 0);
    this.paymentAmount.set(remaining);
    this.paymentMethod.set('gcash');
    this.paymentReference.set('');
    this.paymentNotes.set('');
    this.receiptImage.set(null);
    this.receiptFileName.set('');
    this.modalErrorMessage.set('');
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    this.closeReceiptCamera();
    this.showPaymentModal.set(false);
    this.selectedBill.set(null);
    this.receiptImage.set(null);
    this.receiptFileName.set('');
  }

  ngOnDestroy(): void {
    // Navigating away with the camera open would otherwise leave the track live.
    this.closeReceiptCamera();
  }

  // --- Payment QR codes ---

  // Displayable QR sources. A stored value may be a decoded payload (re-rendered here)
  // or a legacy/fallback image, so every view goes through resolveQrImage.
  gcashQrSrc = signal('');
  mayaQrSrc = signal('');

  private async refreshQrSources(): Promise<void> {
    const s = this.settings();
    this.gcashQrSrc.set(await resolveQrImage(s?.gcash_qr, 512));
    this.mayaQrSrc.set(await resolveQrImage(s?.maya_qr, 512));
  }


  // Standalone QR viewer, opened from the Available Payment Methods cards so the
  // QR can be seen (and saved) without starting a payment.
  qrViewer = signal<{
    label: string;
    image: string;
    brand: 'gcash' | 'maya';
    accountName: string;
    accountNumber: string;
  } | null>(null);
  isDownloadingQr = signal(false);

  openQrViewer(label: string, _image?: string | null) {
    const s = this.settings();
    const isGcash = label.toLowerCase() === 'gcash';
    const image = isGcash ? this.gcashQrSrc() : this.mayaQrSrc();
    if (!image) return;
    this.qrViewer.set({
      label,
      image,
      // Shown alongside the code so the occupant can confirm they are paying the right
      // account before they scan, instead of a bare unlabelled image.
      brand: isGcash ? 'gcash' : 'maya',
      accountName: (isGcash ? s?.gcash_name : s?.maya_name) || '',
      accountNumber: (isGcash ? s?.gcash_number : s?.maya_number) || '',
    });
  }

  closeQrViewer() {
    this.qrViewer.set(null);
  }

  /**
   * Save the QR as a labelled card (brand header, account name and number) rather than a
   * bare image, so it is still identifiable once it is sitting in a photo gallery.
   * Falls back to the plain image if the card cannot be composed.
   */
  async downloadQr(brand: 'gcash' | 'maya') {
    const s = this.settings();
    const isGcash = brand === 'gcash';
    const image = (isGcash ? this.gcashQrSrc() : this.mayaQrSrc()) || '';
    const label = isGcash ? 'GCash' : 'Maya';
    if (!image) return;

    this.isDownloadingQr.set(true);
    try {
      const card = await composeQrCard({
        image,
        brand,
        label,
        accountName: (isGcash ? s?.gcash_name : s?.maya_name) || '',
        accountNumber: (isGcash ? s?.gcash_number : s?.maya_number) || '',
        logo: isGcash ? 'icons/gcash.png' : 'icons/maya.png',
      });
      await downloadImage(card || image, `${brand}-qr-code`);
    } catch {
      this.toastService.error('Download failed', `Could not save the ${label} QR code.`);
    } finally {
      this.isDownloadingQr.set(false);
    }
  }

  scrollModalToTop() {
    const modalContent = document.querySelector('.modal');
    if (modalContent) {
      modalContent.scrollTop = 0;
    }
  }

  onReceiptFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      
      this.receiptFileName.set(file.name);
      
      const reader = new FileReader();
      reader.onload = () => {
        this.receiptImage.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeReceipt() {
    this.receiptImage.set(null);
    this.receiptFileName.set('');
  }

  // --- Receipt photo capture ---
  // Alternative to picking a file: photograph a printed or on-screen receipt. Feeds the
  // same receiptImage() signal the upload path does, so submit and validation are unchanged.

  private readonly receiptVideo = viewChild<ElementRef<HTMLVideoElement>>('receiptVideo');
  private readonly receiptCanvas = viewChild<ElementRef<HTMLCanvasElement>>('receiptCanvas');
  private receiptStream: MediaStream | null = null;

  showReceiptCamera = signal(false);
  isReceiptCameraReady = signal(false);
  receiptCameraError = signal('');

  async startReceiptCamera(): Promise<void> {
    this.receiptCameraError.set('');
    this.isReceiptCameraReady.set(false);
    this.showReceiptCamera.set(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.receiptCameraError.set('This device or browser does not support camera capture.');
      return;
    }

    // Let the @if render the <video> before we attach the stream to it.
    await Promise.resolve();

    try {
      // Rear camera: the receipt is usually a printed slip or another phone's screen.
      this.receiptStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      const video = this.receiptVideo()?.nativeElement;
      if (!video) {
        this.stopReceiptCamera();
        return;
      }
      video.srcObject = this.receiptStream;
      await video.play().catch(() => {});
      this.isReceiptCameraReady.set(true);
    } catch (error: any) {
      this.receiptCameraError.set(
        error?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access, or upload a file instead.'
          : 'Unable to start the camera. You can upload a file instead.'
      );
      this.stopReceiptCamera();
    }
  }

  // Always release the tracks — a leaked stream leaves the camera indicator on.
  private stopReceiptCamera(): void {
    this.receiptStream?.getTracks().forEach((track) => track.stop());
    this.receiptStream = null;
    this.isReceiptCameraReady.set(false);
  }

  closeReceiptCamera(): void {
    this.stopReceiptCamera();
    this.showReceiptCamera.set(false);
    this.receiptCameraError.set('');
  }

  captureReceiptPhoto(): void {
    const video = this.receiptVideo()?.nativeElement;
    const canvas = this.receiptCanvas()?.nativeElement;
    if (!video || !canvas || !video.videoWidth) return;

    // Downscale as we draw, so a phone photo lands in the same size range as the
    // screenshot uploads this field was built for (it is stored base64 in the DB).
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    this.receiptImage.set(canvas.toDataURL('image/jpeg', 0.7));
    this.receiptFileName.set(`receipt-photo-${new Date().toISOString().slice(0, 10)}.jpg`);
    this.closeReceiptCamera();
  }

  retakeReceiptPhoto(): void {
    this.receiptImage.set(null);
    this.receiptFileName.set('');
    this.startReceiptCamera();
  }

  async submitPayment() {
    this.modalErrorMessage.set('');
    
    if (!this.selectedBill() || !this.paymentAmount() || !this.paymentMethod()) {
      this.modalErrorMessage.set('Please fill in all required fields');
      this.scrollModalToTop();
      return;
    }

    // For GCash/Maya, require reference number
    if ((this.paymentMethod() === 'gcash' || this.paymentMethod() === 'maya') && !this.paymentReference()) {
      this.modalErrorMessage.set('Please provide the reference number for your e-wallet transaction');
      this.scrollModalToTop();
      return;
    }

    // For GCash/Maya, require e-receipt
    if ((this.paymentMethod() === 'gcash' || this.paymentMethod() === 'maya') && !this.receiptImage()) {
      this.modalErrorMessage.set('Please upload the e-receipt screenshot');
      this.scrollModalToTop();
      return;
    }

    const bill = this.selectedBill()!;
    const remaining = bill.amount - (bill.amount_paid || 0) - (bill.pending_amount || 0);
    if (this.paymentAmount() > remaining) {
      this.modalErrorMessage.set('Payment amount cannot exceed the remaining balance');
      this.scrollModalToTop();
      return;
    }

    if (remaining <= 0) {
      this.modalErrorMessage.set('This bill already has sufficient payment pending or completed');
      this.scrollModalToTop();
      return;
    }

    this.isSubmitting.set(true);

    try {
      const paymentData: MakePaymentRequest = {
        bill_id: this.selectedBill()!.id,
        amount: this.paymentAmount(),
        payment_method: this.paymentMethod(),
        reference_number: this.paymentReference() || undefined,
        notes: this.paymentNotes() || undefined,
        receipt_image: this.receiptImage() || undefined
      };

      await this.paymentService.makePayment(paymentData);
      
      // Show success message first
      this.successMessage.set('Payment submitted successfully! It will be verified by the admin.');
      setTimeout(() => this.successMessage.set(''), 5000);
      
      // Reset form and close modal
      this.selectedBill.set(null);
      this.receiptImage.set(null);
      this.receiptFileName.set('');
      this.showPaymentModal.set(false);
      
      // Refresh data
      await this.loadData();
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to submit payment');
      setTimeout(() => this.errorMessage.set(''), 5000);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // Pagination methods
  async nextPage() {
    const paginationData = this.pagination();
    if (paginationData && paginationData.hasNextPage) {
      this.currentPage.set(this.currentPage() + 1);
      await this.loadPayments();
    }
  }

  async prevPage() {
    const paginationData = this.pagination();
    if (paginationData && paginationData.hasPrevPage) {
      this.currentPage.set(this.currentPage() - 1);
      await this.loadPayments();
    }
  }

  async goToPage(page: number) {
    const paginationData = this.pagination();
    if (paginationData && page > 0 && page <= paginationData.pages) {
      this.currentPage.set(page);
      await this.loadPayments();
    }
  }

  getPageNumbers(): number[] {
    const paginationData = this.pagination();
    if (!paginationData) return [];
    
    const totalPages = paginationData.pages;
    const currentPage = this.currentPage();
    const maxPagesToShow = 5;
    const pages: number[] = [];

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const halfWindow = Math.floor(maxPagesToShow / 2);
      let startPage = Math.max(1, currentPage - halfWindow);
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

      if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  }

  // Utility functions
  formatCurrency(amount: number): string {
    return this.paymentService.formatCurrency(amount);
  }

  formatDate(date: string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getBillStatusClass(status: string): string {
    return this.paymentService.getBillStatusClass(status);
  }

  getPaymentStatusClass(status: string): string {
    return this.paymentService.getPaymentStatusClass(status);
  }

  getTypeLabel(type: string): string {
    return this.paymentService.getBillTypeLabel(type);
  }

  getPaymentMethodLabel(method: string): string {
    return this.paymentService.getPaymentMethodLabel(method);
  }

  getRemainingAmount(bill: Bill): number {
    return bill.amount - (bill.amount_paid || 0) - (bill.pending_amount || 0);
  }
}
