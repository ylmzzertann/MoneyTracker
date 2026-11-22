import type { Converted } from '@/features/reports/aggregate';
import { daysLeftInRange, type DateRange } from '@/lib/dates';
import { currencyDecimals } from '@/lib/money';

export type BudgetState = 'ok' | 'warn' | 'over';
export const WARN_AT = 0.8;

export function budgetState(spent: number, limit: number): BudgetState {
  if (limit <= 0) return 'ok';
  const share = spent / limit;
  return share >= 1 ? 'over' : share >= WARN_AT ? 'warn' : 'ok';
}

export type BudgetPace = {
  /** Spent ÷ limit. */
  share: number;
  /** Share of the month that has gone by, today included. */
  expectedShare: number;
  /** Month-end spending if the current pace continues. */
  projected: number;
  /** Limit minus spent; negative when over. */
  remaining: number;
  /** What can still be spent per day for the rest of the month. */
  perDay: number;
  state: BudgetState;
};

export function budgetPace(spent: number, limit: number, range: DateRange, now = new Date()): BudgetPace {
  const total = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000));
  const left = daysLeftInRange(range, now);
  const elapsed = Math.min(total, Math.max(1, total - left + 1));
  const remaining = limit - spent;
  return {
    share: limit > 0 ? spent / limit : 0,
    expectedShare: elapsed / total,
    projected: Math.round((spent / elapsed) * total),
    remaining,
    perDay: left > 0 ? Math.max(0, Math.floor(remaining / left)) : 0,
    state: budgetState(spent, limit),
  };
}

export type AlertLevel = 0 | 80 | 100;

export function alertLevel(share: number): AlertLevel {
  return share >= 1 ? 100 : share >= WARN_AT ? 80 : 0;
}

/** The level to announce when spending moved past a threshold that was not announced yet. */
export function thresholdCrossed(announced: AlertLevel, share: number): 80 | 100 | null {
  const level = alertLevel(share);
  return level > announced ? (level as 80 | 100) : null;
}

/** Rounds up to two significant digits in major units: 4 372,10 → 4 400. */
export function niceCeil(minor: number, currency: string): number {
  const unit = 10 ** currencyDecimals(currency);
  const major = minor / unit;
  if (major <= 0) return 0;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(major)) - 1);
  return Math.round(Math.ceil(major / step - 1e-9) * step * unit);
}

/** A limit to offer: the average of the months that had spending, rounded up. */
export function suggestLimit(monthTotals: number[], currency: string): number | null {
  const used = monthTotals.filter((v) => v > 0);
  if (used.length === 0) return null;
  return niceCeil(used.reduce((a, b) => a + b, 0) / used.length, currency);
}

/** Expense totals per top-level category. */
export function spentByRoot(rows: Converted[], rootOf: (categoryId: string) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== 'expense') continue;
    const k = rootOf(r.categoryId);
    out.set(k, (out.get(k) ?? 0) + r.baseMinor);
  }
  return out;
}

export function totalSpent(rows: Converted[]): number {
  return rows.reduce((acc, r) => (r.kind === 'expense' ? acc + r.baseMinor : acc), 0);
}

export type BudgetLine = { categoryId: string | null; limit: number };
export type BudgetStatus = BudgetLine & { spent: number; share: number };

export function budgetStatuses(rows: Converted[], budgets: BudgetLine[], rootOf: (id: string) => string): BudgetStatus[] {
  const byRoot = spentByRoot(rows, rootOf);
  const all = totalSpent(rows);
  return budgets.map((b) => {
    const spent = b.categoryId ? (byRoot.get(b.categoryId) ?? 0) : all;
    return { ...b, spent, share: b.limit > 0 ? spent / b.limit : 0 };
  });
}

/** The month limit: the explicit one, or the sum of the category limits when only those are set. */
export function effectiveTotal(budgets: BudgetLine[]): number | null {
  const total = budgets.find((b) => b.categoryId === null);
  if (total) return total.limit;
  const sum = budgets.reduce((acc, b) => acc + b.limit, 0);
  return sum > 0 ? sum : null;
}
