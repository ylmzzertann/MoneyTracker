import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function ImportLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* Swiping cards right must not trigger the back gesture. */}
      <Stack.Screen name="review" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
