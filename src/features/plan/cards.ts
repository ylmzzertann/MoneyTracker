import { addDays, startOfDay, type DateRange } from '@/lib/dates';

import { daysInMonth } from './schedule';

const onDay = (year: number, month: number, day: number) => new Date(year, month, Math.min(day, daysInMonth(year, month)));

export type CardCycle = {
  /** The last closed statement: (previous close, last close]. */
  lastStatement: DateRange;
  /** The open period that closes on `nextClose`. */
  current: DateRange;
  lastClose: Date;
  nextClose: Date;
  /** Payment due date of the last closed statement. */
  lastDue: Date;
  /** Payment due date of the statement that is still open. */
  nextDue: Date;
};

/**
 * Statement periods of a credit card from its statement (closing) day and
 * payment due day. A due day after the statement day falls in the same month,
 * otherwise in the next one (e.g. closes on the 28th, due on the 5th).
 */
export function cardCycle(statementDay: number, dueDay: number, now = new Date()): CardCycle {
  const today = startOfDay(now);
  let nextClose = onDay(today.getFullYear(), today.getMonth(), statementDay);
  if (nextClose < today) nextClose = onDay(today.getFullYear(), today.getMonth() + 1, statementDay);
  const lastClose = onDay(nextClose.getFullYear(), nextClose.getMonth() - 1, statementDay);
  const prevClose = onDay(nextClose.getFullYear(), nextClose.getMonth() - 2, statementDay);
  const dueFor = (close: Date) => onDay(close.getFullYear(), close.getMonth() + (dueDay > statementDay ? 0 : 1), dueDay);
  return {
    lastStatement: { start: addDays(prevClose, 1), end: addDays(lastClose, 1) },
    current: { start: addDays(lastClose, 1), end: addDays(nextClose, 1) },
    lastClose,
    nextClose,
    lastDue: dueFor(lastClose),
    nextDue: dueFor(nextClose),
  };
}
