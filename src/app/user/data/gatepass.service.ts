import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Gatepass, CreateGatepassDto, GatepassExtension } from '../../models/gatepass.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class GatepassService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/gatepasses`;

  async getMyGatepasses(): Promise<Gatepass[]> {
    const res = await firstValueFrom(this.http.get<ApiResponse<Gatepass[]>>(this.apiUrl));
    return res.data ?? [];
  }

  async getById(id: number): Promise<Gatepass | null> {
    const res = await firstValueFrom(this.http.get<ApiResponse<Gatepass>>(`${this.apiUrl}/${id}`));
    return res.data ?? null;
  }

  async getMyActive(): Promise<Gatepass | null> {
    const res = await firstValueFrom(this.http.get<ApiResponse<Gatepass | null>>(`${this.apiUrl}/my-qr`));
    return res.data ?? null;
  }

  async create(dto: CreateGatepassDto): Promise<{ id: number; status: string }> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<{ id: number; status: string }>>(this.apiUrl, dto)
    );
    if (!res.success || !res.data) throw new Error(res.message || 'Failed to create gatepass');
    return res.data;
  }

  async cancel(id: number): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/cancel`, {}));
  }

  async extend(id: number, reason: string, image: string): Promise<{ deadline: string; extensions_remaining: number }> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<any> & { deadline: string; extensions_remaining: number }>(
        `${this.apiUrl}/${id}/extend`,
        { reason, image }
      )
    );
    return { deadline: (res as any).deadline, extensions_remaining: (res as any).extensions_remaining };
  }

  async getExtensions(id: number): Promise<GatepassExtension[]> {
    const res = await firstValueFrom(
      this.http.get<ApiResponse<GatepassExtension[]>>(`${this.apiUrl}/${id}/extensions`)
    );
    return res.data ?? [];
  }
}
