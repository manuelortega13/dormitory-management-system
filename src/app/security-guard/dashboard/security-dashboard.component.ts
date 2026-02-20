import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-security-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './security-dashboard.component.html',
  styleUrl: './security-dashboard.component.scss'
})
export class SecurityDashboardComponent {
  protected readonly currentDate = new Date();
  protected readonly currentShift = signal('Night Shift (10:00 PM - 6:00 AM)');

  protected readonly stats = signal({
    currentVisitors: 5,
    todayCheckIns: 23,
    todayCheckOuts: 18,
    openIncidents: 2
  });

  protected readonly recentVisitors = signal([
    { id: 1, name: 'Sarah Wilson', visiting: 'John Doe', room: '101', timeIn: new Date('2026-02-20T14:30:00'), status: 'inside' },
    { id: 2, name: 'Mike Brown', visiting: 'Emily Chen', room: '205', timeIn: new Date('2026-02-20T13:45:00'), status: 'inside' },
    { id: 3, name: 'Lisa Johnson', visiting: 'David Kim', room: '302', timeIn: new Date('2026-02-20T12:15:00'), status: 'left' },
    { id: 4, name: 'Tom Davis', visiting: 'Sarah Smith', room: '108', timeIn: new Date('2026-02-20T11:00:00'), status: 'left' }
  ]);

  protected readonly recentIncidents = signal([
    { id: 1, title: 'Noise complaint - Floor 2', time: new Date('2026-02-20T22:30:00'), severity: 'medium', status: 'open' },
    { id: 2, title: 'Lost key card report', time: new Date('2026-02-20T18:15:00'), severity: 'low', status: 'open' }
  ]);
}
