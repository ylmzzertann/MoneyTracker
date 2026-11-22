import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Sky } from '@/components/Sky';
import { Chip, GlassCircle, GlassPill, Txt, useGlass } from '@/components/ui';
import { createTransaction, getTransaction, listTransactions, restoreTransaction, softDeleteTransaction } from '@/db/repos/transactions';
import type { TransactionListRow, TxKind } from '@/db/types';
import { NAV_HEIGHT } from '@/features/nav/SectionNav';
import { totals } from '@/features/reports/aggregate';
import { useCategories } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { usePeriodRows } from '@/hooks/usePeriodRows';
import { useQuery } from '@/hooks/useQuery';
import { dayKey, isSameDay, parseLocalISO, periodRange, shiftAnchor, startOfDay, addDays, toLocalISO } from '@/lib/dates';
import { bumpData } from '@/store/dataVersion';
import { useSettings } from '@/store/settings';
import { showToast } from '@/store/toast';
import { categoryTone, font, useTheme } from '@/theme';

import { TxRow } from './TxRow';

type KindFilter = 'all' | TxKind;

export function ActivityScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const glass = useGlass();
  const { money, date } = useFormat();
  const weekStart = useSettings((s) => s.weekStart);
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const catalog = useCategories();

  const [anchor, setAnchor] = useState(() => new Date());
  const [kind, setKind] = useState<KindFilter>('all');
  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId ?? null);
  const [paramSeen, setParamSeen] = useState(params.categoryId ?? null);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');

  // A category tapped on the home screen arrives as a route param.
  if ((params.categoryId ?? null) !== paramSeen) {
    setParamSeen(params.categoryId ?? null);
    if (params.categoryId) {
      setCategoryId(params.categoryId);
      setKind('all');
    }
  }

  const range = periodRange('month', anchor, weekStart);
  const start = toLocalISO(range.start);
  const end = toLocalISO(range.end);
  const root = categoryId ? catalog?.byId.get(categoryId) : undefined;
  const categoryIds = root ? [root.id, ...root.children.map((c) => c.id)] : undefined;
  const query = search.trim();
  const rows =
    useQuery(`list:${start}:${end}:${kind}:${categoryIds?.join(',') ?? ''}:${query}`, (d) =>
      listTransactions(d, {
        start,
        end,
        kind: kind === 'all' ? undefined : kind,
        categoryIds,
        search: query || undefined,
      }),
    ).data ?? [];
  const period = usePeriodRows(range);
  const sum = period ? totals(period.rows) : null;
  const baseById = new Map<string, number>();
  for (const r of period?.rows ?? []) baseById.set(r.transactionId, (baseById.get(r.transactionId) ?? 0) + r.baseMinor);

  const sections: { key: string; day: Date; data: TransactionListRow[]; expense: number; income: number }[] = [];
  for (const r of rows) {
    const key = dayKey(r.occurredAt);
    let s = sections[sections.length - 1];
    if (!s || s.key !== key) {
      s = { key, day: startOfDay(parseLocalISO(r.occurredAt)), data: [], expense: 0, income: 0 };
      sections.push(s);
    }
    s.data.push(r);
    const base = baseById.get(r.id) ?? 0;
    if (r.kind === 'expense') s.expense += base;
    else s.income += base;
  }

  const remove = async (row: TransactionListRow) => {
    await softDeleteTransaction(db, row.id);
    bumpData();
    showToast({
      message: t('transactions.deleted'),
      actionLabel: t('common.undo'),
      onAction: () => {
        void restoreTransaction(db, row.id).then(bumpData);
      },
    });
  };

  const duplicate = async (row: TransactionListRow) => {
    const tx = await getTransaction(db, row.id);
    if (!tx) return;
    const { id: _id, ...input } = tx;
    const newId = await createTransaction(db, { ...input, occurredAt: toLocalISO(new Date()), externalId: null, source: 'manual' });
    bumpData();
    showToast({
      message: t('transactions.duplicated'),
      actionLabel: t('common.undo'),
      onAction: () => {
        void softDeleteTransaction(db, newId).then(bumpData);
      },
    });
  };

  const today = startOfDay(new Date());
  const dayTitle = (d: Date) =>
    isSameDay(d, today) ? t('common.today') : isSameDay(d, addDays(today, -1)) ? t('common.yesterday') : date(d, { weekday: 'long' });
  const isCurrentMonth = range.end > new Date() && range.start <= new Date();
  const topCats = catalog?.topLevel('expense').slice(0, 6) ?? [];

  const header = (
    <View>
      <View style={styles.header}>
        <View style={styles.monthRow}>
          <GlassCircle icon="chevron_left" label={t('transactions.prevMonth')} onPress={() => setAnchor(shiftAnchor('month', anchor, -1))} />
          <GlassPill icon="calendar_month" iconColor={colors.accent} label={date(range.start, { month: 'long', year: 'numeric' }).toLocaleUpperCase()} textStyle={styles.month} />
          {!isCurrentMonth && (
            <GlassCircle icon="chevron_right" label={t('transactions.nextMonth')} onPress={() => setAnchor(shiftAnchor('month', anchor, 1))} />
          )}
        </View>
        <GlassCircle
          icon={searching ? 'close' : 'search'}
          label={searching ? t('transactions.closeSearch') : t('transactions.search')}
          onPress={() => {
            setSearching(!searching);
            setSearch('');
          }}
        />
      </View>

      <View style={styles.titleBlock}>
        <Txt display="light" size={34} style={styles.title}>
          {t('transactions.title')}
        </Txt>
        {sum && (
          <Txt tone="muted" size={13}>
            {t('transactions.count', { count: sum.expenseCount + sum.incomeCount })} · {t('transactions.spentLabel')}{' '}
            <Txt display="regular" size={13}>
              {money(sum.expense, undefined, { trimZeroCents: true })}
            </Txt>{' '}
            · {t('transactions.incomeLabel')}{' '}
            <Txt display="regular" size={13} style={{ color: colors.income }}>
              {money(sum.income, undefined, { trimZeroCents: true, showPlus: true })}
            </Txt>
          </Txt>
        )}
      </View>

      {searching && (
        <View style={[styles.search, glass]}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder={t('transactions.searchPlaceholder')}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t('transactions.searchPlaceholder')}
            style={[styles.input, { color: colors.text, fontFamily: font.medium }]}
          />
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={t('common.all')} selected={kind === 'all' && !categoryId} onPress={() => { setKind('all'); setCategoryId(null); }} />
        <Chip label={t('kind.expense')} selected={kind === 'expense' && !categoryId} onPress={() => { setKind('expense'); setCategoryId(null); }} />
        <Chip label={t('kind.income')} selected={kind === 'income' && !categoryId} onPress={() => { setKind('income'); setCategoryId(null); }} />
        {root && !topCats.some((c) => c.id === root.id) && (
          <Chip label={root.label} icon={root.iconName} selected onPress={() => setCategoryId(null)} />
        )}
        {topCats.map((c) => {
          const tone = categoryTone(c.color);
          return (
            <Chip
              key={c.id}
              label={c.label}
              icon={c.iconName}
              iconColor={isDark ? tone.light : tone.deep}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.flex}>
      <Sky />
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: NAV_HEIGHT + insets.bottom + 40, paddingHorizontal: 12 }}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Txt size={12} weight="semibold" tone="soft">
              {dayTitle(section.day)}{' '}
              <Txt size={12} tone="muted">
                · {date(section.day, { day: 'numeric', month: 'long' })}
              </Txt>
            </Txt>
            <Txt size={12} tone="muted">
              {[section.income > 0 ? money(section.income, undefined, { showPlus: true, trimZeroCents: true }) : null, section.expense > 0 ? money(-section.expense, undefined, { trimZeroCents: true }) : null]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          </View>
        )}
        renderItem={({ item }) => (
          <TxRow
            row={item}
            category={catalog?.byId.get(item.categoryId)}
            onDelete={() => void remove(item)}
            onDuplicate={() => void duplicate(item)}
            onEdit={() => router.push({ pathname: '/add', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <Txt tone="muted" size={13} style={styles.empty}>
            {t('transactions.empty')}
          </Txt>
        }
        ListFooterComponent={
          rows.length > 0 ? (
            <Txt tone="faint" size={10.5} style={styles.footer}>
              {t('transactions.rowHint')}
            </Txt>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  month: { fontSize: 10, letterSpacing: 2.4, fontWeight: '700' },
  titleBlock: { paddingHorizontal: 10, marginTop: 18, gap: 8 },
  title: { letterSpacing: -1.2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 22, paddingHorizontal: 14, marginTop: 14, marginHorizontal: 8 },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  chips: { gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 6 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingTop: 16, paddingBottom: 6 },
  empty: { textAlign: 'center', marginTop: 48 },
  footer: { textAlign: 'center', marginTop: 18 },
});
