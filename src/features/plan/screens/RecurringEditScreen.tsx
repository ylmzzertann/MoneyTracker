import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sky } from '@/components/Sky';
import { AccentButton, Card, Eyebrow, GlassCircle, GlassPill, Segmented, Txt, useGlass } from '@/components/ui';
import { systemCategoryId } from '@/db/defaults';
import { createRule, deleteRule, getRule, postDueRules, restoreRule, updateRule } from '@/db/repos/recurring';
import type { Frequency, RecurringRuleInput, TxKind } from '@/db/types';
import { CategoryPicker } from '@/features/add/CategoryPicker';
import { ChipChoice, SwitchRow } from '@/features/settings/parts';
import { useAccounts, useCategories } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { useQuery } from '@/hooks/useQuery';
import { dayKey, parseLocalISO } from '@/lib/dates';
import { bumpData } from '@/store/dataVersion';
import { useSettings } from '@/store/settings';
import { showToast } from '@/store/toast';
import { font, useTheme } from '@/theme';

import { AmountSheet } from '../AmountSheet';
import { MiniCalendar } from '../MiniCalendar';
import { requestReminderPermission } from '../notifications';

type RuleType = 'subscription' | 'bill' | 'income';
const DEFAULT_CATEGORY: Record<RuleType, string> = {
  subscription: systemCategoryId('subscriptions'),
  bill: systemCategoryId('utilities'),
  income: systemCategoryId('salary'),
};
const REMINDERS = ['none', '0', '1', '3'] as const;

export function RecurringEditScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const glass = useGlass();
  const { moneyParts } = useFormat();
  const params = useLocalSearchParams<{ id?: string; name?: string; amount?: string; categoryId?: string; accountId?: string; nextDue?: string; kind?: TxKind }>();
  const editId = params.id ?? null;
  const catalog = useCategories();
  const accounts = useAccounts();
  const lastAccountId = useSettings((s) => s.lastAccountId);
  const notifyBills = useSettings((s) => s.notifyBills);
  const setSettings = useSettings((s) => s.set);
  const existing = useQuery(`rule:${editId ?? ''}`, (d) => (editId ? getRule(d, editId) : Promise.resolve(null))).data;
  const today = dayKey(new Date());

  const [type, setType] = useState<RuleType>(params.kind === 'income' ? 'income' : params.name ? 'subscription' : 'bill');
  const [name, setName] = useState(params.name ?? '');
  const [amount, setAmount] = useState(Number(params.amount ?? 0) || 0);
  const [rootId, setRootId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(params.accountId ?? null);
  const [frequency, setFrequency] = useState<Frequency>('month');
  const [nextDue, setNextDue] = useState(params.nextDue ?? today);
  const [autoPost, setAutoPost] = useState(false);
  const [remind, setRemind] = useState<(typeof REMINDERS)[number]>(params.kind === 'income' ? 'none' : '1');
  const [active, setActive] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Editing: copy the stored rule into the form once.
  if (existing && catalog && loadedId !== existing.id) {
    const root = catalog.rootOf(existing.categoryId);
    setLoadedId(existing.id);
    setType(existing.kind === 'income' ? 'income' : existing.isSubscription ? 'subscription' : 'bill');
    setName(existing.name);
    setAmount(existing.amountMinor);
    setRootId(root?.id ?? null);
    setSubId(root && root.id !== existing.categoryId ? existing.categoryId : null);
    setAccountId(existing.accountId);
    setFrequency(existing.frequency);
    setNextDue(existing.nextDue);
    setAutoPost(existing.autoPost);
    setRemind(existing.remindDays === null ? 'none' : (String(existing.remindDays) as (typeof REMINDERS)[number]));
    setActive(existing.active);
  }

  const kind: TxKind = type === 'income' ? 'income' : 'expense';
  const list = catalog?.topLevel(kind) ?? [];
  const wanted = catalog?.byId.get(params.categoryId ?? DEFAULT_CATEGORY[type]);
  const wantedOk = wanted && wanted.kind === kind ? wanted : undefined;
  const effRoot = rootId ?? (wantedOk ? (catalog?.rootOf(wantedOk.id)?.id ?? null) : (list[0]?.id ?? null));
  const effSub = rootId ? subId : wantedOk?.parentId ? wantedOk.id : null;
  const account = accounts?.find((a) => a.id === (accountId ?? lastAccountId)) ?? accounts?.[0];
  const currency = account?.currency ?? 'USD';
  const parts = moneyParts(amount, currency);
  const categoryLabel = catalog?.byId.get(effSub ?? effRoot ?? '')?.label ?? '';

  const save = async () => {
    const categoryId = effSub ?? effRoot;
    if (amount <= 0) return showToast({ message: t('add.needAmount') });
    if (!categoryId) return showToast({ message: t('add.needCategory') });
    if (!account) return showToast({ message: t('add.needAccount') });
    const input: RecurringRuleInput = {
      kind,
      name: name.trim() || categoryLabel,
      accountId: account.id,
      categoryId,
      amountMinor: amount,
      currency: account.currency,
      frequency,
      interval: existing?.interval ?? 1,
      anchorDay: frequency === 'week' ? null : parseLocalISO(nextDue).getDate(),
      nextDue,
      autoPost,
      remindDays: remind === 'none' ? null : Number(remind),
      isSubscription: type === 'subscription',
      active,
    };
    try {
      if (editId) await updateRule(db, editId, input);
      else await createRule(db, input);
      if (autoPost) await postDueRules(db);
      bumpData();
    } catch {
      return showToast({ message: t('common.error') });
    }
    if (input.remindDays !== null && !notifyBills) {
      const granted = await requestReminderPermission().catch(() => false);
      if (granted) setSettings({ notifyBills: true });
      else showToast({ message: t('notifications.denied') });
    } else {
      showToast({ message: editId ? t('recurring.updated') : t('recurring.created') });
    }
    router.back();
  };

  const remove = async () => {
    if (!editId) return;
    await deleteRule(db, editId);
    bumpData();
    router.back();
    showToast({ message: t('recurring.deleted'), actionLabel: t('common.undo'), onAction: () => void restoreRule(db, editId).then(bumpData) });
  };

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <GlassCircle icon="close" label={t('common.close')} onPress={() => router.back()} />
          <Txt display="light" size={22} style={styles.title} numberOfLines={1} accessibilityRole="header">
            {editId ? t('recurring.editTitle') : t('recurring.newTitle')}
          </Txt>
          <GlassCircle icon="check" iconColor={colors.accent} label={t('common.save')} onPress={() => void save()} />
        </View>

        <View style={styles.pad}>
          <Segmented
            stretch
            accessibilityLabel={t('recurring.type')}
            value={type}
            onChange={(v) => {
              setType(v);
              setRootId(null);
              setSubId(null);
            }}
            options={[
              { value: 'subscription', label: t('recurring.typeSubscription') },
              { value: 'bill', label: t('recurring.typeBill') },
              { value: 'income', label: t('recurring.typeIncome') },
            ]}
          />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={t('recurring.amountA11y')} onPress={() => setSheet(true)} style={styles.amount}>
          <Txt display="light" size={46} style={styles.amountText} numberOfLines={1} adjustsFontSizeToFit>
            {parts.main}
            <Txt display="light" size={22} tone="muted">
              {parts.cents}
            </Txt>
          </Txt>
          <Txt tone="faint" size={11}>
            {t('recurring.tapAmount')}
          </Txt>
        </Pressable>

        <View style={[styles.pad, styles.nameWrap]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={categoryLabel ? t('recurring.namePlaceholderWith', { name: categoryLabel }) : t('recurring.namePlaceholder')}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t('recurring.name')}
            returnKeyType="done"
            style={[styles.input, glass, { color: colors.text, fontFamily: font.semibold }]}
          />
        </View>

        <CategoryPicker
          categories={list}
          rootId={effRoot}
          subId={effSub}
          onChange={(r, s) => {
            setRootId(r);
            setSubId(s);
          }}
        />

        <View style={[styles.pad, styles.sections]}>
          {accounts && accounts.length > 0 && (
            <View style={styles.block}>
              <Eyebrow>{t('add.account')}</Eyebrow>
              <ChipChoice value={account?.id ?? ''} onChange={setAccountId} options={accounts.map((a) => ({ value: a.id, label: a.name, icon: a.iconName }))} />
            </View>
          )}

          <View style={styles.block}>
            <Eyebrow>{t('recurring.repeats')}</Eyebrow>
            <Segmented
              stretch
              value={frequency}
              onChange={setFrequency}
              options={[
                { value: 'week', label: t('recurring.freqWeek') },
                { value: 'month', label: t('recurring.freqMonth') },
                { value: 'year', label: t('recurring.freqYear') },
              ]}
            />
          </View>

          <Card>
            <Eyebrow>{t('recurring.nextDate')}</Eyebrow>
            <MiniCalendar value={nextDue} onChange={setNextDue} min={editId ? undefined : today} />
          </Card>

          <View style={styles.block}>
            <Eyebrow>{t('recurring.remind')}</Eyebrow>
            <ChipChoice
              value={remind}
              onChange={setRemind}
              options={REMINDERS.map((r) => ({
                value: r,
                label: r === 'none' ? t('recurring.remindNone') : r === '0' ? t('recurring.remindSameDay') : t('recurring.remindBefore', { count: Number(r) }),
              }))}
            />
            {remind !== 'none' && !notifyBills && (
              <Txt tone="muted" size={11.5}>
                {t('recurring.permissionHint')}
              </Txt>
            )}
          </View>

          <Card padded={false}>
            <SwitchRow icon="autorenew" label={t('recurring.autoPost')} value={autoPost} onChange={setAutoPost} hint={t('recurring.autoPostHint')} />
            {editId && <SwitchRow icon="schedule" label={t('recurring.active')} value={active} onChange={setActive} />}
          </Card>

          <AccentButton icon="check" label={t('common.save')} onPress={() => void save()} />
          {editId && <GlassPill icon="delete" iconColor={colors.danger} label={t('recurring.delete')} onPress={() => void remove()} />}
        </View>
      </ScrollView>

      {sheet && (
        <AmountSheet
          title={name.trim() || categoryLabel || t('recurring.newTitle')}
          currency={currency}
          initial={amount}
          onSubmit={(v) => {
            setAmount(v);
            setSheet(false);
          }}
          onClose={() => setSheet(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  title: { flex: 1, letterSpacing: -0.8, textAlign: 'center' },
  pad: { paddingHorizontal: 16 },
  amount: { alignItems: 'center', gap: 4, marginVertical: 22, paddingHorizontal: 24 },
  amountText: { letterSpacing: -1.6 },
  nameWrap: { marginBottom: 14 },
  input: { height: 48, borderRadius: 16, paddingHorizontal: 16, fontSize: 15 },
  sections: { gap: 16, marginTop: 16 },
  block: { gap: 10 },
});
