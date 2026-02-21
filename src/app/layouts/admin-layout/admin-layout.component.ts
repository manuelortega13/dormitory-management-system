import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, CommonModule],
  template: `
    <div class="admin-layout" [class.sidebar-open]="isMobileSidebarOpen()">
      <!-- Mobile overlay -->
      @if (isMobileSidebarOpen()) {
        <div class="mobile-overlay" (click)="closeMobileSidebar()"></div>
      }
      
      <!-- Mobile header -->
      <header class="mobile-header">
        <button class="menu-toggle" (click)="toggleMobileSidebar()">
          <span>☰</span>
        </button>
        <span class="mobile-logo">🏠 DormHub</span>
      </header>
      
      <app-sidebar [class.mobile-visible]="isMobileSidebarOpen()" (click)="handleSidebarClick($event)" />
      <main class="admin-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .admin-layout {
      display: flex;
      min-height: 100vh;
    }

    .admin-content {
      flex: 1;
      margin-left: 260px;
      transition: margin-left 0.3s ease;
      min-height: 100vh;
      background: #f5f6fa;
    }

    .mobile-header {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
      z-index: 999;
      align-items: center;
      padding: 0 1rem;
      gap: 1rem;
    }

    .menu-toggle {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      width: 40px;
      height: 40px;
      border-radius: 8px;
      font-size: 1.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .menu-toggle:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .mobile-logo {
      color: #fff;
      font-weight: 700;
      font-size: 1.1rem;
    }

    .mobile-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999;
    }

    @media (max-width: 768px) {
      .admin-content {
        margin-left: 0;
        padding-top: 56px;
      }

      .mobile-header {
        display: flex;
      }

      .mobile-overlay {
        display: block;
      }

      :host ::ng-deep app-sidebar {
        .sidebar {
          transform: translateX(-100%);
          transition: transform 0.3s ease;
        }
      }

      :host ::ng-deep app-sidebar.mobile-visible {
        .sidebar {
          transform: translateX(0);
          z-index: 1001;
        }
      }
    }
  `]
})
export class AdminLayoutComponent {
  protected readonly isMobileSidebarOpen = signal(false);

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update(v => !v);
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  handleSidebarClick(event: Event): void {
    // Close sidebar when clicking menu items on mobile
    const target = event.target as HTMLElement;
    if (target.closest('.menu-item') || target.closest('.logout-btn')) {
      if (window.innerWidth <= 768) {
        this.closeMobileSidebar();
      }
    }
  }
}
