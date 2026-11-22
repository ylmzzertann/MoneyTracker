import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { Sky } from '@/components/Sky';
import { AccentButton, Card, Eyebrow, GlassCircle, Txt, useGlass } from '@/components/ui';
import { CATEGORY_COLORS } from '@/db/defaults';
import { createGoal, getGoal, updateGoal } from '@/db/repos/goals';
import { ChipChoice, ColorChoice } from '@/features/settings/parts';
import { useFormat } from '@/hooks/useFormat';
import { useQuery } from '@/hooks/useQuery';
import { dayKey, parseLocalISO } from '@/lib/dates';
import { bumpData } from '@/store/dataVersion';
import { useSettings } from '@/store/settings';
import { showToast } from '@/store/toast';
import { font, useTheme } from '@/theme';
import { iconOrDefault, type IconName } from '@/theme/icons';

import { AmountSheet } from '../AmountSheet';
import { GOAL_HORIZONS, targetDateIn } from '../goals';
import { MiniCalendar } from '../MiniCalendar';

const GOAL_ICONS: IconName[] = [
  'flag', 'savings', 'flight', 'home', 'directions_car', 'school', 'favorite', 'redeem', 'smartphone', 'child_care',
  'pets', 'fitness_center', 'account_balance', 'apparel', 'sports_esports', 'local_florist', 'work', 'language',
];

export function GoalEditScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const glass = useGlass();
  const { moneyParts, date } = useFormat();
  const base = useSettings((s) => s.baseCurrency);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ?? null;
  const existing = useQuery(`goal:${editId ?? ''}`, (d) => (editId ? getGoal(d, editId) : Promise.resolve(null))).data;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconName>('flag');
  const [color, setColor] = useState('#FACC15');
  const [target, setTarget] = useState(0);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<string>('0');
  const [pickDate, setPickDate] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (existing && loadedId !== existing.id) {
    setLoadedId(existing.id);
    setName(existing.name);
    setIcon(iconOrDefault(existing.icon));
    setColor(existing.color);
    setTarget(existing.targetMinor);
    setTargetDate(existing.targetDate);
    setHorizon(existing.targetDate ? 'custom' : '0');
  }

  const currency = existing?.currency ?? base;
  const parts = moneyParts(target, currency);
  const today = dayKey(new Date());

  const save = async () => {
    if (!name.trim()) return showToast({ message: t('goals.needName') });
    if (target <= 0) return showToast({ message: t('goals.needTarget') });
    const input = { name, icon, color, targetMinor: target, currency, targetDate };
    try {
      if (editId) await updateGoal(db, editId, input);
      else await createGoal(db, input);
      bumpData();
      router.back();
    } catch {
      showToast({ message: t('common.error') });
    }
  };

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <GlassCircle icon="close" label={t('common.close')} onPress={() => router.back()} />
          <Txt display="light" size={22} style={styles.title} numberOfLines={1} accessibilityRole="header">
            {editId ? t('goals.editTitle') : t('goals.newTitle')}
          </Txt>
          <GlassCircle icon="check" iconColor={colors.accent} label={t('common.save')} onPress={() => void save()} />
        </View>

        <View style={styles.preview}>
          <CategoryTile icon={icon} color={color} size={64} selected />
          <TextInput
            autoFocus={!editId}
            value={name}
            onChangeText={setName}
            placeholder={t('goals.namePlaceholder')}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t('goals.name')}
            returnKeyType="done"
            style={[styles.input, glass, { color: colors.text, fontFamily: font.semibold }]}
          />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={t('goals.targetA11y')} onPress={() => setSheet(true)} style={styles.amount}>
          <Eyebrow>{t('goals.target')}</Eyebrow>
          <Txt display="light" size={42} style={styles.amountText} numberOfLines={1} adjustsFontSizeToFit>
            {parts.main}
            <Txt display="light" size={20} tone="muted">
              {parts.cents}
            </Txt>
          </Txt>
          <Txt tone="faint" size={11}>
            {t('recurring.tapAmount')}
          </Txt>
        </Pressable>

        <View style={styles.sections}>
          <View style={styles.block}>
            <Eyebrow>{t('goals.deadline')}</Eyebrow>
            <ChipChoice
              value={horizon}
              onChange={(v) => {
                setHorizon(v);
                if (v === 'custom') {
                  setPickDate(true);
                  setTargetDate(targetDate ?? targetDateIn(6));
                } else {
                  setPickDate(false);
                  setTargetDate(targetDateIn(Number(v)));
                }
              }}
              options={[
                ...GOAL_HORIZONS.map((m) => ({
                  value: String(m),
                  label: m === 0 ? t('goals.noDeadline') : m % 12 === 0 ? t('goals.years', { count: m / 12 }) : t('goals.months', { count: m }),
                })),
                { value: 'custom', label: t('goals.pickDate') },
              ]}
            />
            {targetDate && (
              <Txt tone="soft" size={12.5}>
                {t('goals.until', { date: date(parseLocalISO(targetDate), { day: 'numeric', month: 'long', year: 'numeric' }) })}
              </Txt>
            )}
            {pickDate && targetDate && (
              <Card>
                <MiniCalendar value={targetDate} onChange={setTargetDate} min={today} />
              </Card>
            )}
          </View>

          <View style={styles.block}>
            <Eyebrow>{t('categoriesScreen.icon')}</Eyebrow>
            <View style={styles.icons}>
              {GOAL_ICONS.map((i) => (
                <Pressable
                  key={i}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: i === icon }}
                  accessibilityLabel={i}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setIcon(i);
                  }}
                  style={styles.iconCell}>
                  <CategoryTile icon={i} color={i === icon ? color : '#94A3B8'} size={44} selected={i === icon} soft={i !== icon} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.block}>
            <Eyebrow>{t('categoriesScreen.color')}</Eyebrow>
            <ColorChoice colors={CATEGORY_COLORS} value={color} onChange={setColor} />
          </View>

          <AccentButton icon="check" label={t('common.save')} onPress={() => void save()} />
        </View>
      </ScrollView>

      {sheet && (
        <AmountSheet
          title={t('goals.target')}
          subtitle={name.trim() || undefined}
          currency={currency}
          initial={target}
          onSubmit={(v) => {
            setTarget(v);
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, letterSpacing: -0.8, textAlign: 'center' },
  preview: { alignItems: 'center', gap: 16, marginTop: 24 },
  input: { alignSelf: 'stretch', height: 50, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, textAlign: 'center' },
  amount: { alignItems: 'center', gap: 4, marginTop: 24 },
  amountText: { letterSpacing: -1.5 },
  sections: { gap: 20, marginTop: 24 },
  block: { gap: 10 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconCell: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
});
