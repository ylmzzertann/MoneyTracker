import * as Haptics from 'expo-haptics';
import { useImperativeHandle, useRef, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { Card, Txt } from '@/components/ui';
import type { TxKind } from '@/db/types';
import type { CategoryView } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { parseLocalISO } from '@/lib/dates';
import { toMinor } from '@/lib/money';
import { useTheme } from '@/theme';

import type { CandidateStatus } from './dedupe';
import type { ImportCandidate } from './types';

const THRESHOLD = 110;

export type Decision = 'add' | 'skip';
export type DeckCardHandle = { fling: (decision: Decision) => void };

/**
 * The top card of the review deck: drag right to add, left to skip, up to
 * change the category. Buttons and screen readers reach the same actions.
 */
export function DeckCard({
  ref,
  children,
  label,
  onDecide,
  onCategory,
}: {
  ref?: Ref<DeckCardHandle>;
  children: ReactNode;
  label: string;
  onDecide: (decision: Decision) => void;
  onCategory: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const zone = useRef<-1 | 0 | 1>(0);
  const decided = useRef(false);

  const fling = (decision: Decision) => {
    if (decided.current) return;
    decided.current = true;
    void Haptics.impactAsync(decision === 'add' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    if (reduced) {
      onDecide(decision);
      return;
    }
    const target = (decision === 'add' ? 1 : -1) * width * 1.3;
    tx.set(
      withTiming(target, { duration: 240, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(onDecide, decision);
      }),
    );
  };
  useImperativeHandle(ref, () => ({ fling }));

  const settle = () => {
    tx.set(withSpring(0, { damping: 18, stiffness: 220 }));
    ty.set(withSpring(0, { damping: 18, stiffness: 220 }));
  };

  const pan = usePanGesture({
    minDistance: 6,
    runOnJS: true,
    onUpdate: (e) => {
      if (decided.current) return;
      tx.set(e.translationX);
      ty.set(e.translationY);
      const next = e.translationX > THRESHOLD ? 1 : e.translationX < -THRESHOLD ? -1 : 0;
      if (next !== zone.current) {
        zone.current = next;
        if (next !== 0) void Haptics.selectionAsync();
      }
    },
    onDeactivate: (e) => {
      if (decided.current) return;
      const x = e.translationX;
      const y = e.translationY;
      if (x > THRESHOLD || (x > 40 && e.velocityX > 900)) return fling('add');
      if (x < -THRESHOLD || (x < -40 && e.velocityX < -900)) return fling('skip');
      settle();
      if (y < -THRESHOLD && Math.abs(y) > Math.abs(x) * 1.5) onCategory();
    },
    onFinalize: () => {
      zone.current = 0;
      if (!decided.current) settle();
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value * 0.35 }, { rotate: `${tx.value / 24}deg` }],
  }));
  const addStamp = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [24, THRESHOLD], [0, 1], Extrapolation.CLAMP) }));
  const skipStamp = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-THRESHOLD, -24], [1, 0], Extrapolation.CLAMP) }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.fill, cardStyle]}
        accessible
        accessibilityLabel={label}
        accessibilityHint={t('import.deckHint')}
        accessibilityActions={[
          { name: 'add', label: t('import.add') },
          { name: 'skip', label: t('import.skip') },
          { name: 'category', label: t('import.changeCategory') },
        ]}
        onAccessibilityAction={(e) => {
          const name = e.nativeEvent.actionName;
          if (name === 'add' || name === 'skip') fling(name);
          else if (name === 'category') onCategory();
        }}>
        {children}
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampLeft, { borderColor: colors.accent }, addStamp]}>
          <Txt weight="bold" size={15} style={{ color: colors.accent, letterSpacing: 2 }}>
            {t('import.add').toLocaleUpperCase()}
          </Txt>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampRight, { borderColor: colors.danger }, skipStamp]}>
          <Txt weight="bold" size={15} style={{ color: colors.danger, letterSpacing: 2 }}>
            {t('import.skip').toLocaleUpperCase()}
          </Txt>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/** What one imported row looks like on its card. */
export function CandidateFace({
  candidate,
  kind,
  currency,
  category,
  status,
  onCategory,
}: {
  candidate: ImportCandidate;
  kind: TxKind;
  currency: string;
  category: CategoryView | undefined;
  status: CandidateStatus;
  onCategory?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { money, date } = useFormat();
  const when = parseLocalISO(candidate.occurredAt);
  const hasTime = !candidate.occurredAt.endsWith('T12:00:00');
  const title = candidate.merchantName || candidate.description || t('import.noDescription');
  const warnings = [
    status === 'similar' ? t('import.similar') : null,
    candidate.hint === 'cardPayment' ? t('import.cardPayment') : null,
  ].filter((w): w is string => !!w);

  return (
    <Card style={styles.face}>
      <View style={styles.row}>
        <Txt tone="muted" weight="semibold" size={12.5}>
          {date(when, { weekday: 'short', day: 'numeric', month: 'long', ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}) })}
        </Txt>
        {candidate.last4 && (
          <View style={[styles.last4, { boxShadow: `inset 0 0 0 1px ${colors.hairlineStrong}` }]}>
            <Icon name="credit_card" size={13} color={colors.textMuted} />
            <Txt tone="muted" weight="semibold" size={11.5}>
              {`•••• ${candidate.last4}`}
            </Txt>
          </View>
        )}
      </View>

      <View style={styles.middle}>
        <Txt display="light" size={42} numberOfLines={1} adjustsFontSizeToFit style={{ color: kind === 'income' ? colors.income : colors.text, letterSpacing: -1.5 }}>
          {`${kind === 'income' ? '+' : '−'}${money(toMinor(candidate.amount, currency), currency)}`}
        </Txt>
        <Txt weight="bold" size={20} numberOfLines={1}>
          {title}
        </Txt>
        {candidate.merchantName !== '' && candidate.description !== '' && (
          <Txt tone="faint" size={12} numberOfLines={2}>
            {candidate.description}
          </Txt>
        )}
      </View>

      {warnings.map((w) => (
        <View key={w} style={[styles.warning, { backgroundColor: isDark ? 'rgba(251,191,36,0.12)' : 'rgba(251,191,36,0.18)' }]}>
          <Icon name="warning" size={15} color={colors.warning} />
          <Txt size={12.5} weight="semibold" style={[styles.flex, { color: isDark ? colors.warning : colors.text }]}>
            {w}
          </Txt>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('import.changeCategoryOf', { name: category?.label ?? '' })}
        disabled={!onCategory}
        onPress={onCategory}
        style={({ pressed }) => [styles.category, { boxShadow: `inset 0 0 0 1px ${colors.hairline}` }, pressed && styles.pressed]}>
        {category && <CategoryTile icon={category.iconName} color={category.color} size={40} selected />}
        <View style={styles.flex}>
          <Txt tone="faint" weight="bold" size={10}>
            {t('import.category').toLocaleUpperCase()}
          </Txt>
          <Txt weight="semibold" size={15} numberOfLines={1}>
            {category?.label ?? '—'}
          </Txt>
        </View>
        <Icon name="expand_more" size={20} color={colors.textMuted} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { flex: 1 },
  face: { flex: 1, gap: 16, justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  last4: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  middle: { gap: 6 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  category: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  stamp: { position: 'absolute', top: 28, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 2.5, borderRadius: 10 },
  stampLeft: { left: 26, transform: [{ rotate: '-12deg' }] },
  stampRight: { right: 26, transform: [{ rotate: '12deg' }] },
});
