import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  useLongPressGesture,
  usePanGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Orb } from '@/components/Orb';
import { GlassPill, Txt } from '@/components/ui';
import { useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

import { hitTest, radialRadii, useRadial, type Point, type RadialItem } from './radial';

export type Section = 'activity' | 'home' | 'reports';
const ORDER: Section[] = ['activity', 'home', 'reports'];
const HREF = { activity: '/activity', home: '/', reports: '/reports' } as const;
const SECTION_ICON: Record<Section, IconName> = { activity: 'format_list_bulleted', home: 'home', reports: 'donut_large' };

export const NAV_HEIGHT = 112;

export function openAdd(categoryId?: string) {
  if (categoryId) router.push({ pathname: '/add', params: { categoryId } });
  else router.push('/add');
}

/**
 * Bottom navigation built around the "+" orb:
 * tap = new transaction, slide sideways = switch section,
 * hold then slide up = category menu (released on a category opens it pre-filled).
 * Every gesture has a tap alternative: the section pills and the orb tap.
 */
export function SectionNav({ section, items }: { section: Section; items: RadialItem[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const orbRef = useRef<ComponentRef<typeof View>>(null);
  const anchor = useRef<Point>({ x: width / 2, y: 0 });
  const mode = useRef<'idle' | 'radial' | 'swipe'>('idle');
  const shift = useSharedValue(0);

  const index = ORDER.indexOf(section);
  const left = ORDER[index - 1];
  const right = ORDER[index + 1];
  const labels: Record<Section, string> = {
    activity: t('tabs.transactions'),
    home: t('tabs.home'),
    reports: t('tabs.reports'),
  };

  const measureOrb = () => {
    orbRef.current?.measureInWindow((x, y, w, h) => {
      anchor.current = { x: x + w / 2, y: y + h / 2 };
    });
  };

  const finishRadial = () => {
    if (mode.current !== 'radial') return;
    mode.current = 'idle';
    const { hover, close } = useRadial.getState();
    close();
    const chosen = hover.sub ?? hover.main;
    if (chosen) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      openAdd(chosen);
    }
  };

  const longPress = useLongPressGesture({
    minDuration: 260,
    maxDistance: 2000,
    runOnJS: true,
    onActivate: () => {
      if (mode.current === 'swipe') return;
      mode.current = 'radial';
      shift.set(withSpring(0));
      useRadial.getState().show(anchor.current);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onFinalize: () => finishRadial(),
  });

  const tap = useTapGesture({
    maxDistance: 12,
    runOnJS: true,
    onActivate: () => openAdd(),
  });

  const pan = usePanGesture({
    minDistance: 2,
    runOnJS: true,
    onUpdate: (e) => {
      if (mode.current === 'radial') {
        const state = useRadial.getState();
        const next = hitTest(anchor.current, { x: e.absoluteX, y: e.absoluteY }, items, radialRadii(width), state.hover);
        if (next.main !== state.hover.main || next.sub !== state.hover.sub) {
          state.setHover(next);
          void Haptics.selectionAsync();
        }
        return;
      }
      if (mode.current === 'idle' && Math.abs(e.translationX) > 24 && Math.abs(e.translationX) > Math.abs(e.translationY)) {
        mode.current = 'swipe';
      }
      if (mode.current === 'swipe') {
        shift.set(Math.max(-36, Math.min(36, e.translationX * 0.4)));
      }
    },
    onDeactivate: (e) => {
      if (mode.current !== 'swipe') return;
      const target = e.translationX < -48 ? left : e.translationX > 48 ? right : undefined;
      if (target) {
        void Haptics.selectionAsync();
        router.navigate(HREF[target]);
      }
    },
    onFinalize: () => {
      if (mode.current === 'radial') {
        finishRadial();
        return;
      }
      mode.current = 'idle';
      shift.set(withSpring(0));
    },
  });

  const gesture = useSimultaneousGestures(pan, useExclusiveGestures(longPress, tap));
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { top: -40, backgroundImage: `linear-gradient(180deg, transparent 0%, ${colors.bg} 55%)` },
        ]}
      />
      <View style={styles.row}>
        <View style={styles.side}>
          {left && <GlassPill icon={SECTION_ICON[left]} label={labels[left]} onPress={() => router.navigate(HREF[left])} style={styles.pill} />}
        </View>
        <GestureDetector gesture={gesture}>
          <Animated.View
            ref={orbRef}
            onLayout={measureOrb}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('nav.orbA11y')}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={() => openAdd()}
            style={orbStyle}>
            <Orb />
          </Animated.View>
        </GestureDetector>
        <View style={styles.side}>
          {right && <GlassPill icon={SECTION_ICON[right]} label={labels[right]} onPress={() => router.navigate(HREF[right])} style={styles.pill} />}
        </View>
      </View>
      <Txt tone="faint" size={10.5} style={styles.hint} numberOfLines={1}>
        {t('nav.hint')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 8, paddingTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  side: { width: 112, alignItems: 'center' },
  pill: { width: 112 },
  hint: { letterSpacing: 0.4, paddingHorizontal: 16 },
});
