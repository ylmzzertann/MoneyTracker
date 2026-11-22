import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { Sky } from '@/components/Sky';
import { GlassCircle, GlassPill, Segmented, Txt } from '@/components/ui';
import { CATEGORY_COLORS, PICKABLE_ICONS } from '@/db/defaults';
import { createCategory, setCategoryHidden, updateCategory } from '@/db/repos/categories';
import type { TxKind } from '@/db/types';
import { useCategories, type CategoryView } from '@/hooks/useCatalog';
import { bumpData } from '@/store/dataVersion';
import { showToast } from '@/store/toast';
import { font, useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

import { ChipChoice, ColorChoice, Section } from './parts';

type Draft = { id: string | null; system: boolean; name: string; icon: IconName; color: string; parentId: string | null; hidden: boolean };

export function CategoriesScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const catalog = useCategories();
  const [kind, setKind] = useState<TxKind>('expense');
  const [draft, setDraft] = useState<Draft | null>(null);
  const roots = catalog?.all.filter((c) => c.kind === kind && !c.parentId) ?? [];

  const open = (c: CategoryView | null) =>
    setDraft(
      c
        ? { id: c.id, system: c.key !== null, name: c.name ?? c.label, icon: c.iconName, color: c.color, parentId: c.parentId, hidden: c.hidden }
        : { id: null, system: false, name: '', icon: 'more_horiz', color: CATEGORY_COLORS[0], parentId: null, hidden: false },
    );

  const save = async () => {
    if (!draft) return;
    if (!draft.system && !draft.name.trim()) return showToast({ message: t('categoriesScreen.needName') });
    try {
      const input = { name: draft.name, kind, icon: draft.icon, color: draft.color, parentId: draft.parentId };
      if (draft.id) {
        await updateCategory(db, draft.id, input);
        const current = catalog?.byId.get(draft.id);
        if (current && current.hidden !== draft.hidden) await setCategoryHidden(db, draft.id, draft.hidden);
      } else {
        await createCategory(db, input);
      }
      bumpData();
      setDraft(null);
    } catch {
      showToast({ message: t('common.error') });
    }
  };

  const row = (c: CategoryView, child: boolean) => (
    <Pressable
      key={c.id}
      accessibilityRole="button"
      onPress={() => open(c)}
      style={({ pressed }) => [
        styles.row,
        child && styles.child,
        { boxShadow: `inset 0 -1px 0 ${colors.hairline}`, opacity: c.hidden ? 0.45 : 1 },
        pressed && { backgroundColor: colors.surfaceSelected },
      ]}>
      <CategoryTile icon={c.iconName} color={c.color} size={child ? 28 : 36} soft />
      <Txt weight={child ? 'medium' : 'semibold'} size={child ? 13.5 : 15} style={styles.flex}>
        {c.label}
      </Txt>
      {c.hidden && (
        <Txt tone="muted" size={11}>
          {t('categoriesScreen.hidden')}
        </Txt>
      )}
    </Pressable>
  );

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 18 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <GlassCircle icon="chevron_left" label={t('settings.back')} onPress={() => router.back()} />
          <Txt display="light" size={28} style={styles.title}>
            {t('categoriesScreen.title')}
          </Txt>
        </View>

        <View style={styles.top}>
          <Segmented
            value={kind}
            onChange={(k) => {
              setKind(k);
              setDraft(null);
            }}
            itemWidth={96}
            options={[
              { value: 'expense', label: t('kind.expenses') },
              { value: 'income', label: t('kind.incomes') },
            ]}
          />
          {!draft && <GlassPill icon="add" iconColor={colors.accent} label={t('categoriesScreen.add')} onPress={() => open(null)} />}
        </View>

        {draft && (
          <Section title={draft.id ? t('categoriesScreen.edit') : t('categoriesScreen.add')}>
            <View style={styles.editor}>
              <View style={styles.preview}>
                <CategoryTile icon={draft.icon} color={draft.color} size={52} selected />
                {draft.system ? (
                  <Txt tone="muted" size={12} style={styles.flex}>
                    {t('categoriesScreen.systemNameHint')}
                  </Txt>
                ) : (
                  <TextInput
                    autoFocus={!draft.id}
                    value={draft.name}
                    onChangeText={(name) => setDraft({ ...draft, name })}
                    placeholder={t('categoriesScreen.namePlaceholder')}
                    placeholderTextColor={colors.textFaint}
                    accessibilityLabel={t('categoriesScreen.name')}
                    style={[styles.input, { color: colors.text, fontFamily: font.semibold, boxShadow: `inset 0 0 0 1px ${colors.hairline}` }]}
                  />
                )}
              </View>
              {!draft.id && (
                <>
                  <Txt tone="soft" weight="bold" size={12}>
                    {t('categoriesScreen.parent')}
                  </Txt>
                  <ChipChoice
                    value={draft.parentId ?? ''}
                    onChange={(v) => setDraft({ ...draft, parentId: v || null })}
                    options={[{ value: '', label: t('categoriesScreen.noParent') }, ...roots.map((r) => ({ value: r.id, label: r.label, icon: r.iconName }))]}
                  />
                </>
              )}
              <Txt tone="soft" weight="bold" size={12}>
                {t('categoriesScreen.icon')}
              </Txt>
              <View style={styles.icons}>
                {PICKABLE_ICONS.map((icon) => (
                  <Pressable key={icon} accessibilityRole="radio" accessibilityState={{ selected: draft.icon === icon }} accessibilityLabel={icon} onPress={() => setDraft({ ...draft, icon })}>
                    <CategoryTile icon={icon} color={draft.icon === icon ? draft.color : '#94A3B8'} size={40} soft />
                  </Pressable>
                ))}
              </View>
              <Txt tone="soft" weight="bold" size={12}>
                {t('categoriesScreen.color')}
              </Txt>
              <ColorChoice colors={CATEGORY_COLORS} value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
              <View style={styles.actions}>
                <GlassPill label={t('common.cancel')} onPress={() => setDraft(null)} />
                {draft.id && (
                  <GlassPill label={draft.hidden ? t('categoriesScreen.show') : t('categoriesScreen.hide')} onPress={() => setDraft({ ...draft, hidden: !draft.hidden })} />
                )}
                <GlassPill label={t('common.save')} icon="check" iconColor={colors.accent} onPress={() => void save()} />
              </View>
            </View>
          </Section>
        )}

        <Section title={kind === 'expense' ? t('kind.expenses') : t('kind.incomes')}>
          {roots.map((c) => (
            <View key={c.id}>
              {row(c, false)}
              {(catalog?.all.filter((x) => x.parentId === c.id) ?? []).map((ch) => row(ch, true))}
            </View>
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
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, gap: 8, flexWrap: 'wrap' },
  editor: { padding: 16, gap: 12 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  input: { flex: 1, height: 46, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  child: { paddingLeft: 40 },
});
