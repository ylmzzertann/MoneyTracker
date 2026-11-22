import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { useToast } from '@/store/toast';
import { useTheme } from '@/theme';

import { Txt } from './ui';

/** Bottom toast with an optional action (e.g. "Undo" after a delete). Hides itself after 4 s. */
export function ToastHost({ bottom }: { bottom: number }) {
  const { colors } = useTheme();
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hide, 4000);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(160)}
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          bottom,
          backgroundColor: colors.surfaceRaised,
          boxShadow: `inset 0 0 0 1px ${colors.hairlineStrong}, 0 12px 30px rgba(0,0,0,0.45)`,
        },
      ]}>
      <View style={styles.flex}>
        <Txt size={13.5} weight="semibold">
          {toast.message}
        </Txt>
      </View>
      {toast.actionLabel && toast.onAction && (
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => {
            toast.onAction?.();
            hide();
          }}
          style={styles.action}>
          <Txt size={13.5} weight="bold" style={{ color: colors.accent }}>
            {toast.actionLabel}
          </Txt>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: { flex: 1 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
});
