export type ResidentStatus = 'active' | 'inactive' | 'pending' | 'suspended';
export type Gender = 'male' | 'female' | 'other';

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface Resident {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  photo_url: string | null;
  status: ResidentStatus;
  created_at: string;
  room_number: string | null;
  floor: number | null;
  room_type: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
}

export interface ResidentFilters {
  status?: ResidentStatus;
  search?: string;
  floor?: number;
}
