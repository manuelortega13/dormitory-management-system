import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Task } from '../models/task.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/tasks`;

  async getMyTasks(status?: 'pending' | 'completed'): Promise<Task[]> {
    const q = status ? `?status=${status}` : '';
    const res = await firstValueFrom(this.http.get<ApiResponse<Task[]>>(`${this.apiUrl}/my${q}`));
    return res.data ?? [];
  }

  async getAllTasks(filters?: { status?: string; user_id?: number }): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.user_id) params.set('user_id', String(filters.user_id));
    const q = params.toString() ? `?${params.toString()}` : '';
    const res = await firstValueFrom(this.http.get<ApiResponse<Task[]>>(`${this.apiUrl}${q}`));
    return res.data ?? [];
  }

  async completeTask(id: number): Promise<void> {
    await firstValueFrom(this.http.patch<ApiResponse<void>>(`${this.apiUrl}/${id}/complete`, {}));
  }

  // Occupant completes their own task with proof (required image, optional note)
  async completeMyTask(id: number, payload: { note?: string; image: string }): Promise<void> {
    await firstValueFrom(
      this.http.patch<ApiResponse<void>>(`${this.apiUrl}/my/${id}/complete`, payload),
    );
  }
}
