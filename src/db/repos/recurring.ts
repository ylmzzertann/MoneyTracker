import type { SQLiteDatabase } from 'expo-sqlite';

import { catchUp, nextDate } from '@/features/plan/schedule';
import { dayKey, parseLocalISO, toLocalISO } from '@/lib/dates';
import { newId, nowUtc } from '@/lib/id';

import { LOCAL_HOUSEHOLD } from '../migrations';
import type { Frequency, RecurringRule, RecurringRuleInput, TxKind } from '../types';
import { insertTransaction } from './transactions';

type RuleRow = {
  id: string;
  kind: TxKind;
  name: string;
  account_id: string;
  category_id: string;
  amount_minor: number;
  currency: string;
  frequency: Frequency;
  interval_count: number;
  anchor_day: number | null;
  next_due: string;
  auto_post: number;
  remind_days: number | null;
  is_subscription: number;
  active: number;
};

const toRule = (r: RuleRow): RecurringRule => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  accountId: r.account_id,
  categoryId: r.category_id,
  amountMinor: r.amount_minor,
  currency: r.currency,
  frequency: r.frequency,
  interval: r.interval_count,
  anchorDay: r.anchor_day,
  nextDue: r.next_due,
  autoPost: r.auto_post === 1,
  remindDays: r.remind_days,
  isSubscription: r.is_subscription === 1,
  active: r.active === 1,
});

export async function listRules(db: SQLiteDatabase): Promise<RecurringRule[]> {
  const rows = await db.getAllAsync<RuleRow>('SELECT * FROM recurring_rules WHERE deleted_at IS NULL ORDER BY next_due, name');
  return rows.map(toRule);
}

export async function getRule(db: SQLiteDatabase, id: string): Promise<RecurringRule | null> {
  const r = await db.getFirstAsync<RuleRow>('SELECT * FROM recurring_rules WHERE id = ? AND deleted_at IS NULL', id);
  return r ? toRule(r) : null;
}

export async function createRule(db: SQLiteDatabase, input: RecurringRuleInput): Promise<string> {
  const id = newId();
  const now = nowUtc();
  await db.runAsync(
    `INSERT INTO recurring_rules (id, household_id, kind, name, account_id, category_id, amount_minor, currency, frequency,
       interval_count, anchor_day, next_due, auto_post, remind_days, is_subscription, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    LOCAL_HOUSEHOLD,
    input.kind,
    input.name.trim(),
    input.accountId,
    input.categoryId,
    input.amountMinor,
    input.currency,
    input.frequency,
    input.interval,
    input.anchorDay,
    input.nextDue,
    input.autoPost ? 1 : 0,
    input.remindDays,
    input.isSubscription ? 1 : 0,
    input.active ? 1 : 0,
    now,
    now,
  );
  return id;
}

export async function updateRule(db: SQLiteDatabase, id: string, input: RecurringRuleInput): Promise<void> {
  await db.runAsync(
    `UPDATE recurring_rules SET kind = ?, name = ?, account_id = ?, category_id = ?, amount_minor = ?, currency = ?,
       frequency = ?, interval_count = ?, anchor_day = ?, next_due = ?, auto_post = ?, remind_days = ?,
       is_subscription = ?, active = ?, updated_at = ?
     WHERE id = ?`,
    input.kind,
    input.name.trim(),
    input.accountId,
    input.categoryId,
    input.amountMinor,
    input.currency,
    input.frequency,
    input.interval,
    input.anchorDay,
    input.nextDue,
    input.autoPost ? 1 : 0,
    input.remindDays,
    input.isSubscription ? 1 : 0,
    input.active ? 1 : 0,
    nowUtc(),
    id,
  );
}

export async function deleteRule(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowUtc();
  await db.runAsync('UPDATE recurring_rules SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}

export async function restoreRule(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE recurring_rules SET deleted_at = NULL, updated_at = ? WHERE id = ?', nowUtc(), id);
}

/** Moves the rule past the occurrence due on `due` (paid or skipped). Never moves it backwards. */
export async function advanceRule(db: SQLiteDatabase, rule: RecurringRule, due: string): Promise<void> {
  const next = nextDate(due, rule);
  if (next <= rule.nextDue) return;
  await db.runAsync('UPDATE recurring_rules SET next_due = ?, updated_at = ? WHERE id = ?', next, nowUtc(), rule.id);
}

export async function setRuleNextDue(db: SQLiteDatabase, id: string, nextDue: string): Promise<void> {
  await db.runAsync('UPDATE recurring_rules SET next_due = ?, updated_at = ? WHERE id = ?', nextDue, nowUtc(), id);
}

const externalId = (ruleId: string, due: string) => `rec:${ruleId}:${due}`;

/**
 * Books one occurrence of a rule as a transaction (dated on the due day, or
 * today when paid early) and advances the rule. Booking the same occurrence
 * twice is a no-op. Returns the new transaction id, or null when it existed.
 */
export async function postOccurrence(
  db: SQLiteDatabase,
  rule: RecurringRule,
  due: string,
  opts: { amountMinor?: number; now?: Date } = {},
): Promise<string | null> {
  const now = opts.now ?? new Date();
  let id: string | null = null;
  await db.withTransactionAsync(async () => {
    const exists = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM transactions WHERE external_id = ? AND deleted_at IS NULL',
      externalId(rule.id, due),
    );
    if (!exists) {
      const dueDate = parseLocalISO(due);
      const when = due > dayKey(now) ? now : new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), 9);
      const amount = opts.amountMinor ?? rule.amountMinor;
      id = await insertTransaction(
        db,
        {
          kind: rule.kind,
          accountId: rule.accountId,
          amountMinor: amount,
          currency: rule.currency,
          occurredAt: toLocalISO(when),
          merchantName: rule.name,
          source: 'recurring',
          externalId: externalId(rule.id, due),
          splits: [{ categoryId: rule.categoryId, amountMinor: amount }],
        },
        { recurringRuleId: rule.id },
      );
    }
    await advanceRule(db, rule, due);
  });
  return id;
}

/** Books every overdue occurrence of the automatic rules. Returns how many transactions were added. */
export async function postDueRules(db: SQLiteDatabase, now = new Date()): Promise<number> {
  const today = dayKey(now);
  const rules = (await listRules(db)).filter((r) => r.active && r.autoPost && r.nextDue <= today);
  let posted = 0;
  for (const r of rules) {
    let rule = r;
    // At most a year of catching up per rule, so a forgotten weekly rule cannot flood the list.
    for (let i = 0; i < 53 && rule.nextDue <= today; i++) {
      if (await postOccurrence(db, rule, rule.nextDue, { now })) posted++;
      rule = { ...rule, nextDue: nextDate(rule.nextDue, rule) };
    }
    if (rule.nextDue <= today) await setRuleNextDue(db, rule.id, catchUp(rule.nextDue, rule, now));
  }
  return posted;
}
