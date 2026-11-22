import { View, type StyleProp, type ViewStyle } from 'react-native';

import { categoryTone, tint, useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

import { Icon } from './Icon';

type Props = {
  icon: IconName;
  color: string;
  size?: number;
  /** Filled with the category colour and ringed: the chosen category. */
  selected?: boolean;
  /** Smaller glow, for dense lists. */
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A category icon in its neon box: dark inside, outline and glow in the category colour. */
export function CategoryTile({ icon, color, size = 46, selected, soft, style }: Props) {
  const { colors, isDark } = useTheme();
  const tone = categoryTone(color);
  const radius = Math.round(size * 0.32);

  let look: ViewStyle;
  if (!isDark) {
    look = {
      backgroundColor: colors.tileFrom,
      backgroundImage: selected ? `linear-gradient(160deg, ${tint(tone.base, 0.28)}, ${tint(tone.base, 0.08)})` : undefined,
      boxShadow: `inset 0 0 0 ${selected ? 2 : 1.5}px ${tone.base}, 0 6px 18px ${tint(tone.base, selected ? 0.5 : 0.32)}`,
    };
  } else if (selected) {
    look = {
      backgroundColor: colors.tileTo,
      backgroundImage: `linear-gradient(160deg, ${tint(tone.base, 0.32)}, ${tint(tone.base, 0.08)})`,
      boxShadow:
        `inset 0 0 0 2px ${tone.light}, inset 0 0 18px ${tint(tone.base, 0.35)}, ` +
        `0 0 0 5px ${colors.bg}, 0 0 0 6px ${tint(tone.base, 0.45)}, 0 0 36px ${tint(tone.base, 0.6)}`,
    };
  } else {
    look = {
      backgroundImage: `linear-gradient(160deg, ${colors.tileFrom}, ${colors.tileTo})`,
      boxShadow:
        `inset 0 0 0 1.5px ${tone.base}, inset 0 0 14px ${tint(tone.base, 0.22)}, ` +
        `0 0 ${soft ? 12 : 20}px ${tint(tone.base, soft ? 0.32 : 0.45)}`,
    };
  }

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
        look,
        style,
      ]}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={isDark ? tone.light : tone.deep} />
    </View>
  );
}
