import type { SQLiteDatabase } from 'expo-sqlite';

import { installmentDates, splitInstallments } from '@/features/plan/installments';
import { toLocalISO } from '@/lib/dates';
import { newId, nowUtc } from '@/lib/id';

import { LOCAL_HOUSEHOLD } from '../migrations';
import type { InstallmentPlan, TransactionInput } from '../types';
import { insertTransaction } from './transactions';

/**
 * Books a card purchase paid in `count` monthly installments: one plan row and
 * one transaction per month, so each month's reports carry only that month's part.
 */
export async function createInstallmentPurchase(db: SQLiteDatabase, input: TransactionInput, count: number): Promise<string> {
  const categoryId = input.splits[0]?.categoryId;
  if (!categoryId) throw new Error('A category is required');
  const id = newId();
  const now = nowUtc();
  const parts = splitInstallments(input.amountMinor, count);
  const dates = installmentDates(input.occurredAt, count);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO installment_plans (id, household_id, account_id, category_id, merchant_name, total_minor, currency, count,
         first_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      LOCAL_HOUSEHOLD,
      input.accountId,
      categoryId,
      input.merchantName?.trim() || null,
      input.amountMinor,
      input.currency,
      parts.length,
      input.occurredAt,
      now,
      now,
    );
    for (let i = 0; i < parts.length; i++) {
      await insertTransaction(
        db,
        { ...input, amountMinor: parts[i], occurredAt: dates[i], splits: [{ categoryId, amountMinor: parts[i] }] },
        { installmentPlanId: id, installmentNo: i + 1 },
      );
    }
  });
  return id;
}

export async function listInstallmentPlans(db: SQLiteDatabase, now = new Date()): Promise<InstallmentPlan[]> {
  const today = toLocalISO(now);
  const rows = await db.getAllAsync<{
    id: string;
    account_id: string;
    category_id: string;
    merchant_name: string | null;
    total_minor: number;
    currency: string;
    count: number;
    first_date: string;
    paid: number;
    remaining: number | null;
    next_date: string | null;
  }>(
    `SELECT p.*,
       (SELECT COUNT(*) FROM transactions t WHERE t.installment_plan_id = p.id AND t.deleted_at IS NULL AND t.occurred_at <= ?) AS paid,
       (SELECT SUM(t.amount_minor) FROM transactions t WHERE t.installment_plan_id = p.id AND t.deleted_at IS NULL AND t.occurred_at > ?) AS remaining,
       (SELECT MIN(t.occurred_at) FROM transactions t WHERE t.installment_plan_id = p.id AND t.deleted_at IS NULL AND t.occurred_at > ?) AS next_date
     FROM installment_plans p WHERE p.deleted_at IS NULL ORDER BY p.first_date DESC`,
    today,
    today,
    today,
  );
  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    categoryId: r.category_id,
    merchantName: r.merchant_name,
    totalMinor: r.total_minor,
    currency: r.currency,
    count: r.count,
    firstDate: r.first_date,
    paidCount: r.paid,
    remainingMinor: r.remaining ?? 0,
    nextDate: r.next_date,
  }));
}

/** Removes a plan with all of its installments (soft, so it can be undone). */
export async function deleteInstallmentPlan(db: SQLiteDatabase, id: string): Promise<string> {
  const now = nowUtc();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE installment_plans SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
    await db.runAsync(
      'UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE installment_plan_id = ? AND deleted_at IS NULL',
      now,
      now,
      id,
    );
  });
  return now;
}

/** Undo for deleteInstallmentPlan: brings back the rows deleted at `deletedAt`. */
export async function restoreInstallmentPlan(db: SQLiteDatabase, id: string, deletedAt: string): Promise<void> {
  const now = nowUtc();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE installment_plans SET deleted_at = NULL, updated_at = ? WHERE id = ?', now, id);
    await db.runAsync(
      'UPDATE transactions SET deleted_at = NULL, updated_at = ? WHERE installment_plan_id = ? AND deleted_at = ?',
      now,
      id,
      deletedAt,
    );
  });
}
