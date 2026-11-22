import { listBudgets } from '@/db/repos/budgets';
import { loadRates } from '@/db/repos/fx';
import { listGoals } from '@/db/repos/goals';
import { listInstallmentPlans } from '@/db/repos/installments';
import { listRules } from '@/db/repos/recurring';
import type { Budget } from '@/db/types';
import { effectiveTotal, type BudgetLine } from '@/features/plan/budget';
import { loadCardSummaries } from '@/features/plan/cardSummary';
import { perMonth } from '@/features/plan/schedule';
import { dayKey } from '@/lib/dates';
import { convertMinor } from '@/lib/fx';
import { useSettings } from '@/store/settings';

import { useQuery } from './useQuery';

export type BudgetView = {
  list: Budget[];
  /** Limits converted to the main currency. */
  lines: BudgetLine[];
  /** The month limit (explicit, or the sum of category limits). */
  total: number | null;
  explicitTotal: number | null;
  byCategory: Map<string, number>;
};

export function useBudgets(): BudgetView | undefined {
  const base = useSettings((s) => s.baseCurrency);
  const list = useQuery('budgets', listBudgets).data;
  const fx = useQuery('fx', loadRates).data;
  if (!list || !fx) return undefined;
  const lines = list.map((b) => ({ categoryId: b.categoryId, limit: convertMinor(b.amountMinor, b.currency, base, fx.rates) ?? b.amountMinor }));
  return {
    list,
    lines,
    total: effectiveTotal(lines),
    explicitTotal: lines.find((l) => l.categoryId === null)?.limit ?? null,
    byCategory: new Map(lines.filter((l) => l.categoryId).map((l) => [l.categoryId!, l.limit])),
  };
}

export const useRules = () => useQuery('rules', listRules).data;
export const useGoals = () => useQuery('goals', listGoals).data;

export function useInstallmentPlans() {
  const today = dayKey(new Date());
  return useQuery(`plans:${today}`, (db) => listInstallmentPlans(db)).data;
}

export function useCardSummaries() {
  const today = dayKey(new Date());
  return useQuery(`cards:${today}`, (db) => loadCardSummaries(db)).data;
}

/** Monthly and yearly cost of the active recurring expenses, in the main currency. */
export function useFixedCosts() {
  const base = useSettings((s) => s.baseCurrency);
  const rules = useRules();
  const fx = useQuery('fx', loadRates).data;
  if (!rules || !fx) return undefined;
  let monthly = 0;
  let subscriptions = 0;
  let count = 0;
  for (const r of rules) {
    if (!r.active || r.kind !== 'expense') continue;
    const m = convertMinor(perMonth(r.amountMinor, r), r.currency, base, fx.rates) ?? 0;
    monthly += m;
    if (r.isSubscription) subscriptions += m;
    count++;
  }
  return { monthly, yearly: monthly * 12, subscriptions, count };
}
