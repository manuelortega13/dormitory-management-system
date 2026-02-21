import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, User } from '../../auth/auth.service';
import { firstValueFrom } from 'rxjs';

interface RoomInfo {
  roomNumber: string;
  floor: number;
  type: string;
  roommates: string[];
}

@Component({
  selector: 'app-user-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="user-home">
      <section class="welcome-section">
        <div class="welcome-content">
          <h1>Welcome back, {{ userName() }}!</h1>
          <p>Here's an overview of your dormitory status</p>
        </div>
        <a routerLink="/my-leave-request" class="quick-action-btn">
          <span class="icon">📤</span>
          Request to Leave
        </a>
      </section>

      <div class="home-grid">
        <!-- Room Info Card -->
        <section class="info-card room-card">
          <div class="card-header">
            <h2>🛏️ My Room</h2>
            <a routerLink="/my-room" class="view-link">View Details →</a>
          </div>
          <div class="card-body">
            <div class="room-number">Room {{ roomInfo().roomNumber }}</div>
            <div class="room-details">
              <span>Floor {{ roomInfo().floor }}</span>
              <span>•</span>
              <span>{{ roomInfo().type }}</span>
            </div>
            <div class="roommates">
              <span class="label">Roommates:</span>
              @if (roomInfo().roommates.length > 0) {
                @for (mate of roomInfo().roommates; track mate) {
                  <span class="roommate-tag">{{ mate }}</span>
                }
              } @else {
                <span class="no-roommates">No roommates</span>
              }
            </div>
          </div>
        </section>

        <!-- Payment Status Card -->
        <section class="info-card payment-card">
          <div class="card-header">
            <h2>💰 Payment Status</h2>
            <a routerLink="/my-payments" class="view-link">View All →</a>
          </div>
          <div class="card-body">
            <div class="payment-status" [class]="paymentInfo().status">
              @if (paymentInfo().status === 'paid') {
                ✅ All Paid
              } @else {
                ⚠️ Payment Due
              }
            </div>
            <div class="payment-details">
              <div class="detail-row">
                <span>Monthly Rent:</span>
                <span class="amount">\${{ paymentInfo().monthlyRent }}</span>
              </div>
              <div class="detail-row">
                <span>Next Due:</span>
                <span>{{ paymentInfo().nextDue | date:'mediumDate' }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Announcements Card -->
        <section class="info-card announcements-card">
          <div class="card-header">
            <h2>📢 Announcements</h2>
            <a routerLink="/announcements" class="view-link">View All →</a>
          </div>
          <div class="card-body">
            <ul class="announcement-list">
              @for (announcement of announcements(); track announcement.id) {
                <li class="announcement-item">
                  <span class="announcement-date">{{ announcement.date | date:'shortDate' }}</span>
                  <span class="announcement-title">{{ announcement.title }}</span>
                </li>
              }
            </ul>
          </div>
        </section>

        <!-- Quick Links Card -->
        <section class="info-card quick-links-card">
          <div class="card-header">
            <h2>🔗 Quick Links</h2>
          </div>
          <div class="card-body">
            <div class="links-grid">
              <a routerLink="/my-leave-request" class="quick-link">
                <span class="link-icon">📤</span>
                <span>Request Leave</span>
              </a>
              <a routerLink="/maintenance-request" class="quick-link">
                <span class="link-icon">🔧</span>
                <span>Maintenance</span>
              </a>
              <a routerLink="/my-payments" class="quick-link">
                <span class="link-icon">💳</span>
                <span>Pay Dues</span>
              </a>
              <a routerLink="/contact" class="quick-link">
                <span class="link-icon">📞</span>
                <span>Contact Admin</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  `,
  styles: [`
    .user-home {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .welcome-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding: 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      color: #fff;

      .welcome-content {
        h1 {
          margin: 0 0 0.5rem;
          font-size: 1.75rem;
        }

        p {
          margin: 0;
          opacity: 0.9;
        }
      }

      .quick-action-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.875rem 1.5rem;
        background: #fff;
        color: #667eea;
        border-radius: 10px;
        text-decoration: none;
        font-weight: 600;
        transition: all 0.2s;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .icon {
          font-size: 1.25rem;
        }
      }
    }

    .home-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .info-card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #eee;

      h2 {
        margin: 0;
        font-size: 1rem;
        color: #1a1a2e;
      }

      .view-link {
        font-size: 0.85rem;
        color: #4a90d9;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .card-body {
      padding: 1.25rem;
    }

    // Room Card
    .room-number {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 0.5rem;
    }

    .room-details {
      display: flex;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: #6c757d;
      margin-bottom: 1rem;
    }

    .roommates {
      .label {
        display: block;
        font-size: 0.8rem;
        color: #6c757d;
        margin-bottom: 0.5rem;
      }

      .roommate-tag {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        background: #e9ecef;
        border-radius: 20px;
        font-size: 0.85rem;
        margin-right: 0.5rem;
      }

      .no-roommates {
        font-size: 0.85rem;
        color: #adb5bd;
      }
    }

    // Payment Card
    .payment-status {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;

      &.paid {
        color: #28a745;
      }

      &.due {
        color: #dc3545;
      }
    }

    .payment-details {
      .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        font-size: 0.9rem;
        border-bottom: 1px solid #f1f3f4;

        &:last-child {
          border-bottom: none;
        }

        .amount {
          font-weight: 600;
          color: #1a1a2e;
        }
      }
    }

    // Announcements Card
    .announcement-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .announcement-item {
      display: flex;
      gap: 1rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f1f3f4;

      &:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .announcement-date {
        font-size: 0.8rem;
        color: #6c757d;
        white-space: nowrap;
      }

      .announcement-title {
        font-size: 0.9rem;
        color: #1a1a2e;
      }
    }

    // Quick Links
    .links-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }

    .quick-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 10px;
      text-decoration: none;
      transition: all 0.2s;

      &:hover {
        background: #e9ecef;
        transform: translateY(-2px);
      }

      .link-icon {
        font-size: 1.5rem;
      }

      span:last-child {
        font-size: 0.85rem;
        color: #495057;
        font-weight: 500;
      }
    }
  `]
})
export class UserHomeComponent implements OnInit {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/users';

  protected readonly userName = signal('Resident');
  protected readonly currentUser = signal<User | null>(null);

  protected readonly roomInfo = signal<RoomInfo>({
    roomNumber: '-',
    floor: 0,
    type: '-',
    roommates: []
  });

  protected readonly paymentInfo = signal({
    status: 'paid' as 'paid' | 'due',
    monthlyRent: 850,
    nextDue: new Date('2026-03-01')
  });

  protected readonly announcements = signal([
    { id: 1, date: new Date('2026-02-18'), title: 'Campus-wide fire drill scheduled for Feb 25th' },
    { id: 2, date: new Date('2026-02-15'), title: 'Spring semester payment deadline reminder' },
    { id: 3, date: new Date('2026-02-10'), title: 'New laundry room hours posted' }
  ]);

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUser.set(user);
      this.userName.set(user.firstName);
      this.loadRoomInfo(user.id);
    }
  }

  private async loadRoomInfo(userId: number) {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/${userId}/room`)
      );
      
      if (response) {
        this.roomInfo.set({
          roomNumber: response.room_number || '-',
          floor: response.floor || 0,
          type: response.room_type || '-',
          roommates: [] // Could fetch roommates separately if needed
        });
      }
    } catch (error) {
      // No room assigned or error fetching
      console.log('No room info available');
    }
  }
}
