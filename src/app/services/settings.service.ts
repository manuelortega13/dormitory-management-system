import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SystemSetting {
  id: number;
  key: string;
  value: any;
  type: 'text' | 'number' | 'toggle' | 'select' | 'image';
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
  providedIn: 'root',
})
export class SettingsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/settings`;

  // State
  settings = signal<SettingsResponse>({});
  isLoading = signal(false);
  error = signal<string | null>(null);
  systemLogo = signal<string | null>(null);
  systemName = signal('PAC DMS');

  async getAllSettings(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.http.get<SettingsResponse>(this.apiUrl));
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
      const response = await firstValueFrom(
        this.http.get<SystemSetting[]>(`${this.apiUrl}/category/${category}`)
      );
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
      await firstValueFrom(this.http.put(this.apiUrl, { settings: updates }));
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
      await firstValueFrom(this.http.put(`${this.apiUrl}/${category}/${key}`, { value }));
      // Update local state
      const currentSettings = this.settings();
      if (currentSettings[category]) {
        const settingIndex = currentSettings[category].findIndex((s) => s.key === key);
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

    const setting = categorySettings.find((s) => s.key === key);
    return setting?.value ?? null;
  }

  async loadBranding(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ logo: string; name: string }>(`${this.apiUrl}/public/branding`)
      );
      if (response?.logo) {
        this.systemLogo.set(response.logo);
        this.applyPwaIcon(response.logo, response.name);
      } else {
        this.systemLogo.set(null);
      }
      if (response?.name) {
        this.systemName.set(response.name);
        document.title = response.name;
      }
    } catch {
      // Silently fail — use defaults
    }
  }

  private applyPwaIcon(logoDataUrl: string, name?: string) {
    const logoServerUrl = `${this.apiUrl}/public/logo.png`;

    // Update apple-touch-icon to server URL (iOS reads this for home screen icon)
    const appleTouchIcon = document.querySelector(
      'link[rel="apple-touch-icon"]'
    ) as HTMLLinkElement;
    if (appleTouchIcon) {
      appleTouchIcon.href = logoServerUrl;
    }

    // Update favicon with data URL (works for in-browser tab)
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon) {
      favicon.href = logoDataUrl;
    }

    // Update manifest dynamically with server-served logo URL
    const existingManifestLink = document.querySelector(
      'link[rel="manifest"]'
    ) as HTMLLinkElement;
    if (existingManifestLink) {
      const appName = name || this.systemName();
      const manifest = {
        name: appName,
        short_name: appName,
        theme_color: '#1a1a2e',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: logoServerUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: logoServerUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: logoServerUrl, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      existingManifestLink.href = URL.createObjectURL(blob);
    }
  }
}
