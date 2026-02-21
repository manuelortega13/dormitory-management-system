import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Resident, ResidentFilters, CreateResidentDto, UpdateResidentDto, Parent } from './resident.model';

@Injectable({
  providedIn: 'root'
})
export class ResidentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/users';
  private readonly authUrl = 'http://localhost:3000/api/auth';

  getResidents(filters?: ResidentFilters): Observable<Resident[]> {
    let params = new HttpParams();

    if (filters?.status) {
      params = params.set('status', filters.status);
    }

    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    if (filters?.floor) {
      params = params.set('floor', filters.floor.toString());
    }

    return this.http.get<Resident[]>(`${this.apiUrl}/residents`, { params });
  }

  getResidentById(id: number): Observable<Resident> {
    return this.http.get<Resident>(`${this.apiUrl}/${id}`);
  }

  createResident(data: CreateResidentDto): Observable<{ message: string; user: Resident }> {
    return this.http.post<{ message: string; user: Resident }>(
      `${this.authUrl}/register`,
      { ...data, role: 'resident' }
    );
  }

  updateResident(id: number, data: UpdateResidentDto): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/${id}`,
      data
    );
  }

  deleteResident(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  suspendResident(id: number, reason: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.apiUrl}/${id}/suspend`,
      { reason }
    );
  }

  reactivateResident(id: number): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.apiUrl}/${id}/reactivate`,
      {}
    );
  }

  getParents(): Observable<Parent[]> {
    return this.http.get<Parent[]>(`${this.apiUrl}?role=parent`);
  }
}
