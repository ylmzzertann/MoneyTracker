import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { Card, Eyebrow, GlassPill, Txt } from '@/components/ui';
import type { InsightView } from '@/features/plan/insightText';
import { UpcomingRow } from '@/features/plan/UpcomingRow';
import type { Upcoming } from '@/features/plan/upcoming';
import type { Catalog } from '@/hooks/useCatalog';
import { useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

/** Swipeable deck of this month's insights; each card opens the screen it is about. */
export function InsightsDeck({ items, width }: { items: InsightView[]; width: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (items.length === 0) return null;
  const cardW = items.length === 1 ? width - 32 : width - 64;
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Eyebrow>{t('insights.title')}</Eyebrow>
        {items.length > 1 && (
          <Txt tone="faint" size={10.5}>
            {t('insights.swipe', { count: items.length })}
          </Txt>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + 10}
        decelerationRate="fast"
        contentContainerStyle={styles.deck}>
        {items.map((i) => (
          <Pressable
            key={i.key}
            accessibilityRole="button"
            accessibilityLabel={`${i.title}. ${i.body}`}
            onPress={() => router.push(i.href)}
            style={({ pressed }) => [{ width: cardW }, pressed && styles.pressed]}>
            <Card style={styles.insight}>
              <CategoryTile icon={i.icon} color={i.color} size={40} soft />
              <View style={styles.flex}>
                <Txt weight="bold" size={14} numberOfLines={2}>
                  {i.title}
                </Txt>
                <Txt tone="soft" size={12.5} numberOfLines={2} style={styles.body}>
                  {i.body}
                </Txt>
              </View>
              <Icon name="chevron_right" size={16} color={colors.textFaint} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** The next few payments, straight from the home screen. */
export function UpcomingList({ items, catalog }: { items: Upcoming[]; catalog: Catalog | undefined }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Eyebrow>{t('recurring.upcoming')}</Eyebrow>
        <GlassPill label={t('common.seeAll')} onPress={() => router.push('/plan/recurring')} style={styles.smallPill} />
      </View>
      <View style={styles.list}>
        {items.map((item) => (
          <UpcomingRow
            key={item.key}
            item={item}
            catalog={catalog}
            onPress={
              item.type === 'rule' && item.actionable
                ? () => router.push({ pathname: '/add', params: { ruleId: item.rule.id, due: item.due } })
                : () => router.push(item.type === 'card' ? '/plan/cards' : '/plan/recurring')
            }
          />
        ))}
      </View>
    </View>
  );
}

export type PlanTile = { key: string; icon: IconName; color: string; title: string; status: string; href: Href };

/** Four doors into planning: budgets, recurring payments, cards, goals. */
export function PlanTiles({ tiles, width }: { tiles: PlanTile[]; width: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Eyebrow>{t('plan.title')}</Eyebrow>
      </View>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.key}
            accessibilityRole="button"
            accessibilityLabel={`${tile.title}, ${tile.status}`}
            onPress={() => router.push(tile.href)}
            style={({ pressed }) => [{ width: Math.floor((width - 42) / 2) }, pressed && styles.pressed]}>
            <Card style={styles.tileCore}>
              <CategoryTile icon={tile.icon} color={tile.color} size={36} soft />
              <Txt weight="bold" size={14} numberOfLines={1} style={styles.tileTitle}>
                {tile.title}
              </Txt>
              <Txt tone="muted" size={11.5} numberOfLines={2}>
                {tile.status}
              </Txt>
            </Card>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginTop: 22, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, minHeight: 36 },
  deck: { paddingHorizontal: 16, gap: 10 },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 92 },
  body: { marginTop: 3, lineHeight: 17 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  smallPill: { height: 36 },
  list: { paddingHorizontal: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  tileCore: { gap: 6, minHeight: 124 },
  tileTitle: { marginTop: 6 },
});
