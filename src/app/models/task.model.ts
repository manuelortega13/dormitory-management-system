export interface Task {
  id: number;
  user_id: number;
  assigned_by?: number | null;
  gatepass_id?: number | null;
  extension_id?: number | null;
  title: string;
  description?: string | null;
  due_date?: string | null;
  status: 'pending' | 'completed';
  completed_at?: string | null;
  completion_note?: string | null;
  completion_image?: string | null;
  occupant_name?: string;
  student_resident_id?: string | null;
  assigned_by_name?: string | null;
  created_at: string;
}
