import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Orb } from '@/components/Orb';
import { Sky } from '@/components/Sky';
import { Segmented, Txt } from '@/components/ui';
import { ACCOUNT_TYPE_ICONS } from '@/db/defaults';
import { createAccount, listAccounts } from '@/db/repos/accounts';
import { deviceLanguage, deviceRegion } from '@/i18n';
import { bumpData } from '@/store/dataVersion';
import { regionDefaults, useSettings, type Region } from '@/store/settings';
import { showToast } from '@/store/toast';

import { ChipChoice, CURRENCY_OPTIONS } from './parts';

/** First launch: language, region and main currency, then two starter accounts. */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const setSettings = useSettings((s) => s.set);
  const [language, setLanguage] = useState<'en' | 'tr'>(deviceLanguage());
  const [region, setRegion] = useState<Region>(deviceRegion());
  const [currency, setCurrency] = useState(regionDefaults(deviceRegion()).baseCurrency);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const existing = await listAccounts(db, true);
      if (existing.length === 0) {
        const common = { currency, statementDay: null, dueDay: null, creditLimitMinor: null, isShared: false };
        await createAccount(db, { ...common, name: t('defaultAccounts.cash'), type: 'cash', icon: ACCOUNT_TYPE_ICONS.cash, color: '#2DD4BF' });
        await createAccount(db, { ...common, name: t('defaultAccounts.card'), type: 'credit_card', icon: ACCOUNT_TYPE_ICONS.credit_card, color: '#A78BFA' });
      }
      bumpData();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSettings({ language, region, baseCurrency: currency, weekStart: regionDefaults(region).weekStart, onboarded: true });
    } catch {
      setBusy(false);
      showToast({ message: t('common.error') });
    }
  };

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <Txt display="light" size={34} style={styles.title}>
          {t('onboarding.welcome')}
        </Txt>
        <Txt tone="muted" size={15}>
          {t('onboarding.subtitle')}
        </Txt>

        <View style={styles.block}>
          <Txt weight="bold" size={12} tone="soft">
            {t('onboarding.language')}
          </Txt>
          <Segmented
            value={language}
            onChange={(l) => {
              setLanguage(l);
              setSettings({ language: l });
            }}
            itemWidth={110}
            options={[
              { value: 'tr', label: 'Türkçe' },
              { value: 'en', label: 'English' },
            ]}
          />
        </View>

        <View style={styles.block}>
          <Txt weight="bold" size={12} tone="soft">
            {t('onboarding.region')}
          </Txt>
          <ChipChoice
            value={region}
            onChange={(r) => {
              setRegion(r);
              setCurrency(regionDefaults(r).baseCurrency);
            }}
            options={[
              { value: 'TR', label: t('onboarding.regionTR') },
              { value: 'US', label: t('onboarding.regionUS') },
              { value: 'OTHER', label: t('onboarding.regionOther') },
            ]}
          />
        </View>

        <View style={styles.block}>
          <Txt weight="bold" size={12} tone="soft">
            {t('onboarding.currency')}
          </Txt>
          <ChipChoice value={currency} onChange={setCurrency} options={CURRENCY_OPTIONS} />
          <Txt tone="muted" size={12}>
            {t('onboarding.currencyHint')}
          </Txt>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.start')} onPress={() => void start()} style={styles.start}>
          <Orb icon="check" />
          <Txt weight="bold" size={14}>
            {t('onboarding.start')}
          </Txt>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 10 },
  title: { letterSpacing: -1.2, lineHeight: 40 },
  block: { marginTop: 26, gap: 10 },
  start: { alignItems: 'center', gap: 12, marginTop: 44 },
});
