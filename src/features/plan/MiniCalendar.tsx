import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCircle, Txt } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { addDays, dayKey, parseLocalISO } from '@/lib/dates';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

import { daysInMonth } from './schedule';

/** Month grid for picking a future date (next payment, deadline). Days before `min` are disabled. */
export function MiniCalendar({ value, onChange, min }: { value: string; onChange: (key: string) => void; min?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { date } = useFormat();
  const weekStart = useSettings((s) => s.weekStart);
  const picked = parseLocalISO(value);
  const [month, setMonth] = useState(() => new Date(picked.getFullYear(), picked.getMonth(), 1));
  const minKey = min ?? '0000-00-00';
  const canGoBack = dayKey(new Date(month.getFullYear(), month.getMonth(), 0)) >= minKey;

  const offset = (month.getDay() - weekStart + 7) % 7;
  const total = daysInMonth(month.getFullYear(), month.getMonth());
  const cells: (number | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const firstWeekday = addDays(month, -offset);
  const weekdays = Array.from({ length: 7 }, (_, i) => date(addDays(firstWeekday, i), { weekday: 'narrow' }));

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <GlassCircle
          icon="chevron_left"
          label={t('transactions.prevMonth')}
          onPress={canGoBack ? () => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)) : undefined}
          style={!canGoBack && styles.disabled}
        />
        <Txt weight="bold" size={14}>
          {date(month, { month: 'long', year: 'numeric' })}
        </Txt>
        <GlassCircle icon="chevron_right" label={t('transactions.nextMonth')} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </View>
      <View style={styles.grid}>
        {weekdays.map((w, i) => (
          <View key={`w${i}`} style={styles.cell}>
            <Txt tone="faint" weight="bold" size={10.5}>
              {w}
            </Txt>
          </View>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={styles.cell} />;
          const key = dayKey(new Date(month.getFullYear(), month.getMonth(), d));
          const on = key === value;
          const disabled = key < minKey;
          return (
            <Pressable
              key={key}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled }}
              accessibilityLabel={date(parseLocalISO(key), { weekday: 'long', day: 'numeric', month: 'long' })}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(key);
              }}
              style={styles.cell}>
              <View
                style={[
                  styles.day,
                  on && {
                    backgroundImage: `linear-gradient(180deg, ${colors.accentFrom}, ${colors.accent})`,
                    boxShadow: `0 6px 18px ${colors.accentHaloRing}`,
                  },
                ]}>
                <Txt display="regular" size={13} tone={disabled ? 'faint' : 'text'} style={on ? { color: colors.onAccent } : null}>
                  {d}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disabled: { opacity: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
