import { toDateOnly, isDateInRange, doesRangeOverlap } from './date-filter.util';

describe('date-filter util', () => {
  describe('toDateOnly', () => {
    it('passes through a date-only value', () => {
      expect(toDateOnly('2026-08-04')).toBe('2026-08-04');
    });

    it('takes the calendar day from an ISO timestamp without shifting it', () => {
      // A late-evening timestamp must stay on its own day, not roll over in UTC.
      expect(toDateOnly('2026-08-04T23:30:00.000Z')).toBe('2026-08-04');
    });

    it('returns null for missing or unparseable values', () => {
      expect(toDateOnly(null)).toBeNull();
      expect(toDateOnly(undefined)).toBeNull();
      expect(toDateOnly('')).toBeNull();
      expect(toDateOnly('not a date')).toBeNull();
    });
  });

  describe('isDateInRange', () => {
    it('matches everything when no bounds are set', () => {
      expect(isDateInRange('2026-08-04', '', '')).toBe(true);
      expect(isDateInRange(null, '', '')).toBe(true);
    });

    it('honours an open-ended lower bound', () => {
      expect(isDateInRange('2026-08-04', '2026-08-01', '')).toBe(true);
      expect(isDateInRange('2026-07-31', '2026-08-01', '')).toBe(false);
    });

    it('honours an open-ended upper bound', () => {
      expect(isDateInRange('2026-08-04', '', '2026-08-07')).toBe(true);
      expect(isDateInRange('2026-08-08', '', '2026-08-07')).toBe(false);
    });

    it('is inclusive on both bounds', () => {
      expect(isDateInRange('2026-08-01', '2026-08-01', '2026-08-07')).toBe(true);
      expect(isDateInRange('2026-08-07', '2026-08-01', '2026-08-07')).toBe(true);
    });

    it('excludes records with no usable date once a bound is set', () => {
      expect(isDateInRange(null, '2026-08-01', '')).toBe(false);
    });
  });

  describe('doesRangeOverlap', () => {
    const from = '2026-08-03';
    const to = '2026-08-07';

    it('matches a period that starts before the window and ends inside it', () => {
      expect(doesRangeOverlap('2026-07-30', '2026-08-04', from, to)).toBe(true);
    });

    it('matches a period that starts inside the window and ends after it', () => {
      expect(doesRangeOverlap('2026-08-06', '2026-08-12', from, to)).toBe(true);
    });

    it('matches a period that spans the whole window', () => {
      expect(doesRangeOverlap('2026-07-01', '2026-09-01', from, to)).toBe(true);
    });

    it('matches a period entirely inside the window', () => {
      expect(doesRangeOverlap('2026-08-04', '2026-08-05', from, to)).toBe(true);
    });

    it('rejects a period entirely before or after the window', () => {
      expect(doesRangeOverlap('2026-07-01', '2026-08-02', from, to)).toBe(false);
      expect(doesRangeOverlap('2026-08-08', '2026-08-10', from, to)).toBe(false);
    });

    it('is inclusive at the edges', () => {
      expect(doesRangeOverlap('2026-08-01', '2026-08-03', from, to)).toBe(true);
      expect(doesRangeOverlap('2026-08-07', '2026-08-09', from, to)).toBe(true);
    });

    it('treats a missing end as a single-day period', () => {
      expect(doesRangeOverlap('2026-08-04', null, from, to)).toBe(true);
      expect(doesRangeOverlap('2026-08-20', null, from, to)).toBe(false);
    });

    it('copes with start and end stored the wrong way round', () => {
      expect(doesRangeOverlap('2026-08-05', '2026-08-04', from, to)).toBe(true);
    });

    it('matches everything when no bounds are set', () => {
      expect(doesRangeOverlap('2026-01-01', '2026-01-02', '', '')).toBe(true);
    });
  });
});
