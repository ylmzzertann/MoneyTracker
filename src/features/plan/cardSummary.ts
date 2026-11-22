import type { SQLiteDatabase } from 'expo-sqlite';

import { listAccounts } from '@/db/repos/accounts';
import { accountNetSpend, futureInstallmentsByMonth } from '@/db/repos/transactions';
import type { Account } from '@/db/types';
import { toLocalISO } from '@/lib/dates';

import { cardCycle, type CardCycle } from './cards';

export type CardSummary = {
  account: Account;
  /** Null until the statement and due days are set. */
  cycle: CardCycle | null;
  lastStatementAmount: number;
  currentAmount: number;
  /** Installments booked after the open statement, per month. */
  future: { month: string; total: number }[];
  futureTotal: number;
};

/** Statement amounts, due dates and upcoming installments of every credit card. */
export async function loadCardSummaries(db: SQLiteDatabase, now = new Date()): Promise<CardSummary[]> {
  const cards = (await listAccounts(db)).filter((a) => a.type === 'credit_card');
  const out: CardSummary[] = [];
  for (const account of cards) {
    const cycle = account.statementDay && account.dueDay ? cardCycle(account.statementDay, account.dueDay, now) : null;
    const lastStatementAmount = cycle
      ? await accountNetSpend(db, account.id, toLocalISO(cycle.lastStatement.start), toLocalISO(cycle.lastStatement.end))
      : 0;
    const currentAmount = cycle ? await accountNetSpend(db, account.id, toLocalISO(cycle.current.start), toLocalISO(cycle.current.end)) : 0;
    const futureStart = cycle ? cycle.current.end : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const future = await futureInstallmentsByMonth(db, account.id, toLocalISO(futureStart));
    out.push({ account, cycle, lastStatementAmount, currentAmount, future, futureTotal: future.reduce((a, f) => a + f.total, 0) });
  }
  return out;
}
