import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'security_guard' | 'resident' | 'parent' | 'home_dean' | 'vpsas' | 'business_officer';
  deanType?: 'male' | 'female' | null;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
  requiresApproval?: boolean;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: 'resident' | 'parent';
  faceImage?: string;
  studentResidentId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = `${environment.apiUrl}/auth`;

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
    
    // Store token and user info (only if token provided - parents pending approval won't have one)
    if (this.isBrowser && response.token && response.user) {
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
    const token = this.getToken();
    if (!token) return false;

    // A stale/expired token (common in an installed PWA that persists storage across
    // sessions) must count as logged-out — otherwise guards and the login/register
    // pages think you're authenticated, redirect you, and the next API call 401s you
    // straight back to /login.
    if (this.isTokenExpired(token)) {
      if (this.isBrowser) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      return false;
    }
    return true;
  }

  /** Decode a JWT and check its `exp` claim. Malformed tokens are treated as expired. */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return false; // no expiry claim -> non-expiring token
      return payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  getRedirectUrl(role: string): string {
    switch (role) {
      case 'admin':
      case 'home_dean':
      case 'vpsas':
        return '/manage';
      case 'business_officer':
        return '/manage/payments';
      case 'security_guard':
        return '/security-guard/check-in-out';
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
