import type { Frequency } from '@/db/types';
import { addDays, dayKey, parseLocalISO, startOfDay } from '@/lib/dates';

export type Schedule = { frequency: Frequency; interval: number; anchorDay: number | null };

export const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/** `months` later on the anchor day, or the month's last day when the month is shorter (31 → 28 → 31). */
export function addMonthsAnchored(d: Date, months: number, anchorDay: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const day = Math.min(anchorDay, daysInMonth(target.getFullYear(), target.getMonth()));
  return new Date(target.getFullYear(), target.getMonth(), day, d.getHours(), d.getMinutes(), d.getSeconds());
}

/** The due date after `key` ("YYYY-MM-DD"). */
export function nextDate(key: string, s: Schedule): string {
  const d = parseLocalISO(key);
  const interval = Math.max(1, s.interval);
  if (s.frequency === 'week') return dayKey(addDays(d, 7 * interval));
  const months = s.frequency === 'year' ? 12 * interval : interval;
  return dayKey(addMonthsAnchored(d, months, s.anchorDay ?? d.getDate()));
}

/** Due dates from `first` up to and including `until`. */
export function occurrences(first: string, s: Schedule, until: string, max = 60): string[] {
  const out: string[] = [];
  let k = first;
  while (k <= until && out.length < max) {
    out.push(k);
    k = nextDate(k, s);
  }
  return out;
}

/** Moves a due date forward until it is on or after `today`. */
export function catchUp(key: string, s: Schedule, today: Date): string {
  const t = dayKey(today);
  let k = key;
  for (let i = 0; i < 1000 && k < t; i++) k = nextDate(k, s);
  return k;
}

export function perYear(amountMinor: number, s: Pick<Schedule, 'frequency' | 'interval'>): number {
  const interval = Math.max(1, s.interval);
  const times = s.frequency === 'week' ? 52 / interval : s.frequency === 'month' ? 12 / interval : 1 / interval;
  return Math.round(amountMinor * times);
}

export function perMonth(amountMinor: number, s: Pick<Schedule, 'frequency' | 'interval'>): number {
  return Math.round(perYear(amountMinor, s) / 12);
}

/** Whole days from today to `key`; negative when it is in the past. */
export function daysUntil(key: string, now = new Date()): number {
  return Math.round((parseLocalISO(key).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

/** The next date on or after `from` that falls on `day` of the month (clamped in short months). */
export function nextMonthDay(day: number, from = new Date()): string {
  const start = startOfDay(from);
  const thisMonth = new Date(start.getFullYear(), start.getMonth(), Math.min(day, daysInMonth(start.getFullYear(), start.getMonth())));
  return dayKey(thisMonth >= start ? thisMonth : addMonthsAnchored(thisMonth, 1, day));
}
