import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap } from 'rxjs';
import { Room, RoomStatus, RoomType, Occupant, RoomResponse, OccupantResponse } from './room.model';

export type { Room, RoomStatus, RoomType, Occupant } from './room.model';

@Injectable({
  providedIn: 'root'
})
export class RoomsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/rooms';

  getAll(filters?: { status?: RoomStatus; floor?: number; roomType?: RoomType }): Observable<Room[]> {
    let url = this.apiUrl;
    const params: string[] = [];

    if (filters?.status) {
      params.push(`status=${filters.status}`);
    }
    if (filters?.floor) {
      params.push(`floor=${filters.floor}`);
    }
    if (filters?.roomType) {
      params.push(`roomType=${filters.roomType}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.http.get<RoomResponse[]>(url).pipe(
      map(rooms => rooms.map(room => this.mapRoom(room)))
    );
  }

  getAllWithOccupants(filters?: { status?: RoomStatus; floor?: number; roomType?: RoomType }): Observable<Room[]> {
    return this.getAll(filters).pipe(
      switchMap(rooms => {
        if (rooms.length === 0) {
          return [[]];
        }

        const occupantRequests = rooms.map(room =>
          this.getOccupants(room.id).pipe(
            map(occupants => ({ ...room, occupants }))
          )
        );

        return forkJoin(occupantRequests);
      })
    );
  }

  getById(id: number): Observable<Room> {
    return this.http.get<RoomResponse>(`${this.apiUrl}/${id}`).pipe(
      map(room => this.mapRoom(room))
    );
  }

  getOccupants(roomId: number): Observable<Occupant[]> {
    return this.http.get<OccupantResponse[]>(`${this.apiUrl}/${roomId}/occupants`).pipe(
      map(occupants => occupants.map(o => this.mapOccupant(o)))
    );
  }

  create(room: {
    roomNumber: string;
    floor: number;
    capacity: number;
    roomType: RoomType;
    pricePerMonth: number;
    amenities: string[];
  }): Observable<{ message: string; id: number }> {
    return this.http.post<{ message: string; id: number }>(this.apiUrl, room);
  }

  update(id: number, room: {
    roomNumber: string;
    floor: number;
    capacity: number;
    status: RoomStatus;
    roomType: RoomType;
    pricePerMonth: number;
    amenities: string[];
  }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}`, room);
  }

  updateStatus(id: number, status: RoomStatus): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/${id}/status`, { status });
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  assignResident(roomId: number, data: {
    userId: number;
    startDate: string;
    endDate?: string;
  }): Observable<{ message: string; id: number }> {
    return this.http.post<{ message: string; id: number }>(`${this.apiUrl}/${roomId}/assign`, data);
  }

  getAvailable(): Observable<Room[]> {
    return this.http.get<RoomResponse[]>(`${this.apiUrl}/available`).pipe(
      map(rooms => rooms.map(room => this.mapRoom(room)))
    );
  }

  unassignResident(roomId: number, userId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${roomId}/occupants/${userId}`);
  }

  private mapRoom(room: RoomResponse): Room {
    let amenities: string[] = [];
    try {
      amenities = room.amenities ? JSON.parse(room.amenities) : [];
    } catch {
      amenities = [];
    }

    return {
      id: room.id,
      roomNumber: room.room_number,
      floor: room.floor,
      type: room.room_type,
      capacity: room.capacity,
      status: room.status,
      monthlyRent: room.price_per_month,
      amenities,
      occupants: []
    };
  }

  private mapOccupant(o: OccupantResponse): Occupant {
    return {
      id: o.id,
      name: `${o.first_name} ${o.last_name}`,
      email: o.email,
      phone: o.phone || '',
      checkInDate: new Date(o.start_date),
      expectedCheckOut: o.end_date ? new Date(o.end_date) : null,
      photo: o.photo_url || undefined,
      assignmentId: o.assignment_id
    };
  }
}
