import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface SystemSetting {
  id: number;
  key: string;
  value: any;
  type: 'text' | 'number' | 'toggle' | 'select';
  description: string;
  options: string[] | null;
}

export interface SettingsResponse {
  [category: string]: SystemSetting[];
}

export interface SettingUpdate {
  category: string;
  key: string;
  value: any;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/settings`;

  // State
  settings = signal<SettingsResponse>({});
  isLoading = signal(false);
  error = signal<string | null>(null);

  async getAllSettings(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await this.http.get<SettingsResponse>(this.apiUrl).toPromise();
      this.settings.set(response || {});
    } catch (err: any) {
      console.error('Failed to fetch settings:', err);
      this.error.set(err.error?.message || 'Failed to fetch settings');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async getSettingsByCategory(category: string): Promise<SystemSetting[]> {
    try {
      const response = await this.http.get<SystemSetting[]>(`${this.apiUrl}/category/${category}`).toPromise();
      return response || [];
    } catch (err: any) {
      console.error('Failed to fetch settings by category:', err);
      throw err;
    }
  }

  async updateSettings(updates: SettingUpdate[]): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.http.put(this.apiUrl, { settings: updates }).toPromise();
      // Refresh settings after update
      await this.getAllSettings();
    } catch (err: any) {
      console.error('Failed to update settings:', err);
      this.error.set(err.error?.message || 'Failed to update settings');
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateSetting(category: string, key: string, value: any): Promise<void> {
    try {
      await this.http.put(`${this.apiUrl}/${category}/${key}`, { value }).toPromise();
      // Update local state
      const currentSettings = this.settings();
      if (currentSettings[category]) {
        const settingIndex = currentSettings[category].findIndex(s => s.key === key);
        if (settingIndex !== -1) {
          currentSettings[category][settingIndex].value = value;
          this.settings.set({ ...currentSettings });
        }
      }
    } catch (err: any) {
      console.error('Failed to update setting:', err);
      throw err;
    }
  }

  getSettingValue(category: string, key: string): any {
    const categorySettings = this.settings()[category];
    if (!categorySettings) return null;
    
    const setting = categorySettings.find(s => s.key === key);
    return setting?.value ?? null;
  }
}
