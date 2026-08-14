import { downloadCsv } from '../../../shared/utils/csv.util';
import { barPath, barPathH, niceScale } from './chart-geometry';

/**
 * Chart primitives shared by every report view.
 *
 * The palette slots come from a colourblind-safe categorical set whose ordering was
 * validated for adjacent-pair separation against a white surface. Do not re-order,
 * substitute or extend the slots without re-validating: `aqua` and `yellow` already sit
 * below 3:1 contrast on white, so any chart using them must also carry a legend, direct
 * labels or a table view — never colour alone.
 */
export const PALETTE = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  red: '#e34948',
  /** Reserved for the men's/women's wing split, so it never collides with the outcome pair. */
  violet: '#4a3aa7',
  /** Single-hue sequential ramp, light -> dark, for continuous magnitude. */
  seq: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'],
  grid: '#e2e8f0',
  axis: '#cbd5e1',
  muted: '#94a3b8',
  deemph: '#dbe2ea',
  surface: '#ffffff',
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export interface Tooltip {
  /** Anchor position as a percentage of the plot box. */
  left: number;
  top: number;
  align: 'start' | 'center' | 'end';
  /** Flip under the anchor when there is no room above, so the card never clips it. */
  below: boolean;
  title: string;
  rows: TooltipRow[];
}

export interface Delta {
  text: string;
  /** null when the change is neutral or there is nothing to compare against. */
  good: boolean | null;
}

export interface Sparkline {
  w: number;
  h: number;
  base: string;
  accent: string;
  end: Point;
  /** False when there are too few points to draw a line worth showing. */
  visible: boolean;
}

/**
 * Geometry and formatting helpers every report component inherits. Kept as a base class
 * rather than free functions so templates can call them directly.
 */
export abstract class ReportBase {
  protected readonly palette = PALETTE;

  // Geometry lives in chart-geometry.ts so the builders and the components share one
  // implementation; these thin wrappers keep it reachable from component code.
  protected readonly barPath = barPath;
  protected readonly barPathH = barPathH;
  protected readonly niceScale = niceScale;

  /** Sparkline: the whole seeded year recessive, the selected slice in the accent hue. */
  protected sparkline(values: number[], start: number, end: number): Sparkline {
    const w = 104;
    const h = 30;
    const p = 4;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const step = values.length > 1 ? (w - p * 2) / (values.length - 1) : 0;

    const pts = values.map((v, i) => ({
      x: p + step * i,
      y: h - p - ((v - lo) / span) * (h - p * 2),
    }));
    const d = (list: Point[]) =>
      list.map((pt, i) => `${i ? 'L' : 'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');

    return {
      w,
      h,
      base: d(pts),
      accent: d(pts.slice(start, end)),
      end: pts[end - 1] ?? { x: p, y: h / 2 },
      visible: values.length > 1,
    };
  }

  protected alignFor(fraction: number): 'start' | 'center' | 'end' {
    if (fraction < 0.15) return 'start';
    if (fraction > 0.85) return 'end';
    return 'center';
  }

  protected deltaPoints(now: number, before: number, upIsGood: boolean): Delta {
    const change = now - before;
    return {
      text: `${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(1)} pts`,
      good: Math.abs(change) < 0.05 ? null : change > 0 === upIsGood,
    };
  }

  protected deltaPercent(now: number, before: number, upIsGood: boolean): Delta {
    if (!before) return { text: 'new', good: null };
    const change = ((now - before) / before) * 100;
    return {
      text: `${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(1)}%`,
      good: Math.abs(change) < 0.05 ? null : change > 0 === upIsGood,
    };
  }

  protected fmtInt(value: number): string {
    return Math.round(value).toLocaleString('en-PH');
  }

  protected fmtPeso(value: number): string {
    return `₱${Math.round(value).toLocaleString('en-PH')}`;
  }

  protected compactPeso(value: number): string {
    if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `₱${Math.round(value / 1_000)}K`;
    return `₱${Math.round(value)}`;
  }

  protected fmtPct(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  protected fmtHours(value: number): string {
    return `${value.toFixed(1)} h`;
  }

  // Axis-tick formatters. They take the tick step so a compressed domain gains a decimal
  // instead of printing the same rounded label on several gridlines.
  protected pctTick(value: number, step: number): string {
    return step < 1 ? `${value.toFixed(1)}%` : `${Math.round(value)}%`;
  }

  protected hourTick(value: number, step: number): string {
    return step < 1 ? `${value.toFixed(1)}h` : `${Math.round(value)}h`;
  }

  /** Serialise a grid of cells to CSV and hand it to the browser as a download. */
  protected downloadCsv(filename: string, rows: (string | number)[][]): void {
    downloadCsv(filename, rows);
  }
}
