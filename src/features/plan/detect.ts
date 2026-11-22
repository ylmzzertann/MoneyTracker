import type { HistoryTx } from '@/db/repos/transactions';
import type { TxKind } from '@/db/types';
import { dayKey, monthKey, parseLocalISO } from '@/lib/dates';
import { normalizeName } from '@/lib/text';

import { catchUp, nextDate } from './schedule';

export type RecurringCandidate = {
  /** Normalised merchant name; also the key for "don't suggest again". */
  key: string;
  name: string;
  kind: TxKind;
  amountMinor: number;
  currency: string;
  categoryId: string;
  accountId: string;
  /** How many months in a row it was seen. */
  months: number;
  nextDue: string;
};

const DAY = 86_400_000;

/**
 * Finds payments that look monthly: the same merchant, once a month, at least
 * three months in a row, roughly 4 weeks apart and within 20% of the same amount,
 * the last one less than 45 days ago. Merchants that already have a rule,
 * or that were dismissed, are skipped.
 */
export function detectRecurring(txs: HistoryTx[], skip: Set<string>, now = new Date()): RecurringCandidate[] {
  const groups = new Map<string, HistoryTx[]>();
  for (const tx of txs) {
    if (!tx.merchantName || tx.recurringRuleId || tx.installmentPlanId) continue;
    const name = normalizeName(tx.merchantName);
    if (!name || skip.has(name)) continue;
    const k = `${name}|${tx.currency}|${tx.kind}`;
    const list = groups.get(k) ?? [];
    list.push(tx);
    groups.set(k, list);
  }

  const out: RecurringCandidate[] = [];
  for (const [k, list] of groups) {
    const perMonth = new Map<string, HistoryTx[]>();
    for (const tx of list) {
      const m = monthKey(tx.occurredAt);
      perMonth.set(m, [...(perMonth.get(m) ?? []), tx]);
    }
    const months = [...perMonth.keys()].sort();
    if (months.length < 3) continue;
    const recent = months.slice(-3);
    // Subscriptions charge once a month; a shop visited every week is not one.
    if (recent.some((m) => perMonth.get(m)!.length > 1)) continue;
    const last3 = recent.map((m) => perMonth.get(m)![0]);
    const times = last3.map((tx) => parseLocalISO(tx.occurredAt).getTime());
    const gapsOk = times.slice(1).every((t, i) => {
      const gap = (t - times[i]) / DAY;
      return gap >= 20 && gap <= 40;
    });
    if (!gapsOk) continue;
    const amounts = last3.map((tx) => tx.amountMinor);
    if (Math.max(...amounts) > Math.min(...amounts) * 1.2) continue;
    const last = last3[2];
    if ((now.getTime() - times[2]) / DAY > 45) continue;

    const lastDay = parseLocalISO(last.occurredAt);
    const schedule = { frequency: 'month' as const, interval: 1, anchorDay: lastDay.getDate() };
    const counts = new Map<string, number>();
    for (const tx of last3) counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
    const categoryId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    let run = 1;
    for (let i = months.length - 1; i > 0 && run < months.length; i--) {
      const [y, m] = months[i].split('-').map(Number);
      const prev = monthKey(new Date(y, m - 2, 1));
      if (months[i - 1] !== prev) break;
      run++;
    }
    out.push({
      key: k.split('|')[0],
      name: last.merchantName!,
      kind: last.kind,
      amountMinor: last.amountMinor,
      currency: last.currency,
      categoryId,
      accountId: last.accountId,
      months: run,
      nextDue: catchUp(nextDate(dayKey(lastDay), schedule), schedule, now),
    });
  }
  return out.sort((a, b) => b.amountMinor - a.amountMinor);
}

export type PriceChange = { ruleId: string; from: number; to: number; pct: number };

/** Recurring payments whose latest amount is at least 3% above the one before. */
export function priceIncreases(payments: { ruleId: string; amountMinor: number; occurredAt: string }[]): PriceChange[] {
  const byRule = new Map<string, { amountMinor: number; occurredAt: string }[]>();
  for (const p of payments) byRule.set(p.ruleId, [...(byRule.get(p.ruleId) ?? []), p]);
  const out: PriceChange[] = [];
  for (const [ruleId, list] of byRule) {
    if (list.length < 2) continue;
    const [latest, previous] = [...list].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    if (previous.amountMinor > 0 && latest.amountMinor >= previous.amountMinor * 1.03) {
      out.push({
        ruleId,
        from: previous.amountMinor,
        to: latest.amountMinor,
        pct: Math.round(((latest.amountMinor - previous.amountMinor) / previous.amountMinor) * 100),
      });
    }
  }
  return out;
}
