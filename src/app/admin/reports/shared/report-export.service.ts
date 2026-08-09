import { Injectable } from '@angular/core';

/**
 * Lets the Reports shell own a single "Export CSV" button while the role-specific child
 * decides what a CSV of *its* report contains. The child registers its handler on init;
 * the shell just fires it.
 *
 * Provided by ReportsComponent, so each visit to the page gets a fresh registration.
 */
@Injectable()
export class ReportExportService {
  private handler: (() => void) | null = null;

  register(handler: () => void): void {
    this.handler = handler;
  }

  run(): void {
    this.handler?.();
  }
}
