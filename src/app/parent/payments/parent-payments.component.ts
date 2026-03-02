import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, Bill, Payment, MakePaymentRequest, PaymentSettings, PaginationMeta } from '../../services/payment.service';
import { ParentService } from '../data/parent.service';

interface ChildBills {
  child_name: string;
  child_id: number;
  room_number: string | null;
  bills: Bill[];
}

@Component({
  selector: 'app-parent-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-payments.component.html',
  styleUrl: './parent-payments.component.scss'
})
export class ParentPaymentsComponent implements OnInit {
  private paymentService = inject(PaymentService);
  private parentService = inject(ParentService);

  // Tab management
  activeTab = signal<'bills' | 'history'>('bills');

  // Data
  childBills = signal<ChildBills[]>([]);
  payments = signal<Payment[]>([]);
  settings = signal<PaymentSettings | null>(null);
  isLoading = signal(true);
  errorMessage = signal('');
  successMessage = signal('');

  // Stats
  totalPending = signal(0);
  totalOverdue = signal(0);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(10);
  pagination = signal<PaginationMeta | null>(null);

  // Payment Modal
  showPaymentModal = signal(false);
  selectedBill = signal<Bill | null>(null);
  selectedChildName = signal('');
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
        this.loadChildBills(),
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

  async loadSettings() {
    await this.paymentService.getPaymentSettings();
    this.settings.set(this.paymentService.settings());
  }

  async loadChildBills() {
    // Get bills for all registered children
    await this.paymentService.getMyBills();
    const bills = this.paymentService.myBills();
    
    // Group bills by child (resident)
    const grouped = new Map<number, ChildBills>();
    
    for (const bill of bills) {
      if (!grouped.has(bill.resident_id)) {
        grouped.set(bill.resident_id, {
          child_name: bill.resident_name || 'Unknown',
          child_id: bill.resident_id,
          room_number: bill.room_number || null,
          bills: []
        });
      }
      grouped.get(bill.resident_id)!.bills.push(bill);
    }
    
    this.childBills.set(Array.from(grouped.values()));
  }

  async loadPayments() {
    await this.paymentService.getMyPayments(this.currentPage(), this.pageSize());
    this.payments.set(this.paymentService.myPayments());
    this.pagination.set(this.paymentService.paymentsPagination());
  }

  calculateStats() {
    let pending = 0;
    let overdue = 0;

    for (const child of this.childBills()) {
      for (const bill of child.bills) {
        const remaining = bill.amount - (bill.amount_paid || 0);
        if (bill.status === 'unpaid' || bill.status === 'partial') {
          pending += remaining;
        }
        if (bill.status === 'overdue') {
          overdue += remaining;
        }
      }
    }

    this.totalPending.set(pending);
    this.totalOverdue.set(overdue);
  }

  // Tab switching
  switchTab(tab: 'bills' | 'history') {
    this.activeTab.set(tab);
  }

  // Get unpaid bills for a child
  getUnpaidBills(child: ChildBills): Bill[] {
    return child.bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled');
  }

  // Payment Modal
  openPaymentModal(bill: Bill, childName: string) {
    this.selectedBill.set(bill);
    this.selectedChildName.set(childName);
    const remaining = bill.amount - (bill.amount_paid || 0);
    this.paymentAmount.set(remaining);
    this.paymentMethod.set('gcash');
    this.paymentReference.set('');
    this.paymentNotes.set('');
    this.receiptImage.set(null);
    this.receiptFileName.set('');
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);
    this.selectedBill.set(null);
    this.selectedChildName.set('');
    this.receiptImage.set(null);
    this.receiptFileName.set('');
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
    if (!this.selectedBill() || !this.paymentAmount() || !this.paymentMethod()) {
      alert('Please fill in all required fields');
      return;
    }

    // For GCash/Maya, require reference number
    if ((this.paymentMethod() === 'gcash' || this.paymentMethod() === 'maya') && !this.paymentReference()) {
      alert('Please provide the reference number for your e-wallet transaction');
      return;
    }

    const remaining = this.selectedBill()!.amount - (this.selectedBill()!.amount_paid || 0);
    if (this.paymentAmount() > remaining) {
      alert('Payment amount cannot exceed the remaining balance');
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
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to submit payment');
      setTimeout(() => this.errorMessage.set(''), 5000);
    } finally {
      this.isSubmitting.set(false);
      this.showPaymentModal.set(false);
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

  hasUnpaidBills(): boolean {
    return this.childBills().some(child => this.getUnpaidBills(child).length > 0);
  }
}
