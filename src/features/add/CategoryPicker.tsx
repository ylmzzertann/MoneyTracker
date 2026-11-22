import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryTile } from '@/components/CategoryTile';
import { Chip, Txt } from '@/components/ui';
import type { CategoryView } from '@/hooks/useCatalog';
import { categoryTone, useTheme } from '@/theme';

/**
 * Horizontal strip of category tiles (the chosen one grows and glows) with the
 * chosen category's sub-categories as chips underneath.
 */
export function CategoryPicker({
  categories,
  rootId,
  subId,
  onChange,
}: {
  categories: CategoryView[];
  rootId: string | null;
  subId: string | null;
  onChange: (rootId: string, subId: string | null) => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const root = categories.find((c) => c.id === rootId);
  const tone = root ? categoryTone(root.color) : null;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {categories.map((c) => {
          const on = c.id === rootId;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={c.label}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(c.id, null);
              }}
              style={styles.item}>
              <CategoryTile icon={c.iconName} color={c.color} size={on ? 60 : 44} selected={on} soft={!on} />
            </Pressable>
          );
        })}
      </ScrollView>
      <Txt weight="bold" size={13} style={[styles.label, tone ? { color: isDark ? tone.light : tone.deep } : null]}>
        {root ? root.label : t('add.needCategory')}
      </Txt>
      {root && root.children.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subs}>
          <Chip label={t('add.general')} selected={subId === null} onPress={() => onChange(root.id, null)} />
          {root.children.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              icon={c.iconName}
              iconColor={isDark ? tone?.light : tone?.deep}
              selected={subId === c.id}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(root.id, c.id);
              }}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  strip: { paddingHorizontal: 20, gap: 14, alignItems: 'center', minHeight: 76 },
  item: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
  subs: { paddingHorizontal: 20, gap: 8 },
});
