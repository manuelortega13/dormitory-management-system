export type ResidentStatus = 'active' | 'inactive' | 'pending' | 'suspended';
export type Gender = 'male' | 'female';

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
  student_resident_id: string | null;
  gender: Gender | null;
  address: string | null;
  course: string | null;
  year_level: number | null;
  room_number: string | null;
  floor: number | null;
  room_type: string | null;
  start_date: string | null;
  end_date: string | null;
  parent_id: number | null;
  parent_first_name: string | null;
  parent_last_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
}

export interface ResidentFilters {
  status?: ResidentStatus;
  search?: string;
  floor?: number;
}

export interface CreateResidentDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  parentId?: number | null;
  gender?: Gender | null;
  address?: string | null;
  course?: string | null;
  yearLevel?: number | null;
}

export interface UpdateResidentDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  password?: string;
  parentId?: number | null;
  gender?: Gender | null;
  address?: string | null;
  course?: string | null;
  yearLevel?: number | null;
}

export interface Parent {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
}
