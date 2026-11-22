import type { SQLiteDatabase } from 'expo-sqlite';

import { toLocalISO } from '@/lib/dates';
import { newId, nowUtc } from '@/lib/id';

import { LOCAL_HOUSEHOLD } from '../migrations';
import type { Goal, GoalContribution, GoalInput } from '../types';

type GoalRow = {
  id: string;
  name: string;
  icon: string;
  color: string;
  target_minor: number;
  currency: string;
  target_date: string | null;
  archived: number;
  saved: number | null;
};

const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  color: r.color,
  targetMinor: r.target_minor,
  currency: r.currency,
  targetDate: r.target_date,
  archived: r.archived === 1,
  savedMinor: r.saved ?? 0,
});

const SELECT = `SELECT g.*,
  (SELECT SUM(c.amount_minor) FROM goal_contributions c WHERE c.goal_id = g.id AND c.deleted_at IS NULL) AS saved
  FROM goals g`;

export async function listGoals(db: SQLiteDatabase): Promise<Goal[]> {
  const rows = await db.getAllAsync<GoalRow>(`${SELECT} WHERE g.deleted_at IS NULL ORDER BY g.archived, g.sort_order, g.created_at`);
  return rows.map(toGoal);
}

export async function getGoal(db: SQLiteDatabase, id: string): Promise<Goal | null> {
  const r = await db.getFirstAsync<GoalRow>(`${SELECT} WHERE g.id = ? AND g.deleted_at IS NULL`, id);
  return r ? toGoal(r) : null;
}

export async function createGoal(db: SQLiteDatabase, input: GoalInput): Promise<string> {
  const id = newId();
  const now = nowUtc();
  const order = await db.getFirstAsync<{ n: number }>('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM goals');
  await db.runAsync(
    `INSERT INTO goals (id, household_id, name, icon, color, target_minor, currency, target_date, archived, sort_order,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    id,
    LOCAL_HOUSEHOLD,
    input.name.trim(),
    input.icon,
    input.color,
    input.targetMinor,
    input.currency,
    input.targetDate,
    order?.n ?? 0,
    now,
    now,
  );
  return id;
}

export async function updateGoal(db: SQLiteDatabase, id: string, input: GoalInput): Promise<void> {
  await db.runAsync(
    `UPDATE goals SET name = ?, icon = ?, color = ?, target_minor = ?, currency = ?, target_date = ?, updated_at = ?
     WHERE id = ?`,
    input.name.trim(),
    input.icon,
    input.color,
    input.targetMinor,
    input.currency,
    input.targetDate,
    nowUtc(),
    id,
  );
}

export async function setGoalArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<void> {
  await db.runAsync('UPDATE goals SET archived = ?, updated_at = ? WHERE id = ?', archived ? 1 : 0, nowUtc(), id);
}

export async function deleteGoal(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowUtc();
  await db.runAsync('UPDATE goals SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}

/** Adds money to a goal (negative = taking money out). */
export async function addContribution(db: SQLiteDatabase, goalId: string, amountMinor: number, when = new Date()): Promise<string> {
  if (!Number.isInteger(amountMinor) || amountMinor === 0) throw new Error('Amount must be a non-zero integer');
  const id = newId();
  const now = nowUtc();
  await db.runAsync(
    `INSERT INTO goal_contributions (id, household_id, goal_id, amount_minor, occurred_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    LOCAL_HOUSEHOLD,
    goalId,
    amountMinor,
    toLocalISO(when),
    now,
    now,
  );
  return id;
}

export async function listContributions(db: SQLiteDatabase, goalId: string): Promise<GoalContribution[]> {
  const rows = await db.getAllAsync<{ id: string; goal_id: string; amount_minor: number; occurred_at: string; note: string | null }>(
    'SELECT * FROM goal_contributions WHERE goal_id = ? AND deleted_at IS NULL ORDER BY occurred_at DESC, created_at DESC',
    goalId,
  );
  return rows.map((r) => ({ id: r.id, goalId: r.goal_id, amountMinor: r.amount_minor, occurredAt: r.occurred_at, note: r.note }));
}

export async function deleteContribution(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowUtc();
  await db.runAsync('UPDATE goal_contributions SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}

export async function restoreContribution(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE goal_contributions SET deleted_at = NULL, updated_at = ? WHERE id = ?', nowUtc(), id);
}
