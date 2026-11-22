import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { ProgressRing } from '@/components/Progress';
import { Sky } from '@/components/Sky';
import { AccentButton, Card, Eyebrow, GlassCircle, GlassPill, ScreenHeader, Txt } from '@/components/ui';
import { loadRates } from '@/db/repos/fx';
import type { Goal } from '@/db/types';
import { useFormat } from '@/hooks/useFormat';
import { useGoals } from '@/hooks/usePlan';
import { useQuery } from '@/hooks/useQuery';
import { parseLocalISO } from '@/lib/dates';
import { convertMinor } from '@/lib/fx';
import { useSettings } from '@/store/settings';
import { categoryTone, useTheme } from '@/theme';
import { iconOrDefault } from '@/theme/icons';

import { goalProgress } from '../goals';

export function GoalsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { money } = useFormat();
  const base = useSettings((s) => s.baseCurrency);
  const goals = useGoals();
  const fx = useQuery('fx', loadRates).data;
  const [showArchived, setShowArchived] = useState(false);
  const active = goals?.filter((g) => !g.archived) ?? [];
  const archived = goals?.filter((g) => g.archived) ?? [];
  const saved = active.reduce((acc, g) => acc + (convertMinor(g.savedMinor, g.currency, base, fx?.rates ?? {}) ?? 0), 0);
  const target = active.reduce((acc, g) => acc + (convertMinor(g.targetMinor, g.currency, base, fx?.rates ?? {}) ?? 0), 0);

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}>
        <ScreenHeader
          title={t('goals.title')}
          backLabel={t('common.back')}
          onBack={() => router.back()}
          right={<GlassCircle icon="add" iconColor={colors.accent} label={t('goals.add')} onPress={() => router.push('/plan/goal-edit')} />}
        />
        <View style={styles.gap}>
          {active.length > 0 && (
            <Card>
              <Eyebrow>{t('goals.totalSaved')}</Eyebrow>
              <Txt display="light" size={34} style={styles.big} numberOfLines={1} adjustsFontSizeToFit>
                {money(saved, base, { trimZeroCents: true })}
              </Txt>
              <Txt tone="soft" size={12.5}>
                {t('goals.ofTargets', { amount: money(target, base, { trimZeroCents: true }), count: active.length })}
              </Txt>
            </Card>
          )}

          {goals !== undefined && active.length === 0 && (
            <Card>
              <View style={styles.empty}>
                <CategoryTile icon="flag" color="#FACC15" size={52} />
                <Txt weight="semibold" size={16}>
                  {t('goals.emptyTitle')}
                </Txt>
                <Txt tone="soft" size={13} style={styles.center}>
                  {t('goals.emptyBody')}
                </Txt>
                <AccentButton icon="add" label={t('goals.add')} onPress={() => router.push('/plan/goal-edit')} />
              </View>
            </Card>
          )}

          {active.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}

          {archived.length > 0 && (
            <>
              <GlassPill
                icon={showArchived ? 'expand_more' : 'archive'}
                label={t('goals.archived', { count: archived.length })}
                onPress={() => setShowArchived(!showArchived)}
                style={styles.archivePill}
              />
              {showArchived && archived.map((g) => <GoalCard key={g.id} goal={g} />)}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export function GoalCard({ goal: g, compact }: { goal: Goal; compact?: boolean }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { money, date } = useFormat();
  const p = goalProgress(g.targetMinor, g.savedMinor, g.targetDate);
  const tone = categoryTone(g.color);
  const sub = p.done
    ? t('goals.reached')
    : p.overdue
      ? t('goals.overdue')
      : p.perMonth !== null && p.monthsLeft !== null
        ? t('goals.perMonth', { amount: money(p.perMonth, g.currency, { trimZeroCents: true }), count: p.monthsLeft })
        : t('goals.noDeadline');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${g.name}, ${money(g.savedMinor, g.currency)} / ${money(g.targetMinor, g.currency)}, ${sub}`}
      onPress={() => router.push({ pathname: '/plan/goal', params: { id: g.id } })}
      style={({ pressed }) => [pressed && styles.pressed, g.archived && styles.dim]}>
      <Card style={styles.goal}>
        <ProgressRing size={compact ? 52 : 64} share={p.share} color={g.color}>
          <Icon name={iconOrDefault(g.icon)} size={compact ? 20 : 24} color={isDark ? tone.light : tone.deep} />
        </ProgressRing>
        <View style={styles.flex}>
          <Txt weight="semibold" size={15} numberOfLines={1}>
            {g.name}
          </Txt>
          <Txt display="regular" size={12.5} numberOfLines={1}>
            {money(g.savedMinor, g.currency, { trimZeroCents: true })}
            <Txt tone="muted" size={12.5}>{` / ${money(g.targetMinor, g.currency, { trimZeroCents: true })}`}</Txt>
          </Txt>
          <Txt tone="muted" size={11.5} numberOfLines={1}>
            {sub}
            {g.targetDate && !p.done ? ` · ${date(parseLocalISO(g.targetDate), { month: 'short', year: 'numeric' })}` : ''}
          </Txt>
        </View>
        <Txt weight="bold" size={13} style={{ color: p.done ? colors.income : isDark ? tone.light : tone.deep }}>
          %{Math.min(999, Math.round(p.share * 100))}
        </Txt>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 12, marginTop: 18 },
  big: { letterSpacing: -1.2, marginVertical: 4 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  center: { textAlign: 'center', lineHeight: 19 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  dim: { opacity: 0.55 },
  archivePill: { alignSelf: 'flex-start', marginTop: 6 },
});
