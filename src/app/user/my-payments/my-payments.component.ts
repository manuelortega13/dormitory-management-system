import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, Bill, Payment, MakePaymentRequest, PaymentSettings, PaginationMeta } from '../../services/payment.service';

@Component({
  selector: 'app-my-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-payments.component.html',
  styleUrl: './my-payments.component.scss'
})
export class MyPaymentsComponent implements OnInit {
  private paymentService = inject(PaymentService);

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
    this.showPaymentModal.set(false);
    this.selectedBill.set(null);
    this.receiptImage.set(null);
    this.receiptFileName.set('');
  }

  scrollModalToTop() {
    const modalContent = document.querySelector('.modal-content');
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
      // Close modal immediately after successful payment
      this.closePaymentModal();
      this.successMessage.set('Payment submitted successfully! It will be verified by the admin.');
      setTimeout(() => this.successMessage.set(''), 5000);
      // Refresh data in background
      await this.loadData();
      this.showPaymentModal.set(false);
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
    return bill.amount - (bill.amount_paid || 0);
  }
}
