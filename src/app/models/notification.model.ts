export interface AppNotification {
  id: number;
  user_id: number;
  type:
    | 'leave_request_new'
    | 'leave_request_admin_approved'
    | 'leave_request_dean_approved'
    | 'leave_request_parent_approved'
    | 'leave_request_vpsas_approved'
    | 'leave_request_cancelled'
    | 'parent_approval_needed'
    | 'vpsas_approval_needed'
    | 'leave_request_approved'
    | 'leave_request_declined'
    | 'child_left_campus'
    | 'child_returned_campus'
    | 'registration'
    | 'announcement'
    | 'payment'
    | 'gatepass_new'
    | 'gatepass_parent_approved'
    | 'gatepass_dean_approved'
    | 'gatepass_approved'
    | 'gatepass_declined'
    | 'gatepass_exit'
    | 'gatepass_returned'
    | 'gatepass_overdue'
    | 'gatepass_extended'
    | 'gatepass_task_assigned'
    | 'gatepass_late_return'
    | 'gatepass_cancelled';
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
