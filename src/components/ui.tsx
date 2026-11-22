import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

import { font, radius, size, useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

import { Icon } from './Icon';

type Tone = 'text' | 'soft' | 'muted' | 'faint';

/** Text in the theme colours; `display` switches to the Unbounded number font. */
export function Txt({
  tone = 'text',
  display,
  weight,
  size: fontSize = 15,
  style,
  ...rest
}: TextProps & {
  tone?: Tone;
  display?: 'light' | 'regular';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  size?: number;
}) {
  const { colors } = useTheme();
  const color = { text: colors.text, soft: colors.textSoft, muted: colors.textMuted, faint: colors.textFaint }[tone];
  const fontFamily = display
    ? display === 'light'
      ? font.display
      : font.displayRegular
    : font[weight ?? 'regular'];
  return <Text {...rest} style={[{ color, fontFamily, fontSize }, style]} />;
}

/** The translucent "glass" look shared by buttons, pills and segmented controls. */
export function useGlass(): ViewStyle {
  const { colors } = useTheme();
  return {
    backgroundImage: `linear-gradient(180deg, ${colors.glassFrom}, ${colors.glassTo})`,
    boxShadow: `inset 0 0 0 1px ${colors.hairline}`,
  };
}

export function GlassCircle({
  icon,
  label,
  onPress,
  iconColor,
  style,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const glass = useGlass();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.circle, glass, pressed && styles.pressed, style]}>
      <Icon name={icon} size={21} color={iconColor ?? colors.textSoft} />
    </Pressable>
  );
}

export function GlassPill({
  icon,
  iconColor,
  label,
  onPress,
  accessibilityLabel,
  style,
  textStyle,
  trailing,
}: {
  icon?: IconName;
  iconColor?: string;
  label: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  const glass = useGlass();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.pill, glass, pressed && styles.pressed, style]}>
      {icon && <Icon name={icon} size={18} color={iconColor ?? colors.textSoft} />}
      <Txt tone="soft" weight="semibold" size={12.5} style={textStyle} numberOfLines={1}>
        {label}
      </Txt>
      {trailing}
    </Pressable>
  );
}

export type SegmentOption<T extends string> = { value: T; label?: string; icon?: IconName; a11y?: string };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  itemWidth,
  stretch,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  itemWidth?: number;
  stretch?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const glass = useGlass();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.segment, glass, stretch && styles.stretch]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.a11y ?? o.label}
            onPress={() => onChange(o.value)}
            style={[
              styles.segmentItem,
              itemWidth ? { width: itemWidth } : null,
              stretch && styles.flex,
              on && {
                backgroundImage: `linear-gradient(180deg, ${colors.surfaceSelected}, ${colors.glassTo})`,
                boxShadow: `inset 0 1px 0 ${colors.hairline}`,
              },
            ]}>
            {o.icon ? (
              <Icon name={o.icon} size={19} color={on ? colors.text : colors.textMuted} />
            ) : (
              <Txt size={13} weight={on ? 'semibold' : 'medium'} tone={on ? 'text' : 'muted'}>
                {o.label}
              </Txt>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small pill with a status colour, e.g. "%112" on an over-budget category. */
export function Badge({ label, background, color }: { label: string; background: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: background, boxShadow: `0 0 0 2px ${colors.bg}` }]}>
      <Text style={{ color, fontFamily: font.bold, fontSize: 9.5 }}>{label}</Text>
    </View>
  );
}

/** Chip with an optional leading icon; selected chips are filled with the accent. */
export function Chip({
  label,
  icon,
  iconColor,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName;
  iconColor?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const glass = useGlass();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? {
              backgroundImage: `linear-gradient(180deg, ${colors.accentFrom}, ${colors.accent})`,
              boxShadow: `0 6px 18px ${colors.accentHaloRing}`,
            }
          : glass,
        pressed && styles.pressed,
      ]}>
      {icon && <Icon name={icon} size={16} color={selected ? colors.onAccent : (iconColor ?? colors.textSoft)} />}
      <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: selected ? colors.onAccent : colors.textSoft }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: size.touch,
    height: size.touch,
    borderRadius: size.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: size.touch,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.pill },
  stretch: { alignSelf: 'stretch' },
  flex: { flex: 1 },
  segmentItem: {
    height: 36,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { height: 17, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
});
