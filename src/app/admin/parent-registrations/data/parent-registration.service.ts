import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ParentRegistration {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  student_resident_id: string;
  registration_status: 'pending' | 'approved' | 'declined';
  registration_reviewed_by: number | null;
  registration_reviewed_at: string | null;
  face_image: string | null;
  created_at: string;
  // Student info
  student_id?: number;
  student_first_name?: string;
  student_last_name?: string;
  student_email?: string;
}

export interface ParentRegistrationDetail extends ParentRegistration {
  face_image: string;
}

export interface PendingCountResponse {
  count: number;
}

export interface ApprovalResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ParentRegistrationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/parent-registrations`;
  
  // Subject to notify sidebar when registration is approved/declined
  private registrationUpdatedSubject = new Subject<void>();
  registrationUpdated$ = this.registrationUpdatedSubject.asObservable();

  getPendingCount(): Observable<PendingCountResponse> {
    return this.http.get<PendingCountResponse>(`${this.apiUrl}/pending/count`);
  }

  getPendingRegistrations(): Observable<ParentRegistration[]> {
    return this.http.get<ParentRegistration[]>(`${this.apiUrl}/pending`);
  }

  getAllRegistrations(status?: string): Observable<ParentRegistration[]> {
    const params = status ? `?status=${status}` : '';
    return this.http.get<ParentRegistration[]>(`${this.apiUrl}${params}`);
  }

  getRegistrationById(id: number): Observable<ParentRegistrationDetail> {
    return this.http.get<ParentRegistrationDetail>(`${this.apiUrl}/${id}`);
  }

  approveRegistration(id: number): Observable<ApprovalResponse> {
    return this.http.post<ApprovalResponse>(`${this.apiUrl}/${id}/approve`, {}).pipe(
      tap(() => this.registrationUpdatedSubject.next())
    );
  }

  declineRegistration(id: number, reason: string): Observable<ApprovalResponse> {
    return this.http.post<ApprovalResponse>(`${this.apiUrl}/${id}/decline`, { reason }).pipe(
      tap(() => this.registrationUpdatedSubject.next())
    );
  }
}
