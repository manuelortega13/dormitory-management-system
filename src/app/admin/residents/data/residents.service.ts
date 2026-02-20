import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Resident, ResidentFilters } from './resident.model';

@Injectable({
  providedIn: 'root'
})
export class ResidentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/users';

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

  deleteResident(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
