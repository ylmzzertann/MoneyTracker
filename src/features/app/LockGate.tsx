import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Sky } from '@/components/Sky';
import { GlassPill, Txt } from '@/components/ui';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

/** Covers the app with a lock screen when biometric lock is on, on launch and after returning from the background. */
export function LockGate() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const enabled = useSettings((s) => s.biometricLock);
  const [locked, setLocked] = useState(enabled);

  const unlock = () =>
    LocalAuthentication.authenticateAsync({ promptMessage: t('lock.reason') }).then((result) => {
      if (result.success) setLocked(false);
    });

  useEffect(() => {
    if (!enabled || !locked) return;
    void LocalAuthentication.authenticateAsync({ promptMessage: t('lock.reason') }).then((result) => {
      if (result.success) setLocked(false);
    });
  }, [enabled, locked, t]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && enabled) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  if (!enabled || !locked) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Sky />
      <View style={styles.center}>
        <Icon name="lock" size={40} color={colors.accent} />
        <Txt display="light" size={24} style={styles.title}>
          {t('lock.title')}
        </Txt>
        <GlassPill label={t('lock.unlock')} onPress={() => void unlock()} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32 },
  title: { textAlign: 'center' },
  button: { minWidth: 160 },
});
