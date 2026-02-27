import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Payment {
  id: number;
  description: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: 'paid' | 'pending' | 'overdue';
  method: string | null;
  reference: string | null;
}

@Component({
  selector: 'app-my-payments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-payments.component.html',
  styleUrl: './my-payments.component.scss'
})
export class MyPaymentsComponent {
  mockPayments: Payment[] = [
    {
      id: 1,
      description: 'Monthly Rent - January 2025',
      amount: 5000,
      dueDate: '2025-01-05',
      paidDate: '2025-01-03',
      status: 'paid',
      method: 'GCash',
      reference: 'GC-20250103-001'
    },
    {
      id: 2,
      description: 'Monthly Rent - February 2025',
      amount: 5000,
      dueDate: '2025-02-05',
      paidDate: null,
      status: 'pending',
      method: null,
      reference: null
    },
    {
      id: 3,
      description: 'Utility Bill - January 2025',
      amount: 450,
      dueDate: '2025-01-20',
      paidDate: '2025-01-18',
      status: 'paid',
      method: 'Bank Transfer',
      reference: 'BT-20250118-042'
    },
    {
      id: 4,
      description: 'Security Deposit',
      amount: 10000,
      dueDate: '2024-06-01',
      paidDate: '2024-06-01',
      status: 'paid',
      method: 'Cash',
      reference: 'CASH-001'
    },
    {
      id: 5,
      description: 'Late Fee - December 2024',
      amount: 250,
      dueDate: '2024-12-20',
      paidDate: null,
      status: 'overdue',
      method: null,
      reference: null
    }
  ];

  stats = {
    totalPaid: this.mockPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
    pendingAmount: this.mockPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
    overdueAmount: this.mockPayments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0),
    nextDueDate: '2025-02-05'
  };

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-PH');
  }

  formatDate(date: string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getStatusClass(status: string): string {
    return status;
  }
}
