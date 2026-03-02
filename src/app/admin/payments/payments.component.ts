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

  // Pagination for payments
  paymentCurrentPage = signal(1);
  paymentPageSize = signal(10);
  paymentPagination = signal<PaginationMeta | null>(null);

  // Bill Modal
  showBillModal = signal(false);
  isEditingBill = signal(false);
  editingBillId = signal<number | null>(null);
  isSavingBill = signal(false);

  // Bill form data
  formResidentId = signal<number | null>(null);
  formBillType = signal<'rent' | 'deposit' | 'utility' | 'fine' | 'other'>('rent');
  formDescription = signal('');
  formAmount = signal<number>(0);
  formDueDate = signal('');

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
  settingsMayaNumber = signal('');
  settingsMayaName = signal('');
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
      const filters: any = {};
      if (this.billStatusFilter()) filters.status = this.billStatusFilter();
      if (this.billTypeFilter()) filters.type = this.billTypeFilter();
      await this.paymentService.getAllBills(filters);
      this.bills.set(this.paymentService.bills());
    } catch (error) {
      console.error('Failed to load bills:', error);
    }
  }

  async loadPayments() {
    try {
      const filters: any = {};
      if (this.paymentStatusFilter()) filters.status = this.paymentStatusFilter();
      if (this.paymentMethodFilter()) filters.payment_method = this.paymentMethodFilter();
      await this.paymentService.getAllPayments(filters, this.paymentCurrentPage(), this.paymentPageSize());
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
      this.settingsMayaNumber.set(s.maya_number || '');
      this.settingsMayaName.set(s.maya_name || '');
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
        maya_number: this.settingsMayaNumber(),
        maya_name: this.settingsMayaName(),
        cash_instructions: this.settingsCashInstructions(),
        payment_notes: this.settingsPaymentNotes()
      });
      alert('Payment settings saved successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to save settings');
    } finally {
      this.isSavingSettings.set(false);
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
    this.loadBills();
  }

  onPaymentFilterChange() {
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
  }

  async saveBill() {
    if (!this.formResidentId() || !this.formAmount() || !this.formDueDate()) {
      alert('Please fill in all required fields');
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
      } else {
        await this.paymentService.createBill(billData);
      }

      this.closeBillModal();
      await this.loadBills();
      await this.loadStats();
    } catch (error: any) {
      alert(error.message || 'Failed to save bill');
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
    } catch (error: any) {
      alert(error.message || 'Failed to verify payment');
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
