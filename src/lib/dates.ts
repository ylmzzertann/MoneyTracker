/**
 * Date helpers. Transaction times are stored as local wall-clock strings
 * ("YYYY-MM-DDTHH:mm:ss") so that grouping by day/month never shifts with
 * time zones. Range ends are exclusive.
 */

export type WeekStart = 0 | 1; // 0 = Sunday (US), 1 = Monday (TR, most of Europe)
export type PeriodKind = 'week' | 'month' | 'year';
export type DateRange = { start: Date; end: Date };

const pad2 = (n: number) => String(n).padStart(2, '0');

export function toLocalISO(d: Date): string {
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

export function parseLocalISO(s: string): Date {
  const [datePart, timePart = '00:00:00'] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss);
}

export function dayKey(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function monthKey(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 7);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
}

export function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay));
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function periodRange(kind: PeriodKind, anchor: Date, weekStart: WeekStart = 1): DateRange {
  if (kind === 'year') {
    return { start: new Date(anchor.getFullYear(), 0, 1), end: new Date(anchor.getFullYear() + 1, 0, 1) };
  }
  if (kind === 'month') {
    return {
      start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
      end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1),
    };
  }
  const day = startOfDay(anchor);
  const diff = (day.getDay() - weekStart + 7) % 7;
  const start = addDays(day, -diff);
  return { start, end: addDays(start, 7) };
}

export function shiftAnchor(kind: PeriodKind, anchor: Date, delta: number): Date {
  if (kind === 'year') return new Date(anchor.getFullYear() + delta, anchor.getMonth(), 1);
  if (kind === 'month') return new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
  return addDays(startOfDay(anchor), delta * 7);
}

/** Every day in [start, end). */
export function eachDay(range: DateRange): Date[] {
  const days: Date[] = [];
  for (let d = startOfDay(range.start); d < range.end; d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}

/** The first day of each of the `count` months ending with the anchor's month. */
export function lastMonths(anchor: Date, count: number): Date[] {
  const months: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(new Date(anchor.getFullYear(), anchor.getMonth() - i, 1));
  }
  return months;
}

/** True when the range contains today (used to disable "next" on the current period). */
export function rangeContainsToday(range: DateRange, now = new Date()): boolean {
  return now >= range.start && now < range.end;
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
export function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dtfCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, options);
    } catch {
      f = new Intl.DateTimeFormat('en-US', options);
    }
    dtfCache.set(key, f);
  }
  return f;
}

export function formatPeriodLabel(kind: PeriodKind, range: DateRange, locale: string): string {
  if (kind === 'year') return String(range.start.getFullYear());
  if (kind === 'month') {
    return dateFormatter(locale, { month: 'long', year: 'numeric' }).format(range.start);
  }
  const last = addDays(range.end, -1);
  const f = dateFormatter(locale, { day: 'numeric', month: 'short' });
  return `${f.format(range.start)} – ${f.format(last)}`;
}

/** Days remaining in the period including today; 0 if the period is in the past. */
export function daysLeftInRange(range: DateRange, now = new Date()): number {
  if (now >= range.end) return 0;
  const from = now < range.start ? range.start : startOfDay(now);
  return Math.round((range.end.getTime() - from.getTime()) / 86_400_000);
}
