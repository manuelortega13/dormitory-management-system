import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type RequestStatus = 'pending' | 'approved' | 'declined';

interface LeaveRequest {
  id: number;
  occupant: {
    id: number;
    name: string;
    email: string;
    phone: string;
    avatar: string;
    roomNumber: string;
    floor: number;
  };
  requestDate: Date;
  expectedLeaveDate: Date;
  reason: string;
  status: RequestStatus;
  notes?: string;
  processedDate?: Date;
  processedBy?: string;
}

@Component({
  selector: 'app-leave-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leave-requests.component.html',
  styleUrl: './leave-requests.component.scss'
})
export class LeaveRequestsComponent {
  protected readonly filterStatus = signal<RequestStatus | 'all'>('all');
  protected readonly searchQuery = signal('');

  protected readonly leaveRequests = signal<LeaveRequest[]>([
    {
      id: 1,
      occupant: {
        id: 1,
        name: 'John Doe',
        email: 'john.doe@email.com',
        phone: '+1 234 567 8901',
        avatar: 'JD',
        roomNumber: '101',
        floor: 1
      },
      requestDate: new Date('2026-02-18'),
      expectedLeaveDate: new Date('2026-03-15'),
      reason: 'Completing my studies and graduating this semester. Need to move back home.',
      status: 'pending'
    },
    {
      id: 2,
      occupant: {
        id: 2,
        name: 'Sarah Johnson',
        email: 'sarah.j@email.com',
        phone: '+1 234 567 8902',
        avatar: 'SJ',
        roomNumber: '102',
        floor: 1
      },
      requestDate: new Date('2026-02-17'),
      expectedLeaveDate: new Date('2026-02-28'),
      reason: 'Family emergency - need to return home urgently.',
      status: 'pending'
    },
    {
      id: 3,
      occupant: {
        id: 3,
        name: 'Mike Smith',
        email: 'mike.smith@email.com',
        phone: '+1 234 567 8903',
        avatar: 'MS',
        roomNumber: '201',
        floor: 2
      },
      requestDate: new Date('2026-02-15'),
      expectedLeaveDate: new Date('2026-03-01'),
      reason: 'Transferring to another university for the next semester.',
      status: 'pending'
    },
    {
      id: 4,
      occupant: {
        id: 4,
        name: 'Emily Brown',
        email: 'emily.b@email.com',
        phone: '+1 234 567 8904',
        avatar: 'EB',
        roomNumber: '205',
        floor: 2
      },
      requestDate: new Date('2026-02-10'),
      expectedLeaveDate: new Date('2026-02-20'),
      reason: 'Got an off-campus apartment with roommates.',
      status: 'approved',
      processedDate: new Date('2026-02-12'),
      processedBy: 'Admin User',
      notes: 'Approved. Room will be available for new occupant after Feb 20.'
    },
    {
      id: 5,
      occupant: {
        id: 5,
        name: 'David Wilson',
        email: 'david.w@email.com',
        phone: '+1 234 567 8905',
        avatar: 'DW',
        roomNumber: '302',
        floor: 3
      },
      requestDate: new Date('2026-02-08'),
      expectedLeaveDate: new Date('2026-02-15'),
      reason: 'Personal reasons.',
      status: 'declined',
      processedDate: new Date('2026-02-09'),
      processedBy: 'Admin User',
      notes: 'Request too close to leave date. Please submit at least 2 weeks in advance.'
    },
    {
      id: 6,
      occupant: {
        id: 6,
        name: 'Jessica Martinez',
        email: 'jessica.m@email.com',
        phone: '+1 234 567 8906',
        avatar: 'JM',
        roomNumber: '108',
        floor: 1
      },
      requestDate: new Date('2026-02-19'),
      expectedLeaveDate: new Date('2026-04-01'),
      reason: 'Internship opportunity in another city starting April.',
      status: 'pending'
    },
    {
      id: 7,
      occupant: {
        id: 7,
        name: 'Chris Taylor',
        email: 'chris.t@email.com',
        phone: '+1 234 567 8907',
        avatar: 'CT',
        roomNumber: '210',
        floor: 2
      },
      requestDate: new Date('2026-02-16'),
      expectedLeaveDate: new Date('2026-03-20'),
      reason: 'Study abroad program in Europe.',
      status: 'pending'
    }
  ]);

  protected readonly stats = computed(() => {
    const all = this.leaveRequests();
    return {
      total: all.length,
      pending: all.filter(r => r.status === 'pending').length,
      approved: all.filter(r => r.status === 'approved').length,
      declined: all.filter(r => r.status === 'declined').length
    };
  });

  protected readonly filteredRequests = computed(() => {
    let filtered = this.leaveRequests();

    if (this.filterStatus() !== 'all') {
      filtered = filtered.filter(r => r.status === this.filterStatus());
    }

    if (this.searchQuery()) {
      const query = this.searchQuery().toLowerCase();
      filtered = filtered.filter(r =>
        r.occupant.name.toLowerCase().includes(query) ||
        r.occupant.roomNumber.toLowerCase().includes(query) ||
        r.occupant.email.toLowerCase().includes(query)
      );
    }

    // Sort by request date, most recent first, pending items first
    return filtered.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
    });
  });

  protected selectedRequest = signal<LeaveRequest | null>(null);
  protected actionNotes = signal('');

  updateSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  updateFilter(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.filterStatus.set(select.value as RequestStatus | 'all');
  }

  openRequestDetails(request: LeaveRequest) {
    this.selectedRequest.set(request);
    this.actionNotes.set('');
  }

  closeModal() {
    this.selectedRequest.set(null);
    this.actionNotes.set('');
  }

  updateNotes(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.actionNotes.set(textarea.value);
  }

  approveRequest(request: LeaveRequest) {
    this.leaveRequests.update(requests =>
      requests.map(r => {
        if (r.id === request.id) {
          return {
            ...r,
            status: 'approved' as RequestStatus,
            processedDate: new Date(),
            processedBy: 'Admin User',
            notes: this.actionNotes() || 'Request approved.'
          };
        }
        return r;
      })
    );
    this.closeModal();
  }

  declineRequest(request: LeaveRequest) {
    this.leaveRequests.update(requests =>
      requests.map(r => {
        if (r.id === request.id) {
          return {
            ...r,
            status: 'declined' as RequestStatus,
            processedDate: new Date(),
            processedBy: 'Admin User',
            notes: this.actionNotes() || 'Request declined.'
          };
        }
        return r;
      })
    );
    this.closeModal();
  }

  getAvatarColor(name: string): string {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  getDaysUntilLeave(date: Date): number {
    const today = new Date();
    const leaveDate = new Date(date);
    const diffTime = leaveDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
