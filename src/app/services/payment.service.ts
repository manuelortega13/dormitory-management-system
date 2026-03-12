import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Bill {
  id: number;
  resident_id: number;
  type: 'rent' | 'deposit' | 'utility' | 'fine' | 'other';
  description: string;
  amount: number;
  due_date: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
  updated_at: string;
  // Joined fields
  resident_name?: string;
  resident_email?: string;
  room_number?: string;
  amount_paid?: number;
  pending_amount?: number;
  remaining_balance?: number;
  has_pending_payment?: boolean;
}

export interface Payment {
  id: number;
  bill_id: number;
  resident_id: number;
  paid_by: number;
  amount: number;
  payment_method: 'cash' | 'gcash' | 'maya' | 'other';
  reference_number?: string;
  notes?: string;
  status: 'pending' | 'verified' | 'rejected';
  verified_by?: number;
  verified_at?: string;
  created_at: string;
  // Joined fields
  resident_name?: string;
  payer_name?: string;
  verifier_name?: string;
  bill_type?: string;
  bill_description?: string;
  receipt_image?: string;
}

export interface CreateBillRequest {
  resident_id: number;
  type: 'rent' | 'deposit' | 'utility' | 'fine' | 'other';
  description: string;
  amount: number;
  due_date: string;
}

export interface MakePaymentRequest {
  bill_id: number;
  amount: number;
  payment_method: 'cash' | 'gcash' | 'maya' | 'other';
  reference_number?: string;
  notes?: string;
  receipt_image?: string;
}

export interface PaymentSettings {
  gcash_number: string;
  gcash_name: string;
  gcash_qr: string;
  maya_number: string;
  maya_name: string;
  maya_qr: string;
  cash_instructions: string;
  payment_notes: string;
}

export interface PaymentStats {
  total_billed: number;
  total_collected: number;
  pending_payments: number;
  overdue_bills: number;
}

export interface Resident {
  id: number;
  name: string;
  email: string;
  room_number?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: PaginationMeta;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/payments`;

  bills = signal<Bill[]>([]);
  payments = signal<Payment[]>([]);
  myBills = signal<Bill[]>([]);
  myPayments = signal<Payment[]>([]);
  stats = signal<PaymentStats | null>(null);
  residents = signal<Resident[]>([]);
  settings = signal<PaymentSettings | null>(null);
  loading = signal<boolean>(false);

  // Pagination metadata
  paymentsPagination = signal<PaginationMeta | null>(null);
  allPaymentsPagination = signal<PaginationMeta | null>(null);
  billsPagination = signal<PaginationMeta | null>(null);

  // Admin: Get all bills
  async getAllBills(filters?: { status?: string; type?: string; resident_id?: number; page?: number; limit?: number; sort_by?: string; sort_order?: string }): Promise<void> {
    this.loading.set(true);
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.resident_id) params.append('resident_id', filters.resident_id.toString());
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.sort_by) params.append('sort_by', filters.sort_by);
      if (filters?.sort_order) params.append('sort_order', filters.sort_order);

      const url = `${this.apiUrl}/bills${params.toString() ? '?' + params.toString() : ''}`;
      const response = await firstValueFrom(this.http.get<ApiResponse<Bill[]>>(url));
      if (response.success && response.data) {
        this.bills.set(response.data);
      }
      if (response.pagination) {
        this.billsPagination.set(response.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch bills:', error);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  // Admin: Create a new bill
  async createBill(bill: CreateBillRequest): Promise<Bill> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<Bill>>(`${this.apiUrl}/bills`, bill)
    );
    if (response.success && response.data) {
      this.bills.update(bills => [response.data!, ...bills]);
      return response.data;
    }
    throw new Error(response.message || 'Failed to create bill');
  }

  // Admin: Update a bill
  async updateBill(id: number, updates: Partial<CreateBillRequest & { status: string }>): Promise<void> {
    const response = await firstValueFrom(
      this.http.put<ApiResponse<Bill>>(`${this.apiUrl}/bills/${id}`, updates)
    );
    if (response.success && response.data) {
      this.bills.update(bills => bills.map(b => b.id === id ? response.data! : b));
    } else {
      throw new Error(response.message || 'Failed to update bill');
    }
  }

  // Admin: Delete a bill
  async deleteBill(id: number): Promise<void> {
    const response = await firstValueFrom(
      this.http.delete<ApiResponse<void>>(`${this.apiUrl}/bills/${id}`)
    );
    if (response.success) {
      this.bills.update(bills => bills.filter(b => b.id !== id));
    } else {
      throw new Error(response.message || 'Failed to delete bill');
    }
  }

  // Admin: Get all payments
  async getAllPayments(filters?: { status?: string; payment_method?: string; page?: number; limit?: number }): Promise<void> {
    this.loading.set(true);
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.payment_method) params.append('payment_method', filters.payment_method);
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const url = `${this.apiUrl}/payments${params.toString() ? '?' + params.toString() : ''}`;
      const response = await firstValueFrom(this.http.get<ApiResponse<Payment[]>>(url));
      if (response.success && response.data) {
        this.payments.set(response.data);
      }
      if (response.pagination) {
        this.allPaymentsPagination.set(response.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  // Admin: Verify payment
  async verifyPayment(id: number, status: 'verified' | 'rejected'): Promise<void> {
    const response = await firstValueFrom(
      this.http.put<ApiResponse<Payment>>(`${this.apiUrl}/payments/${id}/verify`, { status })
    );
    if (response.success && response.data) {
      this.payments.update(payments => payments.map(p => p.id === id ? response.data! : p));
    } else {
      throw new Error(response.message || 'Failed to verify payment');
    }
  }

  // Admin: Get stats
  async getStats(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<PaymentStats>>(`${this.apiUrl}/stats`)
      );
      if (response.success && response.data) {
        this.stats.set(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }

  // Admin: Get residents for dropdown
  async getResidents(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<Resident[]>>(`${this.apiUrl}/residents`)
      );
      if (response.success && response.data) {
        this.residents.set(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch residents:', error);
    }
  }

  // User: Get my bills
  async getMyBills(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<Bill[]>>(`${this.apiUrl}/my-bills`)
      );
      if (response.success && response.data) {
        this.myBills.set(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch my bills:', error);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  // User: Get my payments
  async getMyPayments(page: number = 1, limit: number = 10): Promise<void> {
    this.loading.set(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const url = `${this.apiUrl}/my-payments?${params.toString()}`;
      const response = await firstValueFrom(
        this.http.get<ApiResponse<Payment[]>>(url)
      );
      if (response.success && response.data) {
        this.myPayments.set(response.data);
        if (response.pagination) {
          this.paymentsPagination.set(response.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to fetch my payments:', error);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  // User/Parent: Make a payment
  async makePayment(payment: MakePaymentRequest): Promise<Payment> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<Payment>>(`${this.apiUrl}/pay`, payment)
      );
      if (response.success && response.data) {
        this.myPayments.update(payments => [response.data!, ...payments]);
        // Refresh bills to update status
        await this.getMyBills();
        return response.data;
      }
      throw new Error(response.message || 'Failed to make payment');
    } catch (error: any) {
      // Handle HTTP error responses
      if (error.error?.error) {
        throw new Error(error.error.error);
      }
      // Handle other errors
      throw new Error(error.message || 'Failed to make payment');
    }
  }

  // Format currency in PHP
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  // Get status badge class
  getBillStatusClass(status: string): string {
    switch (status) {
      case 'paid': return 'badge-success';
      case 'partial': return 'badge-warning';
      case 'unpaid': return 'badge-info';
      case 'overdue': return 'badge-danger';
      case 'cancelled': return 'badge-secondary';
      default: return 'badge-secondary';
    }
  }

  getPaymentStatusClass(status: string): string {
    switch (status) {
      case 'verified': return 'badge-success';
      case 'pending': return 'badge-warning';
      case 'rejected': return 'badge-danger';
      default: return 'badge-secondary';
    }
  }

  getBillTypeLabel(type: string): string {
    switch (type) {
      case 'rent': return 'Rent';
      case 'deposit': return 'Deposit';
      case 'utility': return 'Utility';
      case 'fine': return 'Fine';
      case 'other': return 'Other';
      default: return type;
    }
  }

  getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'cash': return 'Cash';
      case 'gcash': return 'GCash';
      case 'maya': return 'Maya';
      case 'other': return 'Other';
      default: return method;
    }
  }

  // Get payment settings (public)
  async getPaymentSettings(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<PaymentSettings>>(`${this.apiUrl}/settings`)
      );
      if (response.success && response.data) {
        this.settings.set(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch payment settings:', error);
    }
  }

  // Admin: Update payment settings
  async updatePaymentSettings(settings: Partial<PaymentSettings>): Promise<void> {
    const response = await firstValueFrom(
      this.http.put<ApiResponse<void>>(`${this.apiUrl}/settings`, settings)
    );
    if (response.success) {
      await this.getPaymentSettings();
    } else {
      throw new Error(response.message || 'Failed to update settings');
    }
  }
}
