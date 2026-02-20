import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface DormitorySummary {
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  totalResidents: number;
  pendingRequests: number;
  maintenanceIssues: number;
}

interface RecentActivity {
  id: number;
  type: 'check-in' | 'check-out' | 'maintenance' | 'payment';
  description: string;
  timestamp: Date;
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  protected readonly summary = signal<DormitorySummary>({
    totalRooms: 120,
    occupiedRooms: 98,
    availableRooms: 22,
    totalResidents: 186,
    pendingRequests: 5,
    maintenanceIssues: 3
  });

  protected readonly occupancyRate = signal<number>(
    Math.round((this.summary().occupiedRooms / this.summary().totalRooms) * 100)
  );

  protected readonly recentActivities = signal<RecentActivity[]>([
    {
      id: 1,
      type: 'check-in',
      description: 'John Doe checked into Room 205',
      timestamp: new Date('2026-02-19T09:30:00'),
      icon: '🏠'
    },
    {
      id: 2,
      type: 'payment',
      description: 'Payment received from Sarah Smith - $850',
      timestamp: new Date('2026-02-19T08:15:00'),
      icon: '💰'
    },
    {
      id: 3,
      type: 'maintenance',
      description: 'Maintenance request for Room 112 - Plumbing',
      timestamp: new Date('2026-02-18T16:45:00'),
      icon: '🔧'
    },
    {
      id: 4,
      type: 'check-out',
      description: 'Mike Johnson checked out from Room 301',
      timestamp: new Date('2026-02-18T14:00:00'),
      icon: '👋'
    },
    {
      id: 5,
      type: 'check-in',
      description: 'Emily Brown checked into Room 108',
      timestamp: new Date('2026-02-18T11:20:00'),
      icon: '🏠'
    }
  ]);

  protected readonly quickActions = [
    { label: 'Add Resident', icon: '👤', route: '/residents/add' },
    { label: 'Room Assignment', icon: '🛏️', route: '/rooms/assign' },
    { label: 'Maintenance Request', icon: '🔧', route: '/maintenance/new' },
    { label: 'View Reports', icon: '📊', route: '/reports' }
  ];
}
