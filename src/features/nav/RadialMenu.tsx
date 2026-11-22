import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { Orb } from '@/components/Orb';
import { Txt } from '@/components/ui';
import type { CategoryView } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { categoryTone, useTheme } from '@/theme';

import { placeMain, placeSubs, radialRadii, useRadial } from './radial';

/**
 * The category arc that opens while the orb is held. It only draws; the orb's
 * gesture in SectionNav does the hit testing and the navigation.
 */
export function RadialMenu({ items, spentById }: { items: CategoryView[]; spentById: Map<string, number> }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { money } = useFormat();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const open = useRadial((s) => s.open);
  const anchor = useRadial((s) => s.anchor);
  const hover = useRadial((s) => s.hover);
  if (!open) return null;

  const radii = radialRadii(width);
  const mains = placeMain(anchor, items.length, radii.main);
  const parentIndex = items.findIndex((i) => i.id === hover.main);
  const parent = parentIndex >= 0 ? items[parentIndex] : undefined;
  const subs = parent && parent.children.length > 0 ? placeSubs(anchor, mains[parentIndex].angle, parent.children.length, radii.sub) : [];
  const chosen = hover.sub ? parent?.children.find((c) => c.id === hover.sub) : parent;
  const tone = parent ? categoryTone(parent.color) : null;

  return (
    <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
      <View style={[styles.info, { top: insets.top + 120 }]}>
        <Txt tone="muted" weight="bold" size={10} style={styles.eyebrow}>
          {t('nav.releaseToAdd')}
        </Txt>
        <View style={styles.titleRow}>
          <Txt display="light" size={38} style={styles.title} numberOfLines={1}>
            {parent ? parent.label : '—'}
          </Txt>
          {hover.sub && chosen && tone && (
            <Txt weight="semibold" size={14} style={{ color: isDark ? tone.light : tone.deep }}>
              › {chosen.label}
            </Txt>
          )}
        </View>
        {parent && (
          <Txt tone="muted" size={12.5}>
            {t('nav.thisMonth', { amount: money(spentById.get(parent.id) ?? 0) })}
          </Txt>
        )}
        <View style={styles.hints}>
          {[t('nav.slideOut'), t('nav.backToCancel')].map((h) => (
            <View key={h} style={[styles.hintChip, { boxShadow: `inset 0 0 0 1px ${colors.hairline}` }]}>
              <Txt tone="soft" size={11.5}>
                {h}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      {subs.map((s, i) => {
        const child = parent!.children[i];
        const on = child.id === hover.sub;
        const size = on ? 42 : 36;
        return (
          <Animated.View key={child.id} entering={ZoomIn.duration(140)} style={[styles.item, { left: s.x - 40, top: s.y - size / 2 }]}>
            <CategoryTile icon={child.iconName} color={parent!.color} size={size} selected={on} soft={!on} />
            <Txt size={11} weight={on ? 'bold' : 'semibold'} tone={on ? 'text' : 'muted'} numberOfLines={1}>
              {child.label}
            </Txt>
          </Animated.View>
        );
      })}

      {mains.map((m, i) => {
        const item = items[i];
        const on = item.id === hover.main;
        const size = on ? 60 : 46;
        return (
          <Animated.View key={item.id} entering={ZoomIn.delay(i * 18).duration(160)} style={[styles.item, { left: m.x - 40, top: m.y - size / 2 }]}>
            <CategoryTile icon={item.iconName} color={item.color} size={size} selected={on && !hover.sub} />
            <Txt size={11.5} weight={on ? 'bold' : 'semibold'} tone={on ? 'text' : 'muted'} numberOfLines={1}>
              {item.label}
            </Txt>
          </Animated.View>
        );
      })}

      <View style={[styles.orb, { left: anchor.x - 33, top: anchor.y - 33 }]}>
        <Orb active />
      </View>
      <Txt tone="muted" size={10.5} style={[styles.release, { top: anchor.y + 44 }]} numberOfLines={1}>
        {chosen ? t('nav.releaseHint', { name: chosen.label }) : t('nav.chooseHint')}
      </Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  info: { position: 'absolute', left: 22, right: 22, gap: 8 },
  eyebrow: { letterSpacing: 2.4 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { letterSpacing: -1.4, flexShrink: 1 },
  hints: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  hintChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  item: { position: 'absolute', width: 80, alignItems: 'center', gap: 6 },
  orb: { position: 'absolute' },
  release: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
});
