import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Chip, Txt } from '@/components/ui';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import { useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

/** A titled group of settings rows on a glass card. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.section}>
      <Txt tone="muted" weight="bold" size={10} style={styles.sectionTitle}>
        {title.toLocaleUpperCase()}
      </Txt>
      <View
        style={[
          styles.card,
          {
            backgroundImage: isDark ? 'linear-gradient(180deg, rgba(22,25,38,0.85), rgba(12,14,22,0.85))' : 'linear-gradient(180deg, #FFFFFF, #F7F8F3)',
            boxShadow: `inset 0 0 0 1px ${colors.hairline}`,
          },
        ]}>
        {children}
      </View>
    </View>
  );
}

export function Row({
  icon,
  label,
  value,
  onPress,
  danger,
  children,
}: {
  icon?: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, { boxShadow: `inset 0 -1px 0 ${colors.hairline}` }, pressed && { backgroundColor: colors.surfaceSelected }]}>
      <View style={styles.rowHead}>
        {icon && <Icon name={icon} size={20} color={danger ? colors.danger : colors.textSoft} />}
        <Txt weight="semibold" size={14.5} style={[styles.flex, danger ? { color: colors.danger } : null]}>
          {label}
        </Txt>
        {value !== undefined && (
          <Txt tone="muted" size={13} numberOfLines={1} style={styles.value}>
            {value}
          </Txt>
        )}
        {onPress && <Icon name="chevron_right" size={16} color={colors.textFaint} />}
      </View>
      {children}
    </Pressable>
  );
}

export function SwitchRow({ icon, label, value, onChange, hint }: { icon?: IconName; label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { boxShadow: `inset 0 -1px 0 ${colors.hairline}` }]}>
      <View style={styles.rowHead}>
        {icon && <Icon name={icon} size={20} color={colors.textSoft} />}
        <Txt weight="semibold" size={14.5} style={styles.flex}>
          {label}
        </Txt>
        <Switch
          value={value}
          onValueChange={onChange}
          accessibilityLabel={label}
          trackColor={{ true: colors.accent, false: colors.track }}
          thumbColor={value ? colors.onAccent : undefined}
        />
      </View>
      {hint ? (
        <Txt tone="muted" size={12}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/** Horizontal chip choice used for region, currency, account type and similar small sets. */
export function ChipChoice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} icon={o.icon} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}

const POPULAR = ['TRY', 'USD', 'EUR', 'GBP'];
export const CURRENCY_OPTIONS = [...POPULAR, ...SUPPORTED_CURRENCIES.filter((c) => !POPULAR.includes(c))].map((c) => ({ value: c, label: c }));

/** Colour swatches; the chosen one is ringed. */
export function ColorChoice({ colors: list, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.swatches}>
      {list.map((c) => (
        <Pressable
          key={c}
          accessibilityRole="radio"
          accessibilityState={{ selected: c.toUpperCase() === value.toUpperCase() }}
          accessibilityLabel={c}
          onPress={() => onChange(c)}
          hitSlop={4}
          style={[
            styles.swatch,
            { backgroundColor: c },
            c.toUpperCase() === value.toUpperCase() && { boxShadow: `0 0 0 3px ${colors.bg}, 0 0 0 5px ${c}` },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginTop: 24, gap: 8 },
  sectionTitle: { letterSpacing: 2, paddingHorizontal: 6 },
  card: { borderRadius: 22, overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 52, justifyContent: 'center', gap: 10 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { maxWidth: '45%' },
  chips: { gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 30, height: 30, borderRadius: 15 },
});
