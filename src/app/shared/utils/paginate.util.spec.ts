import { signal } from '@angular/core';
import { paginate } from './paginate.util';

/** 1..n, so a row's value doubles as its position in the unpaged list. */
const rows = (n: number) => Array.from({ length: n }, (_, index) => index + 1);

describe('paginate util', () => {
  it('slices the source into pages of the given size', () => {
    const source = signal(rows(25));
    const pager = paginate(source, 10);

    expect(pager.items()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(pager.total()).toBe(25);
    expect(pager.totalPages()).toBe(3);

    pager.goToPage(3);
    expect(pager.items()).toEqual([21, 22, 23, 24, 25]);
  });

  it('reports a single empty page for an empty source', () => {
    const pager = paginate(signal<number[]>([]), 10);

    expect(pager.items()).toEqual([]);
    expect(pager.total()).toBe(0);
    expect(pager.totalPages()).toBe(1);
    expect(pager.hasPrev()).toBe(false);
    expect(pager.hasNext()).toBe(false);
  });

  it('tracks the ends of the range', () => {
    const pager = paginate(signal(rows(25)), 10);

    expect(pager.hasPrev()).toBe(false);
    expect(pager.hasNext()).toBe(true);

    pager.next();
    expect(pager.page()).toBe(2);
    expect(pager.hasPrev()).toBe(true);

    pager.next();
    expect(pager.page()).toBe(3);
    expect(pager.hasNext()).toBe(false);

    // Already on the last page — next() must not walk past it.
    pager.next();
    expect(pager.page()).toBe(3);

    pager.prev();
    expect(pager.page()).toBe(2);
  });

  it('ignores a page number outside the range', () => {
    const pager = paginate(signal(rows(25)), 10);

    pager.goToPage(0);
    expect(pager.page()).toBe(1);

    pager.goToPage(4);
    expect(pager.page()).toBe(1);
  });

  it('clamps the current page when the source shrinks under it', () => {
    const source = signal(rows(25));
    const pager = paginate(source, 10);

    pager.goToPage(3);
    expect(pager.page()).toBe(3);

    // A filter (or a refresh) leaves one page of rows: the view must follow it back
    // instead of showing an empty page 3.
    source.set(rows(4));
    expect(pager.page()).toBe(1);
    expect(pager.items()).toEqual([1, 2, 3, 4]);
  });

  it('reset() returns to the first page', () => {
    const pager = paginate(signal(rows(25)), 10);

    pager.goToPage(3);
    pager.reset();
    expect(pager.page()).toBe(1);
  });

  it('lists every page while they fit in the window', () => {
    const pager = paginate(signal(rows(30)), 10);
    expect(pager.pageNumbers()).toEqual([1, 2, 3]);
  });

  it('slides a fixed-width window once the pages outgrow it', () => {
    const pager = paginate(signal(rows(100)), 10);

    expect(pager.pageNumbers()).toEqual([1, 2, 3, 4, 5]);

    pager.goToPage(5);
    expect(pager.pageNumbers()).toEqual([3, 4, 5, 6, 7]);

    // At the end the window stops rather than running past the last page.
    pager.goToPage(10);
    expect(pager.pageNumbers()).toEqual([6, 7, 8, 9, 10]);
  });
});
