import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Txt } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { useTheme } from '@/theme';

const CHART_H = 50;

/** "Daily pulse": spending per day this month as a glowing line, in a double-edged glass card. */
export function PulseCard({ width, values, todayIndex }: { width: number; values: number[]; todayIndex: number }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { money } = useFormat();
  const chartW = width - 10 - 28;
  const shown = values.slice(0, todayIndex + 1);
  const max = Math.max(...shown, 1);
  const step = chartW / Math.max(values.length - 1, 1);
  const pts = shown.map((v, i) => [i * step, CHART_H - 5 - (v / max) * (CHART_H - 12)] as const);
  const line = pts.length > 0 ? 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L') : '';
  const last = pts[pts.length - 1];
  const area = last ? `${line} L${last[0].toFixed(1)} ${CHART_H} L0 ${CHART_H} Z` : '';
  const ticks = [0, 7, 14, todayIndex].filter((d, i, a) => d <= todayIndex && a.indexOf(d) === i);
  const lineFrom = isDark ? colors.ringTo : '#0D9488';
  const lineTo = isDark ? colors.accent : '#8CC800';

  return (
    <View style={[styles.shell, { backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(11,12,16,0.03)', boxShadow: `inset 0 0 0 1px ${colors.hairline}` }]}>
      <View
        style={[
          styles.core,
          {
            backgroundImage: isDark
              ? 'linear-gradient(180deg, rgba(22,25,38,0.92), rgba(12,14,22,0.92))'
              : 'linear-gradient(180deg, #FFFFFF, #F7F8F3)',
            boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : '0 8px 24px rgba(11,12,16,0.06)',
          },
        ]}>
        <View style={styles.head}>
          <Txt weight="bold" size={13}>
            {t('home.pulse')}
          </Txt>
          <Txt tone="muted" size={12}>
            {t('home.todayShort')}{' '}
            <Txt display="regular" size={12}>
              {money(values[todayIndex] ?? 0, undefined, { trimZeroCents: true })}
            </Txt>
          </Txt>
        </View>
        <Svg width={chartW} height={CHART_H} style={styles.chart} accessibilityLabel={t('home.pulse')}>
          <Defs>
            <LinearGradient id="pulseStroke" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={lineFrom} />
              <Stop offset="1" stopColor={lineTo} />
            </LinearGradient>
            <LinearGradient id="pulseArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={isDark ? 0.22 : 0.55} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {area !== '' && <Path d={area} fill="url(#pulseArea)" />}
          {line !== '' && <Path d={line} fill="none" stroke="url(#pulseStroke)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />}
          {last && (
            <>
              <Line x1={last[0]} y1={0} x2={last[0]} y2={CHART_H} stroke={colors.hairlineStrong} strokeDasharray="2 3" />
              <Circle cx={last[0]} cy={last[1]} r={7} fill={colors.accent} opacity={0.25} />
              <Circle cx={last[0]} cy={last[1]} r={3.5} fill={colors.accent} />
            </>
          )}
        </Svg>
        <View style={[styles.ticks, { width: chartW }]}>
          {ticks.map((d) => (
            <Txt
              key={d}
              size={10}
              tone={d === todayIndex ? 'soft' : 'faint'}
              style={[styles.tick, { left: Math.min(Math.max(0, d * step - (d === todayIndex ? 14 : 4)), chartW - 34) }]}>
              {d === todayIndex ? t('home.todayShort') : String(d + 1)}
            </Txt>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { padding: 5, borderRadius: 26 },
  core: { borderRadius: 21, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  chart: { marginTop: 8 },
  ticks: { height: 14, marginTop: 4 },
  tick: { position: 'absolute' },
});
