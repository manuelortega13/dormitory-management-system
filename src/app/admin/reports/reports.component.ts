import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../auth/auth.service';
import { ReportExportService } from './shared/report-export.service';
import { RANGES, RangeKey } from './shared/report-data';
import { OverviewReportComponent } from './overview-report/overview-report.component';
import { DeanReportComponent } from './dean-report/dean-report.component';
import { VpsasReportComponent } from './vpsas-report/vpsas-report.component';
import { BoReportComponent } from './bo-report/bo-report.component';

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

  protected readonly ranges = RANGES;

  protected readonly range = signal<RangeKey>('6m');

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

  protected readonly periodLabel = computed(
    () => RANGES.find((r) => r.key === this.range())?.label ?? '',
  );

  protected readonly comparisonLabel = computed(() => {
    const span = { '3m': 3, '6m': 6, '12m': 12, ytd: 0 }[this.range()];
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
