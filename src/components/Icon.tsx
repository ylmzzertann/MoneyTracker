import { SymbolView } from 'expo-symbols';
import lightWeight from 'expo-symbols/androidWeights/light';
import type { StyleProp, ViewStyle } from 'react-native';

import { ICONS, type IconName } from '@/theme/icons';

type Props = {
  name: IconName;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
};

/** Thin line icon: SF Symbols on iOS, Material Symbols on Android and web. */
export function Icon({ name, size = 22, color, style }: Props) {
  return (
    <SymbolView
      name={{ ios: ICONS[name], android: name, web: name }}
      size={size}
      tintColor={color}
      weight={{ ios: 'light', android: lightWeight }}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
