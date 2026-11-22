import type { SQLiteDatabase } from 'expo-sqlite';

import { newId, nowUtc } from '@/lib/id';

import { LOCAL_HOUSEHOLD } from '../migrations';
import type { Budget } from '../types';

export async function listBudgets(db: SQLiteDatabase): Promise<Budget[]> {
  const rows = await db.getAllAsync<{ id: string; category_id: string | null; amount_minor: number; currency: string }>(
    'SELECT id, category_id, amount_minor, currency FROM budgets WHERE deleted_at IS NULL ORDER BY created_at',
  );
  return rows.map((r) => ({ id: r.id, categoryId: r.category_id, amountMinor: r.amount_minor, currency: r.currency }));
}

/** Sets the monthly limit of a category (or of the whole month when `categoryId` is null). */
export async function setBudget(db: SQLiteDatabase, categoryId: string | null, amountMinor: number, currency: string): Promise<void> {
  const now = nowUtc();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM budgets WHERE deleted_at IS NULL AND category_id IS ?',
    categoryId,
  );
  if (existing) {
    await db.runAsync('UPDATE budgets SET amount_minor = ?, currency = ?, updated_at = ? WHERE id = ?', amountMinor, currency, now, existing.id);
    return;
  }
  await db.runAsync(
    `INSERT INTO budgets (id, household_id, category_id, amount_minor, currency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    LOCAL_HOUSEHOLD,
    categoryId,
    amountMinor,
    currency,
    now,
    now,
  );
}

export async function removeBudget(db: SQLiteDatabase, categoryId: string | null): Promise<void> {
  const now = nowUtc();
  await db.runAsync('UPDATE budgets SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL AND category_id IS ?', now, now, categoryId);
}
