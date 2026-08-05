/**
 * Date-range filtering shared by the admin Leave Requests and Gatepass pages.
 *
 * Everything works on plain YYYY-MM-DD strings rather than Date objects: the API returns
 * a mix of date-only values (start_date) and full timestamps (created_at), and comparing
 * the calendar day as text avoids timezone shifts that would drop a request from the
 * range it visibly belongs to.
 */

/** Normalise an API date or timestamp to YYYY-MM-DD, or null when unusable. */
export function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;

  // Already date-only, or an ISO timestamp we can slice.
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (iso) return iso[1];

  // Fall back to parsing (e.g. "Aug 4, 2026"), using local parts so the day is not
  // shifted by toISOString()'s UTC conversion.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

/**
 * True when `value`'s calendar day falls inside [from, to]. An empty bound is open-ended,
 * so no bounds means everything matches. A value with no usable date is excluded once a
 * bound is set — it cannot be shown to satisfy the filter.
 */
export function isDateInRange(value: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;

  const day = toDateOnly(value);
  if (!day) return false;

  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/**
 * True when the period [start, end] overlaps [from, to] — used for "show me leave
 * happening in this window", which should include a leave that starts before the window
 * and ends inside it. A missing end is treated as a same-day period.
 */
export function doesRangeOverlap(
  start: string | null | undefined,
  end: string | null | undefined,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true;

  const startDay = toDateOnly(start);
  const endDay = toDateOnly(end) ?? startDay;
  if (!startDay || !endDay) return false;

  // Guard against records where the two dates are stored the wrong way round.
  const periodStart = startDay <= endDay ? startDay : endDay;
  const periodEnd = startDay <= endDay ? endDay : startDay;

  if (to && periodStart > to) return false;
  if (from && periodEnd < from) return false;
  return true;
}
