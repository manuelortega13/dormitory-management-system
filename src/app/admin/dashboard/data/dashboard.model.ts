export interface DashboardSummary {
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  maintenanceRooms: number;
  totalResidents: number;
  activeResidents: number;
  pendingRequests: number;
}

export interface RecentActivity {
  id: number;
  type: 'check-in' | 'check-out' | 'leave-approved' | 'leave-declined' | 'leave-request';
  description: string;
  timestamp: Date;
  icon: string;
}

export interface CheckLog {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  room_number: string | null;
  type: 'check-in' | 'check-out';
  created_at: string;
}

export interface LeaveRequestActivity {
  id: number;
  first_name: string;
  last_name: string;
  leave_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}
