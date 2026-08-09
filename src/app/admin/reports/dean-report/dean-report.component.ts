import { Component, computed, inject, input, signal } from '@angular/core';
import { PALETTE, ReportBase, Tooltip } from '../shared/report-base';
import { ReportExportService } from '../shared/report-export.service';
import { DecisionReport, ReportService } from '../shared/report.service';
import { buildGroupedStacks, buildLines, buildStackedBarsH } from '../shared/chart-geometry';
import {
  DecisionRow,
  GENDERS,
  Gender,
  RangeKey,
  periodLabel,
  resolveWindow,
} from '../shared/report-data';

/**
 * Approved and rejected are an outcome pair, not a ranking, so they take two validated
 * categorical slots that clear every contrast and colour-vision gate on white. The order
 * is fixed: an outcome keeps its colour whatever the filters do.
 */
const OUTCOME_SERIES = [
  { key: 'approved', label: 'Approved', color: PALETTE.blue },
  { key: 'rejected', label: 'Rejected', color: PALETTE.red },
];

/**
 * Wing hues, used only where the wing itself is the series (the approval-rate chart).
 * Everywhere else outcome owns the colour channel and the wing is carried by position plus
 * a printed M/F mark, so blue never means two different things on one page.
 */
const WING_COLORS: Record<Gender, string> = {
  male: PALETTE.violet,
  female: PALETTE.orange,
};

interface TypeRow {
  label: string;
  approved: number;
  rejected: number;
}

interface WingSummary {
  approved: number;
  rejected: number;
  total: number;
  approvalRate: number;
  turnaround: number;
  leave: number;
  gatepass: number;
}

/**
 * Home Dean report: every leave request and gatepass the dean's office has decided, read
 * from `/api/reports/decisions`.
 *
 * Scoping is enforced server-side. A dean with `dean_type='male'` gets a response
 * containing men's-wing figures only — the women's wing is never sent, let alone rendered.
 * The API reports which wings it returned and this component renders exactly those, so a
 * dean who oversees both sees the split and a scoped dean sees a single-wing report.
 */
@Component({
  selector: 'app-dean-report',
  standalone: true,
  templateUrl: './dean-report.component.html',
  styleUrl: './dean-report.component.scss',
})
export class DeanReportComponent extends ReportBase {
  readonly range = input.required<RangeKey>();

  private readonly reports = inject(ReportService);

  protected readonly outcomeSeries = OUTCOME_SERIES;
  protected readonly wingColors = WING_COLORS;

  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly report = signal<DecisionReport | null>(null);

  protected readonly volumeView = signal<'chart' | 'table'>('chart');
  protected readonly typeView = signal<'chart' | 'table'>('chart');
  protected readonly rateView = signal<'chart' | 'table'>('chart');

  protected readonly volumeTip = signal<Tooltip | null>(null);
  protected readonly typeTip = signal<Tooltip | null>(null);
  protected readonly rateTip = signal<Tooltip | null>(null);

  protected readonly volumeIndex = signal<number | null>(null);
  protected readonly typeIndex = signal<number | null>(null);
  protected readonly rateIndex = signal<number | null>(null);

  constructor() {
    super();
    inject(ReportExportService).register(() => this.exportCsv());
    this.load();
  }

  protected async load(): Promise<void> {
    this.status.set('loading');
    try {
      this.report.set(await this.reports.getDecisions());
      this.status.set('ready');
    } catch (error) {
      console.error('Failed to load the decisions report', error);
      this.status.set('error');
    }
  }

  /** The wings the API returned — the authoritative answer to what this dean may see. */
  protected readonly shownWings = computed(() => {
    const wings = this.report()?.wings ?? [];
    return GENDERS.filter((g) => wings.includes(g.key));
  });

  protected readonly isSplit = computed(() => this.shownWings().length > 1);

  protected readonly wingLabel = computed(() => {
    const wings = this.shownWings();
    return wings.length === 1 ? wings[0].label.toLowerCase() : 'both wings';
  });

  /** True when the office has decided nothing at all in the last 12 months. */
  protected readonly isEmpty = computed(() =>
    (this.report()?.combined ?? []).every((row) => row.total === 0),
  );

  private readonly months = computed(() => this.report()?.months ?? []);

  private slice<T>(rows: T[]): T[] {
    const { start, end } = resolveWindow(this.range(), this.months());
    return rows.slice(start, end);
  }

  private readonly allRows = computed(() => this.report()?.combined ?? []);
  protected readonly rows = computed(() => this.slice(this.allRows()));

  private readonly wingSeries = computed(() => {
    const byWing = this.report()?.byWing ?? {};
    return this.shownWings().map((wing) => ({
      wing,
      rows: this.slice(byWing[wing.key] ?? []),
    }));
  });

  /** Each month paired with its visible per-wing counts, driving both charts and tables. */
  protected readonly wingRows = computed(() => {
    const series = this.wingSeries();
    return this.rows().map((row, i) => ({
      row,
      wings: series.map((s) => ({ wing: s.wing, row: s.rows[i] })),
    }));
  });

  private readonly priorRows = computed(() => {
    const { start, end } = resolveWindow(this.range(), this.months());
    const span = end - start;
    return start - span < 0 ? [] : this.allRows().slice(start - span, start);
  });

  protected readonly periodLabel = computed(() => periodLabel(this.rows()));

  private summarise(rows: DecisionRow[]): WingSummary {
    const approved = rows.reduce((s, r) => s + r.approved, 0);
    const rejected = rows.reduce((s, r) => s + r.rejected, 0);
    const total = approved + rejected;
    // Only months that decided something count towards the mean turnaround.
    const decided = rows.filter((r) => r.total > 0);
    return {
      approved,
      rejected,
      total,
      approvalRate: total ? (approved / total) * 100 : 0,
      turnaround: decided.length
        ? decided.reduce((s, r) => s + r.turnaround, 0) / decided.length
        : 0,
      leave: rows.reduce((s, r) => s + r.leaveApproved + r.leaveRejected, 0),
      gatepass: rows.reduce((s, r) => s + r.gatepassApproved + r.gatepassRejected, 0),
    };
  }

  protected readonly current = computed(() => this.summarise(this.rows()));
  private readonly prior = computed(() =>
    this.priorRows().length ? this.summarise(this.priorRows()) : null,
  );

  private readonly wingSummaries = computed(() =>
    this.wingSeries().map((s) => ({ wing: s.wing, summary: this.summarise(s.rows) })),
  );

  /**
   * "M 880 · F 741" when both wings are in view; a plain caption when the dean is scoped,
   * since repeating the single wing's own number would say nothing.
   */
  private wingSplit(pick: (s: WingSummary) => number, scopedCaption: string): string {
    if (!this.isSplit()) return scopedCaption;
    return this.wingSummaries()
      .map((entry) => `${entry.wing.short} ${this.fmtInt(pick(entry.summary))}`)
      .join(' · ');
  }

  protected readonly hero = computed(() => {
    const { start, end } = resolveWindow(this.range(), this.months());
    const cur = this.current();
    const prior = this.prior();
    return {
      value: this.fmtInt(cur.total),
      detail: `${this.fmtInt(cur.leave)} leave requests · ${this.fmtInt(cur.gatepass)} gatepasses`,
      split: this.isSplit() ? this.wingSplit((s) => s.total, '') : '',
      delta: prior ? this.deltaPercent(cur.total, prior.total, true) : null,
      spark: this.sparkline(
        this.allRows().map((r) => r.total),
        start,
        end,
      ),
    };
  });

  protected readonly tiles = computed(() => {
    const { start, end } = resolveWindow(this.range(), this.months());
    const all = this.allRows();
    const cur = this.current();
    const prior = this.prior();

    return [
      {
        key: 'approved',
        label: 'Approved',
        value: this.fmtInt(cur.approved),
        detail: this.wingSplit(
          (s) => s.approved,
          `${this.fmtPct(cur.approvalRate)} of all decisions`,
        ),
        delta: prior ? this.deltaPercent(cur.approved, prior.approved, true) : null,
        spark: this.sparkline(
          all.map((r) => r.approved),
          start,
          end,
        ),
      },
      {
        key: 'rejected',
        label: 'Rejected',
        value: this.fmtInt(cur.rejected),
        detail: this.wingSplit((s) => s.rejected, 'returned to the occupant'),
        // Rejections rising is not an improvement, so the delta colour inverts.
        delta: prior ? this.deltaPercent(cur.rejected, prior.rejected, false) : null,
        spark: this.sparkline(
          all.map((r) => r.rejected),
          start,
          end,
        ),
      },
      {
        key: 'rate',
        label: 'Approval rate',
        value: this.fmtPct(cur.approvalRate),
        detail: this.isSplit()
          ? this.wingSummaries()
              .map((e) => `${e.wing.short} ${this.fmtPct(e.summary.approvalRate)}`)
              .join(' · ')
          : 'approved ÷ decided',
        delta: prior ? this.deltaPoints(cur.approvalRate, prior.approvalRate, true) : null,
        spark: this.sparkline(
          all.map((r) => (r.total ? (r.approved / r.total) * 100 : 0)),
          start,
          end,
        ),
      },
      {
        key: 'turnaround',
        label: 'Average turnaround',
        value: this.fmtHours(cur.turnaround),
        detail: 'filing to decision',
        // Faster decisions are better, so a rising turnaround reads as bad.
        delta: prior ? this.deltaPercent(cur.turnaround, prior.turnaround, false) : null,
        spark: this.sparkline(
          all.map((r) => r.turnaround),
          start,
          end,
        ),
      },
    ];
  });

  protected rowForWing(
    entry: { wings: { wing: { key: Gender }; row: DecisionRow }[] },
    wingKey: string,
  ): DecisionRow {
    return (entry.wings.find((w) => w.wing.key === wingKey) ?? entry.wings[0]).row;
  }

  // --- Chart 1: decisions per month, one stack per visible wing, split by outcome ---

  protected readonly volume = computed(() =>
    buildGroupedStacks(
      this.wingRows(),
      this.shownWings().map((w) => ({ key: w.key, label: w.label, short: w.short })),
      OUTCOME_SERIES,
      {
        value: (entry, wing, outcome) =>
          this.rowForWing(entry, wing)[outcome as 'approved' | 'rejected'],
        tickLabel: (v) => this.fmtInt(v),
        w: 960,
        h: 340,
        pad: { l: 64, r: 16, t: 32, b: 58 },
      },
    ),
  );

  // --- Chart 2: request type (x wing, when both are visible) ---

  private readonly typeRows = computed<TypeRow[]>(() => {
    const sum = (rows: DecisionRow[], pick: (r: DecisionRow) => number) =>
      rows.reduce((s, r) => s + pick(r), 0);
    const split = this.isSplit();

    return this.wingSeries().flatMap(({ wing, rows }) => [
      {
        label: split ? `Leave · ${wing.short === 'M' ? 'Men' : 'Women'}` : 'Leave requests',
        approved: sum(rows, (r) => r.leaveApproved),
        rejected: sum(rows, (r) => r.leaveRejected),
      },
      {
        label: split ? `Gatepass · ${wing.short === 'M' ? 'Men' : 'Women'}` : 'Gatepasses',
        approved: sum(rows, (r) => r.gatepassApproved),
        rejected: sum(rows, (r) => r.gatepassRejected),
      },
    ]);
  });

  protected readonly byType = computed(() =>
    buildStackedBarsH(this.typeRows(), OUTCOME_SERIES, {
      label: (row) => row.label,
      value: (row, key) => row[key as 'approved' | 'rejected'],
      segmentLabel: (v) => this.fmtInt(v),
      w: 560,
      pad: { l: this.isSplit() ? 180 : 148, r: 56, t: 20, b: 16 },
      barH: this.isSplit() ? 30 : 44,
      gapY: this.isSplit() ? 22 : 40,
    }),
  );

  // --- Chart 3: approval rate (the wing is the series here, so it owns the colour) ---

  protected readonly rateTrend = computed(() =>
    buildLines(
      this.wingRows(),
      this.shownWings().map((wing) => ({
        key: wing.key,
        label: wing.label,
        color: WING_COLORS[wing.key],
        value: (entry: { wings: { wing: { key: Gender }; row: DecisionRow }[] }) => {
          const row = this.rowForWing(entry, wing.key);
          return row.total ? this.rateOf(row) : null;
        },
      })),
      {
        tickLabel: (v, step) => this.pctTick(v, step),
        // Approval rate barely moves; a 10-point window keeps noise from reading as signal.
        minSpan: 10,
        floor: 0,
        ceiling: 100,
        w: 560,
        h: 300,
        pad: { l: 54, r: 84, t: 24, b: 40 },
      },
    ),
  );

  protected rateOf(row: DecisionRow): number {
    return row.total ? (row.approved / row.total) * 100 : 0;
  }

  protected readonly decisionLog = computed(() => this.report()?.log ?? []);

  /**
   * "Latest 12 of 40 decisions". The charts above aggregate every decision in the window,
   * so without this the truncated list reads as the full set and will not reconcile.
   */
  protected readonly logCaption = computed(() => {
    const report = this.report();
    if (!report) return '';
    const shown = Math.min(report.logLimit, report.logTotal);
    return report.logTotal > shown
      ? `Latest ${this.fmtInt(shown)} of ${this.fmtInt(report.logTotal)} decisions`
      : `All ${this.fmtInt(report.logTotal)} decisions`;
  });

  // Screen-reader text for a mark. Built here rather than in the template because Angular
  // control flow is not parsed inside an SVG <title>, whose content is plain text.
  protected volumeTitle(entry: {
    row: DecisionRow;
    wings: { wing: { key: Gender; label: string }; row: DecisionRow }[];
  }): string {
    const parts = entry.wings.map(
      (w) =>
        `${w.wing.label} ${this.fmtInt(w.row.approved)} approved, ${this.fmtInt(w.row.rejected)} rejected`,
    );
    return `${entry.row.longLabel}: ${parts.join('; ')}`;
  }

  protected rateTitle(entry: {
    row: DecisionRow;
    wings: { wing: { key: Gender; label: string }; row: DecisionRow }[];
  }): string {
    const parts = entry.wings.map((w) =>
      w.row.total
        ? `${w.wing.label} ${this.fmtPct(this.rateOf(w.row))} approval rate`
        : `${w.wing.label} no decisions`,
    );
    return `${entry.row.longLabel}: ${parts.join('; ')}`;
  }

  // --- Hover / focus ---

  protected showVolumeTip(index: number): void {
    const geo = this.volume();
    const column = geo.columns[index];
    const anchorY = Math.min(...column.bars.map((b) => b.capY)) - 14;
    this.volumeIndex.set(index);
    this.volumeTip.set({
      left: (column.centre / geo.w) * 100,
      top: (anchorY / geo.h) * 100,
      align: this.alignFor(column.centre / geo.w),
      below: anchorY / geo.h < 0.3,
      title: `${column.row.row.longLabel} · ${this.fmtInt(column.total)} decisions`,
      rows: column.bars.flatMap((bar) =>
        bar.segments.map((segment) => ({
          label: this.isSplit() ? `${bar.groupLabel} — ${segment.label}` : segment.label,
          value: this.fmtInt(segment.value),
          color: segment.color,
        })),
      ),
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

  protected showRateTip(index: number): void {
    const geo = this.rateTrend();
    const entry = geo.rows[index];
    const drawn = geo.series.map((s) => s.points[index]).filter((p) => p.defined);
    const anchorY = drawn.length ? Math.min(...drawn.map((p) => p.y)) : geo.pad.t;
    this.rateIndex.set(index);
    this.rateTip.set({
      left: (geo.series[0].points[index].x / geo.w) * 100,
      top: (anchorY / geo.h) * 100,
      align: this.alignFor(geo.series[0].points[index].x / geo.w),
      below: anchorY / geo.h < 0.3,
      title: entry.row.longLabel,
      rows: entry.wings.map((w) => ({
        label: w.wing.label,
        // "No decisions" is the honest reading of an empty month, not "0%".
        value: w.row.total
          ? `${this.fmtPct(this.rateOf(w.row))} of ${this.fmtInt(w.row.total)}`
          : 'No decisions',
        color: WING_COLORS[w.wing.key],
      })),
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

  protected clearRateTip(): void {
    this.rateIndex.set(null);
    this.rateTip.set(null);
  }

  private exportCsv(): void {
    const wings = this.shownWings();
    const scope = wings.length === 1 ? wings[0].key : 'all-wings';
    this.downloadCsv(`dean-decisions-${scope}-${this.range()}.csv`, [
      ['Home Dean — leave request & gatepass decisions', this.periodLabel(), this.wingLabel()],
      [],
      [
        'Month',
        'Wing',
        'Leave approved',
        'Leave rejected',
        'Gatepass approved',
        'Gatepass rejected',
        'Approval rate %',
        'Turnaround hours',
      ],
      ...this.wingRows().flatMap((entry) =>
        entry.wings.map((w) => [
          entry.row.longLabel,
          w.wing.label,
          w.row.leaveApproved,
          w.row.leaveRejected,
          w.row.gatepassApproved,
          w.row.gatepassRejected,
          this.rateOf(w.row).toFixed(1),
          w.row.turnaround.toFixed(1),
        ]),
      ),
      [],
      [
        'Reference',
        'Occupant',
        'Wing',
        'Room',
        'Type',
        'Reason',
        'Filed',
        'Decided',
        'Outcome',
        'Note',
      ],
      ...this.decisionLog().map((e) => [
        e.reference,
        e.occupant,
        e.gender === 'male' ? "Men's wing" : "Women's wing",
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
