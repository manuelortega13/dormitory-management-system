import { Component, computed, inject, input, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { PALETTE, ReportBase, Tooltip } from '../shared/report-base';
import { ReportExportService } from '../shared/report-export.service';
import { buildLines, buildStackedBarsH, buildStackedColumns } from '../shared/chart-geometry';
import { PaymentReport, ReportService } from '../shared/report.service';
import { PaymentRow, RangeKey, periodLabel, resolveWindow } from '../shared/report-data';

/**
 * Verification states in a fixed stack order. These are categorical slots chosen for
 * adjacent-pair separation, not the app's status tokens — a chart series never borrows a
 * status colour. Aqua and yellow fall below 3:1 on white, so this chart always ships a
 * legend and a table view.
 */
const STATUS_SERIES = [
  { key: 'verified', label: 'Verified', color: PALETTE.aqua },
  { key: 'pending', label: 'Pending verification', color: PALETTE.yellow },
  { key: 'rejected', label: 'Rejected', color: PALETTE.red },
];

/** Payment channels, in the validated categorical order. */
// The four channels `payments.payment_method` actually records.
const METHOD_SERIES = [
  { key: 'gcash', label: 'GCash', color: PALETTE.blue },
  { key: 'maya', label: 'Maya', color: PALETTE.orange },
  { key: 'cash', label: 'Cash', color: PALETTE.aqua },
  { key: 'other', label: 'Other', color: PALETTE.yellow },
];

const METHOD_INK: Record<string, string> = {
  gcash: '#ffffff',
  maya: '#ffffff',
  // Aqua and yellow are light fills, so an inline label switches to ink to stay legible.
  cash: '#1e293b',
  other: '#1e293b',
};

/**
 * Business Officer report: payment transactions only — what was submitted, what has been
 * verified, what is still queued, and which channels the money arrives through.
 */
@Component({
  selector: 'app-bo-report',
  standalone: true,
  imports: [TitleCasePipe],
  templateUrl: './bo-report.component.html',
  styleUrl: './bo-report.component.scss',
})
export class BoReportComponent extends ReportBase {
  readonly range = input.required<RangeKey>();

  private readonly reports = inject(ReportService);

  protected readonly statusSeries = STATUS_SERIES;
  protected readonly methodSeries = METHOD_SERIES;

  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly report = signal<PaymentReport | null>(null);

  protected readonly statusView = signal<'chart' | 'table'>('chart');
  protected readonly methodView = signal<'chart' | 'table'>('chart');
  protected readonly rateView = signal<'chart' | 'table'>('chart');

  protected readonly statusTip = signal<Tooltip | null>(null);
  protected readonly methodTip = signal<Tooltip | null>(null);
  protected readonly rateTip = signal<Tooltip | null>(null);

  protected readonly statusIndex = signal<number | null>(null);
  protected readonly methodIndex = signal<number | null>(null);
  protected readonly rateIndex = signal<number | null>(null);

  constructor() {
    super();
    inject(ReportExportService).register(() => this.exportCsv());
    this.load();
  }

  protected async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      this.report.set(await this.reports.getPayments());
      this.loadState.set('ready');
    } catch (error) {
      console.error('Failed to load the payments report', error);
      this.loadState.set('error');
    }
  }

  protected readonly transactionLog = computed(() => this.report()?.log ?? []);

  /**
   * "Latest 12 of 26 transactions". The charts above aggregate every payment in the window,
   * so without this the truncated list reads as the full set and will not reconcile.
   */
  protected readonly logCaption = computed(() => {
    const report = this.report();
    if (!report) return '';
    const shown = Math.min(report.logLimit, report.logTotal);
    return report.logTotal > shown
      ? `Latest ${this.fmtInt(shown)} of ${this.fmtInt(report.logTotal)} transactions`
      : `All ${this.fmtInt(report.logTotal)} transactions`;
  });

  /** True when nothing has been billed or paid in the last 12 months. */
  protected readonly isEmpty = computed(() =>
    (this.report()?.months ?? []).every((m) => m.billed === 0 && m.submitted === 0),
  );

  private readonly monthMetas = computed(() => this.report()?.months ?? []);

  private readonly window = computed(() => resolveWindow(this.range(), this.monthMetas()));
  private readonly allRows = computed(() => this.report()?.months ?? []);

  protected readonly rows = computed(() => {
    const { start, end } = this.window();
    return this.allRows().slice(start, end);
  });

  private readonly priorRows = computed(() => {
    const { start, end } = this.window();
    const span = end - start;
    return start - span < 0 ? [] : this.allRows().slice(start - span, start);
  });

  protected readonly periodLabel = computed(() => periodLabel(this.rows()));

  private summarise(rows: PaymentRow[]) {
    const billed = rows.reduce((s, r) => s + r.billed, 0);
    const verified = rows.reduce((s, r) => s + r.verified, 0);
    const pending = rows.reduce((s, r) => s + r.pending, 0);
    const rejected = rows.reduce((s, r) => s + r.rejected, 0);
    return {
      billed,
      verified,
      pending,
      rejected,
      submitted: verified + pending + rejected,
      outstanding: billed - verified,
      collectRate: billed ? (verified / billed) * 100 : 0,
      pendingCount: rows.reduce((s, r) => s + r.pendingCount, 0),
      verifiedCount: rows.reduce((s, r) => s + r.verifiedCount, 0),
      rejectedCount: rows.reduce((s, r) => s + r.rejectedCount, 0),
    };
  }

  protected readonly current = computed(() => this.summarise(this.rows()));
  private readonly prior = computed(() =>
    this.priorRows().length ? this.summarise(this.priorRows()) : null,
  );

  protected readonly hero = computed(() => {
    const { start, end } = this.window();
    const cur = this.current();
    const prior = this.prior();
    return {
      value: this.compactPeso(cur.verified),
      detail: `${this.fmtInt(cur.verifiedCount)} verified transactions of ${this.compactPeso(cur.billed)} billed`,
      delta: prior ? this.deltaPercent(cur.verified, prior.verified, true) : null,
      spark: this.sparkline(
        this.allRows().map((r) => r.verified),
        start,
        end,
      ),
    };
  });

  protected readonly tiles = computed(() => {
    const { start, end } = this.window();
    const all = this.allRows();
    const cur = this.current();
    const prior = this.prior();

    return [
      {
        key: 'pending',
        label: 'Pending verification',
        value: this.compactPeso(cur.pending),
        detail: `${this.fmtInt(cur.pendingCount)} e-receipts in the queue`,
        // A growing verification backlog is a problem, so the delta colour inverts.
        delta: prior ? this.deltaPercent(cur.pending, prior.pending, false) : null,
        spark: this.sparkline(
          all.map((r) => r.pending),
          start,
          end,
        ),
      },
      {
        key: 'rejected',
        label: 'Rejected',
        value: this.compactPeso(cur.rejected),
        detail: `${this.fmtInt(cur.rejectedCount)} transactions returned`,
        delta: prior ? this.deltaPercent(cur.rejected, prior.rejected, false) : null,
        spark: this.sparkline(
          all.map((r) => r.rejected),
          start,
          end,
        ),
      },
      {
        key: 'rate',
        label: 'Collection rate',
        value: this.fmtPct(cur.collectRate),
        detail: 'verified ÷ billed',
        delta: prior ? this.deltaPoints(cur.collectRate, prior.collectRate, true) : null,
        spark: this.sparkline(
          all.map((r) => r.collectRate),
          start,
          end,
        ),
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        value: this.compactPeso(cur.outstanding),
        detail: 'billed but not yet verified',
        delta: prior ? this.deltaPercent(cur.outstanding, prior.outstanding, false) : null,
        spark: this.sparkline(
          all.map((r) => r.billed - r.verified),
          start,
          end,
        ),
      },
    ];
  });

  // --- Chart 1: transaction value by verification state ---

  protected readonly status = computed(() =>
    buildStackedColumns(this.rows(), STATUS_SERIES, {
      value: (row, key) => row[key as 'verified' | 'pending' | 'rejected'],
      tickLabel: (v) => this.compactPeso(v),
      w: 960,
      h: 320,
      pad: { l: 92, r: 20, t: 32, b: 44 },
    }),
  );

  // --- Chart 2: which channel the money arrives through, month by month ---

  protected readonly methods = computed(() =>
    buildStackedBarsH(this.rows(), METHOD_SERIES, {
      label: (row) => row.longLabel,
      value: (row, key) => row.methods[key as 'gcash' | 'maya' | 'cash' | 'other'],
      segmentLabel: (v) => this.compactPeso(v),
      ink: (key) => METHOD_INK[key] ?? '#ffffff',
      w: 560,
      pad: { l: 104, r: 68, t: 20, b: 12 },
    }),
  );

  // --- Chart 3: collection rate over time (single series, no legend needed) ---

  protected readonly rateTrend = computed(() =>
    buildLines(
      this.rows(),
      [
        {
          key: 'rate',
          label: 'Collection rate',
          color: PALETTE.blue,
          // A month with nothing billed has no collection rate; null breaks the line
          // rather than claiming 0% was collected.
          value: (row) => (row.billed ? row.collectRate : null),
        },
      ],
      {
        tickLabel: (v, step) => this.pctTick(v, step),
        // Keep a readable window even in months where the rate hardly moves. No 100% ceiling:
        // a payment can settle a bill from an earlier month, so the ratio really can exceed
        // 100 and clipping the axis would hide the point rather than explain it.
        minSpan: 10,
        floor: 0,
        w: 560,
        h: 300,
        pad: { l: 54, r: 84, t: 24, b: 40 },
      },
    ),
  );

  // --- Hover / focus ---

  protected showStatusTip(index: number): void {
    const geo = this.status();
    const column = geo.columns[index];
    const anchorY = column.capY - 14;
    this.statusIndex.set(index);
    this.statusTip.set({
      left: (column.centre / geo.w) * 100,
      top: (anchorY / geo.h) * 100,
      align: this.alignFor(column.centre / geo.w),
      below: anchorY / geo.h < 0.3,
      title: `${column.row.longLabel} · ${this.compactPeso(column.total)} submitted`,
      rows: [
        { label: 'Verified', value: this.fmtPeso(column.row.verified), color: PALETTE.aqua },
        {
          label: 'Pending verification',
          value: this.fmtPeso(column.row.pending),
          color: PALETTE.yellow,
        },
        { label: 'Rejected', value: this.fmtPeso(column.row.rejected), color: PALETTE.red },
        { label: 'Billed', value: this.fmtPeso(column.row.billed) },
      ],
    });
  }

  protected showMethodTip(index: number): void {
    const geo = this.methods();
    const bar = geo.rows[index];
    this.methodIndex.set(index);
    this.methodTip.set({
      left: 50,
      top: (bar.y / geo.h) * 100,
      align: 'center',
      below: bar.y / geo.h < 0.3,
      title: `${bar.label} · ${this.compactPeso(bar.total)} verified`,
      rows: bar.segments.map((s) => ({
        label: s.label,
        value: this.fmtPeso(s.value),
        color: s.color,
      })),
    });
  }

  protected showRateTip(index: number): void {
    const geo = this.rateTrend();
    const point = geo.series[0].points[index];
    const row = geo.rows[index];
    const anchorY = point.defined ? point.y : geo.pad.t;
    this.rateIndex.set(index);
    this.rateTip.set({
      left: (point.x / geo.w) * 100,
      top: (anchorY / geo.h) * 100,
      align: this.alignFor(point.x / geo.w),
      below: anchorY / geo.h < 0.3,
      title: row.longLabel,
      rows: [
        {
          label: 'Collection rate',
          // Nothing billed means the ratio is undefined, not zero.
          value: row.billed ? this.fmtPct(row.collectRate) : 'Nothing billed',
          color: PALETTE.blue,
        },
        { label: 'Verified', value: this.fmtPeso(row.verified) },
        { label: 'Billed', value: this.fmtPeso(row.billed) },
      ],
    });
  }

  protected clearStatusTip(): void {
    this.statusIndex.set(null);
    this.statusTip.set(null);
  }

  protected clearMethodTip(): void {
    this.methodIndex.set(null);
    this.methodTip.set(null);
  }

  protected clearRateTip(): void {
    this.rateIndex.set(null);
    this.rateTip.set(null);
  }

  private exportCsv(): void {
    this.downloadCsv(`payment-transactions-${this.range()}.csv`, [
      ['Business Officer — payment transactions', this.periodLabel()],
      [],
      [
        'Month',
        'Billed',
        'Verified',
        'Pending verification',
        'Rejected',
        'Collection rate %',
        'GCash',
        'Maya',
        'Cash',
        'Other',
      ],
      ...this.rows().map((r) => [
        r.longLabel,
        r.billed,
        r.verified,
        r.pending,
        r.rejected,
        r.collectRate.toFixed(1),
        r.methods.gcash,
        r.methods.maya,
        r.methods.cash,
        r.methods.other,
      ]),
      [],
      ['Reference', 'Occupant', 'Room', 'Amount', 'Method', 'Submitted', 'Status', 'Handled by'],
      ...this.transactionLog().map((t) => [
        t.reference,
        t.occupant,
        t.room,
        t.amount,
        t.method,
        t.submitted,
        t.status,
        t.handledBy,
      ]),
    ]);
  }
}
