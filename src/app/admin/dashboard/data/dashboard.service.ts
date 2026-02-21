import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { DashboardSummary, RecentActivity, CheckLog, LeaveRequestActivity } from './dashboard.model';
import { RoomsService } from '../../rooms/data/rooms.service';
import { ResidentsService } from '../../residents/data/residents.service';
import { AdminLeaveRequestService } from '../../leave-requests/data/admin-leave-request.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly roomsService = inject(RoomsService);
  private readonly residentsService = inject(ResidentsService);
  private readonly leaveRequestService = inject(AdminLeaveRequestService);
  private readonly apiUrl = 'http://localhost:3000/api';

  getSummary(): Observable<DashboardSummary> {
    return forkJoin({
      rooms: this.roomsService.getAll(),
      residents: this.residentsService.getResidents()
    }).pipe(
      map(({ rooms, residents }) => {
        const totalRooms = rooms.length;
        const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
        const availableRooms = rooms.filter(r => r.status === 'available').length;
        const maintenanceRooms = rooms.filter(r => r.status === 'maintenance').length;

        const totalResidents = residents.length;
        const activeResidents = residents.filter(r => r.status === 'active').length;

        return {
          totalRooms,
          occupiedRooms,
          availableRooms,
          maintenanceRooms,
          totalResidents,
          activeResidents,
          pendingRequests: 0 // Will be updated separately
        };
      })
    );
  }

  async getPendingRequestsCount(): Promise<number> {
    try {
      const pendingList = await this.leaveRequestService.getPendingRequests();
      return pendingList.length;
    } catch (error) {
      console.error('Failed to load pending requests:', error);
      return 0;
    }
  }

  getRecentActivities(limit: number = 10): Observable<RecentActivity[]> {
    return forkJoin({
      checkLogs: this.http.get<CheckLog[]>(`${this.apiUrl}/check-logs?limit=${limit}`),
      leaveRequests: this.http.get<{ data: LeaveRequestActivity[] }>(`${this.apiUrl}/leave-requests?limit=${limit}`)
    }).pipe(
      map(({ checkLogs, leaveRequests }) => {
        const activities: RecentActivity[] = [];

        // Map check logs to activities
        checkLogs.forEach(log => {
          const roomInfo = log.room_number ? ` (Room ${log.room_number})` : '';
          activities.push({
            id: log.id,
            type: log.type,
            description: `${log.first_name} ${log.last_name} ${log.type === 'check-in' ? 'checked in' : 'checked out'}${roomInfo}`,
            timestamp: new Date(log.created_at),
            icon: log.type === 'check-in' ? '🏠' : '👋'
          });
        });

        // Map leave requests to activities (only approved/declined)
        leaveRequests.data
          .filter(lr => lr.status === 'approved' || lr.status === 'declined')
          .forEach(lr => {
            activities.push({
              id: lr.id + 10000, // Offset to avoid ID collision
              type: lr.status === 'approved' ? 'leave-approved' : 'leave-declined',
              description: `Leave request (${lr.leave_type}) for ${lr.first_name} ${lr.last_name} was ${lr.status}`,
              timestamp: new Date(lr.updated_at),
              icon: lr.status === 'approved' ? '✅' : '❌'
            });
          });

        // Sort by timestamp descending and take top limit
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return activities.slice(0, limit);
      })
    );
  }
}
