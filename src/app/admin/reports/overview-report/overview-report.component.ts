import { Component, computed, inject, input, signal } from '@angular/core';
import { PALETTE, ReportBase, Tooltip } from '../shared/report-base';
import { ReportExportService } from '../shared/report-export.service';
import { OverviewReport, ReportService } from '../shared/report.service';
import { PeriodRow, RangeKey, periodLabel, resolveWindow } from '../shared/report-data';

/** Stack order is fixed so a status keeps its colour no matter which months are in view. */
const LEAVE_SERIES = [
  { key: 'completed', label: 'Completed', color: PALETTE.aqua } as const,
  { key: 'approved', label: 'Approved / out', color: PALETTE.blue } as const,
  { key: 'pending', label: 'Pending', color: PALETTE.yellow } as const,
  { key: 'rejected', label: 'Rejected', color: PALETTE.red } as const,
];

/**
 * Dorm-wide report for the admin: occupancy, collections and leave volume across every
 * building. Deans, the VP and the business officer get their own narrower views.
 */
@Component({
  selector: 'app-overview-report',
  standalone: true,
  templateUrl: './overview-report.component.html',
  styleUrl: './overview-report.component.scss',
})
export class OverviewReportComponent extends ReportBase {
  readonly range = input.required<RangeKey>();

  private readonly reports = inject(ReportService);

  protected readonly leaveSeries = LEAVE_SERIES;
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly report = signal<OverviewReport | null>(null);

  protected readonly trendView = signal<'chart' | 'table'>('chart');
  protected readonly billingView = signal<'chart' | 'table'>('chart');
  protected readonly leaveView = signal<'chart' | 'table'>('chart');
  protected readonly heatView = signal<'chart' | 'table'>('chart');

  protected readonly trendTip = signal<Tooltip | null>(null);
  protected readonly billingTip = signal<Tooltip | null>(null);
  protected readonly leaveTip = signal<Tooltip | null>(null);

  /** Index of the hovered/focused mark, so the crosshair and hover band can follow it. */
  protected readonly trendIndex = signal<number | null>(null);
  protected readonly billingIndex = signal<number | null>(null);
  protected readonly leaveIndex = signal<number | null>(null);

  constructor() {
    super();
    inject(ReportExportService).register(() => this.exportCsv());
    this.load();
  }

  protected async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      this.report.set(await this.reports.getOverview());
      this.loadState.set('ready');
    } catch (error) {
      console.error('Failed to load the overview report', error);
      this.loadState.set('error');
    }
  }

  /** True when there are no rooms configured at all — nothing to report on. */
  protected readonly isEmpty = computed(() => (this.report()?.floors ?? []).length === 0);

  private readonly monthMetas = computed(() => this.report()?.months ?? []);

  private readonly window = computed(() => resolveWindow(this.range(), this.monthMetas()));
  private readonly allRows = computed(() => this.report()?.months ?? []);

  protected readonly rows = computed(() => {
    const { start, end } = this.window();
    return this.allRows().slice(start, end);
  });

  /** The equal-length window immediately before the current one, when history allows. */
  private readonly priorRows = computed(() => {
    const { start, end } = this.window();
    const span = end - start;
    return start - span < 0 ? [] : this.allRows().slice(start - span, start);
  });

  protected readonly periodLabel = computed(() => periodLabel(this.rows()));

  private summarise(rows: PeriodRow[]) {
    if (!rows.length) {
      return { occupancy: 0, occupied: 0, billed: 0, collected: 0, collectRate: 0, pending: 0 };
    }
    const billed = rows.reduce((s, r) => s + r.billed, 0);
    const collected = rows.reduce((s, r) => s + r.collected, 0);
    return {
      occupancy: rows.reduce((s, r) => s + r.occupancy, 0) / rows.length,
      occupied: Math.round(rows.reduce((s, r) => s + r.occupied, 0) / rows.length),
      billed,
      collected,
      collectRate: billed ? (collected / billed) * 100 : 0,
      pending: rows.reduce((s, r) => s + r.leaves.pending, 0),
    };
  }

  protected readonly current = computed(() => this.summarise(this.rows()));
  private readonly prior = computed(() =>
    this.priorRows().length ? this.summarise(this.priorRows()) : null,
  );

  /** Hero figure: the one number this report leads with. */
  protected readonly hero = computed(() => {
    const { start, end } = this.window();
    const prior = this.prior();
    return {
      value: this.fmtPct(this.current().occupancy),
      occupied: this.current().occupied,
      capacity: this.rows()[0]?.capacity ?? 0,
      delta: prior ? this.deltaPoints(this.current().occupancy, prior.occupancy, true) : null,
      spark: this.sparkline(
        this.allRows().map((r) => r.occupancy),
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
        key: 'collected',
        label: 'Collected',
        value: this.compactPeso(cur.collected),
        detail: `of ${this.compactPeso(cur.billed)} billed`,
        delta: prior ? this.deltaPercent(cur.collected, prior.collected, true) : null,
        spark: this.sparkline(
          all.map((r) => r.collected),
          start,
          end,
        ),
      },
      {
        key: 'collect-rate',
        label: 'Collection rate',
        value: this.fmtPct(cur.collectRate),
        detail: `${this.fmtPeso(cur.billed - cur.collected)} outstanding`,
        delta: prior ? this.deltaPoints(cur.collectRate, prior.collectRate, true) : null,
        spark: this.sparkline(
          all.map((r) => (r.billed ? (r.collected / r.billed) * 100 : 0)),
          start,
          end,
        ),
      },
      {
        key: 'occupants',
        label: 'Occupants in residence',
        value: this.fmtInt(cur.occupied),
        detail: 'monthly average',
        delta: prior ? this.deltaPercent(cur.occupied, prior.occupied, true) : null,
        spark: this.sparkline(
          all.map((r) => r.occupied),
          start,
          end,
        ),
      },
      {
        key: 'pending',
        label: 'Leave requests pending',
        value: this.fmtInt(cur.pending),
        detail: 'awaiting dean or parent',
        // More pending approvals is worse, so the delta colour inverts here.
        delta: prior ? this.deltaPercent(cur.pending, prior.pending, false) : null,
        spark: this.sparkline(
          all.map((r) => r.leaves.pending),
          start,
          end,
        ),
      },
    ];
  });

  // --- Chart 1: occupancy trend (single series, so the title carries identity) ---

  protected readonly trend = computed(() => {
    const rows = this.rows();
    const w = 960;
    const h = 300;
    // Gutters sized for the largest tick label at the mobile type scale, not just desktop.
    const pad = { l: 74, r: 94, t: 24, b: 40 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    const values = rows.map((r) => r.occupancy);
    const scale = this.niceScale(Math.min(...values) - 2, Math.max(...values) + 2, 0, 100);
    const span = scale.hi - scale.lo || 1;

    const xAt = (i: number) =>
      rows.length === 1 ? pad.l + plotW / 2 : pad.l + (i / (rows.length - 1)) * plotW;
    const yAt = (v: number) => pad.t + plotH - ((v - scale.lo) / span) * plotH;

    const points = rows.map((row, i) => ({ row, x: xAt(i), y: yAt(row.occupancy), index: i }));
    const line = points
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const base = (pad.t + plotH).toFixed(1);
    const area = `${line} L${points[points.length - 1].x.toFixed(1)},${base} L${points[0].x.toFixed(1)},${base} Z`;

    const band = plotW / Math.max(1, rows.length - 1);
    const hit = points.map((p) => ({
      index: p.index,
      x: Math.max(pad.l, p.x - band / 2),
      w: Math.min(band, w - pad.r - Math.max(pad.l, p.x - band / 2)),
    }));

    const yTicks = scale.values.map((v) => ({ y: yAt(v), label: `${Math.round(v)}%` }));
    const peak = points.reduce((best, p) => (p.row.occupancy > best.row.occupancy ? p : best));
    const last = points[points.length - 1];

    return {
      w,
      h,
      pad,
      plotW,
      plotH,
      points,
      hit,
      line,
      area,
      yTicks,
      last,
      // Only annotate the peak when it is not the endpoint, so labels never stack.
      peak: peak.index === last.index ? null : peak,
    };
  });

  // --- Chart 2: billed vs collected (two series of one measure, on one axis) ---

  protected readonly billing = computed(() => {
    const rows = this.rows();
    const w = 560;
    const h = 320;
    const pad = { l: 64, r: 12, t: 20, b: 44 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    const scale = this.niceScale(0, Math.max(...rows.map((r) => r.billed)));
    const yAt = (v: number) => pad.t + plotH - (v / scale.hi) * plotH;

    const band = plotW / rows.length;
    const barW = Math.min(24, (band - 8) / 2 - 1);
    const groupW = barW * 2 + 2; // 2px surface gap between the touching pair

    const groups = rows.map((row, i) => {
      const left = pad.l + band * i + (band - groupW) / 2;
      const floor = pad.t + plotH;
      return {
        row,
        index: i,
        centre: pad.l + band * i + band / 2,
        anchorY: yAt(row.billed),
        hit: { x: pad.l + band * i, w: band },
        bars: [
          {
            label: 'Billed',
            color: PALETTE.blue,
            path: this.barPath(left, yAt(row.billed), barW, floor - yAt(row.billed)),
          },
          {
            label: 'Collected',
            color: PALETTE.orange,
            path: this.barPath(
              left + barW + 2,
              yAt(row.collected),
              barW,
              floor - yAt(row.collected),
            ),
          },
        ],
      };
    });

    const yTicks = scale.values.map((v) => ({ y: yAt(v), label: this.compactPeso(v) }));
    return { w, h, pad, plotW, plotH, groups, yTicks };
  });

  // --- Chart 3: leave requests by status (part-to-whole, fixed stack order) ---

  protected readonly leaves = computed(() => {
    const rows = this.rows();
    const w = 560;
    const h = 320;
    const pad = { l: 44, r: 12, t: 32, b: 44 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    const domain = this.niceScale(0, Math.max(...rows.map((r) => r.leaveTotal)));
    const scale = plotH / domain.hi;
    const floor = pad.t + plotH;
    const band = plotW / rows.length;
    const barW = Math.min(24, band - 10);

    const columns = rows.map((row, i) => {
      const left = pad.l + band * i + (band - barW) / 2;
      const filled = LEAVE_SERIES.filter((s) => row.leaves[s.key] > 0);
      let cursor = floor;

      const segments = filled.map((s, si) => {
        const raw = row.leaves[s.key] * scale;
        const top = cursor - raw;
        // A 2px surface gap — not a stroke — separates touching segments.
        const gap = si === filled.length - 1 ? 0 : 2;
        const height = Math.max(1, raw - gap);
        const isCap = si === filled.length - 1;
        cursor = top;
        return {
          key: s.key,
          label: s.label,
          color: s.color,
          value: row.leaves[s.key],
          path: isCap
            ? this.barPath(left, top, barW, height)
            : this.barPath(left, top + gap, barW, height, 0),
        };
      });

      return {
        row,
        index: i,
        centre: pad.l + band * i + band / 2,
        capY: cursor,
        hit: { x: pad.l + band * i, w: band },
        segments,
      };
    });

    const yTicks = domain.values.map((v) => ({
      y: floor - v * scale,
      label: this.fmtInt(Math.round(v)),
    }));
    return { w, h, pad, plotW, plotH, columns, yTicks };
  });

  // --- Chart 4: occupancy heatmap, building x floor (sequential single hue) ---

  protected readonly heatLegend = PALETTE.seq.map((color, i) => ({
    color,
    label: ['under 60', '60–70', '70–80', '80–90', '90–97', '97+'][i],
    ink: i >= 3 ? '#ffffff' : '#1e293b',
  }));

  protected readonly heatmap = computed(() =>
    (this.report()?.floors ?? []).map((floor) => {
      const bin = this.heatBin(floor.occupancy);
      return {
        floor: floor.floor,
        capacity: floor.capacity,
        occupied: floor.occupied,
        value: Math.round(floor.occupancy),
        color: PALETTE.seq[bin],
        // The label sits inside the fill, so its ink follows the fill's luminance.
        ink: bin >= 3 ? '#ffffff' : '#1e293b',
      };
    }),
  );

  private heatBin(value: number): number {
    if (value < 60) return 0;
    if (value < 70) return 1;
    if (value < 80) return 2;
    if (value < 90) return 3;
    if (value < 97) return 4;
    return 5;
  }

  // --- Detail listing ---

  protected readonly detail = computed(() => {
    const floors = this.report()?.floors ?? [];
    const capacity = floors.reduce((s, f) => s + f.capacity, 0);
    const occupied = floors.reduce((s, f) => s + f.occupied, 0);
    return {
      rows: floors,
      total: {
        capacity,
        occupied,
        occupancy: capacity ? (occupied / capacity) * 100 : 0,
      },
    };
  });

  // --- Hover / focus. Keyboard focus shows exactly what hover shows. ---

  protected showTrendTip(index: number): void {
    const geo = this.trend();
    const point = geo.points[index];
    this.trendIndex.set(index);
    this.trendTip.set({
      left: (point.x / geo.w) * 100,
      top: (point.y / geo.h) * 100,
      align: this.alignFor(point.x / geo.w),
      below: point.y / geo.h < 0.3,
      title: point.row.longLabel,
      rows: [
        { label: 'Occupancy', value: this.fmtPct(point.row.occupancy), color: PALETTE.blue },
        {
          label: 'Occupants',
          value: `${this.fmtInt(point.row.occupied)} of ${this.fmtInt(point.row.capacity)}`,
        },
      ],
    });
  }

  protected showBillingTip(index: number): void {
    const geo = this.billing();
    const group = geo.groups[index];
    this.billingIndex.set(index);
    this.billingTip.set({
      left: (group.centre / geo.w) * 100,
      top: (group.anchorY / geo.h) * 100,
      align: this.alignFor(group.centre / geo.w),
      below: group.anchorY / geo.h < 0.3,
      title: group.row.longLabel,
      rows: [
        { label: 'Billed', value: this.fmtPeso(group.row.billed), color: PALETTE.blue },
        { label: 'Collected', value: this.fmtPeso(group.row.collected), color: PALETTE.orange },
        {
          label: 'Outstanding',
          value: this.fmtPeso(group.row.billed - group.row.collected),
        },
      ],
    });
  }

  protected showLeaveTip(index: number): void {
    const geo = this.leaves();
    const column = geo.columns[index];
    // Anchored above the cap total so the tooltip never lands on that direct label.
    const anchorY = column.capY - 14;
    this.leaveIndex.set(index);
    this.leaveTip.set({
      left: (column.centre / geo.w) * 100,
      top: (anchorY / geo.h) * 100,
      align: this.alignFor(column.centre / geo.w),
      below: anchorY / geo.h < 0.3,
      title: `${column.row.longLabel} · ${this.fmtInt(column.row.leaveTotal)} requests`,
      rows: LEAVE_SERIES.map((s) => ({
        label: s.label,
        value: this.fmtInt(column.row.leaves[s.key]),
        color: s.color,
      })),
    });
  }

  protected clearTrendTip(): void {
    this.trendIndex.set(null);
    this.trendTip.set(null);
  }

  protected clearBillingTip(): void {
    this.billingIndex.set(null);
    this.billingTip.set(null);
  }

  protected clearLeaveTip(): void {
    this.leaveIndex.set(null);
    this.leaveTip.set(null);
  }

  private exportCsv(): void {
    this.downloadCsv(`dorm-overview-${this.range()}.csv`, [
      ['Dormitory overview report', this.periodLabel()],
      [],
      ['Month', 'Capacity', 'Occupants', 'Occupancy %', 'Billed', 'Collected', 'Leave requests'],
      ...this.rows().map((r) => [
        r.longLabel,
        r.capacity,
        r.occupied,
        r.occupancy.toFixed(1),
        r.billed,
        r.collected,
        r.leaveTotal,
      ]),
      [],
      ['Floor', 'Capacity', 'Occupants', 'Occupancy %'],
      ...this.detail().rows.map((r) => [
        `Floor ${r.floor}`,
        r.capacity,
        r.occupied,
        r.occupancy.toFixed(1),
      ]),
    ]);
  }
}
