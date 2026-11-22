import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sky } from '@/components/Sky';
import { GlassCircle, Segmented, Txt } from '@/components/ui';
import { loadRates } from '@/db/repos/fx';
import { refreshRates } from '@/features/app/useFxRefresh';
import { exportCsv } from '@/features/export/exportCsv';
import { requestReminderPermission } from '@/features/plan/notifications';
import { useCategories } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { useBudgets } from '@/hooks/usePlan';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/store/settings';
import { showToast } from '@/store/toast';

import { ChipChoice, CURRENCY_OPTIONS, Row, Section, SwitchRow } from './parts';

export function SettingsScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { money, locale, date } = useFormat();
  const s = useSettings();
  const catalog = useCategories();
  const fx = useQuery('fx', loadRates).data;
  const budgets = useBudgets();
  const [refreshing, setRefreshing] = useState(false);

  const toggleReminders = async (on: boolean) => {
    if (!on) return s.set({ notifyBills: false });
    const granted = await requestReminderPermission().catch(() => false);
    if (granted) s.set({ notifyBills: true });
    else showToast({ message: t('notifications.denied') });
  };

  const toggleBiometric = async (on: boolean) => {
    if (!on) return s.set({ biometricLock: false });
    const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    if (!ok) return showToast({ message: t('settings.biometricUnavailable') });
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: t('lock.reason') });
    if (result.success) s.set({ biometricLock: true });
  };

  const exportAll = async () => {
    try {
      await exportCsv(db, {
        start: '2000-01-01T00:00:00',
        end: '2100-01-01T00:00:00',
        locale,
        t,
        categoryById: catalog?.byId ?? new Map(),
        fileName: 'money-tracker-all.csv',
      });
    } catch {
      showToast({ message: t('common.error') });
    }
  };

  const refreshFx = async () => {
    setRefreshing(true);
    try {
      await refreshRates(db, true);
      showToast({ message: t('settings.fxDone') });
    } catch {
      showToast({ message: t('settings.fxFailed') });
    }
    setRefreshing(false);
  };

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 18 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <GlassCircle icon="chevron_left" label={t('settings.back')} onPress={() => router.back()} />
          <Txt display="light" size={28} style={styles.title}>
            {t('settings.title')}
          </Txt>
        </View>

        <Section title={t('settings.general')}>
          <Row label={t('settings.language')}>
            <Segmented
              value={s.language}
              onChange={(language) => s.set({ language })}
              options={[
                { value: 'system', label: t('settings.languageSystem') },
                { value: 'tr', label: 'Türkçe' },
                { value: 'en', label: 'English' },
              ]}
            />
          </Row>
          <Row label={t('settings.region')}>
            <ChipChoice
              value={s.region}
              onChange={(region) => s.set({ region })}
              options={[
                { value: 'TR', label: t('onboarding.regionTR') },
                { value: 'US', label: t('onboarding.regionUS') },
                { value: 'OTHER', label: t('onboarding.regionOther') },
              ]}
            />
          </Row>
          <Row label={t('settings.baseCurrency')}>
            <ChipChoice value={s.baseCurrency} onChange={(baseCurrency) => s.set({ baseCurrency })} options={CURRENCY_OPTIONS} />
          </Row>
          <Row label={t('settings.theme')}>
            <Segmented
              value={s.theme}
              onChange={(theme) => s.set({ theme })}
              options={[
                { value: 'system', label: t('settings.themeSystem') },
                { value: 'dark', label: t('settings.themeDark') },
                { value: 'light', label: t('settings.themeLight') },
              ]}
            />
          </Row>
          <Row label={t('settings.weekStart')}>
            <Segmented
              value={String(s.weekStart) as '0' | '1'}
              onChange={(v) => s.set({ weekStart: v === '0' ? 0 : 1 })}
              options={[
                { value: '1', label: t('settings.monday') },
                { value: '0', label: t('settings.sunday') },
              ]}
            />
          </Row>
        </Section>

        <Section title={t('plan.title')}>
          <Row
            icon="pie_chart"
            label={t('budgets.title')}
            value={budgets?.total ? money(budgets.total, undefined, { trimZeroCents: true }) : t('settings.budgetNone')}
            onPress={() => router.push('/plan/budgets')}
          />
          <Row icon="autorenew" label={t('recurring.title')} onPress={() => router.push('/plan/recurring')} />
          <Row icon="credit_card" label={t('cards.title')} onPress={() => router.push('/plan/cards')} />
          <Row icon="flag" label={t('goals.title')} onPress={() => router.push('/plan/goals')} />
        </Section>

        <Section title={t('notifications.title')}>
          <SwitchRow icon="notifications" label={t('notifications.reminders')} value={s.notifyBills} onChange={(v) => void toggleReminders(v)} hint={t('notifications.remindersHint')} />
          {s.notifyBills && (
            <Row label={t('notifications.time')}>
              <ChipChoice
                value={String(s.reminderHour)}
                onChange={(v) => s.set({ reminderHour: Number(v) })}
                options={['8', '9', '12', '18', '20'].map((h) => ({ value: h, label: `${h.padStart(2, '0')}:00` }))}
              />
            </Row>
          )}
          <SwitchRow icon="pie_chart" label={t('notifications.budgets')} value={s.notifyBudgets} onChange={(notifyBudgets) => s.set({ notifyBudgets })} hint={t('notifications.budgetsHint')} />
        </Section>

        <Section title={t('settings.security')}>
          <SwitchRow icon="lock" label={t('settings.biometric')} value={s.biometricLock} onChange={(v) => void toggleBiometric(v)} />
          <SwitchRow icon="visibility_off" label={t('settings.hideAmounts')} value={s.hideAmounts} onChange={(hideAmounts) => s.set({ hideAmounts })} />
        </Section>

        <Section title={t('settings.data')}>
          <Row icon="credit_card" label={t('settings.accounts')} onPress={() => router.push('/settings/accounts')} />
          <Row icon="category" label={t('settings.categories')} onPress={() => router.push('/settings/categories')} />
          <Row icon="ios_share" label={t('settings.exportAll')} onPress={() => void exportAll()} />
          <Row
            icon="currency_exchange"
            label={t('settings.fxRates')}
            value={refreshing ? '…' : fx?.date ? t('settings.fxUpdated', { date: date(new Date(fx.date), { day: 'numeric', month: 'short', year: 'numeric' }) }) : t('settings.fxNever')}
            onPress={refreshing ? undefined : () => void refreshFx()}
          />
        </Section>

        <Section title={t('settings.comingSoon')}>
          <View style={styles.soon}>
            <Txt tone="soft" size={13} style={styles.soonText}>
              {t('settings.comingSoonBody')}
            </Txt>
          </View>
        </Section>

        <Txt tone="faint" size={11} style={styles.version}>
          {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </Txt>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { letterSpacing: -1 },
  soon: { padding: 16 },
  soonText: { lineHeight: 20 },
  version: { textAlign: 'center', marginTop: 28 },
});
