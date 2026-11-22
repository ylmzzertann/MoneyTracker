import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sky } from '@/components/Sky';
import { AccentButton, Chip, GlassCircle, GlassPill, Txt } from '@/components/ui';
import { AmountDial } from '@/features/add/AmountDial';
import { Keypad } from '@/features/add/Keypad';
import { useTheme } from '@/theme';

export type AmountSuggestion = { label: string; value: number };

/**
 * Bottom sheet for entering an amount with the same dial / keypad as a new
 * transaction, plus one-tap suggestions (last month, average, monthly need).
 * Mount it only while it is open; it starts from `initial` each time.
 */
export function AmountSheet({
  title,
  subtitle,
  currency,
  initial,
  suggestions = [],
  submitLabel,
  clearLabel,
  onSubmit,
  onClear,
  onClose,
}: {
  title: string;
  subtitle?: string;
  currency: string;
  initial: number;
  suggestions?: AmountSuggestion[];
  submitLabel?: string;
  clearLabel?: string;
  onSubmit: (minor: number) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [value, setValue] = useState(initial);
  const [keypad, setKeypad] = useState(false);
  const dial = Math.round(Math.min(width - 90, 270, height * 0.36));

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={styles.flex}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={[styles.flex, { backgroundColor: colors.overlay }]} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 10, boxShadow: `inset 0 1px 0 ${colors.hairlineStrong}, 0 -24px 60px ${colors.shadow}` }]}>
          <Sky />
          <View style={[styles.grabber, { backgroundColor: colors.hairlineStrong }]} />
          <View style={styles.head}>
            <View style={styles.flex}>
              <Txt display="light" size={20} numberOfLines={1}>
                {title}
              </Txt>
              {subtitle ? (
                <Txt tone="muted" size={12.5} numberOfLines={2}>
                  {subtitle}
                </Txt>
              ) : null}
            </View>
            <GlassCircle icon={keypad ? 'donut_large' : 'dialpad'} label={keypad ? t('add.wheels') : t('add.keypad')} onPress={() => setKeypad(!keypad)} />
          </View>

          <View style={[styles.input, { minHeight: dial }]}>
            {keypad ? (
              <Keypad value={value} currency={currency} onChange={setValue} />
            ) : (
              <AmountDial size={dial} value={value} currency={currency} onChange={setValue} onPressAmount={() => setKeypad(true)} />
            )}
          </View>

          {suggestions.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {suggestions.map((s) => (
                <Chip key={s.label} label={s.label} selected={value === s.value} onPress={() => setValue(s.value)} />
              ))}
            </ScrollView>
          )}

          <View style={styles.actions}>
            {onClear && <GlassPill label={clearLabel ?? t('common.delete')} onPress={onClear} />}
            <AccentButton label={submitLabel ?? t('common.save')} icon="check" disabled={value <= 0} onPress={() => onSubmit(value)} style={styles.flex} />
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', paddingTop: 10, gap: 14 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  input: { alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingHorizontal: 20 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
});
