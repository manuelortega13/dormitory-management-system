import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Incident {
  id: number;
  title: string;
  description: string;
  location: string;
  reportedBy: string;
  reportedAt: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'investigating' | 'resolved';
  assignedTo: string | null;
  resolvedAt: string | null;
}

@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incidents.component.html',
  styleUrl: './incidents.component.scss'
})
export class IncidentsComponent {
  searchQuery = signal('');

  mockIncidents: Incident[] = [
    {
      id: 1,
      title: 'Noise Complaint - Room A-205',
      description: 'Loud music reported after quiet hours (11:30 PM). First warning issued.',
      location: 'Building A, Floor 2',
      reportedBy: 'Resident (Room A-203)',
      reportedAt: '2025-01-15T23:30:00',
      severity: 'low',
      status: 'resolved',
      assignedTo: 'Guard Rodriguez',
      resolvedAt: '2025-01-15T23:45:00'
    },
    {
      id: 2,
      title: 'Unauthorized Visitor',
      description: 'Individual attempted to enter without proper identification. Denied entry.',
      location: 'Main Gate',
      reportedBy: 'Guard Santos',
      reportedAt: '2025-01-15T14:20:00',
      severity: 'medium',
      status: 'resolved',
      assignedTo: 'Guard Santos',
      resolvedAt: '2025-01-15T14:25:00'
    },
    {
      id: 3,
      title: 'Fire Alarm Trigger - Building B',
      description: 'Fire alarm activated on 3rd floor. Investigation shows burnt food in kitchen.',
      location: 'Building B, Floor 3',
      reportedBy: 'System Alert',
      reportedAt: '2025-01-15T18:45:00',
      severity: 'high',
      status: 'investigating',
      assignedTo: 'Guard Team',
      resolvedAt: null
    },
    {
      id: 4,
      title: 'Lost Item Report',
      description: 'Resident reported lost wallet in common area. CCTV review in progress.',
      location: 'Common Area - Lobby',
      reportedBy: 'Carlos Reyes (C-310)',
      reportedAt: '2025-01-15T16:00:00',
      severity: 'low',
      status: 'investigating',
      assignedTo: 'Guard Martinez',
      resolvedAt: null
    },
    {
      id: 5,
      title: 'Water Leak - Room D-102',
      description: 'Water leaking from ceiling reported. Maintenance notified.',
      location: 'Building D, Floor 1',
      reportedBy: 'Night Patrol',
      reportedAt: '2025-01-15T02:30:00',
      severity: 'medium',
      status: 'active',
      assignedTo: null,
      resolvedAt: null
    }
  ];

  stats = {
    total: this.mockIncidents.length,
    active: this.mockIncidents.filter(i => i.status === 'active').length,
    investigating: this.mockIncidents.filter(i => i.status === 'investigating').length,
    resolved: this.mockIncidents.filter(i => i.status === 'resolved').length
  };

  formatDateTime(dateTime: string | null): string {
    if (!dateTime) return '-';
    return new Date(dateTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getSeverityClass(severity: string): string {
    return severity;
  }

  getStatusClass(status: string): string {
    return status;
  }

  getSeverityIcon(severity: string): string {
    const icons: Record<string, string> = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🔶',
      critical: '🚨'
    };
    return icons[severity] || '⚠️';
  }
}
