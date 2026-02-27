import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService, DashboardSummary, RecentActivity } from './data';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  protected readonly isLoading = signal(true);

  protected readonly summary = signal<DashboardSummary>({
    totalRooms: 0,
    occupiedRooms: 0,
    availableRooms: 0,
    maintenanceRooms: 0,
    totalResidents: 0,
    activeResidents: 0,
    pendingRequests: 0
  });

  protected readonly occupancyRate = computed(() => {
    const s = this.summary();
    if (s.totalRooms === 0) return 0;
    return Math.round((s.occupiedRooms / s.totalRooms) * 100);
  });

  protected readonly recentActivities = signal<RecentActivity[]>([]);

  protected readonly quickActions = [
    { label: 'Add Resident', icon: '👤', route: '/manage/residents' },
    { label: 'Room Assignment', icon: '🛏️', route: '/manage/rooms' },
    { label: 'Leave Requests', icon: '🚪', route: '/manage/leave-requests' },
    { label: 'Manage Agents', icon: '👷', route: '/manage/agents' }
  ];

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadRecentActivities();
  }

  private loadDashboardData(): void {
    this.isLoading.set(true);

    this.dashboardService.getSummary().subscribe({
      next: async (summaryData) => {
        const pendingRequests = await this.dashboardService.getPendingRequestsCount();
        this.summary.set({ ...summaryData, pendingRequests });
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard data:', err);
        this.isLoading.set(false);
      }
    });
  }

  private loadRecentActivities(): void {
    this.dashboardService.getRecentActivities(10).subscribe({
      next: (activities) => {
        this.recentActivities.set(activities);
      },
      error: (err) => {
        console.error('Failed to load recent activities:', err);
      }
    });
  }
}
