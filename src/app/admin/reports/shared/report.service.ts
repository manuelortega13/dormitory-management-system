import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CustomRange,
  DecisionLogEntry,
  DecisionRow,
  FloorRow,
  Gender,
  MonthMeta,
  PaymentRow,
  PeriodRow,
  TransactionLogEntry,
} from './report-data';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface ApiDecisionWing {
  leaveApproved: number;
  leaveRejected: number;
  gatepassApproved: number;
  gatepassRejected: number;
  turnaround: number;
}

interface ApiDecisions {
  months: (MonthMeta & { wings: Record<string, ApiDecisionWing> })[];
  wings: Gender[];
  log: (Omit<DecisionLogEntry, 'filed' | 'decided'> & { filed: string; decided: string })[];
  logLimit: number;
  logTotal: number;
  level: 'dean' | 'vpsas';
}

interface ApiPayments {
  months: (MonthMeta & Omit<PaymentRow, keyof MonthMeta | 'submitted' | 'collectRate'>)[];
  log: (Omit<TransactionLogEntry, 'submitted'> & { submitted: string })[];
  logLimit: number;
  logTotal: number;
}

interface ApiOverview {
  months: PeriodRow[];
  floors: FloorRow[];
}

/** Everything the decisions views need, already shaped for the charts. */
export interface DecisionReport {
  /** The wings the signed-in officer is allowed to see; the API decides, not the client. */
  wings: Gender[];
  months: MonthMeta[];
  /** Per-wing monthly series, keyed by wing. */
  byWing: Record<string, DecisionRow[]>;
  /** The visible wings summed — the report's own totals, never the whole dorm's. */
  combined: DecisionRow[];
  log: DecisionLogEntry[];
  /**
   * The log is a capped sample while the charts aggregate the whole window, so the view
   * states both numbers. Without them a truncated list reads as a complete one.
   */
  logLimit: number;
  logTotal: number;
}

export interface PaymentReport {
  months: PaymentRow[];
  log: TransactionLogEntry[];
  logLimit: number;
  logTotal: number;
}

export interface OverviewReport {
  months: PeriodRow[];
  floors: FloorRow[];
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** ISO timestamp -> "02 Aug 2026". Falls back to the raw value if it will not parse. */
function formatDay(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

function decisionRow(meta: MonthMeta, wing: ApiDecisionWing): DecisionRow {
  const approved = wing.leaveApproved + wing.gatepassApproved;
  const rejected = wing.leaveRejected + wing.gatepassRejected;
  return {
    ...meta,
    leaveApproved: wing.leaveApproved,
    leaveRejected: wing.leaveRejected,
    gatepassApproved: wing.gatepassApproved,
    gatepassRejected: wing.gatepassRejected,
    approved,
    rejected,
    total: approved + rejected,
    turnaround: wing.turnaround,
  };
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reports`;

  /**
   * @param range optional explicit day range. When given, the API returns exactly the
   * months that range touches, bounded to those days — so a range ending mid-month yields
   * a genuinely partial bucket rather than the whole month.
   */
  async getDecisions(range?: CustomRange | null): Promise<DecisionReport> {
    let params = new HttpParams();
    if (range?.from && range?.to) {
      params = params.set('from', range.from).set('to', range.to);
    }
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ApiDecisions>>(`${this.base}/decisions`, { params }),
    );
    const data = res.data;
    const months: MonthMeta[] = data.months.map((m) => ({
      key: m.key,
      label: m.label,
      longLabel: m.longLabel,
    }));

    const byWing: Record<string, DecisionRow[]> = {};
    for (const wing of data.wings) {
      byWing[wing] = data.months.map((m, i) => decisionRow(months[i], m.wings[wing]));
    }

    // The combined series sums only the wings in `byWing`, so a scoped dean's totals stay
    // that wing's totals rather than silently becoming the dorm's.
    const combined = months.map((meta, i) => {
      const rows = data.wings.map((w) => byWing[w][i]);
      const sum = (pick: (r: DecisionRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
      const approved = sum((r) => r.approved);
      const rejected = sum((r) => r.rejected);
      const decided = rows.filter((r) => r.total > 0);
      return {
        ...meta,
        leaveApproved: sum((r) => r.leaveApproved),
        leaveRejected: sum((r) => r.leaveRejected),
        gatepassApproved: sum((r) => r.gatepassApproved),
        gatepassRejected: sum((r) => r.gatepassRejected),
        approved,
        rejected,
        total: approved + rejected,
        // Averaged over the wings that actually decided something, so an idle wing does
        // not drag the mean towards zero.
        turnaround: decided.length
          ? decided.reduce((s, r) => s + r.turnaround, 0) / decided.length
          : 0,
      };
    });

    return {
      wings: data.wings,
      months,
      byWing,
      combined,
      log: data.log.map((entry) => ({
        ...entry,
        filed: formatDay(entry.filed),
        decided: formatDay(entry.decided),
      })),
      logLimit: data.logLimit,
      logTotal: data.logTotal,
    };
  }

  /** Every decision in the window — the export needs the full set, not the capped log. */
  async getDecisionLog(range: CustomRange): Promise<DecisionLogEntry[]> {
    const params = new HttpParams().set('from', range.from).set('to', range.to);
    const res = await firstValueFrom(
      this.http.get<
        ApiEnvelope<{
          decisions: (Omit<DecisionLogEntry, 'filed' | 'decided'> & {
            filed: string;
            decided: string;
          })[];
        }>
      >(`${this.base}/decisions/log`, { params }),
    );
    return res.data.decisions.map((entry) => ({
      ...entry,
      filed: formatDay(entry.filed),
      decided: formatDay(entry.decided),
    }));
  }

  /** @param range optional explicit day range; the API bounds the buckets and log to it. */
  async getPayments(range?: CustomRange | null): Promise<PaymentReport> {
    let params = new HttpParams();
    if (range?.from && range?.to) {
      params = params.set('from', range.from).set('to', range.to);
    }
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ApiPayments>>(`${this.base}/payments`, { params }),
    );

    return {
      months: res.data.months.map((m) => {
        const submitted = m.verified + m.pending + m.rejected;
        return {
          ...m,
          submitted,
          collectRate: m.billed ? (m.verified / m.billed) * 100 : 0,
        };
      }),
      log: res.data.log.map((entry) => ({ ...entry, submitted: formatDay(entry.submitted) })),
      logLimit: res.data.logLimit,
      logTotal: res.data.logTotal,
    };
  }

  /** Every transaction in the window — the export needs the full set, not the capped log. */
  async getTransactions(range: CustomRange): Promise<TransactionLogEntry[]> {
    const params = new HttpParams().set('from', range.from).set('to', range.to);
    const res = await firstValueFrom(
      this.http.get<
        ApiEnvelope<{
          transactions: (Omit<TransactionLogEntry, 'submitted'> & { submitted: string })[];
        }>
      >(`${this.base}/payments/transactions`, { params }),
    );
    return res.data.transactions.map((t) => ({ ...t, submitted: formatDay(t.submitted) }));
  }

  async getOverview(): Promise<OverviewReport> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ApiOverview>>(`${this.base}/overview`),
    );
    return res.data;
  }
}
