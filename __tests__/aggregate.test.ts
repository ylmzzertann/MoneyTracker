import type { ReportRow } from '@/db/types';
import {
  convertRows,
  dailySeries,
  foldSmallGroups,
  groupRows,
  monthlySeries,
  percentChange,
  totals,
} from '@/features/reports/aggregate';
import { periodRange } from '@/lib/dates';

const row = (p: Partial<ReportRow>): ReportRow => ({
  transactionId: 't1',
  kind: 'expense',
  occurredAt: '2026-11-03T10:00:00',
  accountId: 'cash',
  merchantName: null,
  channel: null,
  categoryId: 'sys:groceries',
  amountMinor: 1000,
  currency: 'USD',
  ...p,
});

const rates = { EUR: 1, USD: 1, TRY: 50 };

const sample: ReportRow[] = [
  // one receipt split into two categories
  row({ transactionId: 'a', categoryId: 'sys:groceries', amountMinor: 3000, merchantName: 'Walmart' }),
  row({ transactionId: 'a', categoryId: 'sys:household', amountMinor: 1000, merchantName: 'Walmart' }),
  row({ transactionId: 'b', categoryId: 'sys:utilities.electricity', amountMinor: 5000, occurredAt: '2026-11-05T08:00:00' }),
  row({ transactionId: 'c', categoryId: 'sys:dining', amountMinor: 50000, currency: 'TRY', channel: 'store' }),
  row({ transactionId: 'd', kind: 'income', categoryId: 'sys:salary', amountMinor: 200000 }),
  row({ transactionId: 'e', categoryId: 'sys:other', amountMinor: 999, currency: 'GBP' }),
];

describe('convertRows', () => {
  it('converts to the base currency and counts rows without a rate', () => {
    const { rows, missing } = convertRows(sample, 'USD', rates);
    expect(missing).toBe(1);
    expect(rows.find((r) => r.transactionId === 'c')?.baseMinor).toBe(1000);
  });
});

describe('totals', () => {
  it('sums expenses and income and counts transactions, not splits', () => {
    const { rows } = convertRows(sample, 'USD', rates);
    expect(totals(rows)).toEqual({ expense: 10000, income: 200000, net: 190000, expenseCount: 3, incomeCount: 1 });
  });
});

describe('groupRows', () => {
  const { rows } = convertRows(sample, 'USD', rates);
  const parentOf = (id: string) => (id.startsWith('sys:utilities.') ? 'sys:utilities' : null);

  it('groups by category, rolls sub-categories up and sorts by total', () => {
    const groups = groupRows(rows, 'expense', 'category', parentOf);
    expect(groups.map((g) => g.key)).toEqual(['sys:utilities', 'sys:groceries', 'sys:household', 'sys:dining']);
    expect(groups[0].share).toBeCloseTo(0.5);
    expect(groups.reduce((a, g) => a + g.share, 0)).toBeCloseTo(1);
  });

  it('groups by merchant with an empty key for unknown merchants', () => {
    const groups = groupRows(rows, 'expense', 'merchant');
    const walmart = groups.find((g) => g.key === 'Walmart');
    expect(walmart).toMatchObject({ total: 4000, count: 1 });
    expect(groups.find((g) => g.key === '')?.total).toBe(6000);
  });

  it('groups by channel', () => {
    const groups = groupRows(rows, 'expense', 'channel');
    expect(groups.find((g) => g.key === 'store')?.total).toBe(1000);
  });

  it('folds the tail into an "other" bucket', () => {
    const groups = groupRows(rows, 'expense', 'category', parentOf);
    const folded = foldSmallGroups(groups, 3);
    expect(folded).toHaveLength(3);
    expect(folded[2]).toMatchObject({ key: '__other__', total: 2000, count: 2 });
  });
});

describe('series', () => {
  const { rows } = convertRows(sample, 'USD', rates);

  it('builds a value for every day of the period', () => {
    const series = dailySeries(rows, 'expense', periodRange('month', new Date(2026, 10, 1)));
    expect(series).toHaveLength(30);
    expect(series[2]).toEqual({ key: '2026-11-03', total: 5000 });
    expect(series[4]).toEqual({ key: '2026-11-05', total: 5000 });
    expect(series[0].total).toBe(0);
  });

  it('builds monthly totals', () => {
    const series = monthlySeries(rows, 'income', [new Date(2026, 9, 1), new Date(2026, 10, 1)]);
    expect(series).toEqual([
      { key: '2026-10', total: 0 },
      { key: '2026-11', total: 200000 },
    ]);
  });
});

describe('percentChange', () => {
  it('rounds and handles a missing baseline', () => {
    expect(percentChange(92, 100)).toBe(-8);
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(10, 0)).toBeNull();
  });
});
