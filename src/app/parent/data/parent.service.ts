import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LeaveRequest } from '../../models/leave-request.model';
import { environment } from '../../../environments/environment';

export interface ChildActivityLog {
  id: number;
  user_id: number;
  user_name: string;
  email: string;
  room_number?: string;
  leave_request_id: number;
  leave_type?: string;
  destination?: string;
  spending_leave_with?: string;
  type: 'check-in' | 'check-out';
  method: string;
  recorded_by: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class ParentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/leave-requests`;
  private checkLogsUrl = `${environment.apiUrl}/check-logs`;

  // Get all leave requests for parent's children
  async getChildRequests(): Promise<LeaveRequest[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: LeaveRequest[] }>(`${this.apiUrl}`)
    );
    return response.data;
  }

  // Get pending requests awaiting parent approval
  async getPendingRequests(): Promise<LeaveRequest[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: LeaveRequest[] }>(`${this.apiUrl}/pending-parent`)
    );
    return response.data;
  }

  // Approve a child's leave request
  async approveRequest(id: number, notes?: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/${id}/parent-approve`, { notes })
    );
  }

  // Decline a child's leave request
  async declineRequest(id: number, notes?: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/${id}/parent-decline`, { notes })
    );
  }

  // Get a specific leave request
  async getById(id: number): Promise<LeaveRequest> {
    const response = await firstValueFrom(
      this.http.get<{ data: LeaveRequest }>(`${this.apiUrl}/${id}`)
    );
    return response.data;
  }

  // Get children's check-in/out activity logs
  async getChildrenActivityLogs(): Promise<ChildActivityLog[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: ChildActivityLog[] }>(`${this.checkLogsUrl}/children`)
    );
    return response.data;
  }
}
