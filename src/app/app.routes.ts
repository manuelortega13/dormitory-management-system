import { Routes } from '@angular/router';
import { adminGuard, residentGuard, securityGuard, parentGuard } from './auth/auth.guard';

export const routes: Routes = [
  // Login route
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
  },
  // Register route (residents only)
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent)
  },
  // User/Resident routes (no prefix)
  {
    path: '',
    loadComponent: () => import('./layouts/user-layout/user-layout.component').then(m => m.UserLayoutComponent),
    canActivate: [residentGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./user/home/user-home.component').then(m => m.UserHomeComponent)
      },
      {
        path: 'my-leave-request',
        loadComponent: () => import('./user/create-leave-request/create-leave-request.component').then(m => m.CreateLeaveRequestComponent)
      },
      {
        path: 'my-requests',
        loadComponent: () => import('./user/my-requests/my-requests.component').then(m => m.MyRequestsComponent)
      }
    ]
  },
  // Admin routes (/manage)
  {
    path: 'manage',
    loadComponent: () => import('./layouts/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [adminGuard],
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
      },
      {
        path: 'agents',
        loadComponent: () => import('./admin/agents/agents.component').then(m => m.AgentsComponent)
      }
    ]
  },
  // Security Guard routes (/security-guard)
  {
    path: 'security-guard',
    loadComponent: () => import('./layouts/security-layout/security-layout.component').then(m => m.SecurityLayoutComponent),
    canActivate: [securityGuard],
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
  },
  // Parent routes (/parent)
  {
    path: 'parent',
    loadComponent: () => import('./layouts/parent-layout/parent-layout.component').then(m => m.ParentLayoutComponent),
    canActivate: [parentGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./parent/dashboard/parent-dashboard.component').then(m => m.ParentDashboardComponent)
      },
      {
        path: 'history',
        loadComponent: () => import('./parent/history/parent-history.component').then(m => m.ParentHistoryComponent)
      },
      {
        path: 'activity',
        loadComponent: () => import('./parent/activity/parent-activity.component').then(m => m.ParentActivityComponent)
      }
    ]
  },
  // Wildcard route - redirect to login (auth guards will handle proper redirect)
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
