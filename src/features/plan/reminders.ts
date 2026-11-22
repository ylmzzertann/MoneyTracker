import { addDays, parseLocalISO } from '@/lib/dates';

import type { Upcoming } from './upcoming';

export type Reminder = { id: string; date: Date; title: string; body: string; url: string };

type Opts = {
  hour: number;
  now: Date;
  t: (key: string, options?: Record<string, unknown>) => string;
  money: (minor: number, currency: string) => string;
  /** How early card payment reminders come. */
  cardDaysBefore?: number;
  max?: number;
};

const at = (dueKey: string, daysBefore: number, hour: number) => {
  const d = addDays(parseLocalISO(dueKey), -daysBefore);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0);
};

/** Turns upcoming payments into dated reminder texts. Past times are dropped; at most `max` (iOS keeps 64). */
export function buildReminders(items: Upcoming[], { hour, now, t, money, cardDaysBefore = 2, max = 60 }: Opts): Reminder[] {
  const when = (days: number) => (days <= 0 ? t('notifications.today') : days === 1 ? t('notifications.tomorrow') : t('notifications.inDays', { count: days }));
  const out: Reminder[] = [];
  for (const item of items) {
    if (item.type === 'rule') {
      const { rule } = item;
      if (rule.remindDays === null || item.days < 0) continue;
      const date = at(item.due, rule.remindDays, hour);
      if (date <= now) continue;
      const lead = Math.min(rule.remindDays, item.days);
      const body = t(rule.kind === 'income' ? 'notifications.incomeBody' : 'notifications.billBody', { when: when(lead) });
      out.push({
        id: `rule:${item.key}`,
        date,
        title: `${rule.name} · ${money(rule.amountMinor, rule.currency)}`,
        body: rule.autoPost ? `${body} ${t('notifications.autoNote')}` : body,
        url: '/plan/recurring',
      });
    } else {
      let lead = cardDaysBefore;
      let date = at(item.due, lead, hour);
      if (date <= now) {
        lead = 0;
        date = at(item.due, 0, hour);
      }
      if (date <= now) continue;
      out.push({
        id: `card:${item.key}`,
        date,
        title: t('notifications.cardTitle', { card: item.card.account.name }),
        body: item.closed
          ? t('notifications.cardBody', { amount: money(item.amount, item.card.account.currency), when: when(lead) })
          : t('notifications.cardOpenBody', { when: when(lead) }),
        url: '/plan/cards',
      });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, max);
}
