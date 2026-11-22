import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { categoryTone, tint, useTheme } from '@/theme';

/** The colour a budget bar takes: the category's own, amber from 80%, rose when over. */
export function useBudgetColor() {
  const { colors } = useTheme();
  return (share: number, base: string) => (share >= 1 ? colors.danger : share >= 0.8 ? colors.warning : base);
}

/**
 * Thin neon bar. `marker` draws a tick where spending "should" be by today,
 * so ahead/behind pace reads at a glance.
 */
export function ProgressBar({ share, color, marker, height = 6 }: { share: number; color: string; marker?: number; height?: number }) {
  const { colors } = useTheme();
  const pct = `${Math.round(Math.min(Math.max(share, 0), 1) * 1000) / 10}%` as const;
  const tone = categoryTone(color);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: colors.track }]}>
      {share > 0 && (
        <View
          style={{
            width: pct,
            height,
            borderRadius: height / 2,
            backgroundImage: `linear-gradient(90deg, ${tint(tone.base, 0.55)}, ${tone.light})`,
            boxShadow: `0 0 10px ${tint(tone.base, 0.55)}`,
          }}
        />
      )}
      {marker !== undefined && marker > 0 && marker < 1 && (
        <View style={[styles.marker, { left: `${marker * 100}%`, height: height + 6, top: -3, backgroundColor: colors.textSoft }]} />
      )}
    </View>
  );
}

/** Progress ring with something (an icon, a percentage) in the middle. */
export function ProgressRing({
  size,
  stroke = 6,
  share,
  color,
  children,
}: {
  size: number;
  stroke?: number;
  share: number;
  color: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const tone = categoryTone(color);
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(Math.max(share, 0), 1);
  const id = `ring${tone.base.slice(1)}`;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={tone.light} />
            <Stop offset="1" stopColor={tone.base} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.track} strokeWidth={stroke} />
        {f > 0 && (
          <>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={tone.base}
              strokeOpacity={0.25}
              strokeWidth={stroke + 6}
              strokeLinecap="round"
              strokeDasharray={`${c * f} ${c}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={`url(#${id})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c * f} ${c}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </>
        )}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'visible', flexDirection: 'row' },
  marker: { position: 'absolute', width: 2, borderRadius: 1, marginLeft: -1 },
});
