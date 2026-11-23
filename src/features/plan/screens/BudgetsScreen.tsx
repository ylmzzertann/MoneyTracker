import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { ProgressBar, useBudgetColor } from '@/components/Progress';
import { Sky } from '@/components/Sky';
import { AccentButton, Card, Eyebrow, GlassPill, ScreenHeader, Txt } from '@/components/ui';
import { removeBudget, setBudget } from '@/db/repos/budgets';
import { useCategories } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { usePeriodRows } from '@/hooks/usePeriodRows';
import { useBudgets } from '@/hooks/usePlan';
import { monthKey, periodRange, shiftAnchor } from '@/lib/dates';
import { bumpData } from '@/store/dataVersion';
import { useSettings } from '@/store/settings';
import { showToast } from '@/store/toast';
import { tint, useTheme } from '@/theme';

import { AmountSheet, type AmountSuggestion } from '../AmountSheet';
import { budgetPace, niceCeil, spentByRoot, suggestLimit, totalSpent } from '../budget';
import { checkBudgetAlerts } from '../usePlanRunner';

export function BudgetsScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { money, percent } = useFormat();
  const base = useSettings((s) => s.baseCurrency);
  const weekStart = useSettings((s) => s.weekStart);
  const catalog = useCategories();
  const budgets = useBudgets();
  const barColor = useBudgetColor();
  const [sheet, setSheet] = useState<{ categoryId: string | null } | null>(null);

  const now = new Date();
  const range = periodRange('month', now, weekStart);
  const current = usePeriodRows(range);
  const history = usePeriodRows({ start: periodRange('month', shiftAnchor('month', now, -3)).start, end: range.start });
  const rootOf = (id: string) => catalog?.rootOf(id)?.id ?? id;

  const spent = current ? spentByRoot(current.rows, rootOf) : new Map<string, number>();
  const total = current ? totalSpent(current.rows) : 0;
  const pastMonths = [-3, -2, -1].map((i) => monthKey(shiftAnchor('month', now, i)));
  const past = new Map<string, Map<string, number>>(pastMonths.map((m) => [m, new Map()]));
  for (const r of history?.rows ?? []) {
    if (r.kind !== 'expense') continue;
    const m = past.get(monthKey(r.occurredAt));
    if (!m) continue;
    for (const k of [rootOf(r.categoryId), '__total__']) m.set(k, (m.get(k) ?? 0) + r.baseMinor);
  }
  const pastTotals = (key: string) => pastMonths.map((m) => past.get(m)?.get(key) ?? 0);

  const limit = budgets?.total ?? null;
  const pace = limit ? budgetPace(total, limit, range, now) : null;
  const paceText = !pace
    ? null
    : pace.state === 'over'
      ? t('budgets.paceOver')
      : pace.share > pace.expectedShare + 0.03
        ? t('budgets.paceAhead', { pct: Math.round(pace.expectedShare * 100) })
        : pace.share < pace.expectedShare - 0.03
          ? t('budgets.paceBehind')
          : t('budgets.paceOnTrack');

  const categories = (catalog?.topLevel('expense') ?? [])
    .map((c) => {
      const lim = budgets?.byCategory.get(c.id);
      const s = spent.get(c.id) ?? 0;
      return { c, limit: lim, spent: s, share: lim ? s / lim : 0 };
    })
    .sort((a, b) => Number(!!b.limit) - Number(!!a.limit) || b.share - a.share || b.spent - a.spent);

  const sheetCat = sheet?.categoryId ? catalog?.byId.get(sheet.categoryId) : undefined;
  const sheetKey = sheet?.categoryId ?? '__total__';
  const sheetPast = pastTotals(sheetKey);
  const existing = sheet ? (sheet.categoryId ? budgets?.list.find((b) => b.categoryId === sheet.categoryId) : budgets?.list.find((b) => b.categoryId === null)) : undefined;
  const avg = suggestLimit(sheetPast, base);
  const last = sheetPast[2] > 0 ? niceCeil(sheetPast[2], base) : null;
  const suggestions: AmountSuggestion[] = [
    ...(avg ? [{ label: t('budgets.suggestAvg', { amount: money(avg, base, { trimZeroCents: true }) }), value: avg }] : []),
    ...(last && last !== avg ? [{ label: t('budgets.suggestLast', { amount: money(last, base, { trimZeroCents: true }) }), value: last }] : []),
  ];

  const save = async (categoryId: string | null, amount: number | null) => {
    setSheet(null);
    try {
      if (amount) await setBudget(db, categoryId, amount, base);
      else await removeBudget(db, categoryId);
      bumpData();
      await checkBudgetAlerts(db, false);
      showToast({ message: amount ? t('budgets.saved') : t('budgets.removed') });
    } catch {
      showToast({ message: t('common.error') });
    }
  };

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}>
        <ScreenHeader title={t('budgets.title')} backLabel={t('common.back')} onBack={() => router.back()} />

        <View style={styles.gap}>
          <Card>
            <View style={styles.heroHead}>
              <Eyebrow>{t('budgets.monthly')}</Eyebrow>
              <GlassPill
                icon={limit ? 'edit' : 'add'}
                iconColor={colors.accent}
                label={limit ? t('common.edit') : t('budgets.set')}
                onPress={() => setSheet({ categoryId: null })}
                style={styles.smallPill}
              />
            </View>
            {limit && pace ? (
              <>
                <Txt tone="muted" size={13} style={styles.heroLabel}>
                  {pace.remaining >= 0 ? t('budgets.left') : t('budgets.overBy')}
                </Txt>
                <Txt display="light" size={40} numberOfLines={1} adjustsFontSizeToFit style={[styles.heroAmount, pace.remaining < 0 && { color: colors.danger }]}>
                  {money(Math.abs(pace.remaining))}
                </Txt>
                <ProgressBar share={pace.share} color={barColor(pace.share, colors.accent)} marker={pace.expectedShare} height={8} />
                <View style={styles.heroRow}>
                  <Txt tone="soft" size={12.5}>
                    {t('budgets.spentOf', { spent: money(total, base, { trimZeroCents: true }), limit: money(limit, base, { trimZeroCents: true }) })}
                  </Txt>
                  <Txt weight="bold" size={12.5} style={{ color: barColor(pace.share, colors.income) }}>
                    {percent(pace.share)}
                  </Txt>
                </View>
                <View style={[styles.note, { backgroundColor: tint(colors.accent, 0.08), boxShadow: `inset 0 0 0 1px ${tint(colors.accent, 0.22)}` }]}>
                  <Icon name="auto_awesome" size={16} color={colors.accent} />
                  <Txt tone="soft" size={12.5} style={styles.flex}>
                    {paceText}
                    {pace.perDay > 0 ? ` ${t('budgets.perDay', { amount: money(pace.perDay, base, { trimZeroCents: true }) })}` : ''}
                  </Txt>
                </View>
                {budgets?.explicitTotal === null && (
                  <Txt tone="muted" size={12}>
                    {t('budgets.sumOfCategories')}
                  </Txt>
                )}
              </>
            ) : (
              <View style={styles.empty}>
                <Txt tone="soft" size={13.5} style={styles.emptyText}>
                  {t('budgets.emptyBody', { amount: money(total, base, { trimZeroCents: true }) })}
                </Txt>
                <AccentButton icon="add" label={t('budgets.set')} onPress={() => setSheet({ categoryId: null })} />
              </View>
            )}
          </Card>

          <Eyebrow style={styles.listTitle}>{t('budgets.byCategory')}</Eyebrow>
          <View>
            {categories.map(({ c, limit: lim, spent: s, share }) => {
              const color = barColor(share, c.color);
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    lim
                      ? t('budgets.rowA11y', { name: c.label, spent: money(s), limit: money(lim), pct: Math.round(share * 100) })
                      : t('budgets.rowNoneA11y', { name: c.label, spent: money(s) })
                  }
                  onPress={() => setSheet({ categoryId: c.id })}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceRaised }]}>
                  <CategoryTile icon={c.iconName} color={c.color} size={38} soft />
                  <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                      <Txt weight="semibold" size={14.5} numberOfLines={1} style={styles.flex}>
                        {c.label}
                      </Txt>
                      <Txt display="regular" size={12} tone={lim ? 'text' : 'muted'}>
                        {money(s, base, { trimZeroCents: true })}
                        {lim ? <Txt tone="muted" size={12}>{` / ${money(lim, base, { trimZeroCents: true })}`}</Txt> : null}
                      </Txt>
                    </View>
                    {lim ? (
                      <ProgressBar share={share} color={color} marker={pace?.expectedShare ?? undefined} />
                    ) : (
                      <Txt tone="faint" size={11.5}>
                        {t('budgets.noLimit')}
                      </Txt>
                    )}
                  </View>
                  {lim ? (
                    <Txt weight="bold" size={12} style={[styles.pct, { color: share >= 0.8 ? color : colors.textSoft }]}>
                      {percent(share)}
                    </Txt>
                  ) : (
                    <Icon name="add_circle" size={20} color={colors.textMuted} style={styles.pct} />
                  )}
                </Pressable>
              );
            })}
          </View>
          <Txt tone="faint" size={11.5} style={styles.footer}>
            {t('budgets.footer')}
          </Txt>
        </View>
      </ScrollView>

      {sheet && (
        <AmountSheet
          title={sheetCat ? sheetCat.label : t('budgets.monthly')}
          subtitle={t('budgets.sheetHint', { amount: money(sheet.categoryId ? (spent.get(sheet.categoryId) ?? 0) : total, base, { trimZeroCents: true }) })}
          currency={base}
          initial={existing?.amountMinor ?? avg ?? 0}
          suggestions={suggestions}
          clearLabel={t('budgets.remove')}
          onClear={existing ? () => void save(sheet.categoryId, null) : undefined}
          onSubmit={(v) => void save(sheet.categoryId, v)}
          onClose={() => setSheet(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 14, marginTop: 18 },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallPill: { height: 36 },
  heroLabel: { marginTop: 4 },
  heroAmount: { letterSpacing: -1.5, marginBottom: 10 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  empty: { gap: 14, paddingTop: 8, alignItems: 'flex-start' },
  emptyText: { lineHeight: 20 },
  listTitle: { marginTop: 10, paddingHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 16, minHeight: 60 },
  rowBody: { flex: 1, gap: 7 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pct: { width: 40, textAlign: 'right' },
  footer: { textAlign: 'center', marginTop: 12, lineHeight: 17, paddingHorizontal: 12 },
});
