import { Signal, computed, signal } from '@angular/core';

/**
 * Client-side pagination for the admin list pages.
 *
 * These pages load their whole list once and filter it in the component (search boxes,
 * status/floor dropdowns, date ranges), so the page slice has to come after filtering —
 * unlike the Payments page, whose API takes page/limit and returns the count.
 */

/** How many numbered page buttons the pager shows at once. */
const MAX_PAGE_BUTTONS = 5;

/** Everything the pager bar needs; the list itself is not part of it. */
export interface PaginatorControls {
  page: Signal<number>;
  totalPages: Signal<number>;
  total: Signal<number>;
  hasPrev: Signal<boolean>;
  hasNext: Signal<boolean>;
  pageNumbers: Signal<number[]>;
  goToPage(page: number): void;
  next(): void;
  prev(): void;
  reset(): void;
}

export interface Paginator<T> extends PaginatorControls {
  /** The rows of the current page. */
  items: Signal<T[]>;
}

/**
 * Wrap an already-filtered list signal in a paginator. Call `reset()` from the page's
 * filter handlers so a new search starts at page 1.
 */
export function paginate<T>(source: Signal<T[]>, pageSize = 10): Paginator<T> {
  const requestedPage = signal(1);

  const total = computed(() => source().length);
  const totalPages = computed(() => Math.max(1, Math.ceil(total() / pageSize)));

  // Clamped on read rather than stored, so a filter — or a background refresh that
  // drops rows — can never leave the view stranded on a page that no longer exists.
  const page = computed(() => Math.min(requestedPage(), totalPages()));

  const items = computed(() => {
    const start = (page() - 1) * pageSize;
    return source().slice(start, start + pageSize);
  });

  const pageNumbers = computed(() => {
    const pages = totalPages();
    if (pages <= MAX_PAGE_BUTTONS) {
      return Array.from({ length: pages }, (_, index) => index + 1);
    }

    // Keep the current page centred until the window runs into either end of the range.
    const half = Math.floor(MAX_PAGE_BUTTONS / 2);
    const end = Math.min(pages, Math.max(page() + half, MAX_PAGE_BUTTONS));
    const start = end - MAX_PAGE_BUTTONS + 1;
    return Array.from({ length: MAX_PAGE_BUTTONS }, (_, index) => start + index);
  });

  const goToPage = (next: number): void => {
    if (next >= 1 && next <= totalPages()) requestedPage.set(next);
  };

  return {
    items,
    page,
    totalPages,
    total,
    hasPrev: computed(() => page() > 1),
    hasNext: computed(() => page() < totalPages()),
    pageNumbers,
    goToPage,
    next: () => goToPage(page() + 1),
    prev: () => goToPage(page() - 1),
    reset: () => requestedPage.set(1),
  };
}
