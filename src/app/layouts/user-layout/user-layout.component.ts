import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

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
          <nav class="user-nav">
            <a routerLink="/my-leave-request" routerLinkActive="active" class="nav-item primary">
              <span class="nav-icon">📤</span>
              Request Leave
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
            <div class="avatar">JD</div>
            <span class="user-name">John Doe</span>
          </div>
        </div>
      </header>
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
  `]
})
export class UserLayoutComponent {}
