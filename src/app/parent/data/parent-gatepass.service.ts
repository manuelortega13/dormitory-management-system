import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Gatepass } from '../../models/gatepass.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class ParentGatepassService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/gatepasses`;

  async getPending(): Promise<Gatepass[]> {
    const res = await firstValueFrom(this.http.get<ApiResponse<Gatepass[]>>(`${this.apiUrl}/pending-parent`));
    return res.data ?? [];
  }

  /** All gatepasses for this parent's children (any status) — backend scopes by parent_id. */
  async getAll(): Promise<Gatepass[]> {
    const res = await firstValueFrom(this.http.get<ApiResponse<Gatepass[]>>(this.apiUrl));
    return res.data ?? [];
  }

  async approve(id: number, notes: string | undefined, faceImage: string): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/parent-approve`, { notes, faceImage }));
  }

  async decline(id: number, notes?: string): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/parent-decline`, { notes }));
  }
}
