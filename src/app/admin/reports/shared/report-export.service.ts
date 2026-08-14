import { Injectable } from '@angular/core';

/**
 * Lets the Reports shell own single "Export CSV" and "Print / PDF" buttons while the
 * role-specific child decides what an export of *its* report contains. The child registers
 * its handlers on init; the shell just fires them.
 *
 * Print falls back to `window.print()` when a view has not registered anything, so a role
 * that only wants the page as it appears needs no extra code.
 *
 * Provided by ReportsComponent, so each visit to the page gets a fresh registration.
 */
@Injectable()
export class ReportExportService {
  private csvHandler: (() => void) | null = null;
  private printHandler: (() => void | Promise<void>) | null = null;

  register(handler: () => void): void {
    this.csvHandler = handler;
  }

  registerPrint(handler: () => void | Promise<void>): void {
    this.printHandler = handler;
  }

  run(): void {
    this.csvHandler?.();
  }

  runPrint(): void {
    if (this.printHandler) {
      void this.printHandler();
      return;
    }
    window.print();
  }
}
