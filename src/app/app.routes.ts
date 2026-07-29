import { Routes } from '@angular/router';
import {
  adminGuard,
  residentGuard,
  securityGuard,
  parentGuard,
  manageGuard,
  paymentsGuard,
  settingsGuard,
  maintenanceGuard,
} from './auth/auth.guard';

export const routes: Routes = [
  // Login route
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then((m) => m.LoginComponent),
  },
  // Maintenance page (always reachable)
  {
    path: 'maintenance',
    loadComponent: () =>
      import('./maintenance/maintenance.component').then((m) => m.MaintenanceComponent),
  },
  // Register selection route
  {
    path: 'register',
    loadComponent: () =>
      import('./auth/register/register-selection.component').then(
        (m) => m.RegisterSelectionComponent,
      ),
  },
  // Student resident registration
  {
    path: 'register/resident',
    loadComponent: () =>
      import('./auth/register-resident/register-resident.component').then(
        (m) => m.RegisterResidentComponent,
      ),
  },
  // Parent/Guardian registration
  {
    path: 'register/parent',
    loadComponent: () =>
      import('./auth/register-parent/register-parent.component').then(
        (m) => m.RegisterParentComponent,
      ),
  },
  // User/Resident routes (no prefix)
  {
    path: '',
    loadComponent: () =>
      import('./layouts/user-layout/user-layout.component').then((m) => m.UserLayoutComponent),
    canActivate: [residentGuard, maintenanceGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./user/home/user-home.component').then((m) => m.UserHomeComponent),
      },
      {
        path: 'my-leave-request',
        loadComponent: () =>
          import('./user/create-leave-request/create-leave-request.component').then(
            (m) => m.CreateLeaveRequestComponent,
          ),
      },
      {
        path: 'my-requests',
        loadComponent: () =>
          import('./user/my-requests/my-requests.component').then((m) => m.MyRequestsComponent),
      },
      {
        path: 'leave-pass',
        loadComponent: () =>
          import('./user/leave-pass/leave-pass.component').then((m) => m.LeavePassComponent),
      },
      {
        path: 'leave-pass/:id',
        loadComponent: () =>
          import('./user/leave-pass/leave-pass.component').then((m) => m.LeavePassComponent),
      },
      {
        path: 'my-room',
        loadComponent: () =>
          import('./user/my-room/my-room.component').then((m) => m.MyRoomComponent),
      },
      {
        path: 'my-payments',
        loadComponent: () =>
          import('./user/my-payments/my-payments.component').then((m) => m.MyPaymentsComponent),
      },
      {
        path: 'announcements',
        loadComponent: () =>
          import('./user/announcements/user-announcements.component').then(
            (m) => m.UserAnnouncementsComponent,
          ),
      },
      {
        path: 'gatepass',
        loadComponent: () =>
          import('./user/gatepass/gatepass-list.component').then((m) => m.GatepassListComponent),
      },
      {
        path: 'gatepass/:id',
        loadComponent: () =>
          import('./user/gatepass/gatepass-pass.component').then((m) => m.GatepassPassComponent),
      },
      {
        path: 'my-tasks',
        loadComponent: () =>
          import('./user/tasks/my-tasks.component').then((m) => m.MyTasksComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./user/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  // Admin routes (/manage)
  {
    path: 'manage',
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    canActivate: [manageGuard, maintenanceGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'rooms',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/rooms/rooms.component').then((m) => m.RoomsComponent),
      },
      {
        path: 'residents',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/residents/residents.component').then((m) => m.ResidentsComponent),
      },
      {
        path: 'leave-requests',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/leave-requests/leave-requests.component').then(
            (m) => m.LeaveRequestsComponent,
          ),
      },
      {
        path: 'gatepass',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/gatepass/gatepass.component').then((m) => m.AdminGatepassComponent),
      },
      {
        path: 'parent-registrations',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/parent-registrations/parent-registrations.component').then(
            (m) => m.ParentRegistrationsComponent,
          ),
      },
      {
        path: 'agents',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/agents/agents.component').then((m) => m.AgentsComponent),
      },
      {
        path: 'maintenance',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/maintenance/maintenance.component').then((m) => m.MaintenanceComponent),
      },
      {
        path: 'payments',
        canActivate: [paymentsGuard],
        loadComponent: () =>
          import('./admin/payments/payments.component').then((m) => m.PaymentsComponent),
      },
      {
        path: 'inventory',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/inventory/inventory.component').then((m) => m.InventoryComponent),
      },
      {
        path: 'reports',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'announcements',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/announcements/announcements.component').then(
            (m) => m.AnnouncementsComponent,
          ),
      },
      {
        path: 'settings',
        canActivate: [settingsGuard],
        loadComponent: () =>
          import('./admin/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  // Security Guard routes (/security-guard)
  {
    path: 'security-guard',
    loadComponent: () =>
      import('./layouts/security-layout/security-layout.component').then(
        (m) => m.SecurityLayoutComponent,
      ),
    canActivate: [securityGuard, maintenanceGuard],
    children: [
      {
        path: '',
        redirectTo: 'check-in-out',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./security-guard/dashboard/security-dashboard.component').then(
            (m) => m.SecurityDashboardComponent,
          ),
      },
      {
        path: 'check-in-out',
        loadComponent: () =>
          import('./security-guard/check-in-out/check-in-out.component').then(
            (m) => m.CheckInOutComponent,
          ),
      },
      {
        path: 'visitor-log',
        loadComponent: () =>
          import('./security-guard/visitor-log/visitor-log.component').then(
            (m) => m.VisitorLogComponent,
          ),
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./security-guard/incidents/incidents.component').then(
            (m) => m.IncidentsComponent,
          ),
      },
      {
        path: 'emergency',
        loadComponent: () =>
          import('./security-guard/emergency/emergency.component').then(
            (m) => m.EmergencyComponent,
          ),
      },
    ],
  },
  // Parent routes (/parent)
  {
    path: 'parent',
    loadComponent: () =>
      import('./layouts/parent-layout/parent-layout.component').then(
        (m) => m.ParentLayoutComponent,
      ),
    canActivate: [parentGuard, maintenanceGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./parent/requests/parent-requests.component').then(
            (m) => m.ParentRequestsComponent,
          ),
      },
      {
        path: 'gatepass',
        redirectTo: '',
        pathMatch: 'full',
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./parent/history/parent-history.component').then((m) => m.ParentHistoryComponent),
      },
      {
        path: 'activity',
        loadComponent: () =>
          import('./parent/activity/parent-activity.component').then(
            (m) => m.ParentActivityComponent,
          ),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./parent/payments/parent-payments.component').then(
            (m) => m.ParentPaymentsComponent,
          ),
      },
    ],
  },
  // Wildcard route - redirect to login (auth guards will handle proper redirect)
  {
    path: '**',
    redirectTo: 'login',
  },
];
