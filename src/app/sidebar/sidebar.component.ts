import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  protected readonly isCollapsed = signal(false);

  protected readonly menuSections: MenuSection[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: '📊', route: '/dashboard' }
      ]
    },
    {
      title: 'Management',
      items: [
        { label: 'Rooms', icon: '🛏️', route: '/rooms' },
        { label: 'Residents', icon: '👥', route: '/residents' },
        { label: 'Bookings', icon: '📅', route: '/bookings', badge: 3 },
        { label: 'Leave Requests', icon: '🚪', route: '/leave-requests', badge: 5 }
      ]
    },
    {
      title: 'Operations',
      items: [
        { label: 'Maintenance', icon: '🔧', route: '/maintenance', badge: 5 },
        { label: 'Payments', icon: '💰', route: '/payments' },
        { label: 'Inventory', icon: '📦', route: '/inventory' }
      ]
    },
    {
      title: 'Reports & Settings',
      items: [
        { label: 'Reports', icon: '📈', route: '/reports' },
        { label: 'Announcements', icon: '📢', route: '/announcements' },
        { label: 'Settings', icon: '⚙️', route: '/settings' }
      ]
    }
  ];

  toggleSidebar() {
    this.isCollapsed.update(value => !value);
  }
}
