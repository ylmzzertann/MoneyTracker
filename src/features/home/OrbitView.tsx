import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { CategoryTile } from '@/components/CategoryTile';
import { Badge, Txt } from '@/components/ui';
import type { CategoryView } from '@/hooks/useCatalog';
import { useFormat } from '@/hooks/useFormat';
import { categoryTone, useTheme } from '@/theme';

export type OrbitGroup = { category: CategoryView; total: number; share: number; budgetUse?: number };

const HEIGHT = 336;
// Orbit slots from the design: [radius, angle in degrees, label side]
const SLOTS: [number, number, 'right' | 'below'][] = [
  [118, -35, 'right'],
  [160, 200, 'right'],
  [118, 238, 'right'],
  [118, 150, 'below'],
  [118, 95, 'right'],
  [160, 35, 'below'],
  [160, -10, 'below'],
];
const TILE = 46;
const toRad = (d: number) => (d * Math.PI) / 180;

/**
 * Categories as neon tiles on orbits around the remaining budget. Each tile
 * trails a coloured tail whose length is its share of this month's spending.
 */
export function OrbitView({
  width,
  groups,
  spent,
  budget,
  onPressCategory,
  onPressCenter,
}: {
  width: number;
  groups: OrbitGroup[];
  spent: number;
  budget: number | null;
  onPressCategory: (id: string) => void;
  onPressCenter: () => void;
}) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { money, percent } = useFormat();
  const scale = Math.min(1, width / 390);
  const cx = width / 2;
  const cy = HEIGHT / 2;
  const ringR = 56;
  const ringC = 2 * Math.PI * ringR;
  const used = budget ? Math.min(spent / budget, 1) : 0;
  const placed = groups.slice(0, SLOTS.length).map((g, i) => {
    const [r0, angle, side] = SLOTS[i];
    const r = r0 * scale;
    const x = cx + r * Math.cos(toRad(angle));
    const y = cy + r * Math.sin(toRad(angle));
    const span = Math.min(16 + g.share * 140, 100);
    const a0 = toRad(angle - span);
    const a1 = toRad(angle - 9);
    const p0 = { x: cx + r * Math.cos(a0), y: cy + r * Math.sin(a0) };
    const p1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
    return { ...g, r, x, y, side, p0, p1 };
  });

  return (
    <View style={{ width, height: HEIGHT }}>
      <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="orbitFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.text} stopOpacity={0.16} />
            <Stop offset="1" stopColor={colors.text} stopOpacity={0.04} />
          </LinearGradient>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={isDark ? colors.accent : '#8CC800'} />
            <Stop offset="1" stopColor={colors.ringTo} />
          </LinearGradient>
          {placed.map((p, i) => (
            <LinearGradient key={i} id={`tail${i}`} gradientUnits="userSpaceOnUse" x1={p.p0.x} y1={p.p0.y} x2={p.p1.x} y2={p.p1.y}>
              <Stop offset="0" stopColor={p.category.color} stopOpacity={0} />
              <Stop offset="1" stopColor={p.category.color} stopOpacity={0.95} />
            </LinearGradient>
          ))}
        </Defs>
        <Circle cx={cx} cy={cy} r={160 * scale} fill="none" stroke={colors.orbit} strokeDasharray="1 7" strokeLinecap="round" />
        <Circle cx={cx} cy={cy} r={118 * scale} fill="none" stroke="url(#orbitFade)" />
        <Circle cx={cx} cy={cy} r={78 * scale} fill="none" stroke={colors.track} />
        {placed.map((p, i) => (
          <Path
            key={i}
            d={`M${p.p0.x} ${p.p0.y} A${p.r} ${p.r} 0 0 1 ${p.p1.x} ${p.p1.y}`}
            fill="none"
            stroke={`url(#tail${i})`}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}
        <Circle cx={cx} cy={cy} r={ringR} fill="none" stroke={colors.track} strokeWidth={5} />
        {used > 0 && (
          <>
            <Circle
              cx={cx}
              cy={cy}
              r={ringR}
              fill="none"
              stroke="url(#ring)"
              strokeWidth={11}
              strokeOpacity={0.18}
              strokeLinecap="round"
              strokeDasharray={`${ringC * used} ${ringC}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={ringR}
              fill="none"
              stroke="url(#ring)"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={`${ringC * used} ${ringC}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          </>
        )}
      </Svg>

      <Pressable
        accessibilityRole="button"
        onPress={onPressCenter}
        style={[
          styles.core,
          {
            left: cx - 48,
            top: cy - 48,
            backgroundImage: `radial-gradient(circle at 35% 25%, ${colors.coreFrom} 0%, ${colors.coreTo} 72%)`,
            boxShadow: `inset 0 0 0 1px ${colors.hairline}, 0 12px 30px rgba(0,0,0,${isDark ? 0.6 : 0.1})`,
          },
        ]}>
        {budget ? (
          <>
            <Txt tone="muted" size={10} style={styles.coreLabel}>
              {spent > budget ? t('home.over') : t('home.remaining')}
            </Txt>
            <Txt display="regular" size={15} numberOfLines={1} adjustsFontSizeToFit style={spent > budget ? { color: colors.danger } : null}>
              {money(Math.abs(budget - spent), undefined, { trimZeroCents: true })}
            </Txt>
            <Txt tone="faint" size={10} numberOfLines={1}>
              {t('home.ofBudget', { amount: money(budget, undefined, { trimZeroCents: true, compact: true }) })}
            </Txt>
          </>
        ) : (
          <Txt tone="soft" weight="semibold" size={11.5} style={styles.setBudget}>
            {t('home.setBudget')}
          </Txt>
        )}
      </Pressable>

      {placed.length === 0 && (
        <Txt tone="muted" size={12.5} style={[styles.empty, { top: cy + 70 }]}>
          {t('home.orbitEmpty')}
        </Txt>
      )}

      {placed.map((p) => {
        const tone = categoryTone(p.category.color);
        const over = p.budgetUse !== undefined && p.budgetUse > 1;
        const near = p.budgetUse !== undefined && p.budgetUse >= 0.8 && !over;
        return (
          <View key={p.category.id} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.categoryA11y', {
                name: p.category.label,
                amount: money(p.total),
                pct: Math.round(p.share * 100),
              })}
              onPress={() => onPressCategory(p.category.id)}
              hitSlop={6}
              style={[styles.tile, { left: p.x - TILE / 2, top: p.y - TILE / 2 }]}>
              <CategoryTile icon={p.category.iconName} color={p.category.color} size={TILE} />
              {(over || near) && (
                <View style={styles.badge}>
                  <Badge
                    label={percent(p.budgetUse ?? 0)}
                    background={over ? colors.danger : colors.warning}
                    color={over ? colors.onDanger : colors.onWarning}
                  />
                </View>
              )}
            </Pressable>
            <View
              pointerEvents="none"
              style={
                p.side === 'right'
                  ? [styles.label, { left: p.x + 31, top: p.y - 16, width: Math.max(40, width - (p.x + 31) - 4) }]
                  : [styles.label, styles.labelBelow, { left: p.x - 44, top: p.y + 28, width: 88 }]
              }>
              <Txt size={11} weight="semibold" numberOfLines={1} style={{ color: isDark ? tone.light : tone.deep }}>
                {p.category.label}
              </Txt>
              <Txt display="regular" size={12} numberOfLines={1}>
                {money(p.total, undefined, { trimZeroCents: true })}
              </Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  core: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  coreLabel: { letterSpacing: 0.8 },
  setBudget: { textAlign: 'center' },
  empty: { position: 'absolute', left: 40, right: 40, textAlign: 'center' },
  tile: { position: 'absolute' },
  badge: { position: 'absolute', right: -10, top: -9 },
  label: { position: 'absolute', gap: 1 },
  labelBelow: { alignItems: 'center' },
});
