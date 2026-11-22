import { useColorScheme } from 'react-native';

import { useSettings } from '@/store/settings';

import { dark, light, type Palette } from './tokens';

export * from './tokens';

export function useTheme(): { colors: Palette; isDark: boolean } {
  const system = useColorScheme();
  const pref = useSettings((s) => s.theme);
  const isDark = pref === 'system' ? system === 'dark' : pref === 'dark';
  return { colors: isDark ? dark : light, isDark };
}
