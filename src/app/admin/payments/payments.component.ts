import { Component, signal, inject, effect, untracked, viewChild, ElementRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PaymentService, Bill, Payment, PaymentStats, Resident, CreateBillRequest, PaymentSettings, PaginationMeta } from '../../services/payment.service';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent implements OnInit {
  private paymentService = inject(PaymentService);
  private toastService = inject(ToastService);
  private notificationService = inject(NotificationService);

  constructor() {
    // Keep the page live. Any 'payment' notification — most importantly an occupant
    // submitting a payment — increments this trigger, so refresh in place instead of
    // leaving the lists and the "Pending Verification" tile stale until a manual reload.
    effect(() => {
      const trigger = this.notificationService.paymentStatusUpdateTrigger();
      if (trigger > 0) {
        // untracked: only the trigger should re-run this effect. The loaders read the
        // filter/pagination signals, which would otherwise become dependencies and
        // cause a duplicate fetch on every filter change.
        untracked(() => this.refreshData());
      }
    });
  }

  // Tab management
  activeTab = signal<'bills' | 'payments' | 'settings'>('bills');

  // Search and filters
  searchQuery = signal('');
  billStatusFilter = signal('');
  billTypeFilter = signal('');
  paymentStatusFilter = signal('');
  paymentMethodFilter = signal('');

  // Data signals
  bills = signal<Bill[]>([]);
  payments = signal<Payment[]>([]);
  residents = signal<Resident[]>([]);
  stats = signal<PaymentStats | null>(null);
  settings = signal<PaymentSettings | null>(null);
  isLoading = signal(true);
  errorMessage = signal('');
  successMessage = signal('');

  // Sorting for bills
  billSortBy = signal<string>('');
  billSortOrder = signal<'asc' | 'desc'>('desc');

  // Pagination for bills
  billCurrentPage = signal(1);
  billPageSize = signal(10);
  billPagination = signal<PaginationMeta | null>(null);

  // Pagination for payments
  paymentCurrentPage = signal(1);
  paymentPageSize = signal(10);
  paymentPagination = signal<PaginationMeta | null>(null);

  // Bill Modal
  showBillModal = signal(false);
  isEditingBill = signal(false);
  editingBillId = signal<number | null>(null);
  editingBillPaid = signal(false);
  isSavingBill = signal(false);
  billModalError = signal('');

  // Bill form data
  formResidentId = signal<number | null>(null);
  formBillType = signal<'rent' | 'deposit' | 'utility' | 'fine' | 'other'>('rent');
  formDescription = signal('');
  formAmount = signal<number>(0);
  formDueDate = signal('');

  // Searchable resident dropdown
  residentSearchQuery = signal('');
  showResidentDropdown = signal(false);
  selectedResidentName = signal('');
  highlightedResidentIndex = signal(-1);

  // Delete confirmation
  showDeleteModal = signal(false);
  deletingBill = signal<Bill | null>(null);
  isDeleting = signal(false);

  // Payment verification modal
  showVerifyModal = signal(false);
  verifyingPayment = signal<Payment | null>(null);
  isVerifying = signal(false);

  // View payment details modal
  showPaymentDetailModal = signal(false);
  viewingPayment = signal<Payment | null>(null);

  // Settings form
  settingsGcashNumber = signal('');
  settingsGcashName = signal('');
  settingsGcashQr = signal<string>('');
  settingsMayaNumber = signal('');
  settingsMayaName = signal('');
  settingsMayaQr = signal<string>('');
  settingsCashInstructions = signal('');
  settingsPaymentNotes = signal('');
  isSavingSettings = signal(false);

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
        this.loadStats(),
        this.loadResidents(),
        this.loadSettings()
      ]);
    } catch (error: any) {
      this.errorMessage.set('Failed to load data');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Silent refresh used by the real-time effect: reloads the two tabs' data and the
   * stat tiles without toggling isLoading, so the tables don't flash back to a spinner
   * under the user, and the current filters/page are preserved. Settings and the
   * residents dropdown are skipped — a payment can't change them.
   */
  private async refreshData(): Promise<void> {
    try {
      await Promise.all([this.loadBills(), this.loadPayments(), this.loadStats()]);
    } catch (error) {
      console.error('Failed to refresh payment data:', error);
    }
  }

  async loadBills() {
    try {
      const filters: any = {
        page: this.billCurrentPage(),
        limit: this.billPageSize(),
      };
      if (this.billStatusFilter()) filters.status = this.billStatusFilter();
      if (this.billTypeFilter()) filters.type = this.billTypeFilter();
      if (this.billSortBy()) {
        filters.sort_by = this.billSortBy();
        filters.sort_order = this.billSortOrder();
      }
      await this.paymentService.getAllBills(filters);
      this.bills.set(this.paymentService.bills());
      this.billPagination.set(this.paymentService.billsPagination());
    } catch (error) {
      console.error('Failed to load bills:', error);
    }
  }

  async loadPayments() {
    try {
      const filters: any = {
        page: this.paymentCurrentPage(),
        limit: this.paymentPageSize(),
      };
      if (this.paymentStatusFilter()) filters.status = this.paymentStatusFilter();
      if (this.paymentMethodFilter()) filters.payment_method = this.paymentMethodFilter();
      await this.paymentService.getAllPayments(filters);
      this.payments.set(this.paymentService.payments());
      this.paymentPagination.set(this.paymentService.allPaymentsPagination());
    } catch (error) {
      console.error('Failed to load payments:', error);
    }
  }

  async loadStats() {
    await this.paymentService.getStats();
    this.stats.set(this.paymentService.stats());
  }

  async loadResidents() {
    await this.paymentService.getResidents();
    this.residents.set(this.paymentService.residents());
  }

  async loadSettings() {
    await this.paymentService.getPaymentSettings();
    const s = this.paymentService.settings();
    this.settings.set(s);
    if (s) {
      this.settingsGcashNumber.set(s.gcash_number || '');
      this.settingsGcashName.set(s.gcash_name || '');
      this.settingsGcashQr.set(s.gcash_qr || '');
      this.settingsMayaNumber.set(s.maya_number || '');
      this.settingsMayaName.set(s.maya_name || '');
      this.settingsMayaQr.set(s.maya_qr || '');
      this.settingsCashInstructions.set(s.cash_instructions || '');
      this.settingsPaymentNotes.set(s.payment_notes || '');
    }
  }

  async saveSettings() {
    this.isSavingSettings.set(true);
    try {
      await this.paymentService.updatePaymentSettings({
        gcash_number: this.settingsGcashNumber(),
        gcash_name: this.settingsGcashName(),
        gcash_qr: this.settingsGcashQr(),
        maya_number: this.settingsMayaNumber(),
        maya_name: this.settingsMayaName(),
        maya_qr: this.settingsMayaQr(),
        cash_instructions: this.settingsCashInstructions(),
        payment_notes: this.settingsPaymentNotes()
      });
      this.successMessage.set('Payment settings saved successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to save settings');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => this.errorMessage.set(''), 3000);
    } finally {
      this.isSavingSettings.set(false);
    }
  }

  onQrSelected(event: Event, type: 'gcash' | 'maya') {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage.set('QR code image must be less than 5MB');
      setTimeout(() => this.errorMessage.set(''), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (type === 'gcash') {
        this.settingsGcashQr.set(dataUrl);
      } else {
        this.settingsMayaQr.set(dataUrl);
      }
      // Offer cropping straight away — screenshots usually need trimming. Cancelling
      // keeps the image exactly as uploaded.
      this.openQrCrop(type, dataUrl);
    };
    reader.readAsDataURL(file);

    // Allow re-selecting the same file after a cancel, which otherwise fires no change event.
    input.value = '';
  }

  removeQr(type: 'gcash' | 'maya') {
    if (type === 'gcash') {
      this.settingsGcashQr.set('');
    } else {
      this.settingsMayaQr.set('');
    }
  }

  // --- QR code cropping ---
  // Uploaded QR codes are usually screenshots with app chrome around them, so allow
  // trimming down to the code itself. Crop box coordinates are kept in *displayed*
  // pixels and mapped back to the image's natural size on apply.

  qrCrop = signal<{ type: 'gcash' | 'maya'; src: string } | null>(null);
  cropBox = signal({ x: 0, y: 0, w: 0, h: 0 });

  private readonly cropImageRef = viewChild<ElementRef<HTMLImageElement>>('cropImage');
  private cropDrag: {
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    origin: { x: number; y: number; w: number; h: number };
  } | null = null;

  private static readonly MIN_CROP_PX = 24;
  // A QR does not need more than this to stay scannable, and the result is stored
  // base64 in system_settings, so cap the output.
  private static readonly MAX_CROP_OUTPUT_PX = 800;

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  openQrCrop(type: 'gcash' | 'maya', src: string) {
    if (!src) return;
    this.qrCrop.set({ type, src });
  }

  closeQrCrop() {
    this.qrCrop.set(null);
    this.cropDrag = null;
  }

  // Start with a centred square, since QR codes are square.
  onCropImageLoad() {
    const img = this.cropImageRef()?.nativeElement;
    if (!img) return;
    const side = Math.min(img.clientWidth, img.clientHeight) * 0.8;
    this.cropBox.set({
      x: (img.clientWidth - side) / 2,
      y: (img.clientHeight - side) / 2,
      w: side,
      h: side,
    });
  }

  startCropDrag(event: PointerEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') {
    event.preventDefault();
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.cropDrag = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...this.cropBox() },
    };
  }

  onCropDrag(event: PointerEvent) {
    const drag = this.cropDrag;
    const img = this.cropImageRef()?.nativeElement;
    if (!drag || !img) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const boundsW = img.clientWidth;
    const boundsH = img.clientHeight;
    const min = PaymentsComponent.MIN_CROP_PX;
    let { x, y, w, h } = drag.origin;

    if (drag.mode === 'move') {
      x = PaymentsComponent.clamp(x + dx, 0, boundsW - w);
      y = PaymentsComponent.clamp(y + dy, 0, boundsH - h);
    } else {
      // Dragging a west/north handle moves the origin and shrinks the box by the
      // same amount, so the opposite edge stays put.
      if (drag.mode.includes('w')) {
        const nx = PaymentsComponent.clamp(x + dx, 0, x + w - min);
        w += x - nx;
        x = nx;
      }
      if (drag.mode.includes('e')) {
        w = PaymentsComponent.clamp(w + dx, min, boundsW - x);
      }
      if (drag.mode.includes('n')) {
        const ny = PaymentsComponent.clamp(y + dy, 0, y + h - min);
        h += y - ny;
        y = ny;
      }
      if (drag.mode.includes('s')) {
        h = PaymentsComponent.clamp(h + dy, min, boundsH - y);
      }
    }

    this.cropBox.set({ x, y, w, h });
  }

  endCropDrag() {
    this.cropDrag = null;
  }

  applyQrCrop() {
    const target = this.qrCrop();
    const img = this.cropImageRef()?.nativeElement;
    const box = this.cropBox();
    if (!target || !img || box.w < 1 || box.h < 1) return;

    // Displayed pixels -> natural pixels.
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const sw = box.w * scaleX;
    const sh = box.h * scaleY;

    const outScale = Math.min(1, PaymentsComponent.MAX_CROP_OUTPUT_PX / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * outScale));
    canvas.height = Math.max(1, Math.round(sh * outScale));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, box.x * scaleX, box.y * scaleY, sw, sh, 0, 0, canvas.width, canvas.height);

    // PNG, not JPEG: a QR relies on hard black/white edges, and JPEG artefacts around
    // them can stop a scanner from reading it.
    const cropped = canvas.toDataURL('image/png');
    if (target.type === 'gcash') {
      this.settingsGcashQr.set(cropped);
    } else {
      this.settingsMayaQr.set(cropped);
    }
    this.closeQrCrop();
  }

  // Computed filtered lists
  get filteredBills(): Bill[] {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.bills();
    return this.bills().filter(b =>
      b.resident_name?.toLowerCase().includes(query) ||
      b.description?.toLowerCase().includes(query) ||
      b.room_number?.toLowerCase().includes(query)
    );
  }

  get filteredPayments(): Payment[] {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.payments();
    return this.payments().filter(p =>
      p.resident_name?.toLowerCase().includes(query) ||
      p.payer_name?.toLowerCase().includes(query) ||
      p.reference_number?.toLowerCase().includes(query) ||
      p.bill_description?.toLowerCase().includes(query)
    );
  }

  // Tab switching
  switchTab(tab: 'bills' | 'payments' | 'settings') {
    this.activeTab.set(tab);
    this.searchQuery.set('');
  }

  // Filter change handlers
  onBillFilterChange() {
    this.billCurrentPage.set(1);
    this.loadBills();
  }

  onPaymentFilterChange() {
    this.paymentCurrentPage.set(1);
    this.loadPayments();
  }

  // Bill Modal
  openCreateBillModal() {
    this.isEditingBill.set(false);
    this.editingBillId.set(null);
    this.resetBillForm();
    this.showBillModal.set(true);
  }

  openEditBillModal(bill: Bill) {
    this.isEditingBill.set(true);
    this.editingBillId.set(bill.id);
    this.editingBillPaid.set(bill.status === 'paid');
    this.formResidentId.set(bill.resident_id);
    this.selectedResidentName.set(
      `${bill.resident_name}${bill.room_number ? ' (' + bill.room_number + ')' : ''}`
    );
    this.formBillType.set(bill.type);
    this.formDescription.set(bill.description || '');
    this.formAmount.set(bill.amount);
    this.formDueDate.set(bill.due_date ? bill.due_date.split('T')[0] : '');
    this.showBillModal.set(true);
  }

  closeBillModal() {
    this.showBillModal.set(false);
    this.resetBillForm();
  }

  resetBillForm() {
    this.editingBillPaid.set(false);
    this.formResidentId.set(null);
    this.formBillType.set('rent');
    this.formDescription.set('');
    this.formAmount.set(0);
    this.formDueDate.set('');
    this.residentSearchQuery.set('');
    this.showResidentDropdown.set(false);
    this.selectedResidentName.set('');
    this.billModalError.set('');
  }

  get filteredResidents(): Resident[] {
    const query = this.residentSearchQuery().toLowerCase();
    if (!query) return this.residents();
    return this.residents().filter(r =>
      r.name.toLowerCase().includes(query) ||
      (r.room_number && r.room_number.toLowerCase().includes(query))
    );
  }

  selectResident(resident: Resident) {
    this.formResidentId.set(resident.id);
    this.selectedResidentName.set(
      `${resident.name}${resident.room_number ? ' (' + resident.room_number + ')' : ''}`
    );
    this.residentSearchQuery.set('');
    this.showResidentDropdown.set(false);
  }

  clearResidentSelection() {
    this.formResidentId.set(null);
    this.selectedResidentName.set('');
    this.residentSearchQuery.set('');
  }

  onResidentSearchFocus() {
    this.showResidentDropdown.set(true);
    this.highlightedResidentIndex.set(-1);
  }

  onResidentSearchBlur() {
    // Delay to allow click on dropdown item
    setTimeout(() => this.showResidentDropdown.set(false), 200);
  }

  onResidentSearchKeydown(event: KeyboardEvent) {
    const list = this.filteredResidents;
    if (!this.showResidentDropdown() || list.length === 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.showResidentDropdown.set(true);
        this.highlightedResidentIndex.set(0);
        event.preventDefault();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedResidentIndex.set(
          (this.highlightedResidentIndex() + 1) % list.length
        );
        this.scrollToHighlighted();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedResidentIndex.set(
          this.highlightedResidentIndex() <= 0
            ? list.length - 1
            : this.highlightedResidentIndex() - 1
        );
        this.scrollToHighlighted();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.highlightedResidentIndex() >= 0 && this.highlightedResidentIndex() < list.length) {
          this.selectResident(list[this.highlightedResidentIndex()]);
        }
        break;
      case 'Escape':
        this.showResidentDropdown.set(false);
        break;
    }
  }

  private scrollToHighlighted() {
    setTimeout(() => {
      const el = document.querySelector('.dropdown-item.highlighted');
      el?.scrollIntoView({ block: 'nearest' });
    });
  }

  async saveBill() {
    this.billModalError.set('');

    if (!this.formResidentId() || !this.formAmount() || !this.formDueDate()) {
      this.billModalError.set('Please fill in all required fields');
      return;
    }

    this.isSavingBill.set(true);

    try {
      const billData: CreateBillRequest = {
        resident_id: this.formResidentId()!,
        type: this.formBillType(),
        description: this.formDescription(),
        amount: this.formAmount(),
        due_date: this.formDueDate()
      };

      if (this.isEditingBill() && this.editingBillId()) {
        await this.paymentService.updateBill(this.editingBillId()!, billData);
        this.successMessage.set('Bill updated successfully!');
      } else {
        await this.paymentService.createBill(billData);
        this.successMessage.set('Bill created successfully!');
      }

      this.closeBillModal();
      await this.loadBills();
      await this.loadStats();

      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (error: any) {
      this.billModalError.set(error.message || 'Failed to save bill');
    } finally {
      this.isSavingBill.set(false);
    }
  }

  // Delete Bill
  openDeleteModal(bill: Bill) {
    this.deletingBill.set(bill);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.deletingBill.set(null);
  }

  async confirmDeleteBill() {
    if (!this.deletingBill()) return;

    this.isDeleting.set(true);
    try {
      await this.paymentService.deleteBill(this.deletingBill()!.id);
      this.closeDeleteModal();
      await this.loadBills();
      await this.loadStats();
      this.toastService.success('Bill deleted', 'The bill was deleted successfully.');
    } catch (error: any) {
      this.toastService.error('Delete failed', error.message || 'Failed to delete bill');
    } finally {
      this.isDeleting.set(false);
    }
  }

  // Payment Verification
  openVerifyModal(payment: Payment) {
    this.verifyingPayment.set(payment);
    this.showVerifyModal.set(true);
  }

  closeVerifyModal() {
    this.showVerifyModal.set(false);
    this.verifyingPayment.set(null);
  }

  async verifyPayment(status: 'verified' | 'rejected') {
    if (!this.verifyingPayment()) return;

    this.isVerifying.set(true);
    try {
      await this.paymentService.verifyPayment(this.verifyingPayment()!.id, status);
      this.closeVerifyModal();
      await this.loadPayments();
      await this.loadBills();
      await this.loadStats();

      this.successMessage.set(
        status === 'verified' ? 'Payment verified successfully!' : 'Payment rejected.'
      );
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to verify payment');
      setTimeout(() => this.errorMessage.set(''), 3000);
    } finally {
      this.isVerifying.set(false);
    }
  }

  // View Payment Detail
  openPaymentDetailModal(payment: Payment) {
    this.viewingPayment.set(payment);
    this.showPaymentDetailModal.set(true);
  }

  closePaymentDetailModal() {
    this.showPaymentDetailModal.set(false);
    this.viewingPayment.set(null);
  }

  // Sorting for bills
  toggleBillSort(column: string) {
    if (this.billSortBy() === column) {
      this.billSortOrder.set(this.billSortOrder() === 'asc' ? 'desc' : 'asc');
    } else {
      this.billSortBy.set(column);
      this.billSortOrder.set('asc');
    }
    this.billCurrentPage.set(1);
    this.loadBills();
  }

  // Pagination methods for bills
  async nextBillPage() {
    const paginationData = this.billPagination();
    if (paginationData && paginationData.hasNextPage) {
      this.billCurrentPage.set(this.billCurrentPage() + 1);
      await this.loadBills();
    }
  }

  async prevBillPage() {
    const paginationData = this.billPagination();
    if (paginationData && paginationData.hasPrevPage) {
      this.billCurrentPage.set(this.billCurrentPage() - 1);
      await this.loadBills();
    }
  }

  async goToBillPage(page: number) {
    const paginationData = this.billPagination();
    if (paginationData && page > 0 && page <= paginationData.pages) {
      this.billCurrentPage.set(page);
      await this.loadBills();
    }
  }

  getBillPageNumbers(): number[] {
    const paginationData = this.billPagination();
    if (!paginationData) return [];

    const totalPages = paginationData.pages;
    const currentPage = this.billCurrentPage();
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

  // Pagination methods for payments
  async nextPaymentPage() {
    const paginationData = this.paymentPagination();
    if (paginationData && paginationData.hasNextPage) {
      this.paymentCurrentPage.set(this.paymentCurrentPage() + 1);
      await this.loadPayments();
    }
  }

  async prevPaymentPage() {
    const paginationData = this.paymentPagination();
    if (paginationData && paginationData.hasPrevPage) {
      this.paymentCurrentPage.set(this.paymentCurrentPage() - 1);
      await this.loadPayments();
    }
  }

  async goToPaymentPage(page: number) {
    const paginationData = this.paymentPagination();
    if (paginationData && page > 0 && page <= paginationData.pages) {
      this.paymentCurrentPage.set(page);
      await this.loadPayments();
    }
  }

  getPaymentPageNumbers(): number[] {
    const paginationData = this.paymentPagination();
    if (!paginationData) return [];
    
    const totalPages = paginationData.pages;
    const currentPage = this.paymentCurrentPage();
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
  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return '₱0.00';
    return this.paymentService.formatCurrency(amount);
  }

  formatDate(date: string | null | undefined): string {
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
}
