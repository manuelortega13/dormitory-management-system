import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../auth/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="user-layout">
      <header class="user-header">
        <div class="header-container">
          <div class="logo">
            <span class="logo-icon">🏠</span>
            <span class="logo-text">DormHub</span>
          </div>
          
          <!-- Mobile menu button -->
          <button class="mobile-menu-btn" (click)="toggleMobileMenu()">
            <span class="hamburger-icon" [class.open]="isMobileMenuOpen()">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
          
          <nav class="user-nav" [class.mobile-open]="isMobileMenuOpen()">
            <a routerLink="/my-leave-request" routerLinkActive="active" class="nav-item primary">
              <span class="nav-icon">📤</span>
              Request Leave
            </a>
            <a routerLink="/my-requests" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">📋</span>
              My Requests
            </a>
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item">
              <span class="nav-icon">🏠</span>
              Home
            </a>
            <a routerLink="/my-room" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">🛏️</span>
              My Room
            </a>
            <a routerLink="/my-payments" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">💰</span>
              Payments
            </a>
            <a routerLink="/announcements" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">📢</span>
              Announcements
            </a>
          </nav>
          <div class="user-profile">
            <div class="avatar">{{ userInitials() }}</div>
            <span class="user-name">{{ userName() }}</span>
            <button class="logout-btn" (click)="logout()" title="Logout">🚪</button>
          </div>
        </div>
      </header>
      
      <!-- Mobile menu overlay -->
      @if (isMobileMenuOpen()) {
        <div class="mobile-overlay" (click)="closeMobileMenu()"></div>
      }
      
      <main class="user-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .user-layout {
      min-height: 100vh;
      background: #f5f6fa;
    }

    .user-header {
      background: linear-gradient(90deg, #1a1a2e 0%, #16213e 100%);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .header-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 70px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .logo-icon {
        font-size: 1.75rem;
      }

      .logo-text {
        font-size: 1.25rem;
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.5px;
      }
    }

    .user-nav {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1rem;
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      &.active {
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
      }

      &.primary {
        background: linear-gradient(90deg, #4a90d9 0%, #667eea 100%);
        color: #fff;

        &:hover {
          box-shadow: 0 4px 12px rgba(74, 144, 217, 0.3);
          transform: translateY(-1px);
        }
      }

      .nav-icon {
        font-size: 1rem;
      }
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .avatar {
        width: 38px;
        height: 38px;
        background: linear-gradient(135deg, #4a90d9 0%, #667eea 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 600;
        font-size: 0.9rem;
      }

      .user-name {
        color: #fff;
        font-size: 0.9rem;
        font-weight: 500;
      }

      .logout-btn {
        background: rgba(239, 68, 68, 0.2);
        border: none;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.2s;

        &:hover {
          background: rgba(239, 68, 68, 0.4);
        }
      }
    }

    .user-content {
      min-height: calc(100vh - 70px);
    }

    @media (max-width: 992px) {
      .header-container {
        padding: 0 1rem;
      }

      .nav-item {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;

        .nav-icon {
          display: none;
        }

        &.primary .nav-icon {
          display: inline;
        }
      }

      .user-name {
        display: none;
      }
    }

    // Mobile hamburger button
    .mobile-menu-btn {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      z-index: 1001;
    }

    .hamburger-icon {
      display: flex;
      flex-direction: column;
      gap: 5px;
      width: 24px;

      span {
        display: block;
        width: 100%;
        height: 3px;
        background: #fff;
        border-radius: 2px;
        transition: all 0.3s ease;
      }

      &.open {
        span:nth-child(1) {
          transform: rotate(45deg) translate(6px, 6px);
        }
        span:nth-child(2) {
          opacity: 0;
        }
        span:nth-child(3) {
          transform: rotate(-45deg) translate(6px, -6px);
        }
      }
    }

    .mobile-overlay {
      display: none;
    }

    @media (max-width: 768px) {
      .mobile-menu-btn {
        display: block;
        order: 3;
      }

      .header-container {
        flex-wrap: wrap;
      }

      .user-nav {
        display: none;
        position: fixed;
        top: 70px;
        left: 0;
        right: 0;
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        flex-direction: column;
        padding: 1rem;
        gap: 0.5rem;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        &.mobile-open {
          display: flex;
        }

        .nav-item {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 1rem;

          .nav-icon {
            display: inline;
          }

          &:hover {
            background: rgba(255, 255, 255, 0.15);
          }
        }
      }

      .user-profile {
        order: 2;
        margin-left: auto;

        .user-name {
          display: none;
        }
      }

      .mobile-overlay {
        display: block;
        position: fixed;
        top: 70px;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
      }
    }

    @media (max-width: 480px) {
      .header-container {
        height: 60px;
      }

      .user-content {
        min-height: calc(100vh - 60px);
      }

      .logo {
        .logo-icon {
          font-size: 1.5rem;
        }

        .logo-text {
          font-size: 1.1rem;
        }
      }

      .user-profile {
        .avatar {
          width: 32px;
          height: 32px;
          font-size: 0.8rem;
        }

        .logout-btn {
          width: 32px;
          height: 32px;
          font-size: 0.9rem;
        }
      }

      .user-nav {
        top: 60px;
      }

      .mobile-overlay {
        top: 60px;
      }
    }
  `]
})
export class UserLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  protected readonly userName = signal('User');
  protected readonly userInitials = signal('U');
  protected readonly isMobileMenuOpen = signal(false);

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName.set(`${user.firstName} ${user.lastName}`);
      this.userInitials.set(this.getInitials(user.firstName, user.lastName));
    }

    // Close mobile menu on route change
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeMobileMenu();
    });
  }

  private getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  logout() {
    this.authService.logout();
  }
}
