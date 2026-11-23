import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useEffectEvent } from 'react';
import { AppState } from 'react-native';

import { listBudgets, setBudget } from '@/db/repos/budgets';
import { listCategories } from '@/db/repos/categories';
import { loadRates } from '@/db/repos/fx';
import { listRules, postDueRules } from '@/db/repos/recurring';
import { reportRows } from '@/db/repos/transactions';
import { convertRows } from '@/features/reports/aggregate';
import i18n, { categoryKey, formattingLocale, resolveLanguage } from '@/i18n';
import { monthKey, periodRange, toLocalISO } from '@/lib/dates';
import { convertMinor } from '@/lib/fx';
import { formatMoney } from '@/lib/money';
import { budgetAlertKey, useAlerts } from '@/store/alerts';
import { bumpData, useDataVersion } from '@/store/dataVersion';
import { useSettings } from '@/store/settings';
import { showToast } from '@/store/toast';

import { budgetStatuses, thresholdCrossed } from './budget';
import { loadCardSummaries } from './cardSummary';
import { scheduleReminders } from './notifications';
import { buildReminders } from './reminders';
import { buildUpcoming } from './upcoming';
import { useNotificationTaps } from './useNotificationTaps';

/** Moves the phase-1 monthly budget from settings into the budgets table, once. */
async function migrateLegacyBudget(db: SQLiteDatabase) {
  const alerts = useAlerts.getState();
  if (alerts.budgetMigrated) return;
  const s = useSettings.getState();
  if (s.monthlyBudgetMinor) {
    const existing = await listBudgets(db);
    if (!existing.some((b) => b.categoryId === null)) await setBudget(db, null, s.monthlyBudgetMinor, s.baseCurrency);
    s.set({ monthlyBudgetMinor: null });
    bumpData();
  }
  alerts.set({ budgetMigrated: true });
}

/**
 * Compares this month's spending with every budget and remembers which
 * thresholds (80% / 100%) were reached. With `announce`, shows the most
 * important newly reached one as a toast; without it (right after the user
 * changed a limit) it only records the current state.
 */
export async function checkBudgetAlerts(db: SQLiteDatabase, announce = true, now = new Date()): Promise<void> {
  const s = useSettings.getState();
  const budgets = await listBudgets(db);
  if (budgets.length === 0) return;
  const range = periodRange('month', now, s.weekStart);
  const [raw, fx, categories] = await Promise.all([
    reportRows(db, toLocalISO(range.start), toLocalISO(range.end)),
    loadRates(db),
    listCategories(db),
  ]);
  const rows = convertRows(raw, s.baseCurrency, fx.rates).rows;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rootOf = (id: string) => byId.get(id)?.parentId ?? id;
  const lines = budgets.map((b) => ({ categoryId: b.categoryId, limit: convertMinor(b.amountMinor, b.currency, s.baseCurrency, fx.rates) ?? b.amountMinor }));
  const month = monthKey(now);
  const store = useAlerts.getState();
  let best: { categoryId: string | null; level: 80 | 100 } | null = null;
  for (const st of budgetStatuses(rows, lines, rootOf)) {
    const key = budgetAlertKey(month, st.categoryId);
    const level = thresholdCrossed(store.budgetAlerts[key] ?? 0, st.share);
    if (!level) continue;
    store.markBudget(key, level);
    if (!best || level > best.level || (level === best.level && st.categoryId === null)) best = { categoryId: st.categoryId, level };
  }
  if (!announce || !best || !s.notifyBudgets) return;
  const c = best.categoryId ? byId.get(best.categoryId) : undefined;
  const name = best.categoryId ? (c?.name ?? (c?.key ? i18n.t(categoryKey(c.key)) : '?')) : i18n.t('budgets.monthly');
  showToast({
    message: i18n.t(best.level === 100 ? 'alerts.budget100' : 'alerts.budget80', { name }),
    actionLabel: i18n.t('budgets.title'),
    onAction: () => router.push('/plan/budgets'),
  });
}

async function runDaily(db: SQLiteDatabase) {
  await migrateLegacyBudget(db);
  const posted = await postDueRules(db);
  if (posted > 0) {
    bumpData();
    showToast({ message: i18n.t('recurring.autoPosted', { count: posted }), actionLabel: i18n.t('common.seeAll'), onAction: () => router.navigate('/activity') });
  }
  await checkBudgetAlerts(db);
}

async function rescheduleReminders(db: SQLiteDatabase) {
  const s = useSettings.getState();
  if (!s.notifyBills) return scheduleReminders([]);
  const now = new Date();
  const [rules, cards] = await Promise.all([listRules(db), loadCardSummaries(db, now)]);
  const locale = formattingLocale(resolveLanguage(s.language), s.region);
  const reminders = buildReminders(buildUpcoming(rules, cards, now, 60), {
    hour: s.reminderHour,
    now,
    t: (key, options) => i18n.t(key, options ?? {}),
    money: (minor, currency) => formatMoney(minor, currency, locale, { trimZeroCents: true }),
  });
  await scheduleReminders(reminders);
}

/**
 * Background chores of the planning features: on launch and whenever the app
 * comes back to the foreground it books due automatic payments and checks
 * budgets; after data changes it refreshes the scheduled reminders.
 * Tapping a reminder opens the matching screen.
 */
export function usePlanRunner() {
  const db = useSQLiteContext();
  const onboarded = useSettings((s) => s.onboarded);
  const notifyBills = useSettings((s) => s.notifyBills);
  const hour = useSettings((s) => s.reminderHour);
  const language = useSettings((s) => s.language);
  const version = useDataVersion((s) => s.version);

  const daily = useEffectEvent(() => {
    runDaily(db).catch(() => {
      // A failed run is retried the next time the app opens.
    });
  });
  useEffect(() => {
    if (!onboarded) return;
    daily();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') daily();
    });
    return () => sub.remove();
  }, [onboarded]);

  const reschedule = useEffectEvent(() => {
    rescheduleReminders(db).catch(() => {
      // Notifications unavailable (e.g. permission revoked): nothing to do.
    });
  });
  useEffect(() => {
    if (!onboarded) return;
    const timer = setTimeout(() => reschedule(), 1500);
    return () => clearTimeout(timer);
  }, [onboarded, version, notifyBills, hour, language]);

  useNotificationTaps(onboarded);
}
