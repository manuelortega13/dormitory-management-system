export interface AppNotification {
  id: number;
  user_id: number;
  type: 'leave_request_new' | 'leave_request_admin_approved' | 'leave_request_cancelled' | 'parent_approval_needed' | 'leave_request_approved' | 'leave_request_declined' | 'child_left_campus' | 'child_returned_campus';
  title: string;
  message: string;
  reference_id?: number;
  reference_type?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationResponse {
  data: AppNotification[];
}

export interface UnreadCountResponse {
  count: number;
}
