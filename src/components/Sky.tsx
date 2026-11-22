import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/** Deterministic star field so it does not jump between renders. */
const STARS = (() => {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: 26 }, () => ({
    left: `${(rnd() * 98).toFixed(1)}%` as const,
    top: `${(rnd() * 80).toFixed(1)}%` as const,
    size: rnd() > 0.8 ? 2 : 1,
    opacity: 0.1 + rnd() * 0.35,
  }));
})();

/** The background of every main screen: a near-black sky with soft glows and faint stars. */
export function Sky() {
  const { colors, isDark } = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundImage:
              `radial-gradient(circle at 92% 2%, ${colors.glowTop} 0%, transparent 55%), ` +
              `radial-gradient(circle at 0% 45%, ${colors.glowSide} 0%, transparent 50%), ` +
              `radial-gradient(circle at 50% 108%, ${colors.glowBottom} 0%, transparent 55%)`,
          },
        ]}
      />
      {isDark &&
        STARS.map((s, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              borderRadius: s.size,
              backgroundColor: colors.star,
              opacity: s.opacity,
            }}
          />
        ))}
    </View>
  );
}
