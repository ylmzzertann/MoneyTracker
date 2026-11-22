import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { Sky } from '@/components/Sky';
import { GlassCircle, GlassPill, Segmented, Txt } from '@/components/ui';
import { CATEGORY_COLORS } from '@/db/defaults';
import { exportCsv } from '@/features/export/exportCsv';
import { NAV_HEIGHT } from '@/features/nav/SectionNav';
import { useAccounts, useCategories } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { usePeriodRows } from '@/hooks/usePeriodRows';
import { formatPeriodLabel, periodRange, rangeContainsToday, shiftAnchor, toLocalISO, type PeriodKind } from '@/lib/dates';
import { useSettings } from '@/store/settings';
import { showToast } from '@/store/toast';
import { categoryTone, tint, useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

import { foldSmallGroups, groupRows, percentChange, totals, type GroupBy } from './aggregate';
import { RingsChart, type RingItem } from './RingsChart';

const OTHER = '__other__';

export function ReportsScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { money, moneyParts, locale } = useFormat();
  const weekStart = useSettings((s) => s.weekStart);
  const catalog = useCategories();
  const accounts = useAccounts(true);

  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [group, setGroup] = useState<GroupBy>('category');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [selected, setSelected] = useState(0);

  const range = periodRange(kind, anchor, weekStart);
  const prevRange = periodRange(kind, shiftAnchor(kind, anchor, -1), weekStart);
  const trendStart = periodRange(kind, shiftAnchor(kind, anchor, -5), weekStart).start;
  const current = usePeriodRows(range);
  const previous = usePeriodRows(prevRange);
  const trendRows = usePeriodRows({ start: trendStart, end: range.end });

  const sum = current ? totals(current.rows) : null;
  const prevSum = previous ? totals(previous.rows) : null;
  const change = sum && prevSum ? percentChange(sum.expense, prevSum.expense) : null;
  const parentOf = (id: string) => catalog?.rootOf(id)?.id ?? null;
  const groups = current ? foldSmallGroups(groupRows(current.rows, 'expense', group, parentOf), 6, OTHER) : [];
  const prevTotals = new Map(previous ? groupRows(previous.rows, 'expense', group, parentOf).map((g) => [g.key, g.total] as const) : []);

  const describe = (key: string, i: number): { label: string; icon: IconName; color: string } => {
    if (key === OTHER) return { label: t('reports.other'), icon: 'more_horiz', color: '#94A3B8' };
    switch (group) {
      case 'category': {
        const c = catalog?.byId.get(key);
        return { label: c?.label ?? '?', icon: c?.iconName ?? 'more_horiz', color: c?.color ?? '#94A3B8' };
      }
      case 'merchant':
        return { label: key || t('reports.noMerchant'), icon: 'storefront', color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] };
      case 'account': {
        const a = accounts?.find((x) => x.id === key);
        return { label: a?.name ?? '?', icon: a?.iconName ?? 'account_balance', color: CATEGORY_COLORS[(i + 3) % CATEGORY_COLORS.length] };
      }
      case 'channel':
        return key === 'store'
          ? { label: t('channel.store'), icon: 'storefront', color: '#38BDF8' }
          : key === 'online'
            ? { label: t('channel.online'), icon: 'language', color: '#A78BFA' }
            : { label: t('channel.unknown'), icon: 'more_horiz', color: '#94A3B8' };
    }
  };

  const items: (RingItem & { count: number; delta: number | null })[] = groups.map((g, i) => ({
    key: g.key,
    ...describe(g.key, i),
    total: g.total,
    share: g.share,
    count: g.count,
    delta: g.key === OTHER ? null : percentChange(g.total, prevTotals.get(g.key) ?? 0),
  }));
  const sel = Math.min(selected, Math.max(items.length - 1, 0));

  const trend = Array.from({ length: 6 }, (_, i) => {
    const r = periodRange(kind, shiftAnchor(kind, anchor, i - 5), weekStart);
    const total = (trendRows?.rows ?? [])
      .filter((x) => x.kind === 'expense' && x.occurredAt >= toLocalISO(r.start) && x.occurredAt < toLocalISO(r.end))
      .reduce((acc, x) => acc + x.baseMinor, 0);
    return { label: kind === 'year' ? String(r.start.getFullYear()) : formatPeriodLabel(kind === 'month' ? 'month' : 'week', r, locale).split(/[\s–]/)[0], total };
  });
  const trendMax = Math.max(...trend.map((x) => x.total), 1);
  const trendAvg = trend.reduce((a, x) => a + x.total, 0) / trend.length;
  const parts = moneyParts(sum?.expense ?? 0);
  const groupLabel = { category: t('reports.byCategory'), merchant: t('reports.byMerchant'), account: t('reports.byAccount'), channel: t('reports.byChannel') }[group];

  const onExport = async () => {
    try {
      const ok = await exportCsv(db, {
        start: toLocalISO(range.start),
        end: toLocalISO(range.end),
        locale,
        t,
        categoryById: catalog?.byId ?? new Map(),
        fileName: `money-tracker-${toLocalISO(range.start).slice(0, 10)}.csv`,
      });
      if (!ok) showToast({ message: t('common.error') });
    } catch {
      showToast({ message: t('common.error') });
    }
  };

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: NAV_HEIGHT + insets.bottom + 40, paddingHorizontal: 22 }} showsVerticalScrollIndicator={false}>
        <View style={styles.rowBetween}>
          <Segmented
            accessibilityLabel={t('reports.title')}
            itemWidth={66}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setAnchor(new Date());
            }}
            options={[
              { value: 'week', label: t('reports.week') },
              { value: 'month', label: t('reports.month') },
              { value: 'year', label: t('reports.year') },
            ]}
          />
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', icon: 'donut_large', a11y: t('reports.chart') },
              { value: 'table', icon: 'table_rows', a11y: t('reports.table') },
            ]}
          />
        </View>

        <Txt display="light" size={34} style={styles.title}>
          {t('reports.title')}
        </Txt>

        <View style={[styles.rowBetween, styles.periodNav]}>
          <GlassCircle icon="chevron_left" label={t('reports.prevPeriod')} onPress={() => setAnchor(shiftAnchor(kind, anchor, -1))} />
          <Txt weight="bold" size={10} style={styles.periodLabel}>
            {formatPeriodLabel(kind, range, locale).toLocaleUpperCase()}
          </Txt>
          <GlassCircle
            icon="chevron_right"
            label={t('reports.nextPeriod')}
            onPress={rangeContainsToday(range) ? undefined : () => setAnchor(shiftAnchor(kind, anchor, 1))}
            style={rangeContainsToday(range) ? styles.disabled : null}
          />
        </View>

        <View style={styles.totals}>
          <Txt tone="muted" size={14}>
            {t('reports.spentInPeriod')}
          </Txt>
          <Txt display="light" size={44} style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {parts.main}
            <Txt display="light" size={20} tone="muted">
              {parts.cents}
            </Txt>
          </Txt>
          <View style={styles.chips}>
            {change !== null && (
              <View style={[styles.chip, { backgroundColor: change <= 0 ? colors.accent : tint(colors.danger, 0.85) }]}>
                <Txt weight="semibold" size={12} style={{ color: change <= 0 ? colors.onAccent : '#FFFFFF' }}>
                  {change < 0 ? t('reports.lessThanPrev', { pct: -change }) : change > 0 ? t('reports.moreThanPrev', { pct: change }) : t('reports.sameAsPrev')}
                </Txt>
              </View>
            )}
            <View style={[styles.chip, { boxShadow: `inset 0 0 0 1px ${colors.hairline}` }]}>
              <Txt tone="soft" size={12}>
                {t('reports.incomeChip', { amount: money(sum?.income ?? 0, undefined, { trimZeroCents: true }) })}
              </Txt>
            </View>
            <View style={[styles.chip, { boxShadow: `inset 0 0 0 1px ${colors.hairline}` }]}>
              <Txt tone="soft" size={12}>
                {t('reports.count', { count: sum?.expenseCount ?? 0 })}
              </Txt>
            </View>
          </View>
        </View>

        <View style={styles.groupSeg}>
          <Segmented
            stretch
            accessibilityLabel={t('reports.groupBy')}
            value={group}
            onChange={(g) => {
              setGroup(g);
              setSelected(0);
            }}
            options={[
              { value: 'category', label: t('reports.byCategory') },
              { value: 'merchant', label: t('reports.byMerchant') },
              { value: 'account', label: t('reports.byAccount') },
              { value: 'channel', label: t('reports.byChannel') },
            ]}
          />
        </View>

        {items.length === 0 ? (
          <Txt tone="muted" size={13} style={styles.empty}>
            {t('reports.summaryNone')}
          </Txt>
        ) : view === 'chart' ? (
          <>
            <View style={styles.chart}>
              <RingsChart
                width={width}
                items={items}
                selected={sel}
                amountText={money(items[sel]?.total ?? 0, undefined, { trimZeroCents: true })}
                accessibilityLabel={t('reports.chartA11y', {
                  group: groupLabel,
                  list: items.map((i) => `${i.label} ${money(i.total, undefined, { trimZeroCents: true })}`).join(', '),
                })}
              />
            </View>
            <View style={styles.legend}>
              {items.map((it, i) => {
                const on = i === sel;
                return (
                  <Pressable
                    key={it.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setSelected(i)}
                    style={[
                      styles.legendRow,
                      on && {
                        backgroundImage: `linear-gradient(90deg, ${tint(it.color, 0.16)}, ${tint(it.color, 0.02)})`,
                        boxShadow: `inset 0 0 0 1px ${tint(it.color, 0.35)}`,
                      },
                    ]}>
                    <CategoryTile icon={it.icon} color={it.color} size={34} soft={!on} />
                    <Txt weight="semibold" size={14} numberOfLines={1} style={styles.flex}>
                      {it.label}{' '}
                      <Txt tone="muted" size={12}>
                        · {it.count}
                      </Txt>
                    </Txt>
                    <Txt display="regular" size={13}>
                      {money(it.total, undefined, { trimZeroCents: true })}
                    </Txt>
                    <Txt tone="muted" size={12} style={styles.share}>
                      %{Math.round(it.share * 100)}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={[styles.table, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)', boxShadow: `inset 0 0 0 1px ${colors.hairline}` }]}>
            <View style={[styles.tr, styles.th, { boxShadow: `inset 0 -1px 0 ${colors.hairline}` }]}>
              <Txt tone="muted" weight="bold" size={10} style={[styles.cName, styles.caps]}>
                {groupLabel.toLocaleUpperCase()}
              </Txt>
              <Txt tone="muted" weight="bold" size={10} style={[styles.cNum, styles.caps]}>
                {t('reports.colCount')}
              </Txt>
              <Txt tone="muted" weight="bold" size={10} style={[styles.cAmt, styles.caps]}>
                {t('reports.colAmount')}
              </Txt>
              <Txt tone="muted" weight="bold" size={10} style={[styles.cNum, styles.caps]}>
                {t('reports.colShare')}
              </Txt>
              <Txt tone="muted" weight="bold" size={10} style={[styles.cDiff, styles.caps]}>
                {t('reports.colDiff')}
              </Txt>
            </View>
            {items.map((it) => {
              const tone = categoryTone(it.color);
              return (
                <View key={it.key} style={[styles.tr, { boxShadow: `inset 0 -1px 0 ${colors.hairline}` }]}>
                  <View style={[styles.cName, styles.nameCell]}>
                    <CategoryTile icon={it.icon} color={it.color} size={24} soft />
                    <Txt weight="semibold" size={13} numberOfLines={1} style={styles.flex}>
                      {it.label}
                    </Txt>
                  </View>
                  <Txt tone="muted" size={13} style={styles.cNum}>
                    {it.count}
                  </Txt>
                  <Txt display="regular" size={12} style={styles.cAmt} numberOfLines={1}>
                    {money(it.total, undefined, { trimZeroCents: true })}
                  </Txt>
                  <Txt tone="muted" size={13} style={styles.cNum}>
                    %{Math.round(it.share * 100)}
                  </Txt>
                  <Txt
                    weight="bold"
                    size={12.5}
                    style={[styles.cDiff, { color: it.delta === null ? colors.textMuted : it.delta <= 0 ? colors.income : isDark ? '#FDA4AF' : colors.danger }]}>
                    {it.delta === null ? '–' : `${it.delta > 0 ? '+' : it.delta < 0 ? '−' : ''}%${Math.abs(it.delta)}`}
                  </Txt>
                  <View style={[styles.rowAccent, { backgroundColor: tone.base }]} />
                </View>
              );
            })}
            <View style={styles.tr}>
              <Txt weight="bold" size={13} style={styles.cName}>
                {t('common.total')}
              </Txt>
              <Txt weight="bold" size={13} style={styles.cNum}>
                {sum?.expenseCount ?? 0}
              </Txt>
              <Txt display="regular" size={12} style={styles.cAmt} numberOfLines={1}>
                {money(sum?.expense ?? 0, undefined, { trimZeroCents: true })}
              </Txt>
              <Txt weight="bold" size={13} style={styles.cNum}>
                %100
              </Txt>
              <Txt weight="bold" size={12.5} style={[styles.cDiff, { color: change === null ? colors.textMuted : change <= 0 ? colors.income : colors.danger }]}>
                {change === null ? '–' : `${change > 0 ? '+' : change < 0 ? '−' : ''}%${Math.abs(change)}`}
              </Txt>
            </View>
          </View>
        )}
        {view === 'table' && items.length > 0 && (
          <Txt tone="muted" size={11.5} style={styles.note}>
            {t('reports.tableNote')}
          </Txt>
        )}

        <View style={styles.trendHead}>
          <Txt weight="semibold" size={13}>
            {t('reports.trend')}
          </Txt>
          <Txt tone="muted" size={12}>
            {t('reports.average', { amount: money(Math.round(trendAvg), undefined, { trimZeroCents: true, compact: true }) })}
          </Txt>
        </View>
        <View style={styles.bars} accessibilityRole="image" accessibilityLabel={trend.map((x) => `${x.label} ${money(x.total, undefined, { trimZeroCents: true })}`).join(', ')}>
          {trend.map((x, i) => {
            const last = i === trend.length - 1;
            return (
              <View key={i} style={styles.barCol}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(6, (x.total / trendMax) * 92) },
                    last
                      ? { backgroundImage: `linear-gradient(180deg, ${colors.accent}, ${colors.ringTo})`, boxShadow: `0 0 26px ${tint(colors.accent, 0.45)}` }
                      : { backgroundImage: `linear-gradient(180deg, ${colors.surfaceSelected}, ${colors.glassTo})`, boxShadow: `inset 0 0 0 1px ${colors.hairline}` },
                  ]}
                />
                <Txt size={11} tone={last ? 'text' : 'muted'} numberOfLines={1}>
                  {x.label}
                </Txt>
              </View>
            );
          })}
        </View>

        <GlassPill icon="ios_share" label={t('reports.export')} onPress={() => void onExport()} style={styles.export} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { letterSpacing: -1.2, marginTop: 26 },
  periodNav: { marginTop: 12 },
  periodLabel: { letterSpacing: 2.4 },
  disabled: { opacity: 0.35 },
  totals: { marginTop: 18, gap: 8 },
  amount: { letterSpacing: -1.6, lineHeight: 50 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  groupSeg: { marginTop: 24 },
  empty: { textAlign: 'center', marginTop: 40 },
  chart: { marginHorizontal: -22, marginTop: 14 },
  legend: { gap: 2 },
  legendRow: { height: 52, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  share: { width: 40, textAlign: 'right' },
  table: { marginTop: 18, borderRadius: 22, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: 12, gap: 6 },
  th: { minHeight: 40 },
  caps: { letterSpacing: 1.4 },
  cName: { flex: 1, minWidth: 0 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cNum: { width: 38, textAlign: 'right' },
  cAmt: { width: 86, textAlign: 'right' },
  cDiff: { width: 48, textAlign: 'right' },
  rowAccent: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 2, borderRadius: 1 },
  note: { marginTop: 10 },
  trendHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 30 },
  bars: { flexDirection: 'row', gap: 14, marginTop: 12, alignItems: 'flex-end', height: 116 },
  barCol: { flex: 1, alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  bar: { alignSelf: 'stretch', borderRadius: 10 },
  export: { alignSelf: 'center', marginTop: 26 },
});
