import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Unbounded_300Light } from '@expo-google-fonts/unbounded/300Light';
import { Unbounded_400Regular } from '@expo-google-fonts/unbounded/400Regular';
import { Unbounded_600SemiBold } from '@expo-google-fonts/unbounded/600SemiBold';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ToastHost';
import { initializeDatabase } from '@/db/migrations';
import { LockGate } from '@/features/app/LockGate';
import { useFxRefresh } from '@/features/app/useFxRefresh';
import { configureNotifications } from '@/features/plan/notifications';
import { usePlanRunner } from '@/features/plan/usePlanRunner';
import { initI18n, resolveLanguage } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const language = useSettings((s) => s.language);
  initI18n(resolveLanguage(language));

  const [fontsLoaded] = useFonts({
    Unbounded_300Light,
    Unbounded_400Regular,
    Unbounded_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const navTheme = isDark ? DarkTheme : DefaultTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SQLiteProvider databaseName="moneytracker.db" onInit={initializeDatabase}>
        <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent } }}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <AppShell />
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const onboarded = useSettings((s) => s.onboarded);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useFxRefresh();
  usePlanRunner();

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(sections)" />
          <Stack.Screen name="add" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="plan" />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
      <ToastHost bottom={insets.bottom + 128} />
      <LockGate />
    </>
  );
}
