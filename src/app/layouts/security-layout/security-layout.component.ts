import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-security-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="security-layout" [class.sidebar-open]="isSidebarOpen()">
      <!-- Mobile Header -->
      <header class="mobile-header">
        <button class="menu-toggle" (click)="toggleSidebar()">
          <span class="hamburger-icon">☰</span>
        </button>
        <div class="mobile-logo">
          <span class="logo-icon">🛡️</span>
          <span class="logo-text">DormHub Security</span>
        </div>
      </header>

      <!-- Overlay for mobile -->
      <div class="sidebar-overlay" (click)="closeSidebar()"></div>

      <aside class="security-sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <span class="logo-icon">🛡️</span>
            <span class="logo-text">DormHub Security</span>
          </div>
          <button class="close-sidebar" (click)="closeSidebar()">✕</button>
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/security-guard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">📊</span>
            <span class="nav-label">Dashboard</span>
          </a>
          <a routerLink="/security-guard/visitor-log" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">📝</span>
            <span class="nav-label">Visitor Log</span>
          </a>
          <a routerLink="/security-guard/check-in-out" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">🚪</span>
            <span class="nav-label">Check In/Out</span>
          </a>
          <a routerLink="/security-guard/incidents" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">⚠️</span>
            <span class="nav-label">Incidents</span>
          </a>
          <a routerLink="/security-guard/emergency" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <span class="nav-icon">🚨</span>
            <span class="nav-label">Emergency</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="guard-info">
            <div class="avatar">SG</div>
            <div class="guard-details">
              <span class="guard-name">Security Guard</span>
              <span class="guard-shift">Night Shift</span>
            </div>
          </div>
        </div>
      </aside>
      <main class="security-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .security-layout {
      display: flex;
      min-height: 100vh;
    }

    .mobile-header {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: linear-gradient(90deg, #2c3e50 0%, #1a252f 100%);
      z-index: 1000;
      align-items: center;
      padding: 0 1rem;
      gap: 0.75rem;
    }

    .menu-toggle {
      background: none;
      border: none;
      color: #fff;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0.5rem;
    }

    .mobile-logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .logo-icon {
        font-size: 1.25rem;
      }

      .logo-text {
        font-size: 1rem;
        font-weight: 700;
        color: #fff;
      }
    }

    .sidebar-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1001;
    }

    .close-sidebar {
      display: none;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0.5rem;

      &:hover {
        color: #fff;
      }
    }

    .security-sidebar {
      width: 240px;
      height: 100vh;
      background: linear-gradient(180deg, #2c3e50 0%, #1a252f 100%);
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 1002;
      transition: transform 0.3s ease;
    }

    .sidebar-header {
      padding: 1.25rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .logo-icon {
        font-size: 1.5rem;
      }

      .logo-text {
        font-size: 1.1rem;
        font-weight: 700;
        color: #fff;
      }
    }

    .sidebar-nav {
      flex: 1;
      padding: 1rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      border-radius: 8px;
      font-size: 0.9rem;
      transition: all 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      &.active {
        background: #e74c3c;
        color: #fff;
      }

      .nav-icon {
        font-size: 1.1rem;
      }

      .nav-label {
        font-weight: 500;
      }
    }

    .sidebar-footer {
      padding: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .guard-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .avatar {
      width: 40px;
      height: 40px;
      background: #e74c3c;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 600;
      font-size: 0.9rem;
      flex-shrink: 0;
    }

    .guard-details {
      display: flex;
      flex-direction: column;

      .guard-name {
        font-size: 0.875rem;
        font-weight: 600;
        color: #fff;
      }

      .guard-shift {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
      }
    }

    .security-content {
      flex: 1;
      margin-left: 240px;
      min-height: 100vh;
      background: #f5f6fa;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .mobile-header {
        display: flex;
      }

      .sidebar-overlay {
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }

      .security-sidebar {
        transform: translateX(-100%);
      }

      .close-sidebar {
        display: block;
      }

      .security-content {
        margin-left: 0;
        padding-top: 56px;
      }

      .sidebar-open {
        .sidebar-overlay {
          display: block;
          opacity: 1;
          pointer-events: auto;
        }

        .security-sidebar {
          transform: translateX(0);
        }
      }
    }
  `]
})
export class SecurityLayoutComponent {
  protected readonly isSidebarOpen = signal(false);

  toggleSidebar() {
    this.isSidebarOpen.update(open => !open);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }
}
