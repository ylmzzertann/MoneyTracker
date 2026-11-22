import type { SQLiteDatabase } from 'expo-sqlite';

import { newId, nowUtc } from '@/lib/id';

import type { CategoryKind } from '../defaults';
import { LOCAL_HOUSEHOLD } from '../migrations';
import type { Category, CategoryInput, Channel } from '../types';

type CategoryRow = {
  id: string;
  key: string | null;
  name: string | null;
  parent_id: string | null;
  kind: CategoryKind;
  icon: string;
  color: string;
  channel: Channel | null;
  sort_order: number;
  hidden: number;
};

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  key: r.key,
  name: r.name,
  parentId: r.parent_id,
  kind: r.kind,
  icon: r.icon,
  color: r.color,
  channel: r.channel,
  sortOrder: r.sort_order,
  hidden: r.hidden === 1,
});

export async function listCategories(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order, created_at',
  );
  return rows.map(toCategory);
}

export async function createCategory(db: SQLiteDatabase, input: CategoryInput): Promise<string> {
  const id = newId();
  const now = nowUtc();
  const order = await db.getFirstAsync<{ n: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories',
  );
  await db.runAsync(
    `INSERT INTO categories (id, household_id, key, name, parent_id, kind, icon, color, sort_order, hidden,
       created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    id,
    LOCAL_HOUSEHOLD,
    input.name.trim(),
    input.parentId ?? null,
    input.kind,
    input.icon,
    input.color,
    order?.n ?? 0,
    now,
    now,
  );
  return id;
}

/** System categories keep their translated name, so only icon/colour change for them. */
export async function updateCategory(db: SQLiteDatabase, id: string, input: CategoryInput): Promise<void> {
  await db.runAsync(
    `UPDATE categories SET name = CASE WHEN key IS NULL THEN ? ELSE name END, icon = ?, color = ?, updated_at = ?
     WHERE id = ?`,
    input.name.trim(),
    input.icon,
    input.color,
    nowUtc(),
    id,
  );
}

export async function setCategoryHidden(db: SQLiteDatabase, id: string, hidden: boolean): Promise<void> {
  await db.runAsync('UPDATE categories SET hidden = ?, updated_at = ? WHERE id = ?', hidden ? 1 : 0, nowUtc(), id);
}

/** Per-category usage counts, used to order the quick-add grid by what the user picks most. */
export async function categoryUsage(db: SQLiteDatabase, sinceLocalIso: string): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ category_id: string; n: number }>(
    `SELECT s.category_id, COUNT(*) AS n
     FROM transaction_splits s JOIN transactions t ON t.id = s.transaction_id
     WHERE t.deleted_at IS NULL AND s.deleted_at IS NULL AND t.occurred_at >= ?
     GROUP BY s.category_id`,
    sinceLocalIso,
  );
  return Object.fromEntries(rows.map((r) => [r.category_id, r.n]));
}
