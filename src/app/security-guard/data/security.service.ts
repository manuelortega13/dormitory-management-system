import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LeaveRequest } from '../../models/leave-request.model';

export interface VerificationResult {
  valid: boolean;
  leave_request?: LeaveRequest;
  message: string;
}

export interface CheckLog {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  room_number?: string;
  leave_request_id: number;
  leave_type?: string;
  type: 'check-in' | 'check-out';
  method: string;
  recorded_by: number;
  created_at: string;
}

export interface TodayLogsResponse {
  stats: {
    checkIns: number;
    checkOuts: number;
    total: number;
  };
  logs: CheckLog[];
}

@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/leave-requests';
  private checkLogsUrl = 'http://localhost:3000/api/check-logs';

  // Verify QR code
  async verifyQRCode(qrCode: string): Promise<VerificationResult> {
    const response = await firstValueFrom(
      this.http.get<{ data: VerificationResult }>(
        `${this.apiUrl}/verify/${encodeURIComponent(qrCode)}`
      )
    );
    return response.data;
  }

  // Record resident exit
  async recordExit(id: number): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/${id}/record-exit`, {})
    );
  }

  // Record resident return
  async recordReturn(id: number): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/${id}/record-return`, {})
    );
  }

  // Get all active leave passes (residents currently out)
  async getActiveLeaves(): Promise<LeaveRequest[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: LeaveRequest[] }>(`${this.apiUrl}?status=active`)
    );
    return response.data;
  }

  // Get approved leaves ready for exit
  async getApprovedLeaves(): Promise<LeaveRequest[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: LeaveRequest[] }>(`${this.apiUrl}?status=approved`)
    );
    return response.data;
  }

  // Get today's check logs
  async getTodayLogs(): Promise<TodayLogsResponse> {
    const response = await firstValueFrom(
      this.http.get<TodayLogsResponse>(`${this.checkLogsUrl}/today`)
    );
    return response;
  }
}
