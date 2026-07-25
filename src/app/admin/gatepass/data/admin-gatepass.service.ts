import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Gatepass, GatepassExtension } from '../../../models/gatepass.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class AdminGatepassService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/gatepasses`;

  private readonly updatedSubject = new Subject<void>();
  readonly updated$ = this.updatedSubject.asObservable();
  private notify() {
    this.updatedSubject.next();
  }

  async getAll(status?: string): Promise<Gatepass[]> {
    const q = status ? `?status=${status}` : '';
    const res = await firstValueFrom(this.http.get<ApiResponse<Gatepass[]>>(`${this.apiUrl}${q}`));
    return res.data ?? [];
  }

  async getPendingDean(): Promise<Gatepass[]> {
    const res = await firstValueFrom(this.http.get<ApiResponse<Gatepass[]>>(`${this.apiUrl}/pending-dean`));
    return res.data ?? [];
  }

  async getPendingVpsas(): Promise<Gatepass[]> {
    const res = await firstValueFrom(this.http.get<ApiResponse<Gatepass[]>>(`${this.apiUrl}/pending-vpsas`));
    return res.data ?? [];
  }

  async deanApprove(id: number, notes?: string): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/dean-approve`, { notes }));
    this.notify();
  }
  async deanDecline(id: number, notes?: string): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/dean-decline`, { notes }));
    this.notify();
  }
  async vpsasApprove(id: number, notes?: string): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/vpsas-approve`, { notes }));
    this.notify();
  }
  async vpsasDecline(id: number, notes?: string): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/vpsas-decline`, { notes }));
    this.notify();
  }

  async getPendingExtensionReviews(): Promise<GatepassExtension[]> {
    const res = await firstValueFrom(
      this.http.get<ApiResponse<GatepassExtension[]>>(`${this.apiUrl}/extensions/pending-review`)
    );
    return res.data ?? [];
  }

  async assignTask(
    extId: number,
    task: { title: string; description?: string; due_date?: string }
  ): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/extensions/${extId}/assign-task`, task));
    this.notify();
  }

  async waiveExtension(extId: number, notes?: string): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/extensions/${extId}/waive`, { notes }));
    this.notify();
  }
}
