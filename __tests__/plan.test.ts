import type { HistoryTx } from '@/db/repos/transactions';
import { alertLevel, budgetPace, budgetStatuses, effectiveTotal, niceCeil, suggestLimit, thresholdCrossed } from '@/features/plan/budget';
import { cardCycle } from '@/features/plan/cards';
import { detectRecurring, priceIncreases } from '@/features/plan/detect';
import { goalProgress, targetDateIn } from '@/features/plan/goals';
import { buildInsights } from '@/features/plan/insights';
import { installmentDates, splitInstallments } from '@/features/plan/installments';
import { catchUp, daysUntil, nextDate, nextMonthDay, occurrences, perMonth, perYear } from '@/features/plan/schedule';
import type { Converted } from '@/features/reports/aggregate';
import { dayKey, periodRange } from '@/lib/dates';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'id' }));

const monthly = { frequency: 'month' as const, interval: 1, anchorDay: 31 };

describe('recurring schedule', () => {
  it('keeps the 31st across short months', () => {
    expect(nextDate('2026-01-31', monthly)).toBe('2026-02-28');
    expect(nextDate('2026-02-28', monthly)).toBe('2026-03-31');
    expect(nextDate('2028-01-31', monthly)).toBe('2028-02-29');
  });

  it('handles weekly, yearly and every-n intervals', () => {
    expect(nextDate('2026-11-22', { frequency: 'week', interval: 2, anchorDay: null })).toBe('2026-12-06');
    expect(nextDate('2028-02-29', { frequency: 'year', interval: 1, anchorDay: 29 })).toBe('2029-02-28');
    expect(nextDate('2026-11-15', { frequency: 'month', interval: 3, anchorDay: 15 })).toBe('2027-02-15');
  });

  it('lists due dates up to a day and catches up past ones', () => {
    expect(occurrences('2026-11-30', { ...monthly, anchorDay: 30 }, '2027-01-31')).toEqual(['2026-11-30', '2026-12-30', '2027-01-30']);
    expect(catchUp('2026-08-15', { ...monthly, anchorDay: 15 }, new Date(2026, 10, 22))).toBe('2026-12-15');
  });

  it('turns a payment into monthly and yearly cost', () => {
    expect(perYear(22900, { frequency: 'month', interval: 1 })).toBe(274800);
    expect(perMonth(120000, { frequency: 'year', interval: 1 })).toBe(10000);
    expect(perYear(1000, { frequency: 'week', interval: 1 })).toBe(52000);
  });

  it('counts days and finds the next day of the month', () => {
    const now = new Date(2026, 10, 22, 15, 0);
    expect(daysUntil('2026-11-25', now)).toBe(3);
    expect(daysUntil('2026-11-20', now)).toBe(-2);
    expect(nextMonthDay(25, now)).toBe('2026-11-25');
    expect(nextMonthDay(5, now)).toBe('2026-12-05');
    expect(nextMonthDay(31, new Date(2027, 1, 10))).toBe('2027-02-28');
  });
});

describe('budgets', () => {
  const nov = periodRange('month', new Date(2026, 10, 1));

  it('measures pace against the share of the month gone by', () => {
    const p = budgetPace(1100000, 2500000, nov, new Date(2026, 10, 22, 10));
    expect(p.share).toBeCloseTo(0.44);
    expect(p.expectedShare).toBeCloseTo(22 / 30);
    expect(p.projected).toBe(1500000);
    expect(p.perDay).toBe(155555); // 14 000 left over 9 days
    expect(p.state).toBe('ok');
  });

  it('announces 80% and 100% once each', () => {
    expect(alertLevel(0.79)).toBe(0);
    expect(thresholdCrossed(0, 0.85)).toBe(80);
    expect(thresholdCrossed(80, 0.95)).toBeNull();
    expect(thresholdCrossed(80, 1.02)).toBe(100);
    expect(thresholdCrossed(100, 1.5)).toBeNull();
  });

  it('suggests a rounded limit from past months', () => {
    expect(niceCeil(437210, 'TRY')).toBe(440000);
    expect(niceCeil(8700, 'USD')).toBe(8700);
    expect(niceCeil(612, 'JPY')).toBe(620);
    expect(suggestLimit([400000, 0, 474420], 'TRY')).toBe(440000);
    expect(suggestLimit([0, 0], 'TRY')).toBeNull();
  });

  it('sums spending per budget with sub-categories rolled up', () => {
    const rows = [
      row('a', 'sys:utilities.electricity', 30000),
      row('b', 'sys:utilities', 10000),
      row('c', 'sys:groceries', 50000),
      { ...row('d', 'sys:salary', 900000), kind: 'income' as const },
    ];
    const rootOf = (id: string) => id.split('.')[0];
    const s = budgetStatuses(rows, [{ categoryId: 'sys:utilities', limit: 50000 }, { categoryId: null, limit: 100000 }], rootOf);
    expect(s[0]).toMatchObject({ spent: 40000, share: 0.8 });
    expect(s[1]).toMatchObject({ spent: 90000, share: 0.9 });
    expect(effectiveTotal([{ categoryId: 'x', limit: 3 }, { categoryId: 'y', limit: 4 }])).toBe(7);
    expect(effectiveTotal([{ categoryId: 'x', limit: 3 }, { categoryId: null, limit: 10 }])).toBe(10);
    expect(effectiveTotal([])).toBeNull();
  });
});

describe('installments', () => {
  it('splits the total with the remainder on the first one', () => {
    expect(splitInstallments(1000000, 3)).toEqual([333334, 333333, 333333]);
    expect(splitInstallments(1000000, 3).reduce((a, b) => a + b)).toBe(1000000);
    expect(splitInstallments(500, 1)).toEqual([500]);
  });

  it('dates them monthly on the purchase day', () => {
    expect(installmentDates('2026-01-31T14:05:00', 3)).toEqual(['2026-01-31T14:05:00', '2026-02-28T14:05:00', '2026-03-31T14:05:00']);
  });
});

describe('credit card cycle', () => {
  it('closes on the 5th, due on the 15th of the same month', () => {
    const c = cardCycle(5, 15, new Date(2026, 10, 22));
    expect(dayKey(c.lastClose)).toBe('2026-11-05');
    expect(dayKey(c.nextClose)).toBe('2026-12-05');
    expect(dayKey(c.lastDue)).toBe('2026-11-15');
    expect(dayKey(c.nextDue)).toBe('2026-12-15');
    expect(dayKey(c.current.start)).toBe('2026-11-06');
    expect(dayKey(c.current.end)).toBe('2026-12-06');
    expect(dayKey(c.lastStatement.start)).toBe('2026-10-06');
  });

  it('closes on the 28th, due on the 5th of the next month; closing day counts as open', () => {
    const c = cardCycle(28, 5, new Date(2026, 10, 28));
    expect(dayKey(c.nextClose)).toBe('2026-11-28');
    expect(dayKey(c.nextDue)).toBe('2026-12-05');
    expect(dayKey(c.lastDue)).toBe('2026-11-05');
  });

  it('clamps a 31st closing day in February', () => {
    expect(dayKey(cardCycle(31, 10, new Date(2027, 1, 3)).nextClose)).toBe('2027-02-28');
  });
});

describe('goals', () => {
  const now = new Date(2026, 10, 22);

  it('works out the monthly amount to the deadline', () => {
    const g = goalProgress(5000000, 1200000, '2027-06-01', now);
    expect(g.monthsLeft).toBe(6);
    expect(g.perMonth).toBe(633334);
    expect(g.share).toBeCloseTo(0.24);
  });

  it('handles no deadline, done and overdue goals', () => {
    expect(goalProgress(1000, 200, null, now)).toMatchObject({ monthsLeft: null, perMonth: null, remaining: 800 });
    expect(goalProgress(1000, 1200, '2026-12-01', now)).toMatchObject({ done: true, perMonth: 0, remaining: 0 });
    expect(goalProgress(1000, 200, '2026-10-01', now)).toMatchObject({ overdue: true, perMonth: null });
    expect(targetDateIn(6, now)).toBe('2027-05-22');
    expect(targetDateIn(0, now)).toBeNull();
  });
});

describe('recurring detection', () => {
  const tx = (merchant: string, date: string, amount: number, extra: Partial<HistoryTx> = {}): HistoryTx => ({
    id: `${merchant}${date}`,
    kind: 'expense',
    merchantName: merchant,
    amountMinor: amount,
    currency: 'TRY',
    occurredAt: `${date}T10:00:00`,
    accountId: 'card',
    categoryId: 'sys:subscriptions',
    recurringRuleId: null,
    installmentPlanId: null,
    ...extra,
  });
  const now = new Date(2026, 10, 22);

  it('spots a monthly subscription and its next date', () => {
    const found = detectRecurring(
      [tx('Netflix', '2026-08-14', 22900), tx('NETFLIX', '2026-09-14', 22900), tx('Netflix', '2026-10-14', 22900), tx('Netflix', '2026-11-14', 24900)],
      new Set(),
      now,
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ key: 'netflix', amountMinor: 24900, months: 4, nextDue: '2026-12-14' });
  });

  it('ignores weekly shops, irregular gaps, old and dismissed ones', () => {
    const weekly = ['2026-09-02', '2026-09-09', '2026-10-07', '2026-11-04'].map((d) => tx('Migros', d, 50000));
    const irregular = ['2026-07-01', '2026-09-20', '2026-11-10'].map((d) => tx('Gym', d, 90000));
    const old = ['2026-03-01', '2026-04-01', '2026-05-01'].map((d) => tx('Old', d, 1000));
    const dismissed = ['2026-09-03', '2026-10-03', '2026-11-03'].map((d) => tx('Spotify', d, 5999));
    expect(detectRecurring([...weekly, ...irregular, ...old, ...dismissed], new Set(['spotify']), now)).toEqual([]);
  });

  it('reports a price increase of 3% or more', () => {
    expect(
      priceIncreases([
        { ruleId: 'r', amountMinor: 24900, occurredAt: '2026-11-14T00:00:00' },
        { ruleId: 'r', amountMinor: 22900, occurredAt: '2026-10-14T00:00:00' },
        { ruleId: 's', amountMinor: 1010, occurredAt: '2026-11-01T00:00:00' },
        { ruleId: 's', amountMinor: 1000, occurredAt: '2026-10-01T00:00:00' },
      ]),
    ).toEqual([{ ruleId: 'r', from: 22900, to: 24900, pct: 9 }]);
  });
});

function row(id: string, categoryId: string, baseMinor: number, occurredAt = '2026-11-10T10:00:00', merchantName: string | null = null): Converted {
  return {
    transactionId: id,
    kind: 'expense',
    occurredAt,
    accountId: 'a',
    merchantName,
    channel: null,
    categoryId,
    amountMinor: baseMinor,
    currency: 'TRY',
    baseMinor,
  };
}

describe('insights', () => {
  const now = new Date(2026, 10, 22, 12);
  const range = periodRange('month', now);
  const rootOf = (id: string) => id;
  const history: Converted[] = [];
  for (const m of ['08', '09', '10']) {
    history.push(row(`g${m}a`, 'groceries', 300000, `2026-${m}-05T10:00:00`));
    history.push(row(`g${m}b`, 'groceries', 300000, `2026-${m}-15T10:00:00`));
    history.push(row(`d${m}`, 'dining', 200000, `2026-${m}-10T10:00:00`));
    history.push(row(`u${m}`, 'utilities', 100000, `2026-${m}-12T10:00:00`));
    history.push(row(`u${m}x`, 'utilities', 100000, `2026-${m}-18T10:00:00`));
  }

  it('flags budgets, the forecast, big category moves and a one-off payment', () => {
    const current = [
      row('c1', 'groceries', 900000, '2026-11-08T10:00:00'),
      row('c2', 'dining', 50000, '2026-11-09T10:00:00'),
      row('c3', 'utilities', 700000, '2026-11-12T10:00:00', 'Enerjisa'),
    ];
    const list = buildInsights({
      now,
      range,
      current,
      history,
      rootOf,
      budgets: [{ categoryId: 'groceries', limit: 1000000 }, { categoryId: null, limit: 2000000 }],
      priceUps: [],
      fixedCosts: null,
    });
    const kinds = list.map((i) => i.kind);
    expect(list[0]).toMatchObject({ kind: 'pace', tone: 'bad' });
    expect(list).toContainEqual(expect.objectContaining({ kind: 'budget', categoryId: 'groceries', pct: 90, tone: 'warn' }));
    expect(list).toContainEqual(expect.objectContaining({ kind: 'categoryChange', categoryId: 'utilities', tone: 'bad' }));
    expect(list).toContainEqual(expect.objectContaining({ kind: 'categoryChange', categoryId: 'dining', pct: -75, tone: 'good' }));
    expect(list).toContainEqual(expect.objectContaining({ kind: 'unusual', categoryId: 'utilities', merchant: 'Enerjisa', typical: 100000 }));
    expect(kinds.length).toBeLessThanOrEqual(6);
  });

  it('stays quiet without history or budgets', () => {
    const list = buildInsights({ now, range, current: [row('x', 'groceries', 1000, '2026-11-01T10:00:00')], history: [], rootOf, budgets: [], priceUps: [], fixedCosts: null });
    expect(list).toEqual([{ kind: 'pace', projected: 1364, budget: null, average: null, tone: 'info' }]);
  });
});
