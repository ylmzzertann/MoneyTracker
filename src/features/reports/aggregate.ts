import type { ReportRow, TxKind } from '@/db/types';
import { dayKey, eachDay, monthKey, type DateRange } from '@/lib/dates';
import { convertMinor, type RateTable } from '@/lib/fx';

export type GroupBy = 'category' | 'merchant' | 'account' | 'channel';

export type Converted = ReportRow & { baseMinor: number };

/** Converts every row to the base currency; rows without a rate are counted, not guessed. */
export function convertRows(
  rows: ReportRow[],
  baseCurrency: string,
  rates: RateTable,
): { rows: Converted[]; missing: number } {
  const out: Converted[] = [];
  let missing = 0;
  for (const r of rows) {
    const baseMinor = convertMinor(r.amountMinor, r.currency, baseCurrency, rates);
    if (baseMinor === null) {
      missing++;
      continue;
    }
    out.push({ ...r, baseMinor });
  }
  return { rows: out, missing };
}

export type Totals = { expense: number; income: number; net: number; expenseCount: number; incomeCount: number };

export function totals(rows: Converted[]): Totals {
  let expense = 0;
  let income = 0;
  const expenseTx = new Set<string>();
  const incomeTx = new Set<string>();
  for (const r of rows) {
    if (r.kind === 'expense') {
      expense += r.baseMinor;
      expenseTx.add(r.transactionId);
    } else {
      income += r.baseMinor;
      incomeTx.add(r.transactionId);
    }
  }
  return { expense, income, net: income - expense, expenseCount: expenseTx.size, incomeCount: incomeTx.size };
}

export type GroupItem = { key: string; total: number; count: number; share: number };

/**
 * Groups rows of one kind. `parentOf` rolls sub-categories up into their
 * parent (e.g. Electricity -> Bills & utilities) when grouping by category.
 */
export function groupRows(
  rows: Converted[],
  kind: TxKind,
  by: GroupBy,
  parentOf?: (categoryId: string) => string | null,
): GroupItem[] {
  const map = new Map<string, { total: number; tx: Set<string> }>();
  let sum = 0;
  for (const r of rows) {
    if (r.kind !== kind) continue;
    let key: string;
    switch (by) {
      case 'category':
        key = parentOf?.(r.categoryId) ?? r.categoryId;
        break;
      case 'merchant':
        key = r.merchantName ?? '';
        break;
      case 'account':
        key = r.accountId;
        break;
      case 'channel':
        key = r.channel ?? '';
        break;
    }
    const entry = map.get(key) ?? { total: 0, tx: new Set<string>() };
    entry.total += r.baseMinor;
    entry.tx.add(r.transactionId);
    map.set(key, entry);
    sum += r.baseMinor;
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, total: v.total, count: v.tx.size, share: sum > 0 ? v.total / sum : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Keeps the top `max - 1` groups and folds the rest into one "other" bucket. */
export function foldSmallGroups(items: GroupItem[], max: number, otherKey = '__other__'): GroupItem[] {
  if (items.length <= max) return items;
  const head = items.slice(0, max - 1);
  const tail = items.slice(max - 1);
  const other = tail.reduce(
    (acc, i) => ({ key: otherKey, total: acc.total + i.total, count: acc.count + i.count, share: acc.share + i.share }),
    { key: otherKey, total: 0, count: 0, share: 0 },
  );
  return [...head, other];
}

export type SeriesPoint = { key: string; total: number };

export function dailySeries(rows: Converted[], kind: TxKind, range: DateRange): SeriesPoint[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== kind) continue;
    const k = dayKey(r.occurredAt);
    byDay.set(k, (byDay.get(k) ?? 0) + r.baseMinor);
  }
  return eachDay(range).map((d) => {
    const k = dayKey(d);
    return { key: k, total: byDay.get(k) ?? 0 };
  });
}

export function monthlySeries(rows: Converted[], kind: TxKind, months: Date[]): SeriesPoint[] {
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== kind) continue;
    const k = monthKey(r.occurredAt);
    byMonth.set(k, (byMonth.get(k) ?? 0) + r.baseMinor);
  }
  return months.map((m) => {
    const k = monthKey(m);
    return { key: k, total: byMonth.get(k) ?? 0 };
  });
}

/** Percentage change rounded to an integer; null when there is no previous value. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
