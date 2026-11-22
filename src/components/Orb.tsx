import { View, type StyleProp, type ViewStyle } from 'react-native';

import { size as sizes, useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

import { Icon } from './Icon';

/** The lime "+" orb: the app's one primary action. Purely visual; callers attach gestures. */
export function Orb({
  icon = 'add',
  size = sizes.orb,
  active,
  style,
}: {
  icon?: IconName;
  size?: number;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: `linear-gradient(160deg, ${colors.accentFrom} 0%, ${colors.accent} 45%, ${colors.accentTo} 100%)`,
          boxShadow:
            (isDark ? '' : `0 0 0 1.5px ${colors.text}, `) +
            `0 0 0 ${active ? 14 : 8}px ${colors.accentHalo}, 0 0 0 ${active ? 15 : 9}px ${colors.accentHaloRing}, ` +
            `0 16px 40px rgba(212,246,90,${active ? 0.5 : 0.35}), inset 0 1px 0 rgba(255,255,255,0.7)`,
        },
        style,
      ]}>
      <Icon name={icon} size={Math.round(size * 0.45)} color={colors.onAccent} />
    </View>
  );
}
