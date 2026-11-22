import type { Converted } from '@/features/reports/aggregate';
import { daysLeftInRange, monthKey, parseLocalISO, type DateRange } from '@/lib/dates';

import { budgetStatuses, totalSpent, type BudgetLine } from './budget';

export type Tone = 'good' | 'info' | 'warn' | 'bad';

export type Insight =
  | { kind: 'budget'; categoryId: string | null; pct: number; tone: Tone }
  | { kind: 'pace'; projected: number; budget: number | null; average: number | null; tone: Tone }
  | { kind: 'categoryChange'; categoryId: string; pct: number; diff: number; tone: Tone }
  | { kind: 'unusual'; categoryId: string; merchant: string | null; amount: number; typical: number; tone: Tone }
  | { kind: 'priceUp'; name: string; from: number; to: number; currency: string; pct: number; tone: Tone }
  | { kind: 'fixedCosts'; monthly: number; count: number; tone: Tone };

export type InsightInput = {
  now: Date;
  /** The current month. */
  range: DateRange;
  current: Converted[];
  /** The three full months before the current one. */
  history: Converted[];
  rootOf: (categoryId: string) => string;
  /** Limits in the main currency. */
  budgets: BudgetLine[];
  priceUps: { name: string; from: number; to: number; currency: string; pct: number }[];
  fixedCosts: { monthly: number; count: number } | null;
};

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const ORDER: Record<Insight['kind'], number> = { budget: 0, pace: 1, priceUp: 2, unusual: 3, categoryChange: 4, fixedCosts: 5 };
const TONE: Record<Tone, number> = { bad: 0, warn: 1, info: 2, good: 3 };

/**
 * Short, explainable observations about this month: budgets close to or over
 * their limit, the month-end forecast, categories well above or below the
 * same point of previous months, one-off large payments and price increases.
 */
export function buildInsights(input: InsightInput, max = 6): Insight[] {
  const { now, range, current, history, rootOf } = input;
  const out: Insight[] = [];
  const total = Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000);
  const elapsed = Math.min(total, Math.max(1, total - daysLeftInRange(range, now) + 1));
  const spent = totalSpent(current);

  // Budgets at 80% or more.
  for (const s of budgetStatuses(current, input.budgets, rootOf)) {
    if (s.share >= 0.8) out.push({ kind: 'budget', categoryId: s.categoryId, pct: Math.round(s.share * 100), tone: s.share >= 1 ? 'bad' : 'warn' });
  }

  // History, by month and by top-level category, up to the same day of the month.
  const monthsWithData = new Set(history.filter((r) => r.kind === 'expense').map((r) => monthKey(r.occurredAt)));
  const n = monthsWithData.size;
  const historyFullAvg = n > 0 ? totalSpent(history) / n : null;

  // Month-end forecast, once a few days have passed.
  const totalBudget = input.budgets.find((b) => b.categoryId === null)?.limit ?? null;
  if (elapsed >= 5 && spent > 0) {
    const projected = Math.round((spent / elapsed) * total);
    const ref = totalBudget ?? historyFullAvg;
    const tone: Tone = ref ? (projected > ref * 1.05 ? 'bad' : projected > ref * 0.95 ? 'warn' : 'good') : 'info';
    out.push({ kind: 'pace', projected, budget: totalBudget, average: totalBudget ? null : historyFullAvg && Math.round(historyFullAvg), tone });
  }

  if (n > 0) {
    const day = now.getDate();
    const cur = new Map<string, number>();
    for (const r of current) if (r.kind === 'expense') cur.set(rootOf(r.categoryId), (cur.get(rootOf(r.categoryId)) ?? 0) + r.baseMinor);
    const past = new Map<string, number>();
    let pastTotal = 0;
    for (const r of history) {
      if (r.kind !== 'expense' || parseLocalISO(r.occurredAt).getDate() > day) continue;
      const k = rootOf(r.categoryId);
      past.set(k, (past.get(k) ?? 0) + r.baseMinor);
      pastTotal += r.baseMinor;
    }
    const material = Math.max((pastTotal / n) * 0.05, 1);
    let up: Insight | null = null;
    let down: Insight | null = null;
    for (const k of new Set([...cur.keys(), ...past.keys()])) {
      const avg = (past.get(k) ?? 0) / n;
      if (avg <= 0) continue;
      const now_ = cur.get(k) ?? 0;
      const diff = now_ - avg;
      const pct = Math.round((diff / avg) * 100);
      if (Math.abs(pct) < 25 || Math.abs(diff) < material) continue;
      const item: Insight = { kind: 'categoryChange', categoryId: k, pct, diff: Math.round(diff), tone: diff > 0 ? 'bad' : 'good' };
      if (diff > 0 && (!up || diff > (up as { diff: number }).diff)) up = item;
      if (diff < 0 && (!down || diff < (down as { diff: number }).diff)) down = item;
    }
    if (up) out.push(up);
    if (down) out.push(down);

    // One payment far above what the category usually costs.
    const byCat = new Map<string, number[]>();
    for (const r of history) if (r.kind === 'expense') byCat.set(rootOf(r.categoryId), [...(byCat.get(rootOf(r.categoryId)) ?? []), r.baseMinor]);
    let unusual: (Insight & { ratio: number }) | null = null;
    for (const r of current) {
      if (r.kind !== 'expense') continue;
      const k = rootOf(r.categoryId);
      const list = byCat.get(k);
      if (!list || list.length < 4) continue;
      const typical = median(list);
      if (typical <= 0) continue;
      const ratio = r.baseMinor / typical;
      if (ratio < 2.5 || r.baseMinor - typical < material) continue;
      if (!unusual || ratio > unusual.ratio) {
        unusual = { kind: 'unusual', categoryId: k, merchant: r.merchantName, amount: r.baseMinor, typical: Math.round(typical), tone: 'warn', ratio };
      }
    }
    if (unusual) {
      const { ratio: _ratio, ...rest } = unusual;
      out.push(rest);
    }
  }

  for (const p of input.priceUps) out.push({ kind: 'priceUp', ...p, tone: 'warn' });
  if (input.fixedCosts && input.fixedCosts.count > 0) out.push({ kind: 'fixedCosts', ...input.fixedCosts, tone: 'info' });

  return out.sort((a, b) => TONE[a.tone] - TONE[b.tone] || ORDER[a.kind] - ORDER[b.kind]).slice(0, max);
}
