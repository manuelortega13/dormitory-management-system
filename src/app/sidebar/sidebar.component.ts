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
        { label: 'Dashboard', icon: '📊', route: '/manage/dashboard' }
      ]
    },
    {
      title: 'Management',
      items: [
        { label: 'Rooms', icon: '🛏️', route: '/manage/rooms' },
        { label: 'Residents', icon: '👥', route: '/manage/residents' },
        { label: 'Bookings', icon: '📅', route: '/manage/bookings', badge: 3 },
        { label: 'Leave Requests', icon: '🚪', route: '/manage/leave-requests', badge: 5 }
      ]
    },
    {
      title: 'Operations',
      items: [
        { label: 'Maintenance', icon: '🔧', route: '/manage/maintenance', badge: 5 },
        { label: 'Payments', icon: '💰', route: '/manage/payments' },
        { label: 'Inventory', icon: '📦', route: '/manage/inventory' }
      ]
    },
    {
      title: 'Reports & Settings',
      items: [
        { label: 'Reports', icon: '📈', route: '/manage/reports' },
        { label: 'Announcements', icon: '📢', route: '/manage/announcements' },
        { label: 'Settings', icon: '⚙️', route: '/manage/settings' }
      ]
    }
  ];

  toggleSidebar() {
    this.isCollapsed.update(value => !value);
  }
}
