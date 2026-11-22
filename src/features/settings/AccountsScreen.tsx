import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { Sky } from '@/components/Sky';
import { GlassCircle, GlassPill, Txt } from '@/components/ui';
import { ACCOUNT_TYPE_ICONS, CATEGORY_COLORS, type AccountType } from '@/db/defaults';
import { accountBalances, createAccount, setAccountArchived, updateAccount } from '@/db/repos/accounts';
import type { AccountInput } from '@/db/types';
import { useAccounts, type AccountView } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { useQuery } from '@/hooks/useQuery';
import { bumpData } from '@/store/dataVersion';
import { useSettings } from '@/store/settings';
import { showToast } from '@/store/toast';
import { font, useTheme } from '@/theme';

import { ChipChoice, ColorChoice, CURRENCY_OPTIONS, Section } from './parts';

const TYPES: AccountType[] = ['cash', 'bank', 'credit_card', 'wallet', 'savings'];

export function AccountsScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { money } = useFormat();
  const baseCurrency = useSettings((s) => s.baseCurrency);
  const accounts = useAccounts(true) ?? [];
  const balances = useQuery('balances', accountBalances).data ?? {};
  const [editing, setEditing] = useState<{ id: string | null; draft: AccountInput } | null>(null);

  const open = (a: AccountView | null) =>
    setEditing({
      id: a?.id ?? null,
      draft: a
        ? { name: a.name, type: a.type, currency: a.currency, icon: a.icon, color: a.color, statementDay: a.statementDay, dueDay: a.dueDay, creditLimitMinor: a.creditLimitMinor, isShared: a.isShared }
        : { name: '', type: 'credit_card', currency: baseCurrency, icon: ACCOUNT_TYPE_ICONS.credit_card, color: CATEGORY_COLORS[4], statementDay: null, dueDay: null, creditLimitMinor: null, isShared: false },
    });

  const save = async () => {
    if (!editing) return;
    if (!editing.draft.name.trim()) return showToast({ message: t('accounts.needName') });
    try {
      if (editing.id) await updateAccount(db, editing.id, editing.draft);
      else await createAccount(db, editing.draft);
      bumpData();
      setEditing(null);
    } catch {
      showToast({ message: t('common.error') });
    }
  };

  const draft = editing?.draft;
  const patch = (p: Partial<AccountInput>) => editing && setEditing({ ...editing, draft: { ...editing.draft, ...p } });

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 18 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <GlassCircle icon="chevron_left" label={t('settings.back')} onPress={() => router.back()} />
          <Txt display="light" size={28} style={styles.title}>
            {t('accounts.title')}
          </Txt>
        </View>

        {editing && draft ? (
          <Section title={editing.id ? t('accounts.edit') : t('accounts.add')}>
            <View style={styles.editor}>
              <TextInput
                autoFocus={!editing.id}
                value={draft.name}
                onChangeText={(name) => patch({ name })}
                placeholder={t('accounts.namePlaceholder')}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel={t('accounts.name')}
                style={[styles.input, { color: colors.text, fontFamily: font.semibold, boxShadow: `inset 0 0 0 1px ${colors.hairline}` }]}
              />
              <Txt tone="soft" weight="bold" size={12}>
                {t('accounts.type')}
              </Txt>
              <ChipChoice
                value={draft.type}
                onChange={(type) => patch({ type, icon: ACCOUNT_TYPE_ICONS[type] })}
                options={TYPES.map((v) => ({ value: v, label: t(`accountTypes.${v}`), icon: ACCOUNT_TYPE_ICONS[v] }))}
              />
              <Txt tone="soft" weight="bold" size={12}>
                {t('accounts.currency')}
              </Txt>
              <ChipChoice value={draft.currency} onChange={(currency) => patch({ currency })} options={CURRENCY_OPTIONS} />
              <Txt tone="soft" weight="bold" size={12}>
                {t('accounts.color')}
              </Txt>
              <ColorChoice colors={CATEGORY_COLORS} value={draft.color} onChange={(color) => patch({ color })} />
              <View style={styles.actions}>
                <GlassPill label={t('common.cancel')} onPress={() => setEditing(null)} />
                {editing.id && (
                  <GlassPill
                    label={accounts.find((a) => a.id === editing.id)?.archived ? t('accounts.unarchive') : t('accounts.archive')}
                    onPress={() => {
                      const archived = !accounts.find((a) => a.id === editing.id)?.archived;
                      void setAccountArchived(db, editing.id!, archived).then(() => {
                        bumpData();
                        setEditing(null);
                      });
                    }}
                  />
                )}
                <GlassPill label={t('common.save')} icon="check" iconColor={colors.accent} onPress={() => void save()} />
              </View>
            </View>
          </Section>
        ) : (
          <GlassPill icon="add" iconColor={colors.accent} label={t('accounts.add')} onPress={() => open(null)} style={styles.add} />
        )}

        <Section title={t('accounts.title')}>
          {accounts.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              onPress={() => open(a)}
              style={({ pressed }) => [styles.row, { boxShadow: `inset 0 -1px 0 ${colors.hairline}`, opacity: a.archived ? 0.5 : 1 }, pressed && { backgroundColor: colors.surfaceSelected }]}>
              <CategoryTile icon={a.iconName} color={a.color} size={36} soft />
              <View style={styles.flex}>
                <Txt weight="semibold" size={15}>
                  {a.name}
                </Txt>
                <Txt tone="muted" size={12}>
                  {t(`accountTypes.${a.type}`)} · {a.currency}
                  {a.archived ? ` · ${t('accounts.archived')}` : ''}
                </Txt>
              </View>
              <View style={styles.balance}>
                <Txt tone="muted" size={10.5}>
                  {t('accounts.balance')}
                </Txt>
                <Txt display="regular" size={13} style={(balances[a.id] ?? 0) >= 0 ? { color: colors.income } : null}>
                  {money(balances[a.id] ?? 0, a.currency, { showPlus: true })}
                </Txt>
              </View>
            </Pressable>
          ))}
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { letterSpacing: -1 },
  add: { alignSelf: 'flex-start', marginTop: 20 },
  editor: { padding: 16, gap: 12 },
  input: { height: 46, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  balance: { alignItems: 'flex-end', gap: 2 },
});
