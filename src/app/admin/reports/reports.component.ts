import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../auth/auth.service';
import { ReportExportService } from './shared/report-export.service';
import { CustomRange, RANGES, RANGES_WITH_CUSTOM, RangeKey } from './shared/report-data';
import { OverviewReportComponent } from './overview-report/overview-report.component';
import { DeanReportComponent } from './dean-report/dean-report.component';
import { VpsasReportComponent } from './vpsas-report/vpsas-report.component';
import { BoReportComponent } from './bo-report/bo-report.component';

const DAY_FORMAT = new Intl.DateTimeFormat('en-PH', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** "2026-03-01" -> "01 Mar 2026", matching how dates read elsewhere in the app. */
function formatDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : DAY_FORMAT.format(date);
}

interface RoleCopy {
  title: string;
  subtitle: string;
  badge: string;
}

const ROLE_COPY: Record<string, RoleCopy> = {
  home_dean: {
    title: 'Decisions report',
    subtitle: "Leave requests and gatepasses the dean's office has approved or rejected",
    badge: 'Home Dean',
  },
  vpsas: {
    title: 'My decisions report',
    subtitle: 'Leave requests and gatepasses you approved or rejected personally',
    badge: 'VPSAS',
  },
  business_officer: {
    title: 'Payments report',
    subtitle: 'Payment transactions, the verification queue and collection performance',
    badge: 'Business Officer',
  },
  admin: {
    title: 'Dormitory overview',
    subtitle: 'Occupancy, collections and leave activity across every building',
    badge: 'Administrator',
  },
};

/**
 * Reports shell. It owns the one filter row that scopes every chart on the page, then hands
 * the selection to the report view for the signed-in role — the dean and VP see decisions,
 * the business officer sees payments, the admin sees the dorm-wide overview.
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    FormsModule,
    OverviewReportComponent,
    DeanReportComponent,
    VpsasReportComponent,
    BoReportComponent,
  ],
  providers: [ReportExportService],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private readonly auth = inject(AuthService);
  private readonly exporter = inject(ReportExportService);

  protected readonly range = signal<RangeKey>('6m');

  // Only the decisions endpoint accepts an explicit day range, so the custom option is
  // offered where it actually works rather than presented everywhere and ignored.
  protected readonly ranges = computed(() =>
    this.role() === 'home_dean' ? RANGES_WITH_CUSTOM : RANGES,
  );

  protected readonly customFrom = signal<string>('');
  protected readonly customTo = signal<string>('');

  protected readonly isCustom = computed(() => this.range() === 'custom');

  /** Null until both ends are set and ordered — the report keeps its last valid window. */
  protected readonly customRange = computed<CustomRange | null>(() => {
    if (!this.isCustom()) return null;
    const from = this.customFrom();
    const to = this.customTo();
    if (!from || !to || from > to) return null;
    return { from, to };
  });

  protected readonly customHint = computed(() => {
    if (!this.isCustom()) return '';
    const from = this.customFrom();
    const to = this.customTo();
    if (!from || !to) return 'Pick a start and end date.';
    if (from > to) return 'The start date must not be after the end date.';
    return '';
  });

  private readonly currentUser = this.auth.getCurrentUser();

  protected readonly role = signal<User['role'] | null>(this.currentUser?.role ?? null);

  /**
   * A home dean is attached to one wing. The report must honour that: `leave-request`
   * already restricts a dean's queue to `u.gender = deanType`, and the report follows the
   * same rule so a male dean is never shown a female occupant's data (and vice versa).
   * Null means the dean is not restricted and sees both wings.
   */
  protected readonly deanType = signal<'male' | 'female' | null>(
    this.currentUser?.deanType ?? null,
  );

  protected readonly copy = computed(() => {
    const base = ROLE_COPY[this.role() ?? 'admin'] ?? ROLE_COPY['admin'];
    const wing = this.deanType();
    // Make the scope visible in the header, so it is obvious which wing the page covers.
    if (this.role() === 'home_dean' && wing) {
      const label = wing === 'male' ? "Men's wing" : "Women's wing";
      return { ...base, subtitle: `${base.subtitle} — ${label}`, badge: `Home Dean · ${label}` };
    }
    return base;
  });

  protected readonly periodLabel = computed(() => {
    const custom = this.customRange();
    if (custom) return `${formatDay(custom.from)} – ${formatDay(custom.to)}`;
    // Custom is selected but not yet usable, so the report is still showing the full
    // window. Name what is on screen rather than the control that is mid-edit.
    if (this.isCustom()) return 'Last 12 months';
    return this.ranges().find((r) => r.key === this.range())?.label ?? '';
  });

  protected readonly comparisonLabel = computed(() => {
    // A custom window has no defined "previous period" of the same shape, so the tiles
    // drop their deltas rather than compare against something arbitrary.
    if (this.isCustom()) return 'no prior period to compare';
    const span = { '3m': 3, '6m': 6, '12m': 12, ytd: 0, custom: 0 }[this.range()];
    // Twelve months is the whole window the API returns, so there is nothing before it.
    return !span || span >= 12 ? 'no prior period to compare' : `vs previous ${span} months`;
  });

  protected exportCsv(): void {
    this.exporter.run();
  }

  protected printReport(): void {
    window.print();
  }
}
