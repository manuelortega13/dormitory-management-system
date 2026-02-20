import { Routes } from '@angular/router';

export const routes: Routes = [
  // User routes (no prefix)
  {
    path: '',
    loadComponent: () => import('./layouts/user-layout/user-layout.component').then(m => m.UserLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./user/home/user-home.component').then(m => m.UserHomeComponent)
      },
      {
        path: 'my-leave-request',
        loadComponent: () => import('./user/create-leave-request/create-leave-request.component').then(m => m.CreateLeaveRequestComponent)
      }
    ]
  },
  // Admin routes (/manage)
  {
    path: 'manage',
    loadComponent: () => import('./layouts/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./admin/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'rooms',
        loadComponent: () => import('./admin/rooms/rooms.component').then(m => m.RoomsComponent)
      },
      {
        path: 'residents',
        loadComponent: () => import('./admin/residents/residents.component').then(m => m.ResidentsComponent)
      },
      {
        path: 'leave-requests',
        loadComponent: () => import('./admin/leave-requests/leave-requests.component').then(m => m.LeaveRequestsComponent)
      }
    ]
  },
  // Security Guard routes (/security-guard)
  {
    path: 'security-guard',
    loadComponent: () => import('./layouts/security-layout/security-layout.component').then(m => m.SecurityLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./security-guard/dashboard/security-dashboard.component').then(m => m.SecurityDashboardComponent)
      },
      {
        path: 'check-in-out',
        loadComponent: () => import('./security-guard/check-in-out/check-in-out.component').then(m => m.CheckInOutComponent)
      }
    ]
  }
];
