import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { LeaveRequest } from '../../../models/leave-request.model';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../auth/auth.service';

export type { LeaveRequest };

@Injectable({
  providedIn: 'root'
})
export class AdminLeaveRequestService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
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

  // Get pending requests based on user role (Home Dean gets pending_dean, VPSAS gets pending_vpsas)
  async getPendingRequests(): Promise<LeaveRequest[]> {
    const user = this.authService.getCurrentUser();
    const endpoint = user?.role === 'vpsas' ? 'pending-vpsas' : 'pending-admin';
    const response = await firstValueFrom(
      this.http.get<{ data: LeaveRequest[] }>(`${this.apiUrl}/${endpoint}`)
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

  // Approve request (Home Dean or VPSAS based on current user role)
  async approve(id: number, notes?: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    const endpoint = user?.role === 'vpsas' ? 'vpsas-approve' : 'admin-approve';
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/${id}/${endpoint}`, { notes })
    );
    this.leaveRequestUpdated.next();
  }

  // Decline request (Home Dean or VPSAS based on current user role)
  async decline(id: number, notes?: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    const endpoint = user?.role === 'vpsas' ? 'vpsas-decline' : 'admin-decline';
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/${id}/${endpoint}`, { notes })
    );
    this.leaveRequestUpdated.next();
  }
}
