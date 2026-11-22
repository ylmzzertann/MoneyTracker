import type { SQLiteDatabase } from 'expo-sqlite';

import type { ExistingTx } from '@/features/import/dedupe';
import { nowUtc } from '@/lib/id';

import { LOCAL_HOUSEHOLD } from '../migrations';
import type { TransactionInput, TxKind } from '../types';
import { insertTransaction } from './transactions';

/** Learned values such as "last4:1234" → account id. */
export async function getImportHints(db: SQLiteDatabase, keys: string[]): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM import_hints WHERE household_id = ? AND key IN (${keys.map(() => '?').join(', ')})`,
    LOCAL_HOUSEHOLD,
    ...keys,
  );
  return new Map(rows.map((r) => [r.key, r.value]));
}

async function setImportHints(db: SQLiteDatabase, hints: [string, string][]): Promise<void> {
  const now = nowUtc();
  for (const [key, value] of hints) {
    await db.runAsync(
      `INSERT INTO import_hints (household_id, key, value, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (household_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      LOCAL_HOUSEHOLD,
      key,
      value,
      now,
    );
  }
}

/** Normalised merchant name → the category last used with it. */
export async function learnedMerchantCategories(db: SQLiteDatabase): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<{ normalized_name: string; default_category_id: string }>(
    `SELECT normalized_name, default_category_id FROM merchants
     WHERE household_id = ? AND deleted_at IS NULL AND default_category_id IS NOT NULL`,
    LOCAL_HOUSEHOLD,
  );
  return new Map(rows.map((r) => [r.normalized_name, r.default_category_id]));
}

/**
 * What the duplicate check needs: keys imported before (deleted ones too, so a
 * row the user removed does not come back) and live transactions in the window.
 */
export async function importLookup(
  db: SQLiteDatabase,
  keys: string[],
  start: string,
  end: string,
): Promise<{ importedKeys: Set<string>; existing: ExistingTx[] }> {
  const importedKeys = new Set<string>();
  for (let i = 0; i < keys.length; i += 400) {
    const chunk = keys.slice(i, i + 400);
    const rows = await db.getAllAsync<{ external_id: string }>(
      `SELECT external_id FROM transactions WHERE household_id = ? AND external_id IN (${chunk.map(() => '?').join(', ')})`,
      LOCAL_HOUSEHOLD,
      ...chunk,
    );
    for (const r of rows) importedKeys.add(r.external_id);
  }
  const rows = await db.getAllAsync<{ kind: TxKind; amount_minor: number; currency: string; occurred_at: string }>(
    `SELECT kind, amount_minor, currency, occurred_at FROM transactions
     WHERE household_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?`,
    LOCAL_HOUSEHOLD,
    start,
    end,
  );
  return {
    importedKeys,
    existing: rows.map((r) => ({ kind: r.kind, amountMinor: r.amount_minor, currency: r.currency, occurredAt: r.occurred_at })),
  };
}

/** Saves the accepted rows and what was learned, all or nothing. */
export async function saveImport(db: SQLiteDatabase, inputs: TransactionInput[], hints: [string, string][]): Promise<number> {
  await db.withTransactionAsync(async () => {
    for (const input of inputs) await insertTransaction(db, input);
    await setImportHints(db, hints);
  });
  return inputs.length;
}
