import { addMonths, dayKey, parseLocalISO, startOfDay } from '@/lib/dates';

export type GoalProgress = {
  share: number;
  remaining: number;
  /** Whole months left until the target date; null without a date. */
  monthsLeft: number | null;
  /** What to put aside each month to make it; null without a date or when the date has passed. */
  perMonth: number | null;
  done: boolean;
  overdue: boolean;
};

export function goalProgress(targetMinor: number, savedMinor: number, targetDate: string | null, now = new Date()): GoalProgress {
  const remaining = Math.max(0, targetMinor - savedMinor);
  const share = targetMinor > 0 ? Math.max(0, savedMinor / targetMinor) : 0;
  const done = targetMinor > 0 && savedMinor >= targetMinor;
  if (!targetDate) return { share, remaining, monthsLeft: null, perMonth: null, done, overdue: false };

  const d = parseLocalISO(targetDate);
  const overdue = !done && startOfDay(d) < startOfDay(now);
  let months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  if (d.getDate() < now.getDate()) months -= 1;
  const monthsLeft = overdue ? 0 : Math.max(1, months);
  return {
    share,
    remaining,
    monthsLeft,
    perMonth: done ? 0 : overdue ? null : Math.ceil(remaining / monthsLeft),
    done,
    overdue,
  };
}

/** Deadline choices on the goal form, in months from today; 0 = no deadline. */
export const GOAL_HORIZONS = [0, 3, 6, 12, 24, 36] as const;

export function targetDateIn(months: number, now = new Date()): string | null {
  return months > 0 ? dayKey(addMonths(startOfDay(now), months)) : null;
}
