import type { RecurringRule } from '@/db/types';
import { addDays, dayKey, startOfDay } from '@/lib/dates';

import type { CardSummary } from './cardSummary';
import { daysUntil, occurrences } from './schedule';

export type Upcoming =
  | {
      type: 'rule';
      key: string;
      due: string;
      days: number;
      /** Only a rule's first open occurrence can be paid or skipped. */
      actionable: boolean;
      rule: RecurringRule;
    }
  | { type: 'card'; key: string; due: string; days: number; card: CardSummary; amount: number; closed: boolean };

/**
 * What is due in the next `horizonDays`: every occurrence of the active rules
 * (overdue ones first) and the payment dates of credit-card statements.
 */
export function buildUpcoming(rules: RecurringRule[], cards: CardSummary[], now = new Date(), horizonDays = 30): Upcoming[] {
  const today = dayKey(now);
  const until = dayKey(addDays(startOfDay(now), horizonDays));
  const out: Upcoming[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    occurrences(rule.nextDue, rule, until, 4).forEach((due, i) =>
      out.push({ type: 'rule', key: `${rule.id}:${due}`, due, days: daysUntil(due, now), actionable: i === 0, rule }),
    );
  }
  for (const card of cards) {
    const c = card.cycle;
    if (!c) continue;
    const lastDue = dayKey(c.lastDue);
    if (lastDue >= today && card.lastStatementAmount > 0) {
      out.push({ type: 'card', key: `${card.account.id}:${lastDue}`, due: lastDue, days: daysUntil(lastDue, now), card, amount: card.lastStatementAmount, closed: true });
    }
    const nextDue = dayKey(c.nextDue);
    if (nextDue <= until && card.currentAmount > 0) {
      out.push({ type: 'card', key: `${card.account.id}:${nextDue}`, due: nextDue, days: daysUntil(nextDue, now), card, amount: card.currentAmount, closed: false });
    }
  }
  return out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}
