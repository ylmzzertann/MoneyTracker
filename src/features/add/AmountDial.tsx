import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { Txt } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { useTheme } from '@/theme';

import { angleDelta, clockAngle, dialFractions, dialSteps, STEP_DEGREES } from './dial';

/**
 * Two-ring rotary amount input. Drag around the outer ring for big steps,
 * around the inner ring for small ones. Tapping the amount opens the keypad.
 */
export function AmountDial({
  size,
  value,
  currency,
  onChange,
  onPressAmount,
}: {
  size: number;
  value: number;
  currency: string;
  onChange: (minor: number) => void;
  onPressAmount: () => void;
}) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { money, moneyParts } = useFormat();
  const steps = dialSteps(currency);
  const s = size / 300;
  const c = size / 2;
  const rOuter = 140 * s;
  const rInner = 100 * s;
  const frac = dialFractions(value, steps);
  const drag = useRef({ ring: 'outer' as 'outer' | 'inner', last: 0, turned: 0, start: 0, steps: 0 });

  const ticks = { minor: '', major: '' };
  for (let i = 0; i < 72; i++) {
    const a = ((i * 5 - 90) * Math.PI) / 180;
    const major = i % 6 === 0;
    const r1 = (major ? 122 : 127) * s;
    const r2 = 132 * s;
    const seg = `M${(c + r1 * Math.cos(a)).toFixed(1)} ${(c + r1 * Math.sin(a)).toFixed(1)} L${(c + r2 * Math.cos(a)).toFixed(1)} ${(c + r2 * Math.sin(a)).toFixed(1)} `;
    if (major) ticks.major += seg;
    else ticks.minor += seg;
  }
  const knob = (r: number, f: number) => {
    const a = ((f * 360 - 90) * Math.PI) / 180;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  const ko = knob(rOuter, frac.outer);
  const ki = knob(rInner, frac.inner);
  const cOuter = 2 * Math.PI * rOuter;
  const cInner = 2 * Math.PI * rInner;

  const pan = usePanGesture({
    minDistance: 2,
    runOnJS: true,
    onBegin: (e) => {
      const dist = Math.hypot(e.x - c, e.y - c);
      drag.current = {
        ring: dist > (rOuter + rInner) / 2 ? 'outer' : 'inner',
        last: clockAngle(c, c, e.x, e.y),
        turned: 0,
        start: value,
        steps: 0,
      };
    },
    onUpdate: (e) => {
      const d = drag.current;
      const angle = clockAngle(c, c, e.x, e.y);
      d.turned += angleDelta(d.last, angle);
      d.last = angle;
      const n = Math.round(d.turned / STEP_DEGREES[d.ring]);
      if (n !== d.steps) {
        d.steps = n;
        const unit = d.ring === 'outer' ? steps.big : steps.small;
        onChange(Math.max(0, d.start + n * unit));
        void Haptics.selectionAsync();
      }
    },
  });

  const parts = moneyParts(value, currency);
  const lineStart = isDark ? colors.accent : '#8CC800';

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{ width: size, height: size }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('add.dialA11y', { big: money(steps.big, currency, { trimZeroCents: true }), small: money(steps.small, currency, { trimZeroCents: true }) })}
        accessibilityValue={{ text: money(value, currency) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(value + steps.big);
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(0, value - steps.big));
        }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={lineStart} />
              <Stop offset="1" stopColor={colors.ringTo} />
            </LinearGradient>
            <RadialGradient id="dialFace" cx="0.5" cy="0.4" r="0.6">
              <Stop offset="0" stopColor={isDark ? '#1A1E2E' : '#FFFFFF'} />
              <Stop offset="1" stopColor={isDark ? '#0A0C13' : '#ECEEE6'} />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={118 * s} fill="url(#dialFace)" stroke={colors.hairline} />
          <Circle cx={c} cy={c} r={rOuter} fill="none" stroke={colors.track} />
          <Path d={ticks.minor} stroke={colors.textFaint} strokeOpacity={0.5} strokeWidth={1} />
          <Path d={ticks.major} stroke={colors.textMuted} strokeWidth={1} />
          <Circle
            cx={c}
            cy={c}
            r={rOuter}
            fill="none"
            stroke="url(#dialGrad)"
            strokeOpacity={0.25}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${cOuter * frac.outer} ${cOuter}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
          <Circle
            cx={c}
            cy={c}
            r={rOuter}
            fill="none"
            stroke="url(#dialGrad)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${cOuter * frac.outer} ${cOuter}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
          <Circle cx={c} cy={c} r={rInner} fill="none" stroke={colors.track} strokeWidth={10} />
          <Circle
            cx={c}
            cy={c}
            r={rInner}
            fill="none"
            stroke={isDark ? '#7DD3FC' : '#0369A1'}
            strokeOpacity={0.8}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${cInner * frac.inner} ${cInner}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
          <Circle cx={ko.x} cy={ko.y} r={16 * s} fill={colors.accent} opacity={0.2} />
          <Circle cx={ko.x} cy={ko.y} r={9 * s} fill={colors.accent} stroke={isDark ? 'none' : colors.text} strokeWidth={1.2} />
          <Circle cx={ki.x} cy={ki.y} r={12 * s} fill="#7DD3FC" opacity={0.2} />
          <Circle cx={ki.x} cy={ki.y} r={7 * s} fill={isDark ? '#BAE6FD' : '#0369A1'} />
        </Svg>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.center} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel={t('add.keypad')} onPress={onPressAmount} hitSlop={8}>
              <Txt display="light" size={Math.round(44 * s)} style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                {parts.main}
                <Txt display="light" size={Math.round(20 * s)} tone="muted">
                  {parts.cents}
                </Txt>
              </Txt>
            </Pressable>
            <Txt tone="muted" size={11} style={styles.hint}>
              {t('add.dialHint', {
                big: money(steps.big, currency, { trimZeroCents: true }),
                small: money(steps.small, currency, { trimZeroCents: true }),
              })}
              {'\n'}
              {t('add.dialTapHint')}
            </Txt>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: '22%' },
  amount: { letterSpacing: -1.5, textAlign: 'center' },
  hint: { textAlign: 'center', lineHeight: 16 },
});
