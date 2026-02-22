import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { LeaveRequest } from '../../../models/leave-request.model';
import { environment } from '../../../../environments/environment';

export type { LeaveRequest };

@Injectable({
  providedIn: 'root'
})
export class AdminLeaveRequestService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/leave-requests`;
  
  // Subject to notify when leave requests are updated
  private leaveRequestUpdated = new Subject<void>();
  leaveRequestUpdated$ = this.leaveRequestUpdated.asObservable();

  // Get all leave requests (admin view)
  async getAllRequests(): Promise<LeaveRequest[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: LeaveRequest[] }>(this.apiUrl)
    );
    return response.data;
  }

  // Get pending requests for admin approval
  async getPendingRequests(): Promise<LeaveRequest[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: LeaveRequest[] }>(`${this.apiUrl}/pending-admin`)
    );
    return response.data;
  }

  // Get a specific leave request
  async getById(id: number): Promise<LeaveRequest> {
    const response = await firstValueFrom(
      this.http.get<{ data: LeaveRequest }>(`${this.apiUrl}/${id}`)
    );
    return response.data;
  }

  // Approve request
  async approve(id: number, notes?: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/${id}/admin-approve`, { notes })
    );
    this.leaveRequestUpdated.next();
  }

  // Decline request
  async decline(id: number, notes?: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/${id}/admin-decline`, { notes })
    );
    this.leaveRequestUpdated.next();
  }
}
