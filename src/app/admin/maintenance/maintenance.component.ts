import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface MaintenanceRequest {
  id: number;
  title: string;
  description: string;
  roomNumber: string;
  reportedBy: string;
  reportedDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'scheduled';
  priority: 'low' | 'medium' | 'high';
  assignedTo: string | null;
}

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.scss'
})
export class MaintenanceComponent {
  protected readonly searchQuery = signal('');
  
  protected readonly mockRequests: MaintenanceRequest[] = [
    { id: 1, title: 'Broken AC Unit', description: 'Air conditioning not cooling properly', roomNumber: '101-A', reportedBy: 'John Smith', reportedDate: '2026-02-20', status: 'in-progress', priority: 'high', assignedTo: 'Mike Technician' },
    { id: 2, title: 'Leaky Faucet', description: 'Bathroom faucet is dripping constantly', roomNumber: '203-B', reportedBy: 'Maria Garcia', reportedDate: '2026-02-22', status: 'pending', priority: 'medium', assignedTo: null },
    { id: 3, title: 'Light Bulb Replacement', description: 'Ceiling light needs replacement', roomNumber: '105-C', reportedBy: 'James Wilson', reportedDate: '2026-02-18', status: 'completed', priority: 'low', assignedTo: 'Tom Electrician' },
    { id: 4, title: 'Door Lock Issue', description: 'Door lock is jamming frequently', roomNumber: '302-A', reportedBy: 'Emily Brown', reportedDate: '2026-02-24', status: 'scheduled', priority: 'high', assignedTo: 'Mike Technician' },
    { id: 5, title: 'Window Crack', description: 'Small crack in window glass', roomNumber: '201-B', reportedBy: 'Michael Lee', reportedDate: '2026-02-25', status: 'pending', priority: 'medium', assignedTo: null },
    { id: 6, title: 'Clogged Drain', description: 'Shower drain is clogged', roomNumber: '104-A', reportedBy: 'Sarah Johnson', reportedDate: '2026-02-26', status: 'in-progress', priority: 'high', assignedTo: 'Tom Plumber' },
  ];

  protected readonly stats = {
    total: this.mockRequests.length,
    pending: this.mockRequests.filter(r => r.status === 'pending').length,
    inProgress: this.mockRequests.filter(r => r.status === 'in-progress').length,
    completed: this.mockRequests.filter(r => r.status === 'completed').length,
  };

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'in-progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      case 'scheduled': return 'status-scheduled';
      default: return '';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'low': return 'status-low';
      case 'medium': return 'status-medium';
      case 'high': return 'status-high';
      default: return '';
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
