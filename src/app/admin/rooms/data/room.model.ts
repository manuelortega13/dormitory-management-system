export type RoomStatus = 'occupied' | 'available' | 'maintenance' | 'reserved';
export type RoomType = 'single' | 'double' | 'triple' | 'quad' | 'suite';

export interface Occupant {
  id: number;
  name: string;
  email: string;
  phone: string;
  checkInDate: Date;
  expectedCheckOut: Date | null;
  photo?: string;
  assignmentId?: number;
  /** Occupant of the other wing: the bed is counted, the person is not named. */
  restricted?: boolean;
}

export interface Room {
  id: number;
  roomNumber: string;
  floor: number;
  type: RoomType;
  capacity: number;
  status: RoomStatus;
  monthlyRent: number;
  amenities: string[];
  occupants: Occupant[];
}

export interface RoomResponse {
  id: number;
  room_number: string;
  floor: number;
  capacity: number;
  status: RoomStatus;
  room_type: RoomType;
  price_per_month: number;
  amenities: string;
}

export interface OccupantResponse {
  id: number;
  // Absent on restricted rows - the API withholds the identity, not the assignment.
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  photo_url?: string | null;
  assignment_id?: number;
  start_date: string;
  end_date: string | null;
  restricted?: boolean;
}
