import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Txt, useGlass } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { currencyDecimals, keypadPress } from '@/lib/money';
import { useTheme } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'];

/** Large keypad: the alternative to the dial for people who prefer typing. */
export function Keypad({ value, currency, onChange }: { value: number; currency: string; onChange: (minor: number) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const glass = useGlass();
  const { moneyParts } = useFormat();
  const parts = moneyParts(value, currency);
  const decimals = currencyDecimals(currency);

  return (
    <View style={styles.wrap}>
      <Txt display="light" size={44} style={styles.amount} numberOfLines={1} adjustsFontSizeToFit accessibilityLiveRegion="polite">
        {parts.main}
        <Txt display="light" size={20} tone="muted">
          {parts.cents}
        </Txt>
      </Txt>
      <View style={styles.grid}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k === 'back' ? t('common.delete') : k}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(keypadPress(value, k, 9 + decimals));
            }}
            onLongPress={k === 'back' ? () => onChange(0) : undefined}
            style={({ pressed }) => [styles.key, glass, pressed && { backgroundColor: colors.surfaceSelected }]}>
            {k === 'back' ? (
              <Icon name="backspace" size={24} color={colors.textSoft} />
            ) : (
              <Txt display="regular" size={22}>
                {k}
              </Txt>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14, paddingHorizontal: 24 },
  amount: { letterSpacing: -1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, maxWidth: 300 },
  key: { width: 88, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
