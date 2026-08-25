import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Gatepass, DisciplinaryReview } from '../../../models/gatepass.model';

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

  // Admin / Home Dean create a gatepass on an occupant's behalf
  async createForOccupant(payload: {
    userId: number;
    reason: string;
    destination: string;
  }): Promise<void> {
    await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/for-occupant`, payload));
    this.notify();
  }

  async getPendingDean(): Promise<Gatepass[]> {
    const res = await firstValueFrom(
      this.http.get<ApiResponse<Gatepass[]>>(`${this.apiUrl}/pending-dean`),
    );
    return res.data ?? [];
  }

  async deanApprove(id: number, notes?: string): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/dean-approve`, { notes }),
    );
    this.notify();
  }
  async deanDecline(id: number, notes?: string): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/dean-decline`, { notes }),
    );
    this.notify();
  }

  async getPendingDisciplinary(): Promise<DisciplinaryReview[]> {
    const res = await firstValueFrom(
      this.http.get<ApiResponse<DisciplinaryReview[]>>(`${this.apiUrl}/disciplinary/pending`),
    );
    return res.data ?? [];
  }

  async assignTask(
    gatepassId: number,
    task: { title: string; description?: string; due_date?: string },
  ): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiResponse<void>>(`${this.apiUrl}/${gatepassId}/assign-task`, task),
    );
    this.notify();
  }

  async waive(gatepassId: number): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiResponse<void>>(`${this.apiUrl}/${gatepassId}/waive`, {}),
    );
    this.notify();
  }
}
