import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { Sky } from '@/components/Sky';
import { AccentButton, Card, Eyebrow, GlassCircle, GlassPill, ScreenHeader, Txt } from '@/components/ui';
import { advanceRule, postOccurrence, setRuleNextDue } from '@/db/repos/recurring';
import { historyTransactions, softDeleteTransaction } from '@/db/repos/transactions';
import type { RecurringRule } from '@/db/types';
import { useCategories } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { useCardSummaries, useFixedCosts, useRules } from '@/hooks/usePlan';
import { useQuery } from '@/hooks/useQuery';
import { addDays, dayKey, periodRange, shiftAnchor, toLocalISO } from '@/lib/dates';
import { normalizeName } from '@/lib/text';
import { useAlerts } from '@/store/alerts';
import { bumpData } from '@/store/dataVersion';
import { showToast } from '@/store/toast';
import { useTheme } from '@/theme';

import { detectRecurring, type RecurringCandidate } from '../detect';
import { useFrequencyLabel } from '../labels';
import { perYear } from '../schedule';
import { UpcomingRow } from '../UpcomingRow';
import { buildUpcoming } from '../upcoming';
import { checkBudgetAlerts } from '../usePlanRunner';

export function RecurringScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { money } = useFormat();
  const catalog = useCategories();
  const rules = useRules();
  const cards = useCardSummaries();
  const fixed = useFixedCosts();
  const frequency = useFrequencyLabel();
  const dismissed = useAlerts((s) => s.dismissedSuggestions);
  const dismiss = useAlerts((s) => s.dismissSuggestion);

  const now = new Date();
  const histStart = toLocalISO(periodRange('month', shiftAnchor('month', now, -5)).start);
  const histEnd = dayKey(addDays(now, 1));
  const history = useQuery(`history:${histStart}:${histEnd}`, (d) => historyTransactions(d, histStart, `${histEnd}T00:00:00`)).data;
  const known = new Set([...(rules ?? []).map((r) => normalizeName(r.name)), ...dismissed]);
  const candidates = history ? detectRecurring(history, known, now).slice(0, 3) : [];
  const upcoming = buildUpcoming(rules ?? [], cards ?? [], now, 30);

  const pay = async (rule: RecurringRule, due: string) => {
    try {
      const id = await postOccurrence(db, rule, due);
      bumpData();
      showToast({
        message: t('recurring.paid', { name: rule.name }),
        actionLabel: t('common.undo'),
        onAction: () => {
          void (async () => {
            if (id) await softDeleteTransaction(db, id);
            await setRuleNextDue(db, rule.id, rule.nextDue);
            bumpData();
          })();
        },
      });
      await checkBudgetAlerts(db);
    } catch {
      showToast({ message: t('common.error') });
    }
  };

  const skip = async (rule: RecurringRule, due: string) => {
    await advanceRule(db, rule, due);
    bumpData();
    showToast({
      message: t('recurring.skipped', { name: rule.name }),
      actionLabel: t('common.undo'),
      onAction: () => void setRuleNextDue(db, rule.id, rule.nextDue).then(bumpData),
    });
  };

  const add = (c?: RecurringCandidate) =>
    router.push(
      c
        ? {
            pathname: '/plan/recurring-edit',
            params: { name: c.name, amount: String(c.amountMinor), categoryId: c.categoryId, accountId: c.accountId, nextDue: c.nextDue, kind: c.kind },
          }
        : '/plan/recurring-edit',
    );
  const edit = (rule: RecurringRule) => router.push({ pathname: '/plan/recurring-edit', params: { id: rule.id } });

  const groups: { title: string; list: RecurringRule[] }[] = [
    { title: t('recurring.subscriptions'), list: (rules ?? []).filter((r) => r.kind === 'expense' && r.isSubscription) },
    { title: t('recurring.bills'), list: (rules ?? []).filter((r) => r.kind === 'expense' && !r.isSubscription) },
    { title: t('recurring.incomes'), list: (rules ?? []).filter((r) => r.kind === 'income') },
  ].filter((g) => g.list.length > 0);
  const empty = rules !== undefined && rules.length === 0;

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}>
        <ScreenHeader
          title={t('recurring.title')}
          backLabel={t('common.back')}
          onBack={() => router.back()}
          right={<GlassCircle icon="add" iconColor={colors.accent} label={t('recurring.add')} onPress={() => add()} />}
        />

        <View style={styles.gap}>
          {fixed && fixed.count > 0 && (
            <Card>
              <Eyebrow>{t('recurring.fixedMonthly')}</Eyebrow>
              <Txt display="light" size={34} style={styles.big} numberOfLines={1} adjustsFontSizeToFit>
                {money(fixed.monthly, undefined, { trimZeroCents: true })}
              </Txt>
              <Txt tone="soft" size={12.5}>
                {t('recurring.fixedYearly', { amount: money(fixed.yearly, undefined, { trimZeroCents: true }), count: fixed.count })}
                {fixed.subscriptions > 0 ? ` · ${t('recurring.subsMonthly', { amount: money(fixed.subscriptions, undefined, { trimZeroCents: true }) })}` : ''}
              </Txt>
            </Card>
          )}

          {empty && candidates.length === 0 && (
            <Card>
              <View style={styles.empty}>
                <CategoryTile icon="autorenew" color="#22D3EE" size={52} />
                <Txt weight="semibold" size={16}>
                  {t('recurring.emptyTitle')}
                </Txt>
                <Txt tone="soft" size={13} style={styles.center}>
                  {t('recurring.emptyBody')}
                </Txt>
                <AccentButton icon="add" label={t('recurring.add')} onPress={() => add()} />
              </View>
            </Card>
          )}

          {candidates.length > 0 && (
            <>
              <Eyebrow style={styles.listTitle}>{t('recurring.suggested')}</Eyebrow>
              {candidates.map((c) => {
                const cat = catalog?.byId.get(c.categoryId);
                return (
                  <Card key={c.key}>
                    <View style={styles.suggestHead}>
                      <CategoryTile icon={cat?.iconName ?? 'autorenew'} color={cat?.color ?? '#22D3EE'} size={40} soft />
                      <View style={styles.flex}>
                        <Txt weight="semibold" size={15} numberOfLines={1}>
                          {c.name}
                        </Txt>
                        <Txt tone="muted" size={12}>
                          {t('recurring.suggestBody', { amount: money(c.amountMinor, c.currency, { trimZeroCents: true }), count: c.months })}
                        </Txt>
                      </View>
                      <Icon name="auto_awesome" size={18} color={colors.accent} />
                    </View>
                    <View style={styles.suggestActions}>
                      <GlassPill label={t('recurring.dismiss')} onPress={() => dismiss(c.key)} style={styles.smallPill} />
                      <AccentButton icon="add" label={t('recurring.track')} onPress={() => add(c)} style={styles.smallPill} />
                    </View>
                  </Card>
                );
              })}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <View style={styles.listHead}>
                <Eyebrow>{t('recurring.upcoming')}</Eyebrow>
                <Txt tone="faint" size={10.5}>
                  {t('recurring.swipeHint')}
                </Txt>
              </View>
              <View>
                {upcoming.map((item) =>
                  item.type === 'rule' ? (
                    <UpcomingRow
                      key={item.key}
                      item={item}
                      catalog={catalog}
                      onPress={
                        item.actionable
                          ? () => router.push({ pathname: '/add', params: { ruleId: item.rule.id, due: item.due } })
                          : () => edit(item.rule)
                      }
                      paid={{ label: item.rule.kind === 'income' ? t('recurring.received') : t('recurring.markPaid'), icon: 'check', tone: 'accent', onAction: () => void pay(item.rule, item.due) }}
                      skip={{ label: t('recurring.skip'), icon: 'skip_next', tone: 'neutral', onAction: () => void skip(item.rule, item.due) }}
                    />
                  ) : (
                    <UpcomingRow key={item.key} item={item} catalog={catalog} onPress={() => router.push('/plan/cards')} />
                  ),
                )}
              </View>
            </>
          )}

          {groups.map((g) => (
            <View key={g.title} style={styles.group}>
              <Eyebrow style={styles.listTitle}>{g.title}</Eyebrow>
              {g.list.map((r) => {
                const cat = catalog?.byId.get(r.categoryId);
                return (
                  <Pressable
                    key={r.id}
                    accessibilityRole="button"
                    onPress={() => edit(r)}
                    style={({ pressed }) => [styles.row, !r.active && styles.dim, pressed && { backgroundColor: colors.surfaceRaised }]}>
                    <CategoryTile icon={cat?.iconName ?? 'autorenew'} color={cat?.color ?? '#94A3B8'} size={36} soft />
                    <View style={styles.flex}>
                      <Txt weight="semibold" size={14.5} numberOfLines={1}>
                        {r.name}
                      </Txt>
                      <Txt tone="muted" size={12} numberOfLines={1}>
                        {[frequency(r), r.autoPost ? t('recurring.auto') : null, r.active ? null : t('recurring.paused')].filter(Boolean).join(' · ')}
                      </Txt>
                    </View>
                    <View style={styles.rowRight}>
                      <Txt display="regular" size={13} style={r.kind === 'income' ? { color: colors.income } : null}>
                        {money(r.amountMinor, r.currency, { trimZeroCents: true })}
                      </Txt>
                      <Txt tone="faint" size={10.5}>
                        {t('recurring.perYear', { amount: money(perYear(r.amountMinor, r), r.currency, { trimZeroCents: true }) })}
                      </Txt>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 12, marginTop: 18 },
  big: { letterSpacing: -1.2, marginVertical: 4 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  center: { textAlign: 'center', lineHeight: 19 },
  listTitle: { paddingHorizontal: 6, marginTop: 6 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, marginTop: 6 },
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggestActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  smallPill: { height: 40 },
  group: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 16, minHeight: 60 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  dim: { opacity: 0.5 },
});
