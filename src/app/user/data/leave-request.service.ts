import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LeaveRequest } from '../../models/leave-request.model';
import { environment } from '../../../environments/environment';

export type { LeaveRequest };

export interface CreateLeaveRequestDto {
  leaveType: string;
  startDate: string;
  endDate: string;
  destination: string;
  reason: string;
  emergencyContact: string;
  emergencyPhone: string;
}

@Injectable({
  providedIn: 'root'
})
export class LeaveRequestService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/leave-requests`;

  // Get all leave requests for current user
  async getMyRequests(): Promise<LeaveRequest[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: LeaveRequest[] }>(`${this.apiUrl}`)
    );
    return response.data;
  }

  // Create new leave request
  async create(data: CreateLeaveRequestDto): Promise<LeaveRequest> {
    const response = await firstValueFrom(
      this.http.post<{ message: string; data: LeaveRequest }>(this.apiUrl, data)
    );
    return response.data;
  }

  // Cancel a leave request
  async cancel(id: number): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/${id}/cancel`, {})
    );
  }

  // Get my QR code for approved request
  async getMyQRCode(): Promise<{ qr_code: string; leave_request: LeaveRequest } | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: { qr_code: string; leave_request: LeaveRequest } }>(`${this.apiUrl}/my-qr`)
      );
      return response.data;
    } catch {
      return null;
    }
  }
}
