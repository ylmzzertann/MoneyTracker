import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Sky } from '@/components/Sky';
import { GlassCircle, GlassPill, Txt } from '@/components/ui';
import { rulePayments } from '@/db/repos/transactions';
import { NAV_HEIGHT } from '@/features/nav/SectionNav';
import { priceIncreases } from '@/features/plan/detect';
import { goalProgress } from '@/features/plan/goals';
import { useInsightText } from '@/features/plan/insightText';
import { buildInsights } from '@/features/plan/insights';
import { buildUpcoming } from '@/features/plan/upcoming';
import { dailySeries, groupRows, percentChange, totals } from '@/features/reports/aggregate';
import { useCategories } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { usePeriodRows } from '@/hooks/usePeriodRows';
import { useBudgets, useCardSummaries, useFixedCosts, useGoals, useRules } from '@/hooks/usePlan';
import { useQuery } from '@/hooks/useQuery';
import { dayKey, daysLeftInRange, periodRange, shiftAnchor } from '@/lib/dates';
import { useSettings } from '@/store/settings';
import { tint, useTheme } from '@/theme';

import { OrbitView, type OrbitGroup } from './OrbitView';
import { InsightsDeck, PlanTiles, UpcomingList, type PlanTile } from './PlanSections';
import { PulseCard } from './PulseCard';

export function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const weekStart = useSettings((s) => s.weekStart);
  const hidden = useSettings((s) => s.hideAmounts);
  const setSettings = useSettings((s) => s.set);
  const { moneyParts, date, percent } = useFormat();
  const catalog = useCategories();
  const budgets = useBudgets();
  const budget = budgets?.total ?? null;
  const rules = useRules();
  const cards = useCardSummaries();
  const goals = useGoals();
  const fixed = useFixedCosts();
  const payments = useQuery('rulePayments', rulePayments).data;
  const insightText = useInsightText(catalog);

  const now = new Date();
  const range = periodRange('month', now, weekStart);
  const prevRange = periodRange('month', shiftAnchor('month', now, -1), weekStart);
  const current = usePeriodRows(range);
  const previous = usePeriodRows(prevRange);
  const history = usePeriodRows({ start: periodRange('month', shiftAnchor('month', now, -3), weekStart).start, end: range.start });

  const sum = current ? totals(current.rows) : null;
  const spent = sum?.expense ?? 0;
  const change = sum && previous ? percentChange(spent, totals(previous.rows).expense) : null;
  const daysLeft = daysLeftInRange(range, now);
  const parts = moneyParts(spent);

  const groups: OrbitGroup[] =
    current && catalog
      ? groupRows(current.rows, 'expense', 'category', (id) => catalog.rootOf(id)?.id ?? null).flatMap((g) => {
          const category = catalog.byId.get(g.key);
          const limit = budgets?.byCategory.get(g.key);
          return category ? [{ category, total: g.total, share: g.share, budgetUse: limit ? g.total / limit : undefined }] : [];
        })
      : [];

  const series = current ? dailySeries(current.rows, 'expense', range).map((p) => p.total) : [];
  const todayIndex = now.getDate() - 1;

  const ruleById = new Map((rules ?? []).map((r) => [r.id, r]));
  const insights =
    current && history && catalog && budgets
      ? buildInsights({
          now,
          range,
          current: current.rows,
          history: history.rows,
          rootOf: (id) => catalog.rootOf(id)?.id ?? id,
          budgets: budgets.lines,
          priceUps: priceIncreases(payments ?? []).flatMap((p) => {
            const r = ruleById.get(p.ruleId);
            return r ? [{ name: r.name, from: p.from, to: p.to, currency: r.currency, pct: p.pct }] : [];
          }),
          fixedCosts: fixed && fixed.count > 0 ? { monthly: fixed.monthly, count: fixed.count } : null,
        }).map(insightText)
      : [];
  const upcoming = buildUpcoming(rules ?? [], cards ?? [], now, 14).slice(0, 3);
  const dueSoon = buildUpcoming(rules ?? [], [], now, 30).length;
  const nextCard = (cards ?? [])
    .flatMap((c) => (c.cycle ? [c.cycle.lastDue, c.cycle.nextDue].filter((d) => dayKey(d) >= dayKey(now)).map((d) => ({ c, d })) : []))
    .sort((a, b) => a.d.getTime() - b.d.getTime())[0];
  const activeGoals = (goals ?? []).filter((g) => !g.archived);
  const goalShare = activeGoals.length
    ? activeGoals.reduce((acc, g) => acc + Math.min(1, goalProgress(g.targetMinor, g.savedMinor, g.targetDate).share), 0) / activeGoals.length
    : 0;
  const tiles: PlanTile[] = [
    {
      key: 'budgets',
      icon: 'pie_chart',
      color: '#34D399',
      title: t('budgets.title'),
      status: budget ? t('plan.budgetsUsed', { pct: Math.round((spent / budget) * 100) }) : t('plan.budgetsNone'),
      href: '/plan/budgets',
    },
    {
      key: 'recurring',
      icon: 'autorenew',
      color: '#22D3EE',
      title: t('recurring.title'),
      status: rules?.length ? t('plan.recurringDue', { count: dueSoon }) : t('plan.recurringNone'),
      href: '/plan/recurring',
    },
    {
      key: 'cards',
      icon: 'credit_card',
      color: '#A78BFA',
      title: t('cards.title'),
      status: nextCard
        ? t('plan.cardsNext', { card: nextCard.c.account.name, date: date(nextCard.d, { day: 'numeric', month: 'short' }) })
        : cards?.length
          ? t('cards.daysMissing')
          : t('plan.cardsNone'),
      href: '/plan/cards',
    },
    {
      key: 'goals',
      icon: 'flag',
      color: '#FACC15',
      title: t('goals.title'),
      status: activeGoals.length ? t('plan.goalsStatus', { count: activeGoals.length, pct: Math.round(goalShare * 100) }) : t('plan.goalsNone'),
      href: '/plan/goals',
    },
  ];

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: NAV_HEIGHT + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassPill
            icon="calendar_month"
            iconColor={colors.accent}
            label={date(range.start, { month: 'long', year: 'numeric' }).toLocaleUpperCase()}
            accessibilityLabel={t('home.monthA11y', { month: date(range.start, { month: 'long', year: 'numeric' }) })}
            textStyle={styles.month}
            onPress={() => router.navigate('/reports')}
          />
          <View style={styles.headerRight}>
            <GlassCircle
              icon={hidden ? 'visibility_off' : 'visibility'}
              label={hidden ? t('home.showAmounts') : t('home.hideAmounts')}
              onPress={() => setSettings({ hideAmounts: !hidden })}
            />
            <GlassCircle icon="download" label={t('import.title')} onPress={() => router.push('/import')} />
            <GlassCircle icon="settings" label={t('settings.title')} onPress={() => router.push('/settings')} />
          </View>
        </View>

        <View style={styles.hero}>
          <Txt tone="muted" size={14}>
            {t('home.spentThisMonth')}
          </Txt>
          <Txt display="light" size={50} style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {parts.main}
            <Txt display="light" size={24} tone="muted" style={styles.cents}>
              {parts.cents}
            </Txt>
          </Txt>
          <View style={styles.chips}>
            {budget ? (
              <View style={[styles.chip, { backgroundColor: colors.glassFrom, boxShadow: `inset 0 0 0 1px ${colors.hairline}` }]}>
                <View style={[styles.dot, { backgroundColor: colors.accent, boxShadow: `0 0 8px ${colors.accent}` }]} />
                <Txt weight="semibold" size={12}>
                  {t('home.budgetUsed', { pct: Math.round((spent / budget) * 100) })}
                </Txt>
              </View>
            ) : null}
            <View style={[styles.chip, { backgroundColor: colors.glassFrom, boxShadow: `inset 0 0 0 1px ${colors.hairline}` }]}>
              <Txt tone="soft" weight="semibold" size={12}>
                {t('home.daysLeft', { count: daysLeft })}
              </Txt>
            </View>
            {change !== null && (
              <View
                accessibilityLabel={t('home.changeA11y', { value: `${change}%` })}
                style={[
                  styles.chip,
                  {
                    backgroundColor: tint(change <= 0 ? colors.accent : colors.danger, 0.12),
                    boxShadow: `inset 0 0 0 1px ${tint(change <= 0 ? colors.accent : colors.danger, 0.3)}`,
                  },
                ]}>
                <Icon name={change <= 0 ? 'trending_down' : 'trending_up'} size={16} color={change <= 0 ? colors.income : colors.danger} />
                <Txt weight="bold" size={12} style={{ color: change <= 0 ? colors.income : colors.danger }}>
                  {percent(Math.abs(change) / 100)}
                </Txt>
              </View>
            )}
          </View>
        </View>

        <OrbitView
          width={width}
          groups={groups}
          spent={spent}
          budget={budget}
          onPressCategory={(id) => router.navigate({ pathname: '/activity', params: { categoryId: id } })}
          onPressCenter={() => router.push('/plan/budgets')}
        />

        <View style={styles.pulse}>
          <PulseCard width={width - 32} values={series} todayIndex={Math.min(todayIndex, Math.max(series.length - 1, 0))} />
        </View>

        <InsightsDeck items={insights} width={width} />
        <UpcomingList items={upcoming} catalog={catalog} />
        <PlanTiles tiles={tiles} width={width} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  headerRight: { flexDirection: 'row', gap: 8 },
  month: { fontSize: 10, letterSpacing: 2.4, fontWeight: '700' },
  hero: { paddingHorizontal: 22, marginTop: 14, gap: 6 },
  amount: { letterSpacing: -2, lineHeight: 56 },
  cents: { letterSpacing: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { height: 26, paddingHorizontal: 10, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pulse: { paddingHorizontal: 16, marginTop: 10 },
});
