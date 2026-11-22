import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Icon } from '@/components/Icon';
import { Txt } from '@/components/ui';
import { categoryTone, useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

export type RingItem = { key: string; label: string; icon: IconName; color: string; total: number; share: number };

const RADII = [128, 114, 100, 86, 72, 58];

/**
 * Concentric "orbit" rings, one per group. Arc length is relative to the
 * largest group (a full ring would be 270°); the chosen ring glows.
 */
export function RingsChart({
  width,
  items,
  selected,
  amountText,
  accessibilityLabel,
}: {
  width: number;
  items: RingItem[];
  selected: number;
  amountText: string;
  accessibilityLabel: string;
}) {
  const { colors, isDark } = useTheme();
  const height = 300;
  const cx = width / 2;
  const cy = height / 2;
  const max = Math.max(...items.map((i) => i.total), 1);
  const sel = items[selected];
  const selTone = sel ? categoryTone(sel.color) : null;

  return (
    <View style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {RADII.map((r, i) => (
          <Circle key={`t${r}`} cx={cx} cy={cy} r={r} fill="none" stroke={colors.track} strokeWidth={9} opacity={items[i] ? 1 : 0} />
        ))}
        {items.slice(0, RADII.length).map((it, i) => {
          const r = RADII[i];
          const c = 2 * Math.PI * r;
          const dash = `${(it.total / max) * 0.75 * c} ${c}`;
          const on = i === selected;
          return (
            <G key={it.key}>
              {on && (
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={it.color}
                  strokeWidth={16}
                  strokeOpacity={0.22}
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              )}
              <Circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={it.color}
                strokeWidth={9}
                strokeLinecap="round"
                strokeDasharray={dash}
                opacity={on ? 1 : 0.42}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            </G>
          );
        })}
      </Svg>
      {items.slice(0, RADII.length).map((it, i) => (
        <Txt
          key={it.key}
          size={10.5}
          weight={i === selected ? 'bold' : 'semibold'}
          tone={i === selected ? 'text' : 'muted'}
          numberOfLines={1}
          style={[
            styles.ringLabel,
            { right: width - cx + 8, top: cy - RADII[i] - 7 },
            i === selected && selTone ? { color: isDark ? selTone.light : selTone.deep } : null,
          ]}>
          {it.label}
        </Txt>
      ))}
      {sel && selTone && (
        <View style={[styles.center, { left: cx - 60, top: cy - 60 }]} pointerEvents="none">
          <Icon name={sel.icon} size={24} color={isDark ? selTone.light : selTone.deep} />
          <Txt tone="muted" size={11} numberOfLines={1}>
            {sel.label}
          </Txt>
          <Txt display="regular" size={16} numberOfLines={1} adjustsFontSizeToFit>
            {amountText}
          </Txt>
          <Txt weight="bold" size={11} style={{ color: isDark ? selTone.light : selTone.deep }}>
            %{Math.round(sel.share * 100)}
          </Txt>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ringLabel: { position: 'absolute', lineHeight: 14, maxWidth: 120, textAlign: 'right' },
  center: { position: 'absolute', width: 120, height: 120, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
