import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { downloadCsv } from '../../shared/utils/csv.util';
import {
  CheckLogEntry,
  CheckLogReport,
  DayRange,
  GuardReportService,
  ScanSource,
} from '../data/guard-report.service';

/**
 * Reporting periods. These mirror the admin reports so the two read the same way, with
 * Today added: a guard's question is usually about the shift they are standing in, not the
 * quarter. Every preset resolves to an explicit day range before it reaches the API, so
 * there is no client-side slicing of a fixed window.
 */
type PeriodKey = 'today' | '3m' | '6m' | '12m' | 'ytd' | 'custom';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '3m', label: 'Last 3 months' },
  { key: '6m', label: 'Last 6 months' },
  { key: '12m', label: 'Last 12 months' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'custom', label: 'Custom range' },
];

const SOURCES: { key: ScanSource; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'leave', label: 'Leave request' },
  { key: 'gatepass', label: 'Gatepass' },
];

const DAY_FORMAT = new Intl.DateTimeFormat('en-PH', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** "2026-08-14" in local time — the day the guard is actually standing in, not UTC's. */
function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "2026-08-14" -> "14 Aug 2026", matching how dates read elsewhere in the app. */
function formatDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : DAY_FORMAT.format(date);
}

/**
 * Guard report: every entry and exit recorded at the gate, filtered by period and by what
 * the resident was let out on. The page is the log — no charts — so it carries the list
 * itself, a tally above it, and the same list again in the CSV and the printed sheet.
 */
@Component({
  selector: 'app-guard-report',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './guard-report.component.html',
  styleUrl: './guard-report.component.scss',
})
export class GuardReportComponent {
  private readonly reports = inject(GuardReportService);

  protected readonly periods = PERIODS;
  protected readonly sources = SOURCES;

  protected readonly period = signal<PeriodKey>('today');
  protected readonly source = signal<ScanSource>('all');

  protected readonly customFrom = signal<string>('');
  protected readonly customTo = signal<string>('');

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly report = signal<CheckLogReport | null>(null);
  protected readonly exporting = signal(false);

  protected readonly isCustom = computed(() => this.period() === 'custom');

  /**
   * The days the report covers. Null only while a custom range is half-filled or reversed,
   * which is the one state with nothing sensible to ask the API for.
   */
  protected readonly range = computed<DayRange | null>(() => {
    const today = new Date();
    const to = isoDay(today);

    switch (this.period()) {
      case 'today':
        return { from: to, to };
      case 'ytd':
        return { from: `${today.getFullYear()}-01-01`, to };
      case 'custom': {
        const from = this.customFrom();
        const until = this.customTo();
        if (!from || !until || from > until) return null;
        return { from, to: until };
      }
      default: {
        // "Last 3 months" is the current month plus the two before it, so the window starts
        // on the first of that month rather than the same day three months back.
        const span = { '3m': 3, '6m': 6, '12m': 12 }[this.period() as '3m' | '6m' | '12m'];
        const start = new Date(today.getFullYear(), today.getMonth() - (span - 1), 1);
        return { from: isoDay(start), to };
      }
    }
  });

  protected readonly customHint = computed(() => {
    if (!this.isCustom()) return '';
    const from = this.customFrom();
    const to = this.customTo();
    if (!from || !to) return 'Pick a start and end date.';
    if (from > to) return 'The start date must not be after the end date.';
    return '';
  });

  protected readonly periodLabel = computed(() => {
    const range = this.range();
    if (!range) return 'No period selected';
    if (range.from === range.to) return formatDay(range.from);
    return `${formatDay(range.from)} – ${formatDay(range.to)}`;
  });

  protected readonly sourceLabel = computed(
    () => SOURCES.find((s) => s.key === this.source())?.label ?? 'All',
  );

  constructor() {
    // One effect covers both filters: either changing them asks the API for a new window.
    effect(() => {
      const range = this.range();
      const source = this.source();
      if (!range) return;
      void this.load(range, source);
    });
  }

  protected async load(
    range: DayRange | null = this.range(),
    source: ScanSource = this.source(),
  ): Promise<void> {
    if (!range) return;
    this.state.set('loading');
    try {
      this.report.set(await this.reports.getCheckLogs(range, source));
      this.state.set('ready');
    } catch (error) {
      console.error('Failed to load the entry and exit logs', error);
      this.state.set('error');
    }
  }

  protected readonly logs = computed(() => this.report()?.logs ?? []);

  protected readonly isEmpty = computed(() => this.state() === 'ready' && !this.logs().length);

  protected readonly tiles = computed(() => {
    const stats = this.report()?.stats ?? { entries: 0, exits: 0 };
    return [
      { key: 'exits', label: 'Exits', value: stats.exits, detail: 'residents let out' },
      { key: 'entries', label: 'Entries', value: stats.entries, detail: 'residents returned' },
      {
        key: 'total',
        label: 'Total scans',
        value: stats.exits + stats.entries,
        detail: 'movements recorded',
      },
    ];
  });

  /**
   * "Latest 100 of 412 scans". The tally above counts every scan in the window, so without
   * this the truncated list reads as the full set and will not reconcile.
   */
  protected readonly logCaption = computed(() => {
    const report = this.report();
    if (!report) return '';
    const shown = Math.min(report.logLimit, report.logTotal);
    return report.logTotal > shown
      ? `Latest ${shown} of ${report.logTotal} scans`
      : `All ${report.logTotal} scans`;
  });

  /** Rows staged for printing. Rendered only while a print is in flight. */
  protected readonly printRows = signal<CheckLogEntry[] | null>(null);

  /**
   * Every scan in the window, not the capped list on screen — an export that stopped at the
   * screen's cap would under-report the period.
   */
  private async fetchAll(): Promise<CheckLogEntry[] | null> {
    const range = this.range();
    if (!range) return null;
    this.exporting.set(true);
    try {
      return (await this.reports.getCheckLogs(range, this.source(), true)).logs;
    } catch (error) {
      console.error('Failed to list the entry and exit logs for export', error);
      return null;
    } finally {
      this.exporting.set(false);
    }
  }

  protected async exportCsv(): Promise<void> {
    const logs = await this.fetchAll();
    if (!logs?.length) return;
    const range = this.range();

    downloadCsv(`entry-exit-logs-${range?.from}_to_${range?.to}.csv`, [
      [
        'Date & time',
        'Direction',
        'Occupant',
        'Room',
        'Type',
        'Reference',
        'Destination',
        'Purpose',
        'Method',
        'Recorded by',
        'Notes',
      ],
      ...logs.map((entry) => [
        entry.at,
        entry.direction,
        entry.occupant,
        entry.room,
        entry.source,
        entry.reference,
        entry.destination,
        entry.purpose,
        entry.method,
        entry.recordedBy,
        entry.notes,
      ]),
    ]);
  }

  /**
   * Prints the same thing the CSV exports. Printing the page as it appears would carry the
   * filter controls and a capped list rather than the period's movements.
   */
  protected async printReport(): Promise<void> {
    const logs = await this.fetchAll();
    if (!logs?.length) return;

    this.printRows.set(logs);
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
}
