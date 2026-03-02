import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'draft' | 'published' | 'expired';
  audience: 'all' | 'residents' | 'parents' | 'staff';
  created_by: number;
  author_name?: string;
  first_name?: string;
  last_name?: string;
  expires_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementStats {
  total: number;
  published: number;
  drafts: number;
  urgent: number;
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?: 'draft' | 'published';
  audience?: 'all' | 'residents' | 'parents' | 'staff';
  expires_at?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AnnouncementService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/announcements`;

  // Get all announcements (admin)
  async getAll(filters?: { status?: string; audience?: string; priority?: string }): Promise<Announcement[]> {
    let url = this.apiUrl;
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.audience) params.append('audience', filters.audience);
    if (filters?.priority) params.append('priority', filters.priority);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await firstValueFrom(
      this.http.get<{ data: Announcement[] }>(url)
    );
    return response.data;
  }

  // Get published announcements (for users)
  async getPublished(): Promise<Announcement[]> {
    const response = await firstValueFrom(
      this.http.get<{ data: Announcement[] }>(`${this.apiUrl}/published`)
    );
    return response.data;
  }

  // Get single announcement
  async getById(id: number): Promise<Announcement> {
    const response = await firstValueFrom(
      this.http.get<{ data: Announcement }>(`${this.apiUrl}/${id}`)
    );
    return response.data;
  }

  // Get stats
  async getStats(): Promise<AnnouncementStats> {
    const response = await firstValueFrom(
      this.http.get<{ data: AnnouncementStats }>(`${this.apiUrl}/stats`)
    );
    return response.data;
  }

  // Create announcement
  async create(data: CreateAnnouncementDto): Promise<{ id: number }> {
    const response = await firstValueFrom(
      this.http.post<{ data: { id: number } }>(this.apiUrl, data)
    );
    return response.data;
  }

  // Update announcement
  async update(id: number, data: Partial<CreateAnnouncementDto>): Promise<void> {
    await firstValueFrom(
      this.http.put(`${this.apiUrl}/${id}`, data)
    );
  }

  // Publish announcement
  async publish(id: number): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/${id}/publish`, {})
    );
  }

  // Delete announcement
  async delete(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/${id}`)
    );
  }
}
