/**
 * Row shapes the report views consume, plus the period helpers that slice them.
 *
 * The figures themselves come from `/api/reports` via ReportService — this file holds no
 * data of its own. Every series returned by the API is a full 12-month, zero-filled
 * window, so a quiet month renders as a real zero instead of vanishing from the axis.
 */

export type RangeKey = '3m' | '6m' | '12m' | 'ytd';

/** Mirrors `users.gender` / `users.dean_type` — the men's and women's wings. */
export type Gender = 'male' | 'female';

export const GENDERS: { key: Gender; label: string; short: string }[] = [
  { key: 'male', label: "Men's wing", short: 'M' },
  { key: 'female', label: "Women's wing", short: 'F' },
];

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '3m', label: 'Last 3 months' },
  { key: '6m', label: 'Last 6 months' },
  { key: '12m', label: 'Last 12 months' },
  { key: 'ytd', label: 'Year to date' },
];

export interface MonthMeta {
  key: string;
  label: string;
  longLabel: string;
}

export interface PeriodRow extends MonthMeta {
  capacity: number;
  occupied: number;
  occupancy: number;
  billed: number;
  collected: number;
  leaves: { completed: number; approved: number; pending: number; rejected: number };
  leaveTotal: number;
}

export interface DecisionRow extends MonthMeta {
  leaveApproved: number;
  leaveRejected: number;
  gatepassApproved: number;
  gatepassRejected: number;
  approved: number;
  rejected: number;
  total: number;
  /** Mean hours from filing to decision. */
  turnaround: number;
}

export interface PaymentRow extends MonthMeta {
  billed: number;
  verified: number;
  pending: number;
  rejected: number;
  /** Everything submitted, whatever its verification state. */
  submitted: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  methods: { gcash: number; maya: number; cash: number; other: number };
  collectRate: number;
}

export interface FloorRow {
  floor: number;
  capacity: number;
  occupied: number;
  occupancy: number;
}

export interface DecisionLogEntry {
  reference: string;
  occupant: string;
  gender: Gender;
  room: string;
  type: string;
  reason: string;
  filed: string;
  decided: string;
  outcome: 'Approved' | 'Rejected';
  note: string;
}

export interface TransactionLogEntry {
  reference: string;
  occupant: string;
  room: string;
  amount: number;
  method: string;
  submitted: string;
  status: 'verified' | 'pending' | 'rejected';
  handledBy: string;
}

/** Index window a range selects out of the 12 months the API returns. */
export function resolveWindow(
  range: RangeKey,
  months: MonthMeta[],
): { start: number; end: number } {
  const total = months.length;
  switch (range) {
    case '3m':
      return { start: Math.max(0, total - 3), end: total };
    case '6m':
      return { start: Math.max(0, total - 6), end: total };
    case 'ytd': {
      // Everything in the same calendar year as the newest month returned.
      const year = months[total - 1]?.key.slice(0, 4);
      const first = months.findIndex((m) => m.key.startsWith(year ?? ''));
      return { start: first < 0 ? 0 : first, end: total };
    }
    default:
      return { start: 0, end: total };
  }
}

export function periodLabel(rows: { longLabel: string }[]): string {
  if (!rows.length) return '';
  return rows.length === 1
    ? rows[0].longLabel
    : `${rows[0].longLabel} – ${rows[rows.length - 1].longLabel}`;
}
