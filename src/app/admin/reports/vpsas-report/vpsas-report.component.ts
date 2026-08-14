import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { PALETTE, ReportBase, Tooltip } from '../shared/report-base';
import { ReportExportService } from '../shared/report-export.service';
import { buildLine, buildStackedBarsH, buildStackedColumns } from '../shared/chart-geometry';
import { DecisionReport, ReportService } from '../shared/report.service';
import {
  CustomRange,
  DecisionLogEntry,
  DecisionRow,
  RangeKey,
  monthBounds,
  periodLabel,
  resolveWindow,
} from '../shared/report-data';

/** Same validated outcome pair the dean report uses, so a colour means one thing site-wide. */
const OUTCOME_SERIES = [
  { key: 'approved', label: 'Approved', color: PALETTE.blue },
  { key: 'rejected', label: 'Rejected', color: PALETTE.red },
];

interface TypeRow {
  label: string;
  approved: number;
  rejected: number;
}

/**
 * VPSAS report: only the leave requests and gatepasses the VP personally approved or
 * rejected. These reach the VP by escalation — extended leaves, appeals against a dean
 * rejection, out-of-province travel — so turnaround, not volume, is the headline metric.
 */
@Component({
  selector: 'app-vpsas-report',
  standalone: true,
  templateUrl: './vpsas-report.component.html',
  styleUrl: './vpsas-report.component.scss',
})
export class VpsasReportComponent extends ReportBase {
  readonly range = input.required<RangeKey>();
  /**
   * An explicit day range. When set, the API returns exactly the months it touches, bounded
   * to those days, so the client does no slicing of its own.
   */
  readonly customRange = input<CustomRange | null>(null);

  private readonly reports = inject(ReportService);

  protected readonly outcomeSeries = OUTCOME_SERIES;
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly report = signal<DecisionReport | null>(null);

  protected readonly volumeView = signal<'chart' | 'table'>('chart');
  protected readonly typeView = signal<'chart' | 'table'>('chart');
  protected readonly turnaroundView = signal<'chart' | 'table'>('chart');

  protected readonly volumeTip = signal<Tooltip | null>(null);
  protected readonly typeTip = signal<Tooltip | null>(null);
  protected readonly turnaroundTip = signal<Tooltip | null>(null);

  protected readonly volumeIndex = signal<number | null>(null);
  protected readonly typeIndex = signal<number | null>(null);
  protected readonly turnaroundIndex = signal<number | null>(null);

  constructor() {
    super();
    const exporter = inject(ReportExportService);
    exporter.register(() => void this.exportCsv());
    // Print / PDF carries the same payload as the CSV: every decision in the period.
    exporter.registerPrint(() => this.printDecisions());

    // Refetch whenever the explicit range changes. Presets need no refetch: they slice the
    // twelve months already in hand, which keeps the sparkline baselines intact. The first
    // run of this effect is what loads the report, so there is no separate initial fetch.
    effect(() => {
      const range = this.customRange();
      void this.load(range);
    });
  }

  protected async load(range: CustomRange | null = this.customRange()): Promise<void> {
    this.status.set('loading');
    try {
      this.report.set(await this.reports.getDecisions(range));
      this.status.set('ready');
    } catch (error) {
      console.error('Failed to load the decisions report', error);
      this.status.set('error');
    }
  }

  protected readonly decisionLog = computed(() => this.report()?.log ?? []);

  /** "Latest 12 of 40 decisions" — the charts above cover every decision in the window. */
  protected readonly logCaption = computed(() => {
    const report = this.report();
    if (!report) return '';
    const shown = Math.min(report.logLimit, report.logTotal);
    return report.logTotal > shown
      ? `Latest ${this.fmtInt(shown)} of ${this.fmtInt(report.logTotal)} decisions`
      : `All ${this.fmtInt(report.logTotal)} decisions`;
  });

  /** True when this VP has signed nothing at all in the last 12 months. */
  protected readonly isEmpty = computed(() =>
    (this.report()?.combined ?? []).every((row) => row.total === 0),
  );

  private readonly months = computed(() => this.report()?.months ?? []);

  private readonly window = computed(() => resolveWindow(this.range(), this.months()));
  private readonly allRows = computed(() => this.report()?.combined ?? []);

  protected readonly rows = computed(() => {
    const { start, end } = this.window();
    return this.allRows().slice(start, end);
  });

  private readonly priorRows = computed(() => {
    // A custom window has no comparable preceding period, so the tiles drop their deltas.
    if (this.customRange()) return [];
    const { start, end } = this.window();
    const span = end - start;
    return start - span < 0 ? [] : this.allRows().slice(start - span, start);
  });

  protected readonly periodLabel = computed(() => periodLabel(this.rows()));

  private summarise(rows: DecisionRow[]) {
    const approved = rows.reduce((s, r) => s + r.approved, 0);
    const rejected = rows.reduce((s, r) => s + r.rejected, 0);
    const total = approved + rejected;
    return {
      approved,
      rejected,
      total,
      approvalRate: total ? (approved / total) * 100 : 0,
      turnaround: rows.filter((r) => r.total > 0).length
        ? rows.filter((r) => r.total > 0).reduce((s, r) => s + r.turnaround, 0) /
          rows.filter((r) => r.total > 0).length
        : 0,
      leave: rows.reduce((s, r) => s + r.leaveApproved + r.leaveRejected, 0),
      gatepass: rows.reduce((s, r) => s + r.gatepassApproved + r.gatepassRejected, 0),
    };
  }

  protected readonly current = computed(() => this.summarise(this.rows()));
  private readonly prior = computed(() =>
    this.priorRows().length ? this.summarise(this.priorRows()) : null,
  );

  /** Months in the window where this VP actually signed something. */
  private readonly activeMonths = computed(() => this.rows().filter((r) => r.total > 0).length);

  protected readonly hero = computed(() => {
    const { start, end } = this.window();
    const cur = this.current();
    const prior = this.prior();
    return {
      value: this.fmtInt(cur.total),
      detail: `${this.fmtInt(cur.leave)} leave requests · ${this.fmtInt(cur.gatepass)} gatepasses`,
      delta: prior ? this.deltaPercent(cur.total, prior.total, true) : null,
      spark: this.sparkline(
        this.allRows().map((r) => r.total),
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
        key: 'approved',
        label: 'Approved by me',
        value: this.fmtInt(cur.approved),
        detail: `${this.fmtPct(cur.approvalRate)} of my decisions`,
        delta: prior ? this.deltaPercent(cur.approved, prior.approved, true) : null,
        spark: this.sparkline(
          all.map((r) => r.approved),
          start,
          end,
        ),
      },
      {
        key: 'rejected',
        label: 'Rejected by me',
        value: this.fmtInt(cur.rejected),
        detail: 'upheld or denied on review',
        delta: prior ? this.deltaPercent(cur.rejected, prior.rejected, false) : null,
        spark: this.sparkline(
          all.map((r) => r.rejected),
          start,
          end,
        ),
      },
      {
        key: 'turnaround',
        label: 'Average turnaround',
        value: this.fmtHours(cur.turnaround),
        detail: 'escalation to decision',
        // Escalations should clear faster, so a rising turnaround reads as bad.
        delta: prior ? this.deltaPercent(cur.turnaround, prior.turnaround, false) : null,
        spark: this.sparkline(
          all.map((r) => r.turnaround),
          start,
          end,
        ),
      },
      {
        key: 'active-months',
        label: 'Months with escalations',
        value: `${this.fmtInt(this.activeMonths())} of ${this.fmtInt(this.rows().length)}`,
        detail: 'months I signed something',
        delta: null,
        spark: this.sparkline(
          all.map((r) => r.total),
          start,
          end,
        ),
      },
    ];
  });

  // --- Chart 1: my decisions per month, split by outcome ---

  protected readonly volume = computed(() =>
    buildStackedColumns(this.rows(), OUTCOME_SERIES, {
      value: (row, key) => row[key as 'approved' | 'rejected'],
      tickLabel: (v) => this.fmtInt(v),
      w: 960,
      h: 320,
      pad: { l: 64, r: 20, t: 32, b: 44 },
    }),
  );

  // --- Chart 2: which request type escalates ---

  private readonly typeRows = computed<TypeRow[]>(() => {
    const rows = this.rows();
    return [
      {
        label: 'Leave requests',
        approved: rows.reduce((s, r) => s + r.leaveApproved, 0),
        rejected: rows.reduce((s, r) => s + r.leaveRejected, 0),
      },
      {
        label: 'Gatepasses',
        approved: rows.reduce((s, r) => s + r.gatepassApproved, 0),
        rejected: rows.reduce((s, r) => s + r.gatepassRejected, 0),
      },
    ];
  });

  protected readonly byType = computed(() =>
    buildStackedBarsH(this.typeRows(), OUTCOME_SERIES, {
      label: (row) => row.label,
      value: (row, key) => row[key as 'approved' | 'rejected'],
      segmentLabel: (v) => this.fmtInt(v),
      w: 560,
      pad: { l: 116, r: 56, t: 28, b: 20 },
      barH: 44,
      gapY: 44,
    }),
  );

  // --- Chart 3: how long escalations sit before a decision ---

  protected readonly turnaroundTrend = computed(() =>
    buildLine(this.rows(), {
      value: (row) => row.turnaround,
      tickLabel: (v, step) => this.hourTick(v, step),
      floor: 0,
      w: 560,
      h: 300,
      pad: { l: 54, r: 68, t: 24, b: 40 },
    }),
  );

  // --- Hover / focus ---

  protected showVolumeTip(index: number): void {
    const geo = this.volume();
    const column = geo.columns[index];
    const anchorY = column.capY - 14;
    this.volumeIndex.set(index);
    this.volumeTip.set({
      left: (column.centre / geo.w) * 100,
      top: (anchorY / geo.h) * 100,
      align: this.alignFor(column.centre / geo.w),
      below: anchorY / geo.h < 0.3,
      title: `${column.row.longLabel} · ${this.fmtInt(column.total)} decisions`,
      rows: [
        { label: 'Approved', value: this.fmtInt(column.row.approved), color: PALETTE.blue },
        { label: 'Rejected', value: this.fmtInt(column.row.rejected), color: PALETTE.red },
        { label: 'Turnaround', value: this.fmtHours(column.row.turnaround) },
      ],
    });
  }

  protected showTypeTip(index: number): void {
    const geo = this.byType();
    const bar = geo.rows[index];
    this.typeIndex.set(index);
    this.typeTip.set({
      left: 50,
      top: (bar.y / geo.h) * 100,
      align: 'center',
      below: bar.y / geo.h < 0.3,
      title: `${bar.label} · ${this.fmtInt(bar.total)} decided`,
      rows: bar.segments.map((s) => ({
        label: s.label,
        value: this.fmtInt(s.value),
        color: s.color,
      })),
    });
  }

  protected showTurnaroundTip(index: number): void {
    const geo = this.turnaroundTrend();
    const point = geo.points[index];
    this.turnaroundIndex.set(index);
    this.turnaroundTip.set({
      left: (point.x / geo.w) * 100,
      top: (point.y / geo.h) * 100,
      align: this.alignFor(point.x / geo.w),
      below: point.y / geo.h < 0.3,
      title: point.row.longLabel,
      rows: [
        { label: 'Turnaround', value: this.fmtHours(point.row.turnaround), color: PALETTE.blue },
        { label: 'Decisions', value: this.fmtInt(point.row.total) },
      ],
    });
  }

  protected clearVolumeTip(): void {
    this.volumeIndex.set(null);
    this.volumeTip.set(null);
  }

  protected clearTypeTip(): void {
    this.typeIndex.set(null);
    this.typeTip.set(null);
  }

  protected clearTurnaroundTip(): void {
    this.turnaroundIndex.set(null);
    this.turnaroundTip.set(null);
  }

  /** Rows staged for printing. Rendered only while a print is in flight. */
  protected readonly printRows = signal<DecisionLogEntry[] | null>(null);

  /** The days the export covers: the explicit range, or the months currently in view. */
  private windowBounds(): CustomRange | null {
    return this.customRange() ?? monthBounds(this.rows());
  }

  /**
   * Every escalation this VP personally decided in the period. Not the capped on-screen
   * log, which stops at 12 rows, and not the monthly aggregates — the export is the
   * decision list itself. The endpoint scopes to the signed-in reviewer, so "mine" is
   * enforced server-side rather than trusted from here.
   */
  private async fetchDecisions(bounds: CustomRange): Promise<DecisionLogEntry[] | null> {
    try {
      return await this.reports.getDecisionLog(bounds);
    } catch (error) {
      console.error('Failed to list the decisions for export', error);
      return null;
    }
  }

  /**
   * Prints the same thing the CSV exports. Printing the page as it appears would carry the
   * charts and a 12-row sample of the log, which is not the list that was asked for.
   */
  private async printDecisions(): Promise<void> {
    const bounds = this.windowBounds();
    if (!bounds) return;
    const decisions = await this.fetchDecisions(bounds);
    if (!decisions) return;

    this.printRows.set(decisions);
    document.body.classList.add('printing-report');

    const cleanUp = () => {
      document.body.classList.remove('printing-report');
      this.printRows.set(null);
      window.removeEventListener('afterprint', cleanUp);
    };
    window.addEventListener('afterprint', cleanUp);

    // Let Angular flush the print-only table before handing over to the browser.
    await new Promise((resolve) => setTimeout(resolve, 60));
    window.print();
    // Headless and some mobile browsers never fire afterprint; do not leak the class.
    setTimeout(cleanUp, 1000);
  }

  private async exportCsv(): Promise<void> {
    const bounds = this.windowBounds();
    if (!bounds) return;
    const decisions = await this.fetchDecisions(bounds);
    if (!decisions) return;

    this.downloadCsv(`vpsas-decisions-${bounds.from}_to_${bounds.to}.csv`, [
      ['Reference', 'Occupant', 'Room', 'Type', 'Reason', 'Filed', 'Decided', 'Outcome', 'Note'],
      ...decisions.map((e) => [
        e.reference,
        e.occupant,
        e.room,
        e.type,
        e.reason,
        e.filed,
        e.decided,
        e.outcome,
        e.note,
      ]),
    ]);
  }
}
