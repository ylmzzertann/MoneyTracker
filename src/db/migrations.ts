import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CATEGORIES, systemCategoryId } from './defaults';

/** Until cloud sync (phase 4) every row belongs to the single local household. */
export const LOCAL_HOUSEHOLD = 'local';

/**
 * Every table carries household_id, created_at, updated_at and deleted_at from
 * day one so the phase-4 sync engine can push/pull rows without a rewrite.
 * Deletes are soft (deleted_at) for the same reason and to support undo.
 */
const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE accounts (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    currency TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    statement_day INTEGER,
    due_day INTEGER,
    credit_limit_minor INTEGER,
    is_shared INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL,
    key TEXT,
    name TEXT,
    parent_id TEXT,
    kind TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    channel TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE merchants (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    default_category_id TEXT,
    channel TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE UNIQUE INDEX merchants_normalized ON merchants (household_id, normalized_name);

  CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    merchant_id TEXT,
    note TEXT,
    channel TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT,
    transfer_account_id TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX transactions_occurred ON transactions (household_id, occurred_at);
  CREATE INDEX transactions_external ON transactions (external_id);

  CREATE TABLE transaction_splits (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX splits_transaction ON transaction_splits (transaction_id);
  CREATE INDEX splits_category ON transaction_splits (category_id);

  CREATE TABLE fx_rates (
    quote TEXT PRIMARY KEY NOT NULL,
    rate REAL NOT NULL,
    date TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );
  `,
  // v2 — planning: budgets, recurring payments, installments, goals
  `
  ALTER TABLE transactions ADD COLUMN recurring_rule_id TEXT;
  ALTER TABLE transactions ADD COLUMN installment_plan_id TEXT;
  ALTER TABLE transactions ADD COLUMN installment_no INTEGER;
  CREATE INDEX transactions_rule ON transactions (recurring_rule_id);
  CREATE INDEX transactions_plan ON transactions (installment_plan_id);

  CREATE TABLE budgets (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL,
    category_id TEXT,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX budgets_category ON budgets (household_id, category_id);

  CREATE TABLE recurring_rules (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    frequency TEXT NOT NULL,
    interval_count INTEGER NOT NULL DEFAULT 1,
    anchor_day INTEGER,
    next_due TEXT NOT NULL,
    auto_post INTEGER NOT NULL DEFAULT 0,
    remind_days INTEGER,
    is_subscription INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE installment_plans (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    merchant_name TEXT,
    total_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    count INTEGER NOT NULL,
    first_date TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE goals (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    target_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    target_date TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE goal_contributions (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL,
    goal_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    occurred_at TEXT NOT NULL,
    note TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX goal_contributions_goal ON goal_contributions (goal_id);
  `,
  // v3 — import: what the app learned from earlier imports ("card 1234 is this account")
  `
  CREATE TABLE import_hints (
    household_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (household_id, key)
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (row === null) throw new Error('Could not read the database schema version');
  const current = row.user_version;
  if (current > SCHEMA_VERSION) throw new Error('Database schema is newer than this app supports');

  if (current < SCHEMA_VERSION) {
    await db.withTransactionAsync(async () => {
      for (let v = current; v < SCHEMA_VERSION; v++) {
        await db.execAsync(MIGRATIONS[v]);
      }
      await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    });
  }

  await seedSystemCategories(db);
}

/** Inserts any system category that is missing (new ones can ship in app updates). */
async function seedSystemCategories(db: SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.getAllAsync<{ id: string }>("SELECT id FROM categories WHERE id LIKE 'sys:%'");
  const have = new Set(existing.map((r) => r.id));
  const missing = DEFAULT_CATEGORIES.filter((c) => !have.has(systemCategoryId(c.key)));
  if (missing.length === 0) return;

  await db.withTransactionAsync(async () => {
    for (const c of missing) {
      const order = DEFAULT_CATEGORIES.indexOf(c);
      await db.runAsync(
        `INSERT INTO categories (id, household_id, key, name, parent_id, kind, icon, color, channel,
           sort_order, hidden, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        systemCategoryId(c.key),
        LOCAL_HOUSEHOLD,
        c.key,
        c.parent ? systemCategoryId(c.parent) : null,
        c.kind,
        c.icon,
        c.color,
        c.channel ?? null,
        order,
        now,
        now,
      );
    }
  });
}
