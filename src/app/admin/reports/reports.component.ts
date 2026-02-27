import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Report {
  id: number;
  name: string;
  description: string;
  category: 'occupancy' | 'financial' | 'maintenance' | 'incidents' | 'activity';
  lastGenerated: string;
  format: 'PDF' | 'Excel' | 'CSV';
  frequency: 'daily' | 'weekly' | 'monthly' | 'on-demand';
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent {
  searchQuery = signal('');

  mockReports: Report[] = [
    {
      id: 1,
      name: 'Occupancy Report',
      description: 'Current room occupancy rates and availability by building/floor',
      category: 'occupancy',
      lastGenerated: '2025-01-15',
      format: 'PDF',
      frequency: 'weekly'
    },
    {
      id: 2,
      name: 'Monthly Revenue Summary',
      description: 'Payment collections, outstanding balances, and revenue breakdown',
      category: 'financial',
      lastGenerated: '2025-01-01',
      format: 'Excel',
      frequency: 'monthly'
    },
    {
      id: 3,
      name: 'Maintenance Activity Log',
      description: 'All maintenance requests, completion rates, and response times',
      category: 'maintenance',
      lastGenerated: '2025-01-14',
      format: 'PDF',
      frequency: 'weekly'
    },
    {
      id: 4,
      name: 'Incident Summary Report',
      description: 'Security incidents, violations, and resolutions',
      category: 'incidents',
      lastGenerated: '2025-01-10',
      format: 'PDF',
      frequency: 'monthly'
    },
    {
      id: 5,
      name: 'Daily Check-in/Check-out',
      description: 'Daily visitor and resident movement logs',
      category: 'activity',
      lastGenerated: '2025-01-15',
      format: 'CSV',
      frequency: 'daily'
    },
    {
      id: 6,
      name: 'Resident Directory',
      description: 'Complete list of residents with room assignments and contact info',
      category: 'occupancy',
      lastGenerated: '2025-01-12',
      format: 'Excel',
      frequency: 'on-demand'
    }
  ];

  stats = {
    totalReports: this.mockReports.length,
    categories: new Set(this.mockReports.map(r => r.category)).size,
    scheduledReports: this.mockReports.filter(r => r.frequency !== 'on-demand').length,
    generatedToday: 2
  };

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      occupancy: '🏠',
      financial: '💰',
      maintenance: '🔧',
      incidents: '⚠️',
      activity: '📊'
    };
    return icons[category] || '📄';
  }

  getFrequencyClass(frequency: string): string {
    const classes: Record<string, string> = {
      daily: 'active',
      weekly: 'pending',
      monthly: 'completed',
      'on-demand': 'on-demand'
    };
    return classes[frequency] || 'pending';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
