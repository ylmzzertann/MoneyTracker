import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function PlanLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="recurring-edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="goal-edit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
