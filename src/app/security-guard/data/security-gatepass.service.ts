import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Gatepass } from '../../models/gatepass.model';

export interface GatepassVerifyResult {
  valid: boolean;
  type: 'gatepass';
  action?: 'exit' | 'return';
  message: string;
  gatepass?: Gatepass;
}

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class SecurityGatepassService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/gatepasses`;

  async verify(qrCode: string): Promise<GatepassVerifyResult> {
    const res = await firstValueFrom(
      this.http.get<{ data: GatepassVerifyResult }>(`${this.apiUrl}/verify/${encodeURIComponent(qrCode)}`)
    );
    return res.data;
  }

  async recordExit(id: number): Promise<{ deadline?: string }> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<any> & { deadline?: string }>(`${this.apiUrl}/${id}/record-exit`, {})
    );
    return { deadline: (res as any).deadline };
  }

  async recordReturn(id: number): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/record-return`, {}));
  }
}
