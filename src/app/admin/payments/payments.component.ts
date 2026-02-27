import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Payment {
  id: number;
  residentName: string;
  roomNumber: string;
  amount: number;
  type: 'rent' | 'deposit' | 'utility' | 'fine';
  status: 'paid' | 'pending' | 'overdue';
  dueDate: string;
  paidDate: string | null;
  paymentMethod: string | null;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent {
  searchQuery = signal('');

  mockPayments: Payment[] = [
    {
      id: 1,
      residentName: 'Juan Dela Cruz',
      roomNumber: 'A-101',
      amount: 5000,
      type: 'rent',
      status: 'paid',
      dueDate: '2025-01-01',
      paidDate: '2024-12-28',
      paymentMethod: 'GCash'
    },
    {
      id: 2,
      residentName: 'Maria Santos',
      roomNumber: 'B-205',
      amount: 5000,
      type: 'rent',
      status: 'pending',
      dueDate: '2025-01-15',
      paidDate: null,
      paymentMethod: null
    },
    {
      id: 3,
      residentName: 'Pedro Reyes',
      roomNumber: 'C-312',
      amount: 5000,
      type: 'rent',
      status: 'overdue',
      dueDate: '2024-12-15',
      paidDate: null,
      paymentMethod: null
    },
    {
      id: 4,
      residentName: 'Ana Garcia',
      roomNumber: 'A-102',
      amount: 800,
      type: 'utility',
      status: 'paid',
      dueDate: '2025-01-10',
      paidDate: '2025-01-08',
      paymentMethod: 'Bank Transfer'
    },
    {
      id: 5,
      residentName: 'Carlos Lopez',
      roomNumber: 'D-401',
      amount: 10000,
      type: 'deposit',
      status: 'paid',
      dueDate: '2024-12-01',
      paidDate: '2024-12-01',
      paymentMethod: 'Cash'
    },
    {
      id: 6,
      residentName: 'Rosa Martinez',
      roomNumber: 'B-210',
      amount: 500,
      type: 'fine',
      status: 'pending',
      dueDate: '2025-01-20',
      paidDate: null,
      paymentMethod: null
    }
  ];

  stats = {
    totalCollected: this.mockPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
    pending: this.mockPayments.filter(p => p.status === 'pending').length,
    overdue: this.mockPayments.filter(p => p.status === 'overdue').length,
    thisMonth: this.mockPayments.filter(p => p.status === 'paid').length
  };

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      paid: 'completed',
      pending: 'pending',
      overdue: 'overdue'
    };
    return classes[status] || 'pending';
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      rent: 'Monthly Rent',
      deposit: 'Security Deposit',
      utility: 'Utilities',
      fine: 'Fine/Penalty'
    };
    return labels[type] || type;
  }

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
}
