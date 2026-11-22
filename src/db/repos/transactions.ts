import type { SQLiteDatabase } from 'expo-sqlite';

import { newId, nowUtc } from '@/lib/id';
import { normalizeName } from '@/lib/text';

import { LOCAL_HOUSEHOLD } from '../migrations';
import type {
  Channel,
  ReportRow,
  Transaction,
  TransactionFilter,
  TransactionInput,
  TransactionListRow,
  TxKind,
  TxSource,
} from '../types';

function validate(input: TransactionInput) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive integer in minor units');
  }
  if (input.splits.length === 0) throw new Error('At least one category is required');
  const sum = input.splits.reduce((a, s) => a + s.amountMinor, 0);
  if (sum !== input.amountMinor) throw new Error('Split amounts must add up to the total');
}

/** Finds or creates the merchant row and remembers the category/channel last used with it. */
async function upsertMerchant(
  db: SQLiteDatabase,
  name: string | null | undefined,
  categoryId: string,
  channel: Channel | null,
): Promise<string | null> {
  const clean = name?.trim();
  if (!clean) return null;
  const normalized = normalizeName(clean);
  if (!normalized) return null;
  const now = nowUtc();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM merchants WHERE household_id = ? AND normalized_name = ?',
    LOCAL_HOUSEHOLD,
    normalized,
  );
  if (existing) {
    await db.runAsync(
      'UPDATE merchants SET name = ?, default_category_id = ?, channel = ?, updated_at = ?, deleted_at = NULL WHERE id = ?',
      clean,
      categoryId,
      channel,
      now,
      existing.id,
    );
    return existing.id;
  }
  const id = newId();
  await db.runAsync(
    `INSERT INTO merchants (id, household_id, name, normalized_name, default_category_id, channel, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    LOCAL_HOUSEHOLD,
    clean,
    normalized,
    categoryId,
    channel,
    now,
    now,
  );
  return id;
}

async function writeSplits(db: SQLiteDatabase, transactionId: string, input: TransactionInput, now: string) {
  for (const s of input.splits) {
    await db.runAsync(
      `INSERT INTO transaction_splits (id, household_id, transaction_id, category_id, amount_minor, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      LOCAL_HOUSEHOLD,
      transactionId,
      s.categoryId,
      s.amountMinor,
      now,
      now,
    );
  }
}

function primaryCategory(input: TransactionInput): string {
  return [...input.splits].sort((a, b) => b.amountMinor - a.amountMinor)[0].categoryId;
}

export async function createTransaction(db: SQLiteDatabase, input: TransactionInput): Promise<string> {
  validate(input);
  const id = newId();
  const now = nowUtc();
  await db.withTransactionAsync(async () => {
    const merchantId = await upsertMerchant(db, input.merchantName, primaryCategory(input), input.channel ?? null);
    await db.runAsync(
      `INSERT INTO transactions (id, household_id, account_id, kind, amount_minor, currency, occurred_at, merchant_id,
         note, channel, source, external_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      LOCAL_HOUSEHOLD,
      input.accountId,
      input.kind,
      input.amountMinor,
      input.currency,
      input.occurredAt,
      merchantId,
      input.note?.trim() || null,
      input.channel ?? null,
      input.source ?? 'manual',
      input.externalId ?? null,
      now,
      now,
    );
    await writeSplits(db, id, input, now);
  });
  return id;
}

export async function updateTransaction(db: SQLiteDatabase, id: string, input: TransactionInput): Promise<void> {
  validate(input);
  const now = nowUtc();
  await db.withTransactionAsync(async () => {
    const merchantId = await upsertMerchant(db, input.merchantName, primaryCategory(input), input.channel ?? null);
    await db.runAsync(
      `UPDATE transactions SET account_id = ?, kind = ?, amount_minor = ?, currency = ?, occurred_at = ?,
         merchant_id = ?, note = ?, channel = ?, updated_at = ?
       WHERE id = ?`,
      input.accountId,
      input.kind,
      input.amountMinor,
      input.currency,
      input.occurredAt,
      merchantId,
      input.note?.trim() || null,
      input.channel ?? null,
      now,
      id,
    );
    await db.runAsync(
      'UPDATE transaction_splits SET deleted_at = ?, updated_at = ? WHERE transaction_id = ? AND deleted_at IS NULL',
      now,
      now,
      id,
    );
    await writeSplits(db, id, input, now);
  });
}

export async function softDeleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowUtc();
  await db.runAsync('UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}

export async function restoreTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE transactions SET deleted_at = NULL, updated_at = ? WHERE id = ?', nowUtc(), id);
}

type TxRow = {
  id: string;
  account_id: string;
  kind: TxKind;
  amount_minor: number;
  currency: string;
  occurred_at: string;
  merchant_name: string | null;
  note: string | null;
  channel: Channel | null;
  source: TxSource;
  external_id: string | null;
};

export async function getTransaction(db: SQLiteDatabase, id: string): Promise<Transaction | null> {
  const r = await db.getFirstAsync<TxRow>(
    `SELECT t.*, m.name AS merchant_name FROM transactions t LEFT JOIN merchants m ON m.id = t.merchant_id
     WHERE t.id = ?`,
    id,
  );
  if (!r) return null;
  const splits = await db.getAllAsync<{ category_id: string; amount_minor: number }>(
    'SELECT category_id, amount_minor FROM transaction_splits WHERE transaction_id = ? AND deleted_at IS NULL',
    id,
  );
  return {
    id: r.id,
    kind: r.kind,
    accountId: r.account_id,
    amountMinor: r.amount_minor,
    currency: r.currency,
    occurredAt: r.occurred_at,
    merchantName: r.merchant_name,
    note: r.note,
    channel: r.channel,
    source: r.source,
    externalId: r.external_id,
    splits: splits.map((s) => ({ categoryId: s.category_id, amountMinor: s.amount_minor })),
  };
}

type ListRow = {
  id: string;
  kind: TxKind;
  account_id: string;
  account_name: string | null;
  amount_minor: number;
  currency: string;
  occurred_at: string;
  merchant_name: string | null;
  note: string | null;
  channel: Channel | null;
  source: TxSource;
  category_id: string | null;
  split_count: number;
};

export async function listTransactions(db: SQLiteDatabase, f: TransactionFilter): Promise<TransactionListRow[]> {
  const where: string[] = ['t.deleted_at IS NULL', 't.occurred_at >= ?', 't.occurred_at < ?'];
  const params: (string | number)[] = [f.start, f.end];
  if (f.kind) {
    where.push('t.kind = ?');
    params.push(f.kind);
  }
  if (f.accountId) {
    where.push('t.account_id = ?');
    params.push(f.accountId);
  }
  if (f.categoryIds && f.categoryIds.length > 0) {
    where.push(
      `EXISTS (SELECT 1 FROM transaction_splits fs WHERE fs.transaction_id = t.id AND fs.deleted_at IS NULL
        AND fs.category_id IN (${f.categoryIds.map(() => '?').join(',')}))`,
    );
    params.push(...f.categoryIds);
  }
  if (f.search?.trim()) {
    where.push("(m.normalized_name LIKE ? OR LOWER(COALESCE(t.note, '')) LIKE ?)");
    const q = `%${normalizeName(f.search)}%`;
    params.push(q, `%${f.search.trim().toLowerCase()}%`);
  }
  const rows = await db.getAllAsync<ListRow>(
    `SELECT t.id, t.kind, t.account_id, a.name AS account_name, t.amount_minor, t.currency, t.occurred_at,
            m.name AS merchant_name, t.note, t.channel, t.source,
            (SELECT s.category_id FROM transaction_splits s
               WHERE s.transaction_id = t.id AND s.deleted_at IS NULL
               ORDER BY s.amount_minor DESC LIMIT 1) AS category_id,
            (SELECT COUNT(*) FROM transaction_splits s
               WHERE s.transaction_id = t.id AND s.deleted_at IS NULL) AS split_count
     FROM transactions t
     LEFT JOIN merchants m ON m.id = t.merchant_id
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE ${where.join(' AND ')}
     ORDER BY t.occurred_at DESC, t.created_at DESC`,
    params,
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    accountId: r.account_id,
    accountName: r.account_name ?? '',
    amountMinor: r.amount_minor,
    currency: r.currency,
    occurredAt: r.occurred_at,
    merchantName: r.merchant_name,
    note: r.note,
    channel: r.channel,
    source: r.source,
    categoryId: r.category_id ?? 'sys:other',
    splitCount: r.split_count,
  }));
}

/** Split-level rows for reports in [start, end). */
export async function reportRows(db: SQLiteDatabase, start: string, end: string): Promise<ReportRow[]> {
  const rows = await db.getAllAsync<{
    transaction_id: string;
    kind: TxKind;
    occurred_at: string;
    account_id: string;
    merchant_name: string | null;
    channel: Channel | null;
    category_id: string;
    amount_minor: number;
    currency: string;
  }>(
    `SELECT t.id AS transaction_id, t.kind, t.occurred_at, t.account_id, m.name AS merchant_name, t.channel,
            s.category_id, s.amount_minor, t.currency
     FROM transaction_splits s
     JOIN transactions t ON t.id = s.transaction_id
     LEFT JOIN merchants m ON m.id = t.merchant_id
     WHERE t.deleted_at IS NULL AND s.deleted_at IS NULL AND t.occurred_at >= ? AND t.occurred_at < ?`,
    start,
    end,
  );
  return rows.map((r) => ({
    transactionId: r.transaction_id,
    kind: r.kind,
    occurredAt: r.occurred_at,
    accountId: r.account_id,
    merchantName: r.merchant_name,
    channel: r.channel,
    categoryId: r.category_id,
    amountMinor: r.amount_minor,
    currency: r.currency,
  }));
}

/** Amounts the user enters most often for a category, offered as one-tap chips. */
export async function frequentAmounts(
  db: SQLiteDatabase,
  categoryId: string,
  currency: string,
  limit = 6,
): Promise<number[]> {
  const rows = await db.getAllAsync<{ amount_minor: number }>(
    `SELECT t.amount_minor, COUNT(*) AS n, MAX(t.occurred_at) AS last
     FROM transactions t JOIN transaction_splits s ON s.transaction_id = t.id AND s.deleted_at IS NULL
     WHERE t.deleted_at IS NULL AND s.category_id = ? AND t.currency = ?
     GROUP BY t.amount_minor ORDER BY n DESC, last DESC LIMIT ?`,
    categoryId,
    currency,
    limit,
  );
  return rows.map((r) => r.amount_minor).sort((a, b) => a - b);
}

/** Recently used merchant names, optionally for one category, newest first. */
export async function recentMerchants(db: SQLiteDatabase, categoryId: string | null, limit = 8): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT m.name, MAX(t.occurred_at) AS last
     FROM merchants m JOIN transactions t ON t.merchant_id = m.id AND t.deleted_at IS NULL
     ${categoryId ? 'JOIN transaction_splits s ON s.transaction_id = t.id AND s.deleted_at IS NULL AND s.category_id = ?' : ''}
     WHERE m.deleted_at IS NULL
     GROUP BY m.id ORDER BY last DESC LIMIT ?`,
    ...(categoryId ? [categoryId, limit] : [limit]),
  );
  return rows.map((r) => r.name);
}

export async function allTransactionsForExport(db: SQLiteDatabase, start: string, end: string) {
  return db.getAllAsync<{
    occurred_at: string;
    kind: TxKind;
    amount_minor: number;
    currency: string;
    account_name: string | null;
    merchant_name: string | null;
    category_id: string;
    split_amount_minor: number;
    channel: Channel | null;
    note: string | null;
  }>(
    `SELECT t.occurred_at, t.kind, t.amount_minor, t.currency, a.name AS account_name, m.name AS merchant_name,
            s.category_id, s.amount_minor AS split_amount_minor, t.channel, t.note
     FROM transactions t
     JOIN transaction_splits s ON s.transaction_id = t.id AND s.deleted_at IS NULL
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN merchants m ON m.id = t.merchant_id
     WHERE t.deleted_at IS NULL AND t.occurred_at >= ? AND t.occurred_at < ?
     ORDER BY t.occurred_at`,
    start,
    end,
  );
}
