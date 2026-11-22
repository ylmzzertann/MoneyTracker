import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { ProgressBar } from '@/components/Progress';
import { Sky } from '@/components/Sky';
import { SwipeRow } from '@/components/SwipeRow';
import { AccentButton, Card, Eyebrow, GlassPill, ScreenHeader, Txt } from '@/components/ui';
import { updateAccount } from '@/db/repos/accounts';
import { deleteInstallmentPlan, restoreInstallmentPlan } from '@/db/repos/installments';
import type { Account } from '@/db/types';
import { ChipChoice } from '@/features/settings/parts';
import { useAccounts, useCategories } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { useCardSummaries, useInstallmentPlans } from '@/hooks/usePlan';
import { dayKey, parseLocalISO } from '@/lib/dates';
import { bumpData } from '@/store/dataVersion';
import { showToast } from '@/store/toast';
import { categoryTone, useTheme } from '@/theme';

import type { CardSummary } from '../cardSummary';
import { daysUntil } from '../schedule';
import { DueChip } from '../UpcomingRow';

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

export function CardsScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const cards = useCardSummaries();
  const plans = useInstallmentPlans();
  const catalog = useCategories();
  const accounts = useAccounts(true);
  const { money, date } = useFormat();

  const removePlan = async (id: string) => {
    const deletedAt = await deleteInstallmentPlan(db, id);
    bumpData();
    showToast({ message: t('cards.planDeleted'), actionLabel: t('common.undo'), onAction: () => void restoreInstallmentPlan(db, id, deletedAt).then(bumpData) });
  };

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}>
        <ScreenHeader title={t('cards.title')} backLabel={t('common.back')} onBack={() => router.back()} />
        <View style={styles.gap}>
          {cards?.length === 0 && (
            <Card>
              <View style={styles.empty}>
                <CategoryTile icon="credit_card" color="#A78BFA" size={52} />
                <Txt tone="soft" size={13.5} style={styles.center}>
                  {t('cards.empty')}
                </Txt>
                <AccentButton icon="add" label={t('cards.addCard')} onPress={() => router.push('/settings/accounts')} />
              </View>
            </Card>
          )}

          {cards?.map((c) => <CardPanel key={c.account.id} summary={c} />)}

          {plans && plans.length > 0 && (
            <>
              <View style={styles.listHead}>
                <Eyebrow>{t('cards.installments')}</Eyebrow>
                <Txt tone="faint" size={10.5}>
                  {t('cards.swipeHint')}
                </Txt>
              </View>
              <View>
                {plans.map((p) => {
                  const cat = catalog?.byId.get(p.categoryId);
                  const acc = accounts?.find((a) => a.id === p.accountId);
                  const per = Math.floor(p.totalMinor / p.count);
                  const title = p.merchantName ?? cat?.label ?? '—';
                  return (
                    <SwipeRow
                      key={p.id}
                      accessibilityLabel={`${title}, ${t('cards.planProgress', { paid: p.paidCount, count: p.count })}`}
                      left={{ label: t('common.delete'), icon: 'delete', tone: 'danger', onAction: () => void removePlan(p.id) }}>
                      <CategoryTile icon={cat?.iconName ?? 'credit_card'} color={cat?.color ?? '#A78BFA'} size={36} soft />
                      <View style={styles.planBody}>
                        <View style={styles.planTop}>
                          <Txt weight="semibold" size={14.5} numberOfLines={1} style={styles.flex}>
                            {title}
                          </Txt>
                          <Txt display="regular" size={12.5}>
                            {money(p.remainingMinor, p.currency, { trimZeroCents: true })}
                          </Txt>
                        </View>
                        <ProgressBar share={p.paidCount / p.count} color={cat?.color ?? '#A78BFA'} height={5} />
                        <Txt tone="muted" size={11.5} numberOfLines={1}>
                          {[
                            t('cards.planProgress', { paid: p.paidCount, count: p.count }),
                            t('cards.perMonth', { amount: money(per, p.currency, { trimZeroCents: true }) }),
                            acc?.name,
                            p.nextDate ? t('cards.nextOn', { date: date(parseLocalISO(p.nextDate), { day: 'numeric', month: 'short' }) }) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Txt>
                      </View>
                    </SwipeRow>
                  );
                })}
              </View>
            </>
          )}
          <Txt tone="faint" size={11.5} style={styles.footer}>
            {t('cards.footer')}
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}

function CardPanel({ summary }: { summary: CardSummary }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const { money, date } = useFormat();
  const { account: a, cycle } = summary;
  const [editing, setEditing] = useState(!cycle);
  const tone = categoryTone(a.color);
  const cur = a.currency;
  const fmt = (d: Date) => date(d, { day: 'numeric', month: 'short' });
  const lastDueOpen = cycle ? dayKey(cycle.lastDue) >= dayKey(new Date()) : false;
  const used = summary.currentAmount + (lastDueOpen ? summary.lastStatementAmount : 0) + summary.futureTotal;
  const maxFuture = Math.max(1, ...summary.future.map((f) => f.total));

  const setDays = async (patch: Partial<Pick<Account, 'statementDay' | 'dueDay'>>) => {
    const { id: _id, sortOrder: _s, archived: _a, ...input } = a;
    await updateAccount(db, a.id, { ...input, ...patch });
    bumpData();
  };

  return (
    <Card>
      <View style={styles.cardHead}>
        <CategoryTile icon="credit_card" color={a.color} size={40} />
        <View style={styles.flex}>
          <Txt weight="semibold" size={16} numberOfLines={1}>
            {a.name}
          </Txt>
          <Txt tone="muted" size={12}>
            {cycle ? t('cards.days', { statement: a.statementDay, due: a.dueDay }) : t('cards.daysMissing')}
          </Txt>
        </View>
        {cycle && <GlassPill icon="edit" label={editing ? t('common.done') : t('cards.changeDays')} onPress={() => setEditing(!editing)} style={styles.smallPill} />}
      </View>

      {cycle && (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Eyebrow>{t('cards.lastStatement')}</Eyebrow>
            <Txt display="light" size={22} numberOfLines={1} adjustsFontSizeToFit>
              {money(summary.lastStatementAmount, cur, { trimZeroCents: true })}
            </Txt>
            <View style={styles.statRow}>
              <Txt tone="muted" size={11.5}>
                {t('cards.dueOn', { date: fmt(cycle.lastDue) })}
              </Txt>
              {lastDueOpen && summary.lastStatementAmount > 0 && <DueChip days={daysUntil(dayKey(cycle.lastDue))} />}
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
          <View style={styles.stat}>
            <Eyebrow>{t('cards.currentPeriod')}</Eyebrow>
            <Txt display="light" size={22} numberOfLines={1} adjustsFontSizeToFit>
              {money(summary.currentAmount, cur, { trimZeroCents: true })}
            </Txt>
            <Txt tone="muted" size={11.5}>
              {t('cards.closesOn', { date: fmt(cycle.nextClose), count: daysUntil(dayKey(cycle.nextClose)) })}
            </Txt>
          </View>
        </View>
      )}

      {a.creditLimitMinor ? (
        <View style={styles.limit}>
          <ProgressBar share={used / a.creditLimitMinor} color={used >= a.creditLimitMinor ? colors.danger : a.color} height={7} />
          <View style={styles.statRow}>
            <Txt tone="soft" size={12}>
              {t('cards.available', { amount: money(Math.max(0, a.creditLimitMinor - used), cur, { trimZeroCents: true }) })}
            </Txt>
            <Txt tone="muted" size={12}>
              {t('cards.limit', { amount: money(a.creditLimitMinor, cur, { trimZeroCents: true }) })}
            </Txt>
          </View>
        </View>
      ) : null}

      {summary.future.length > 0 && (
        <View style={styles.future}>
          <Eyebrow>{t('cards.futureInstallments', { amount: money(summary.futureTotal, cur, { trimZeroCents: true }) })}</Eyebrow>
          <View style={styles.bars}>
            {summary.future.slice(0, 6).map((f) => {
              const [y, m] = f.month.split('-').map(Number);
              return (
                <View key={f.month} style={styles.barCol} accessible accessibilityLabel={`${date(new Date(y, m - 1, 1), { month: 'long', year: 'numeric' })}: ${money(f.total, cur)}`}>
                  <Txt tone="soft" size={9.5} numberOfLines={1}>
                    {money(f.total, cur, { compact: true })}
                  </Txt>
                  <View style={[styles.barTrack, { backgroundColor: colors.track }]}>
                    <View
                      style={{
                        height: `${Math.max(8, (f.total / maxFuture) * 100)}%`,
                        borderRadius: 6,
                        backgroundImage: `linear-gradient(180deg, ${isDark ? tone.light : tone.base}, ${tone.base})`,
                        boxShadow: `0 0 10px ${tone.base}66`,
                      }}
                    />
                  </View>
                  <Txt tone="muted" size={10}>
                    {date(new Date(y, m - 1, 1), { month: 'short' })}
                  </Txt>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {editing && (
        <View style={styles.editor}>
          <Txt tone="soft" weight="bold" size={12}>
            {t('accounts.statementDay')}
          </Txt>
          <ChipChoice value={a.statementDay ? String(a.statementDay) : ''} onChange={(v) => void setDays({ statementDay: Number(v) })} options={DAYS.map((d) => ({ value: d, label: d }))} />
          <Txt tone="soft" weight="bold" size={12}>
            {t('accounts.dueDay')}
          </Txt>
          <ChipChoice value={a.dueDay ? String(a.dueDay) : ''} onChange={(v) => void setDays({ dueDay: Number(v) })} options={DAYS.map((d) => ({ value: d, label: d }))} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 12, marginTop: 18 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  center: { textAlign: 'center', lineHeight: 19 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, marginTop: 8 },
  planBody: { flex: 1, gap: 6, minWidth: 0 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footer: { textAlign: 'center', marginTop: 12, lineHeight: 17, paddingHorizontal: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallPill: { height: 36, paddingHorizontal: 12 },
  stats: { flexDirection: 'row', marginTop: 16, gap: 14 },
  stat: { flex: 1, gap: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  divider: { width: 1 },
  limit: { gap: 8, marginTop: 16 },
  future: { gap: 10, marginTop: 18 },
  bars: { flexDirection: 'row', gap: 8, height: 110 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { flex: 1, width: 18, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  editor: { gap: 10, marginTop: 16 },
});
