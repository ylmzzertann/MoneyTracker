import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Txt } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { addDays, isSameDay, startOfDay } from '@/lib/dates';
import { useTheme } from '@/theme';

/** Seven days on a gentle arc around the chosen day. Future days are dimmed and disabled. */
export function DayStrip({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { date } = useFormat();
  const { width } = useWindowDimensions();
  const today = startOfDay(new Date());
  const center = startOfDay(value);
  const gap = Math.min(52, (width - 40) / 7);

  return (
    <View style={[styles.wrap, { height: 74 }]} accessibilityRole="radiogroup" accessibilityLabel={t('add.date')}>
      {[-3, -2, -1, 0, 1, 2, 3].map((k) => {
        const d = addDays(center, k);
        const isToday = isSameDay(d, today);
        const future = d > today;
        const on = k === 0;
        return (
          <Pressable
            key={k}
            disabled={future}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: future }}
            accessibilityLabel={date(d, { weekday: 'long', day: 'numeric', month: 'long' })}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(d);
            }}
            style={[
              styles.day,
              {
                left: width / 2 + k * gap - 22,
                top: 2 + k * k * 3.2,
                opacity: future ? 0.35 : 1,
              },
              on && {
                backgroundImage: `linear-gradient(180deg, ${colors.accentFrom}, ${colors.accent})`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px ${colors.accentHaloRing}`,
              },
            ]}>
            <Txt size={10} weight="medium" style={on ? { color: colors.onAccent } : null} tone="soft">
              {isToday ? t('common.today') : date(d, { weekday: 'short' })}
            </Txt>
            <Txt display="regular" size={15} style={on ? { color: colors.onAccent } : null}>
              {d.getDate()}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  day: {
    position: 'absolute',
    width: 44,
    height: 56,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
