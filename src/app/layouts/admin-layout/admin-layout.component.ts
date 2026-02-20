import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="admin-layout">
      <app-sidebar />
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
  `]
})
export class AdminLayoutComponent {}
