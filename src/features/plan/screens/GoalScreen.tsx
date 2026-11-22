import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { ProgressRing } from '@/components/Progress';
import { Sky } from '@/components/Sky';
import { SwipeRow } from '@/components/SwipeRow';
import { AccentButton, Card, Eyebrow, GlassCircle, GlassPill, ScreenHeader, Txt } from '@/components/ui';
import { addContribution, deleteContribution, deleteGoal, getGoal, listContributions, restoreContribution, setGoalArchived } from '@/db/repos/goals';
import { dialSteps } from '@/features/add/dial';
import { useFormat } from '@/hooks/useFormat';
import { useQuery } from '@/hooks/useQuery';
import { parseLocalISO } from '@/lib/dates';
import { bumpData } from '@/store/dataVersion';
import { showToast } from '@/store/toast';
import { categoryTone, tint, useTheme } from '@/theme';
import { iconOrDefault } from '@/theme/icons';

import { AmountSheet, type AmountSuggestion } from '../AmountSheet';
import { goalProgress } from '../goals';

export function GoalScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { money, date } = useFormat();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goal = useQuery(`goal:${id}`, (d) => getGoal(d, id)).data;
  const contributions = useQuery(`contributions:${id}`, (d) => listContributions(d, id)).data ?? [];
  const [sheet, setSheet] = useState<'add' | 'take' | null>(null);

  if (!goal) {
    return (
      <View style={styles.flex}>
        <Sky />
      </View>
    );
  }

  const p = goalProgress(goal.targetMinor, goal.savedMinor, goal.targetDate);
  const tone = categoryTone(goal.color);
  const cur = goal.currency;
  const fmt = (v: number) => money(v, cur, { trimZeroCents: true });
  const step = dialSteps(cur).big;
  const round = [5, 10, 50].map((n) => n * step);
  const suggestions: AmountSuggestion[] =
    sheet === 'take'
      ? goal.savedMinor > 0
        ? [{ label: t('goals.takeAll', { amount: fmt(goal.savedMinor) }), value: goal.savedMinor }]
        : []
      : [
          ...(p.perMonth ? [{ label: t('goals.monthlyShare', { amount: fmt(p.perMonth) }), value: p.perMonth }] : []),
          ...round.filter((v) => v !== p.perMonth && v < p.remaining).map((v) => ({ label: fmt(v), value: v })),
          ...(p.remaining > 0 ? [{ label: t('goals.allRemaining', { amount: fmt(p.remaining) }), value: p.remaining }] : []),
        ];

  const submit = async (amount: number) => {
    const signed = sheet === 'take' ? -Math.min(amount, Math.max(goal.savedMinor, 0)) : amount;
    setSheet(null);
    if (signed === 0) return;
    try {
      const cid = await addContribution(db, goal.id, signed);
      bumpData();
      const reached = signed > 0 && goal.savedMinor < goal.targetMinor && goal.savedMinor + signed >= goal.targetMinor;
      showToast({
        message: reached ? t('goals.reachedToast', { name: goal.name }) : signed > 0 ? t('goals.added', { amount: fmt(signed) }) : t('goals.taken', { amount: fmt(-signed) }),
        actionLabel: t('common.undo'),
        onAction: () => void deleteContribution(db, cid).then(bumpData),
      });
    } catch {
      showToast({ message: t('common.error') });
    }
  };

  const confirmDelete = () =>
    Alert.alert(t('goals.deleteTitle'), t('goals.deleteBody', { name: goal.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          void deleteGoal(db, goal.id).then(() => {
            bumpData();
            router.back();
          }),
      },
    ]);

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}>
        <ScreenHeader
          title={goal.name}
          backLabel={t('common.back')}
          onBack={() => router.back()}
          right={<GlassCircle icon="edit" label={t('common.edit')} onPress={() => router.push({ pathname: '/plan/goal-edit', params: { id: goal.id } })} />}
        />

        <View style={styles.hero}>
          <ProgressRing size={196} stroke={10} share={p.share} color={goal.color}>
            <View style={styles.ringInner}>
              <Icon name={iconOrDefault(goal.icon)} size={26} color={isDark ? tone.light : tone.deep} />
              <Txt display="light" size={26} numberOfLines={1} adjustsFontSizeToFit style={styles.ringAmount}>
                {fmt(goal.savedMinor)}
              </Txt>
              <Txt tone="muted" size={12}>
                %{Math.min(999, Math.round(p.share * 100))}
              </Txt>
            </View>
          </ProgressRing>
          <Txt tone="soft" size={13}>
            {t('goals.targetLine', { target: fmt(goal.targetMinor), remaining: fmt(p.remaining) })}
          </Txt>
          <View style={styles.chips}>
            {p.done ? (
              <View style={[styles.chip, { backgroundColor: tint(colors.accent, 0.14), boxShadow: `inset 0 0 0 1px ${tint(colors.accent, 0.35)}` }]}>
                <Icon name="check_circle" size={15} color={colors.income} />
                <Txt weight="bold" size={12} style={{ color: colors.income }}>
                  {t('goals.reached')}
                </Txt>
              </View>
            ) : p.perMonth !== null && p.monthsLeft !== null ? (
              <View style={[styles.chip, { backgroundColor: tint(tone.base, 0.12), boxShadow: `inset 0 0 0 1px ${tint(tone.base, 0.35)}` }]}>
                <Txt weight="bold" size={12} style={{ color: isDark ? tone.light : tone.deep }}>
                  {t('goals.perMonth', { amount: fmt(p.perMonth), count: p.monthsLeft })}
                </Txt>
              </View>
            ) : null}
            {goal.targetDate && (
              <View style={[styles.chip, { backgroundColor: colors.glassFrom, boxShadow: `inset 0 0 0 1px ${colors.hairline}` }]}>
                <Icon name="flag" size={14} color={p.overdue ? colors.danger : colors.textSoft} />
                <Txt tone="soft" weight="semibold" size={12} style={p.overdue ? { color: colors.danger } : null}>
                  {date(parseLocalISO(goal.targetDate), { day: 'numeric', month: 'long', year: 'numeric' })}
                </Txt>
              </View>
            )}
          </View>
          <View style={styles.actions}>
            <GlassPill icon="remove" label={t('goals.take')} onPress={goal.savedMinor > 0 ? () => setSheet('take') : undefined} style={styles.take} />
            <AccentButton icon="add" label={t('goals.addMoney')} onPress={() => setSheet('add')} style={styles.flex} />
          </View>
        </View>

        {contributions.length > 0 && (
          <View style={styles.history}>
            <Eyebrow style={styles.historyTitle}>{t('goals.history')}</Eyebrow>
            {contributions.map((c) => {
              const positive = c.amountMinor > 0;
              const label = `${date(parseLocalISO(c.occurredAt), { day: 'numeric', month: 'long', year: 'numeric' })}, ${money(c.amountMinor, cur, { showPlus: true })}`;
              return (
                <SwipeRow
                  key={c.id}
                  accessibilityLabel={label}
                  left={{
                    label: t('common.delete'),
                    icon: 'delete',
                    tone: 'danger',
                    onAction: () =>
                      void deleteContribution(db, c.id).then(() => {
                        bumpData();
                        showToast({ message: t('goals.entryDeleted'), actionLabel: t('common.undo'), onAction: () => void restoreContribution(db, c.id).then(bumpData) });
                      }),
                  }}>
                  <CategoryTile icon={positive ? 'add' : 'remove'} color={positive ? goal.color : '#94A3B8'} size={34} soft />
                  <Txt tone="soft" size={13.5} style={styles.flex}>
                    {date(parseLocalISO(c.occurredAt), { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Txt>
                  <Txt display="regular" size={13} style={positive ? { color: colors.income } : null}>
                    {money(c.amountMinor, cur, { showPlus: true, trimZeroCents: true })}
                  </Txt>
                </SwipeRow>
              );
            })}
          </View>
        )}

        <Card style={styles.manage} padded={false}>
          <View style={styles.manageRow}>
            <GlassPill
              icon={goal.archived ? 'unarchive' : 'archive'}
              label={goal.archived ? t('goals.unarchive') : t('goals.archive')}
              onPress={() => void setGoalArchived(db, goal.id, !goal.archived).then(bumpData)}
            />
            <GlassPill icon="delete" iconColor={colors.danger} label={t('common.delete')} onPress={confirmDelete} />
          </View>
        </Card>
      </ScrollView>

      {sheet && (
        <AmountSheet
          title={sheet === 'add' ? t('goals.addMoney') : t('goals.take')}
          subtitle={goal.name}
          currency={cur}
          initial={sheet === 'add' ? (p.perMonth ?? 0) : 0}
          suggestions={suggestions}
          submitLabel={sheet === 'add' ? t('goals.addMoney') : t('goals.take')}
          onSubmit={(v) => void submit(v)}
          onClose={() => setSheet(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: 12, marginTop: 22 },
  ringInner: { alignItems: 'center', gap: 2, paddingHorizontal: 28 },
  ringAmount: { letterSpacing: -1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { height: 28, paddingHorizontal: 11, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 8 },
  take: { paddingHorizontal: 18 },
  history: { marginTop: 26 },
  historyTitle: { paddingHorizontal: 6, marginBottom: 6 },
  manage: { marginTop: 24 },
  manageRow: { flexDirection: 'row', gap: 8, padding: 12, justifyContent: 'center' },
});
