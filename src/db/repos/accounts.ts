import type { SQLiteDatabase } from 'expo-sqlite';

import { newId, nowUtc } from '@/lib/id';

import type { AccountType } from '../defaults';
import { LOCAL_HOUSEHOLD } from '../migrations';
import type { Account, AccountInput } from '../types';

type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  icon: string;
  color: string;
  statement_day: number | null;
  due_day: number | null;
  credit_limit_minor: number | null;
  is_shared: number;
  sort_order: number;
  archived: number;
};

const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  name: r.name,
  type: r.type,
  currency: r.currency,
  icon: r.icon,
  color: r.color,
  statementDay: r.statement_day,
  dueDay: r.due_day,
  creditLimitMinor: r.credit_limit_minor,
  isShared: r.is_shared === 1,
  sortOrder: r.sort_order,
  archived: r.archived === 1,
});

export async function listAccounts(db: SQLiteDatabase, includeArchived = false): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    `SELECT * FROM accounts WHERE deleted_at IS NULL ${includeArchived ? '' : 'AND archived = 0'}
     ORDER BY archived, sort_order, created_at`,
  );
  return rows.map(toAccount);
}

export async function getAccount(db: SQLiteDatabase, id: string): Promise<Account | null> {
  const r = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', id);
  return r ? toAccount(r) : null;
}

export async function createAccount(db: SQLiteDatabase, input: AccountInput): Promise<string> {
  const id = newId();
  const now = nowUtc();
  const order = await db.getFirstAsync<{ n: number }>('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM accounts');
  await db.runAsync(
    `INSERT INTO accounts (id, household_id, name, type, currency, icon, color, statement_day, due_day,
       credit_limit_minor, is_shared, sort_order, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    id,
    LOCAL_HOUSEHOLD,
    input.name.trim(),
    input.type,
    input.currency,
    input.icon,
    input.color,
    input.statementDay,
    input.dueDay,
    input.creditLimitMinor,
    input.isShared ? 1 : 0,
    order?.n ?? 0,
    now,
    now,
  );
  return id;
}

export async function updateAccount(db: SQLiteDatabase, id: string, input: AccountInput): Promise<void> {
  await db.runAsync(
    `UPDATE accounts SET name = ?, type = ?, currency = ?, icon = ?, color = ?, statement_day = ?, due_day = ?,
       credit_limit_minor = ?, is_shared = ?, updated_at = ? WHERE id = ?`,
    input.name.trim(),
    input.type,
    input.currency,
    input.icon,
    input.color,
    input.statementDay,
    input.dueDay,
    input.creditLimitMinor,
    input.isShared ? 1 : 0,
    nowUtc(),
    id,
  );
}

export async function setAccountArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<void> {
  await db.runAsync('UPDATE accounts SET archived = ?, updated_at = ? WHERE id = ?', archived ? 1 : 0, nowUtc(), id);
}

/** Balance change of an account from all its transactions (income minus expense). */
export async function accountBalances(db: SQLiteDatabase): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ account_id: string; balance: number }>(
    `SELECT account_id,
            SUM(CASE WHEN kind = 'income' THEN amount_minor ELSE -amount_minor END) AS balance
     FROM transactions WHERE deleted_at IS NULL GROUP BY account_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.account_id, r.balance]));
}
