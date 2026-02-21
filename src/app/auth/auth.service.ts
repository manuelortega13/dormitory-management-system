import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'security_guard' | 'resident' | 'parent' | 'dean';
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: 'resident';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = 'http://localhost:3000/api/auth';

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password })
    );
    
    // Store token and user info
    if (this.isBrowser) {
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    
    return response;
  }

  async register(data: RegisterData): Promise<LoginResponse> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.apiUrl}/register`, data)
    );
    
    // Store token and user info (auto-login after registration)
    if (this.isBrowser) {
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    
    return response;
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('token');
  }

  getCurrentUser(): User | null {
    if (!this.isBrowser) return null;
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getRedirectUrl(role: string): string {
    switch (role) {
      case 'admin':
      case 'dean':
        return '/manage';
      case 'security_guard':
        return '/security-guard';
      case 'parent':
        return '/parent';
      case 'resident':
      default:
        return '/';
    }
  }

  redirectBasedOnRole(): void {
    const user = this.getCurrentUser();
    if (user) {
      const url = this.getRedirectUrl(user.role);
      this.router.navigate([url]);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
