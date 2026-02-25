import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Agent, AgentFilters, CreateAgentDto, UpdateAgentDto } from './agent.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AgentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  getAgents(filters?: AgentFilters): Observable<Agent[]> {
    let params = new HttpParams();

    if (filters?.role) {
      params = params.set('role', filters.role);
    }

    if (filters?.status) {
      params = params.set('status', filters.status);
    }

    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    return this.http.get<Agent[]>(`${this.apiUrl}/agents/list`, { params });
  }

  createAgent(data: CreateAgentDto): Observable<{ message: string; data: Agent }> {
    return this.http.post<{ message: string; data: Agent }>(
      `${this.apiUrl}/agents`,
      data
    );
  }

  updateAgent(id: number, data: UpdateAgentDto): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/agents/${id}`,
      data
    );
  }

  deleteAgent(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  suspendAgent(id: number, reason: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.apiUrl}/${id}/suspend`,
      { reason }
    );
  }

  reactivateAgent(id: number): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.apiUrl}/${id}/reactivate`,
      {}
    );
  }
}
