import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Orb } from '@/components/Orb';
import { Sky } from '@/components/Sky';
import { GlassCircle, GlassPill, Segmented, Txt, useGlass } from '@/components/ui';
import { createTransaction, getTransaction, updateTransaction } from '@/db/repos/transactions';
import type { TransactionInput, TxKind } from '@/db/types';
import { useAccounts, useCategories } from '@/hooks/useCatalog';
import { useQuery } from '@/hooks/useQuery';
import { isSameDay, parseLocalISO, startOfDay, toLocalISO } from '@/lib/dates';
import { bumpData } from '@/store/dataVersion';
import { useSettings } from '@/store/settings';
import { showToast } from '@/store/toast';
import { categoryTone, font, useTheme } from '@/theme';

import { AmountDial } from './AmountDial';
import { CategoryPicker } from './CategoryPicker';
import { DayStrip } from './DayStrip';
import { Keypad } from './Keypad';

export function AddScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const glass = useGlass();
  const params = useLocalSearchParams<{ id?: string; categoryId?: string; kind?: TxKind }>();
  const editId = params.id ?? null;
  const catalog = useCategories();
  const accounts = useAccounts();
  const lastAccountId = useSettings((s) => s.lastAccountId);
  const lastExpense = useSettings((s) => s.lastExpenseCategoryId);
  const lastIncome = useSettings((s) => s.lastIncomeCategoryId);
  const setSettings = useSettings((s) => s.set);
  const baseCurrency = useSettings((s) => s.baseCurrency);
  const existing = useQuery(`tx:${editId ?? ''}`, (d) => (editId ? getTransaction(d, editId) : Promise.resolve(null))).data;

  const [kind, setKind] = useState<TxKind>(params.kind === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState(0);
  const [rootId, setRootId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [merchant, setMerchant] = useState('');
  const [editingMerchant, setEditingMerchant] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editing: copy the stored transaction into the form once it has loaded.
  if (existing && catalog && loadedId !== existing.id) {
    const catId = existing.splits[0]?.categoryId ?? null;
    const root = catId ? catalog.rootOf(catId) : undefined;
    setLoadedId(existing.id);
    setKind(existing.kind);
    setAmount(existing.amountMinor);
    setRootId(root?.id ?? null);
    setSubId(root && catId !== root.id ? catId : null);
    setAccountId(existing.accountId);
    setDay(startOfDay(parseLocalISO(existing.occurredAt)));
    setMerchant(existing.merchantName ?? '');
  }

  const list = catalog?.topLevel(kind) ?? [];
  const wanted = params.categoryId ?? (kind === 'expense' ? lastExpense : lastIncome);
  const wantedCat = wanted ? catalog?.byId.get(wanted) : undefined;
  const wantedOk = wantedCat && wantedCat.kind === kind ? wantedCat : undefined;
  const effRoot = rootId ?? (wantedOk ? (catalog?.rootOf(wantedOk.id)?.id ?? null) : (list[0]?.id ?? null));
  const effSub = rootId ? subId : wantedOk?.parentId ? wantedOk.id : null;
  const account = accounts?.find((a) => a.id === (accountId ?? lastAccountId)) ?? accounts?.[0];
  const currency = account?.currency ?? baseCurrency;

  const shake = useSharedValue(0);
  const lift = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  const refuse = (message: string) => {
    shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(0, { duration: 50 })));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    showToast({ message });
  };

  const save = async () => {
    if (saving) return;
    const categoryId = effSub ?? effRoot;
    if (amount <= 0) return refuse(t('add.needAmount'));
    if (!categoryId) return refuse(t('add.needCategory'));
    if (!account) return refuse(t('add.needAccount'));
    const keepTime = existing && isSameDay(parseLocalISO(existing.occurredAt), day);
    const now = new Date();
    const occurredAt = keepTime
      ? existing.occurredAt
      : toLocalISO(isSameDay(day, now) ? now : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12));
    const input: TransactionInput = {
      kind,
      accountId: account.id,
      amountMinor: amount,
      currency: account.currency,
      occurredAt,
      merchantName: merchant.trim() || null,
      note: existing?.note ?? null,
      channel: catalog?.byId.get(categoryId)?.channel ?? existing?.channel ?? null,
      source: existing?.source ?? 'manual',
      splits: [{ categoryId, amountMinor: amount }],
    };
    setSaving(true);
    try {
      if (editId) await updateTransaction(db, editId, input);
      else await createTransaction(db, input);
    } catch {
      setSaving(false);
      lift.set(withSpring(0));
      return refuse(t('common.error'));
    }
    bumpData();
    setSettings(
      kind === 'expense'
        ? { lastAccountId: account.id, lastExpenseCategoryId: categoryId }
        : { lastAccountId: account.id, lastIncomeCategoryId: categoryId },
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast({ message: editId ? t('add.updated') : t('add.saved') });
    router.back();
  };

  const flick = usePanGesture({
    runOnJS: true,
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      lift.set(Math.min(0, e.translationY) * 0.6);
    },
    onDeactivate: (e) => {
      if (e.translationY < -60 || e.velocityY < -700) {
        lift.set(withTiming(-height, { duration: 260 }));
        void save();
      } else {
        lift.set(withSpring(0));
      }
    },
    onFinalize: (e) => {
      if (e.canceled) lift.set(withSpring(0));
    },
  });
  const tapSave = useTapGesture({ maxDistance: 10, runOnJS: true, onActivate: () => void save() });
  const saveGesture = useExclusiveGestures(flick, tapSave);

  const dialSize = Math.round(Math.min(width - 60, 300, Math.max(220, height - 540)));
  const cycleAccount = () => {
    if (!accounts || accounts.length === 0 || !account) return;
    const i = accounts.findIndex((a) => a.id === account.id);
    setAccountId(accounts[(i + 1) % accounts.length].id);
    void Haptics.selectionAsync();
  };

  return (
    <View style={styles.flex}>
      <Sky />
      <View style={[styles.flex, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.header}>
          <GlassCircle icon="close" label={t('common.close')} onPress={() => router.back()} />
          <Segmented
            accessibilityLabel={t('add.titleNew')}
            itemWidth={78}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setRootId(null);
              setSubId(null);
            }}
            options={[
              { value: 'expense', label: t('kind.expense') },
              { value: 'income', label: t('kind.income') },
            ]}
          />
          <GlassCircle icon={keypad ? 'donut_large' : 'dialpad'} label={keypad ? t('add.wheels') : t('add.keypad')} onPress={() => setKeypad(!keypad)} />
        </View>

        <DayStrip value={day} onChange={setDay} />

        <Animated.View style={[styles.amountArea, shakeStyle]}>
          {keypad ? (
            <Keypad value={amount} currency={currency} onChange={setAmount} />
          ) : (
            <AmountDial size={dialSize} value={amount} currency={currency} onChange={setAmount} onPressAmount={() => setKeypad(true)} />
          )}
        </Animated.View>

        <CategoryPicker
          categories={list}
          rootId={effRoot}
          subId={effSub}
          onChange={(r, s) => {
            setRootId(r);
            setSubId(s);
          }}
        />

        <View style={styles.meta}>
          {account && (
            <GlassPill
              icon={account.iconName}
              iconColor={categoryTone(account.color).light}
              label={account.name}
              accessibilityLabel={`${t('add.account')}: ${account.name}`}
              onPress={accounts && accounts.length > 1 ? cycleAccount : undefined}
              style={styles.metaPill}
            />
          )}
          {editingMerchant ? (
            <View style={[styles.merchantInput, glass]}>
              <Icon name="storefront" size={18} color={colors.textSoft} />
              <TextInput
                autoFocus
                value={merchant}
                onChangeText={setMerchant}
                onSubmitEditing={() => setEditingMerchant(false)}
                onBlur={() => setEditingMerchant(false)}
                placeholder={t('add.merchantPlaceholder')}
                placeholderTextColor={colors.textFaint}
                returnKeyType="done"
                accessibilityLabel={t('add.merchant')}
                style={[styles.input, { color: colors.text, fontFamily: font.semibold }]}
              />
            </View>
          ) : (
            <GlassPill icon="storefront" label={merchant || t('add.merchantAdd')} onPress={() => setEditingMerchant(true)} style={styles.metaPill} />
          )}
        </View>

        <View style={styles.saveArea}>
          <Icon name="keyboard_double_arrow_up" size={22} color={colors.accent} style={styles.arrows} />
          <GestureDetector gesture={saveGesture}>
            <Animated.View
              style={liftStyle}
              accessible
              accessibilityRole="button"
              accessibilityLabel={editId ? t('add.swipeToUpdate') : t('common.save')}
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={() => void save()}>
              <Orb icon="check" size={62} />
            </Animated.View>
          </GestureDetector>
          <Txt tone="faint" size={10.5} style={styles.saveHint}>
            {t('add.flickToSave')}
          </Txt>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  amountArea: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 220 },
  meta: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 16, marginTop: 10 },
  metaPill: { maxWidth: 180, height: 40 },
  merchantInput: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, borderRadius: 999, paddingHorizontal: 14, minWidth: 180 },
  input: { flex: 1, fontSize: 13, paddingVertical: 0 },
  saveArea: { alignItems: 'center', gap: 6, marginTop: 14 },
  arrows: { opacity: 0.7 },
  saveHint: { letterSpacing: 0.4 },
});
