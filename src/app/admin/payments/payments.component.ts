import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PaymentService, Bill, Payment, PaymentStats, Resident, CreateBillRequest, PaymentSettings, PaginationMeta } from '../../services/payment.service';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent implements OnInit {
  private paymentService = inject(PaymentService);

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
    };
    reader.readAsDataURL(file);
  }

  removeQr(type: 'gcash' | 'maya') {
    if (type === 'gcash') {
      this.settingsGcashQr.set('');
    } else {
      this.settingsMayaQr.set('');
    }
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
    } catch (error: any) {
      alert(error.message || 'Failed to delete bill');
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
