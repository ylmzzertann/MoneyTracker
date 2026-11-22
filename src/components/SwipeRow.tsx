import * as Haptics from 'expo-haptics';
import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

import { Icon } from './Icon';
import { Txt } from './ui';

const ACTION_W = 96;

export type SwipeAction = { label: string; icon: IconName; onAction: () => void; tone: 'accent' | 'danger' | 'neutral' };

/**
 * A list row with swipe actions: `right` is revealed by swiping right
 * (shown on the left edge), `left` by swiping left. Both are also offered
 * in the accessibility actions menu, so nothing depends on the gesture.
 */
export function SwipeRow({
  children,
  onPress,
  accessibilityLabel,
  right,
  left,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  right?: SwipeAction;
  left?: SwipeAction;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const fill = (tone: SwipeAction['tone']) =>
    tone === 'accent'
      ? { backgroundImage: `linear-gradient(90deg, ${colors.accent}, ${colors.accentFrom})`, color: colors.onAccent }
      : tone === 'danger'
        ? { backgroundImage: 'linear-gradient(90deg, #FB7185, #F43F5E)', boxShadow: '0 0 24px rgba(244,63,94,0.45)', color: '#FFFFFF' }
        : { backgroundImage: `linear-gradient(90deg, ${colors.surfaceSelected}, ${colors.surfaceRaised})`, color: colors.text };
  const panel = (a: SwipeAction, side: 'left' | 'right') => {
    const { color, ...bg } = fill(a.tone);
    return (
      <View style={[styles.action, side === 'left' ? styles.leftEdge : styles.rightEdge, bg]}>
        <Icon name={a.icon} size={22} color={color} />
        <Txt weight="bold" size={11} style={{ color }}>
          {a.label}
        </Txt>
      </View>
    );
  };
  const actions = [right, left].filter((a): a is SwipeAction => !!a);

  return (
    <ReanimatedSwipeable
      ref={swipe}
      enabled={actions.length > 0}
      friction={1.4}
      leftThreshold={ACTION_W * 0.7}
      rightThreshold={ACTION_W * 0.7}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={(direction) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        swipe.current?.close();
        if (direction === SwipeDirection.LEFT) left?.onAction();
        else right?.onAction();
      }}
      renderLeftActions={right ? () => panel(right, 'left') : undefined}
      renderRightActions={left ? () => panel(left, 'right') : undefined}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={actions.map((a) => ({ name: a.label, label: a.label }))}
        onAccessibilityAction={(e) => actions.find((a) => a.label === e.nativeEvent.actionName)?.onAction()}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceRaised : colors.bg }, style]}>
        {children}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 12, paddingRight: 16, paddingVertical: 10, borderRadius: 18, marginHorizontal: 4 },
  action: { width: ACTION_W, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 18, marginVertical: 2 },
  leftEdge: { marginLeft: 4 },
  rightEdge: { marginRight: 4 },
});
