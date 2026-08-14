import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** What a scan was recorded against. 'all' is the unfiltered view, not a source. */
export type ScanSource = 'all' | 'leave' | 'gatepass' | 'manual';

/** One gate movement: a resident leaving on a request, or returning from one. */
export interface CheckLogEntry {
  reference: string;
  occupant: string;
  room: string;
  source: 'Leave request' | 'Gatepass' | 'Manual';
  direction: 'Entry' | 'Exit';
  leaveType: string;
  destination: string;
  purpose: string;
  method: string;
  recordedBy: string;
  /** Formatted for display — "14 Aug 2026, 9:12 PM". */
  at: string;
  notes: string;
}

export interface CheckLogReport {
  logs: CheckLogEntry[];
  /**
   * The screen list is capped while the tallies cover the whole window, so the view states
   * both numbers. Without them a truncated list reads as a complete one.
   */
  logLimit: number;
  logTotal: number;
  stats: { entries: number; exits: number };
}

/** An explicit day range, inclusive at both ends. */
export interface DayRange {
  from: string;
  to: string;
}

const STAMP_FORMAT = new Intl.DateTimeFormat('en-PH', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** ISO timestamp -> "14 Aug 2026, 9:12 PM". Falls back to the raw value if it will not parse. */
function formatStamp(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : STAMP_FORMAT.format(date);
}

@Injectable({ providedIn: 'root' })
export class GuardReportService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/reports/check-logs`;

  /**
   * @param full lifts the screen cap for an export. The screen asks for a capped list; the
   * CSV and the printed sheet ask for every scan in the window.
   */
  async getCheckLogs(range: DayRange, source: ScanSource, full = false): Promise<CheckLogReport> {
    let params = new HttpParams().set('from', range.from).set('to', range.to);
    if (source !== 'all') params = params.set('type', source);
    if (full) params = params.set('full', '1');

    const res = await firstValueFrom(
      this.http.get<{ success: boolean; data: CheckLogReport }>(this.url, { params }),
    );
    return {
      ...res.data,
      logs: res.data.logs.map((entry) => ({ ...entry, at: formatStamp(entry.at) })),
    };
  }
}
