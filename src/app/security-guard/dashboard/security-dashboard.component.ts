import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CheckLog, SecurityService } from '../data/security.service';
import { LeaveRequest } from '../../models/leave-request.model';

/**
 * Guard dashboard: the shift at a glance, read from the same gate scans the report page
 * lists. Every figure here comes from `/api/check-logs/today` and the active leave list —
 * nothing on this page is illustrative.
 */
@Component({
  selector: 'app-security-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './security-dashboard.component.html',
  styleUrl: './security-dashboard.component.scss',
})
export class SecurityDashboardComponent {
  private readonly security = inject(SecurityService);

  protected readonly currentDate = new Date();

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly todayLogs = signal<CheckLog[]>([]);
  protected readonly todayStats = signal({ checkIns: 0, checkOuts: 0, total: 0 });
  protected readonly activeLeaves = signal<LeaveRequest[]>([]);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      // Both calls feed the same picture of the shift, so a failure in either is a failure
      // of the page rather than a half-filled dashboard.
      const [today, active] = await Promise.all([
        this.security.getTodayLogs(),
        this.security.getActiveLeaves(),
      ]);
      this.todayStats.set(today.stats);
      this.todayLogs.set(today.logs);
      this.activeLeaves.set(active);
      this.state.set('ready');
    } catch (error) {
      console.error('Failed to load the guard dashboard', error);
      this.state.set('error');
    }
  }

  protected readonly stats = computed(() => {
    const today = this.todayStats();
    return [
      // A check-out is a departure through the gate; a check-in is a return.
      { key: 'exits', icon: '🚪', label: "Today's exits", value: today.checkOuts },
      { key: 'entries', icon: '🏠', label: "Today's entries", value: today.checkIns },
      { key: 'scans', icon: '📋', label: 'Scans today', value: today.total },
      { key: 'out', icon: '🕒', label: 'Currently out', value: this.activeLeaves().length },
    ];
  });

  /** The last few movements, newest first — the full history lives on the report page. */
  protected readonly recentLogs = computed(() => this.todayLogs().slice(0, 8));

  protected directionOf(log: CheckLog): 'Exit' | 'Entry' {
    return log.type === 'check-out' ? 'Exit' : 'Entry';
  }

  protected nameOf(log: CheckLog): string {
    return `${log.first_name ?? ''} ${log.last_name ?? ''}`.trim() || 'Unknown occupant';
  }

  protected leaveName(leave: LeaveRequest): string {
    return (
      leave.user_name ?? `${leave.first_name ?? ''} ${leave.last_name ?? ''}`.trim() ?? 'Occupant'
    );
  }
}
