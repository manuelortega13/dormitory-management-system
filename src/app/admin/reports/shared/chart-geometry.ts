/**
 * Pure SVG geometry for the report charts.
 *
 * Mark specs are fixed here rather than per component: bars cap at 24px with a 4px rounded
 * data-end and a square baseline, stacked segments are separated by a 2px surface gap
 * (never a stroke), and axis domains snap to round tick values.
 */

export interface Pad {
  l: number;
  r: number;
  t: number;
  b: number;
}

export interface Axis {
  w: number;
  h: number;
  pad: Pad;
  plotW: number;
  plotH: number;
}

export interface Tick {
  y: number;
  label: string;
}

const BAR_CAP = 24;
const SEGMENT_GAP = 2;

/** Column/bar path: 4px rounded data-end, square at the baseline. */
export function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  const base = y + h;
  return (
    `M${x.toFixed(1)},${base.toFixed(1)}` +
    `L${x.toFixed(1)},${(y + rr).toFixed(1)}` +
    `Q${x.toFixed(1)},${y.toFixed(1)} ${(x + rr).toFixed(1)},${y.toFixed(1)}` +
    `L${(x + w - rr).toFixed(1)},${y.toFixed(1)}` +
    `Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + rr).toFixed(1)}` +
    `L${(x + w).toFixed(1)},${base.toFixed(1)}Z`
  );
}

/** Horizontal bar path: rounded at the value end, square at the baseline. */
export function barPathH(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.max(0, Math.min(r, h / 2, w));
  const end = x + w;
  return (
    `M${x.toFixed(1)},${y.toFixed(1)}` +
    `L${(end - rr).toFixed(1)},${y.toFixed(1)}` +
    `Q${end.toFixed(1)},${y.toFixed(1)} ${end.toFixed(1)},${(y + rr).toFixed(1)}` +
    `L${end.toFixed(1)},${(y + h - rr).toFixed(1)}` +
    `Q${end.toFixed(1)},${(y + h).toFixed(1)} ${(end - rr).toFixed(1)},${(y + h).toFixed(1)}` +
    `L${x.toFixed(1)},${(y + h).toFixed(1)}Z`
  );
}

/**
 * Axis domain snapped so ticks land on round numbers (0 / 1,000 / 2,000 …). The ticks carry
 * every value that is not directly labelled, so they have to read cleanly.
 */
export function niceScale(min: number, max: number, floor = -Infinity, ceiling = Infinity) {
  const target = 5;
  const raw = Math.max((max - min) / target, Number.EPSILON);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;

  const lo = Math.max(floor, Math.floor(min / step) * step);
  const hi = Math.min(ceiling, Math.ceil(max / step) * step);

  const values: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) {
    values.push(Number(v.toPrecision(12)));
  }
  return { lo, hi, step, values };
}

// --- Line / area ---

export interface LinePoint<T> {
  row: T;
  index: number;
  x: number;
  y: number;
}

export interface LineGeo<T> extends Axis {
  points: LinePoint<T>[];
  hit: { index: number; x: number; w: number }[];
  line: string;
  area: string;
  yTicks: Tick[];
  last: LinePoint<T>;
  /** Null when the extreme is already the endpoint, so direct labels never stack. */
  peak: LinePoint<T> | null;
}

export function buildLine<T>(
  rows: T[],
  opts: {
    value: (row: T) => number;
    /** Receives the tick step so a compressed domain can add decimals instead of repeating. */
    tickLabel: (v: number, step: number) => string;
    w?: number;
    h?: number;
    pad?: Partial<Pad>;
    /** Force the domain to start at zero instead of hugging the data. */
    zeroBased?: boolean;
    /**
     * Smallest domain width to show. A series that barely moves (a rate parked near 95%)
     * would otherwise be plotted on a hair-thin axis, turning noise into apparent signal.
     */
    minSpan?: number;
    floor?: number;
    ceiling?: number;
  },
): LineGeo<T> {
  const w = opts.w ?? 560;
  const h = opts.h ?? 300;
  const pad: Pad = { l: 52, r: 60, t: 24, b: 40, ...opts.pad };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const values = rows.map(opts.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const spread = hi - lo;
  const padding = spread === 0 ? Math.max(1, Math.abs(values[0] ?? 1) * 0.1) : spread * 0.15;

  let domainLo = opts.zeroBased ? 0 : lo - padding;
  let domainHi = hi + padding;
  const minSpan = opts.minSpan ?? 0;
  if (domainHi - domainLo < minSpan) {
    const mid = (hi + lo) / 2;
    domainLo = opts.zeroBased ? 0 : mid - minSpan / 2;
    domainHi = mid + minSpan / 2;
  }

  const scale = niceScale(domainLo, domainHi, opts.floor ?? -Infinity, opts.ceiling ?? Infinity);
  const span = scale.hi - scale.lo || 1;

  const xAt = (i: number) =>
    rows.length === 1 ? pad.l + plotW / 2 : pad.l + (i / (rows.length - 1)) * plotW;
  const yAt = (v: number) => pad.t + plotH - ((v - scale.lo) / span) * plotH;

  const points = rows.map((row, index) => ({ row, index, x: xAt(index), y: yAt(opts.value(row)) }));
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const base = (pad.t + plotH).toFixed(1);
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${base} L${points[0].x.toFixed(1)},${base} Z`;

  const band = plotW / Math.max(1, rows.length - 1);
  const hit = points.map((p) => {
    const x = Math.max(pad.l, p.x - band / 2);
    return { index: p.index, x, w: Math.min(band, w - pad.r - x) };
  });

  const last = points[points.length - 1];
  const peak = points.reduce((best, p) => (opts.value(p.row) > opts.value(best.row) ? p : best));

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
    yTicks: scale.values.map((v) => ({ y: yAt(v), label: opts.tickLabel(v, scale.step) })),
    last,
    peak: peak.index === last.index ? null : peak,
  };
}

// --- Stacked columns ---

export interface StackSeries {
  key: string;
  label: string;
  color: string;
}

export interface StackSegment {
  key: string;
  label: string;
  color: string;
  value: number;
  path: string;
}

export interface StackColumn<T> {
  row: T;
  index: number;
  centre: number;
  /** Y of the top of the stack, where the total is direct-labelled. */
  capY: number;
  total: number;
  hit: { x: number; w: number };
  segments: StackSegment[];
}

export interface StackedColumnGeo<T> extends Axis {
  columns: StackColumn<T>[];
  yTicks: Tick[];
}

export function buildStackedColumns<T>(
  rows: T[],
  series: StackSeries[],
  opts: {
    value: (row: T, key: string) => number;
    tickLabel: (v: number) => string;
    w?: number;
    h?: number;
    pad?: Partial<Pad>;
  },
): StackedColumnGeo<T> {
  const w = opts.w ?? 560;
  const h = opts.h ?? 320;
  const pad: Pad = { l: 48, r: 12, t: 32, b: 44, ...opts.pad };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const totals = rows.map((row) => series.reduce((sum, s) => sum + opts.value(row, s.key), 0));
  const domain = niceScale(0, Math.max(...totals, 1));
  const unit = plotH / domain.hi;
  const floor = pad.t + plotH;
  const band = plotW / rows.length;
  const barW = Math.min(BAR_CAP, band - 10);

  const columns = rows.map((row, index) => {
    const left = pad.l + band * index + (band - barW) / 2;
    const filled = series.filter((s) => opts.value(row, s.key) > 0);
    let cursor = floor;

    const segments = filled.map((s, si) => {
      const raw = opts.value(row, s.key) * unit;
      const top = cursor - raw;
      const isCap = si === filled.length - 1;
      // A 2px surface gap — not a stroke — separates touching segments.
      const gap = isCap ? 0 : SEGMENT_GAP;
      cursor = top;
      return {
        key: s.key,
        label: s.label,
        color: s.color,
        value: opts.value(row, s.key),
        path: isCap
          ? barPath(left, top, barW, Math.max(1, raw - gap))
          : barPath(left, top + gap, barW, Math.max(1, raw - gap), 0),
      };
    });

    return {
      row,
      index,
      centre: pad.l + band * index + band / 2,
      capY: cursor,
      total: totals[index],
      hit: { x: pad.l + band * index, w: band },
      segments,
    };
  });

  return {
    w,
    h,
    pad,
    plotW,
    plotH,
    columns,
    yTicks: domain.values.map((v) => ({ y: floor - v * unit, label: opts.tickLabel(v) })),
  };
}

// --- Horizontal stacked bars (part-to-whole with long row names) ---

export interface HBarSegment {
  key: string;
  label: string;
  color: string;
  value: number;
  path: string;
  /** Centre of the segment, for an inline label when one fits. */
  centre: number;
  /** Only true when the rendered text fits inside the segment with padding. */
  fits: boolean;
  ink: string;
}

export interface HBarRow<T> {
  row: T;
  index: number;
  label: string;
  y: number;
  centreY: number;
  total: number;
  /** X of the end of the bar, where the total is direct-labelled. */
  endX: number;
  hit: { y: number; h: number };
  segments: HBarSegment[];
}

export interface HBarGeo<T> extends Axis {
  rows: HBarRow<T>[];
  barH: number;
}

export function buildStackedBarsH<T>(
  rows: T[],
  series: StackSeries[],
  opts: {
    label: (row: T) => string;
    value: (row: T, key: string) => number;
    /** Rendered text for an inline segment label; measured before it is placed. */
    segmentLabel?: (value: number) => string;
    /** Ink for a label sitting inside the fill, chosen by the fill's luminance. */
    ink?: (key: string) => string;
    w?: number;
    h?: number;
    pad?: Partial<Pad>;
    /** Thickness of each bar and the air between them. Fewer rows want thicker bars. */
    barH?: number;
    gapY?: number;
  },
): HBarGeo<T> {
  const w = opts.w ?? 560;
  const pad: Pad = { l: 120, r: 56, t: 12, b: 12, ...opts.pad };
  const barH = opts.barH ?? 26;
  const gapY = opts.gapY ?? 18;
  const h = opts.h ?? pad.t + pad.b + rows.length * barH + Math.max(0, rows.length - 1) * gapY;
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const totals = rows.map((row) => series.reduce((sum, s) => sum + opts.value(row, s.key), 0));
  const max = Math.max(...totals, 1);

  const built = rows.map((row, index) => {
    const y = pad.t + index * (barH + gapY);
    const filled = series.filter((s) => opts.value(row, s.key) > 0);
    let cursor = pad.l;

    const segments = filled.map((s, si) => {
      const raw = (opts.value(row, s.key) / max) * plotW;
      const isEnd = si === filled.length - 1;
      const gap = isEnd ? 0 : SEGMENT_GAP;
      const width = Math.max(1, raw - gap);
      const x = cursor;
      cursor += raw;

      const text = opts.segmentLabel?.(opts.value(row, s.key)) ?? '';
      // ~6.2px per glyph at 11px; only label inside when it fits with padding both sides.
      const fits = text.length > 0 && width >= text.length * 6.2 + 14;

      return {
        key: s.key,
        label: s.label,
        color: s.color,
        value: opts.value(row, s.key),
        path: isEnd ? barPathH(x, y, width, barH) : barPathH(x, y, width, barH, 0),
        centre: x + width / 2,
        fits,
        ink: opts.ink?.(s.key) ?? '#ffffff',
      };
    });

    return {
      row,
      index,
      label: opts.label(row),
      y,
      centreY: y + barH / 2,
      total: totals[index],
      endX: pad.l + (totals[index] / max) * plotW,
      hit: { y: y - gapY / 2, h: barH + gapY },
      segments,
    };
  });

  return { w, h, pad, plotW, plotH, rows: built, barH };
}

// --- Grouped stacked columns (one stack per group, side by side, per row) ---

export interface StackGroup {
  key: string;
  label: string;
  /** One or two characters printed under each bar, so the groups are never colour-only. */
  short: string;
}

export interface GroupedBar {
  groupKey: string;
  groupLabel: string;
  short: string;
  centre: number;
  /** Y of the top of this stack, where its total is direct-labelled. */
  capY: number;
  total: number;
  segments: StackSegment[];
}

export interface GroupedColumn<T> {
  row: T;
  index: number;
  centre: number;
  total: number;
  hit: { x: number; w: number };
  bars: GroupedBar[];
}

export interface GroupedStackGeo<T> extends Axis {
  columns: GroupedColumn<T>[];
  yTicks: Tick[];
}

/**
 * Adds a second categorical dimension without spending a second colour channel: colour
 * still encodes the series (the outcome), while the group is carried by position plus a
 * printed short label under each bar. Every group shares one y axis, so the stacks are
 * directly comparable.
 */
export function buildGroupedStacks<T>(
  rows: T[],
  groups: StackGroup[],
  series: StackSeries[],
  opts: {
    value: (row: T, groupKey: string, seriesKey: string) => number;
    tickLabel: (v: number) => string;
    w?: number;
    h?: number;
    pad?: Partial<Pad>;
  },
): GroupedStackGeo<T> {
  const w = opts.w ?? 960;
  const h = opts.h ?? 340;
  const pad: Pad = { l: 64, r: 16, t: 32, b: 56, ...opts.pad };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const totalOf = (row: T, groupKey: string) =>
    series.reduce((sum, s) => sum + opts.value(row, groupKey, s.key), 0);

  const peak = Math.max(...rows.flatMap((row) => groups.map((g) => totalOf(row, g.key))), 1);
  const domain = niceScale(0, peak);
  const unit = plotH / domain.hi;
  const floor = pad.t + plotH;

  const band = plotW / rows.length;
  const barW = Math.min(BAR_CAP, Math.max(6, (band - 16) / groups.length - SEGMENT_GAP));
  const groupW = barW * groups.length + SEGMENT_GAP * (groups.length - 1);

  const columns = rows.map((row, index) => {
    const groupLeft = pad.l + band * index + (band - groupW) / 2;

    const bars = groups.map((group, gi) => {
      const left = groupLeft + gi * (barW + SEGMENT_GAP);
      const filled = series.filter((s) => opts.value(row, group.key, s.key) > 0);
      let cursor = floor;

      const segments = filled.map((s, si) => {
        const raw = opts.value(row, group.key, s.key) * unit;
        const top = cursor - raw;
        const isCap = si === filled.length - 1;
        const gap = isCap ? 0 : SEGMENT_GAP;
        cursor = top;
        return {
          key: s.key,
          label: s.label,
          color: s.color,
          value: opts.value(row, group.key, s.key),
          path: isCap
            ? barPath(left, top, barW, Math.max(1, raw - gap))
            : barPath(left, top + gap, barW, Math.max(1, raw - gap), 0),
        };
      });

      return {
        groupKey: group.key,
        groupLabel: group.label,
        short: group.short,
        centre: left + barW / 2,
        capY: cursor,
        total: totalOf(row, group.key),
        segments,
      };
    });

    return {
      row,
      index,
      centre: pad.l + band * index + band / 2,
      total: bars.reduce((sum, b) => sum + b.total, 0),
      hit: { x: pad.l + band * index, w: band },
      bars,
    };
  });

  return {
    w,
    h,
    pad,
    plotW,
    plotH,
    columns,
    yTicks: domain.values.map((v) => ({ y: floor - v * unit, label: opts.tickLabel(v) })),
  };
}

// --- Multi-series line ---

export interface LineSeriesSpec<T> {
  key: string;
  label: string;
  color: string;
  /**
   * Return null where the measure is undefined for that row — a month with no decisions
   * has no approval rate. Nulls break the line instead of being plotted as zero, which
   * would state "0% approved" where the truth is "nothing was decided".
   */
  value: (row: T) => number | null;
}

export interface LineSeriesGeo<T> {
  key: string;
  label: string;
  color: string;
  /** One entry per row; `y` is null where the series has no value for that row. */
  points: (LinePoint<T> & { defined: boolean })[];
  /** Path with gaps: each run of consecutive defined points is its own sub-path. */
  line: string;
  /** The newest defined point, or null when the series is empty. */
  last: (LinePoint<T> & { defined: boolean }) | null;
}

export interface MultiLineGeo<T> extends Axis {
  rows: T[];
  series: LineSeriesGeo<T>[];
  hit: { index: number; x: number; w: number }[];
  yTicks: Tick[];
}

/**
 * Two or more lines on one shared axis. No area wash here — a fill only reads honestly
 * with a single series, and stacked translucent fills misstate the values underneath.
 */
export function buildLines<T>(
  rows: T[],
  series: LineSeriesSpec<T>[],
  opts: {
    tickLabel: (v: number, step: number) => string;
    w?: number;
    h?: number;
    pad?: Partial<Pad>;
    minSpan?: number;
    floor?: number;
    ceiling?: number;
  },
): MultiLineGeo<T> {
  const w = opts.w ?? 560;
  const h = opts.h ?? 300;
  const pad: Pad = { l: 52, r: 60, t: 24, b: 40, ...opts.pad };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const all = rows
    .flatMap((row) => series.map((s) => s.value(row)))
    .filter((v): v is number => v !== null && Number.isFinite(v));

  // Every series may be empty on a fresh install; fall back to a plain 0-1 axis.
  const lo = all.length ? Math.min(...all) : 0;
  const hi = all.length ? Math.max(...all) : 1;
  const spread = hi - lo;
  const padding = spread === 0 ? Math.max(1, Math.abs(hi) * 0.1) : spread * 0.15;

  let domainLo = lo - padding;
  let domainHi = hi + padding;
  const minSpan = opts.minSpan ?? 0;
  if (domainHi - domainLo < minSpan) {
    const mid = (hi + lo) / 2;
    domainLo = mid - minSpan / 2;
    domainHi = mid + minSpan / 2;
  }

  const scale = niceScale(domainLo, domainHi, opts.floor ?? -Infinity, opts.ceiling ?? Infinity);
  const span = scale.hi - scale.lo || 1;

  const xAt = (i: number) =>
    rows.length === 1 ? pad.l + plotW / 2 : pad.l + (i / (rows.length - 1)) * plotW;
  const yAt = (v: number) => pad.t + plotH - ((v - scale.lo) / span) * plotH;

  const built = series.map((spec) => {
    const points = rows.map((row, index) => {
      const value = spec.value(row);
      const defined = value !== null && Number.isFinite(value);
      return {
        row,
        index,
        x: xAt(index),
        y: defined ? yAt(value as number) : pad.t + plotH,
        defined,
      };
    });

    // Break the path wherever the series is undefined rather than bridging the gap.
    let line = '';
    let penDown = false;
    for (const point of points) {
      if (!point.defined) {
        penDown = false;
        continue;
      }
      line += `${penDown ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      penDown = true;
    }

    const defined = points.filter((p) => p.defined);
    return {
      key: spec.key,
      label: spec.label,
      color: spec.color,
      points,
      line,
      last: defined.length ? defined[defined.length - 1] : null,
    };
  });

  const band = plotW / Math.max(1, rows.length - 1);
  const hit = rows.map((_, index) => {
    const x = Math.max(pad.l, xAt(index) - band / 2);
    return { index, x, w: Math.min(band, w - pad.r - x) };
  });

  return {
    w,
    h,
    pad,
    plotW,
    plotH,
    rows,
    series: built,
    hit,
    yTicks: scale.values.map((v) => ({ y: yAt(v), label: opts.tickLabel(v, scale.step) })),
  };
}
