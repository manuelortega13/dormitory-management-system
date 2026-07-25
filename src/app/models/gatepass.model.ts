export type GatepassStatus =
  | 'pending_parent'
  | 'pending_dean'
  | 'pending_vpsas'
  | 'approved'
  | 'active'
  | 'completed'
  | 'declined'
  | 'cancelled';

export type GatepassApprovalStatus = 'pending' | 'approved' | 'declined' | 'not_required';

export interface Gatepass {
  id: number;
  user_id: number;
  occupant_name?: string;
  first_name?: string;
  last_name?: string;
  gender?: 'male' | 'female' | null;
  student_resident_id?: string | null;
  email?: string | null;
  photo_url?: string | null;
  parent_id?: number | null;

  reason: string;
  destination: string;
  status: GatepassStatus;

  parent_status: GatepassApprovalStatus;
  parent_reviewed_at?: string | null;
  parent_notes?: string | null;

  dean_status: 'pending' | 'approved' | 'declined';
  dean_reviewed_at?: string | null;
  dean_notes?: string | null;

  vpsas_status: 'pending' | 'approved' | 'declined';
  vpsas_reviewed_at?: string | null;
  vpsas_notes?: string | null;

  qr_code?: string | null;
  qr_generated_at?: string | null;

  exit_time?: string | null;
  return_time?: string | null;
  deadline?: string | null;
  overdue_notified_at?: string | null;

  room_number?: string | null;
  floor?: number | null;

  created_at: string;
}

export interface CreateGatepassDto {
  reason: string;
  destination: string;
}

export interface GatepassExtension {
  id: number;
  gatepass_id: number;
  requested_by: number;
  reason: string;
  image: string;
  new_deadline?: string | null;
  review_status: 'pending_review' | 'task_assigned' | 'waived';
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  reviewer_name?: string | null;
  created_at: string;

  // Present on the dean pending-review list
  occupant_name?: string;
  student_resident_id?: string | null;
  gender?: string | null;
  gatepass_reason?: string;
  destination?: string;
  gatepass_status?: string;
}
