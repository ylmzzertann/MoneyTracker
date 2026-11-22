import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';

import type { Reminder } from './reminders';

const CHANNEL = 'reminders';

/** Reminders show as a banner even while the app is open. */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: i18n.t('notifications.channel'),
    // eslint-disable-next-line import/namespace -- exported via `export *`, which the lint plugin cannot follow (tsc checks it)
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

const isGranted = (s: Notifications.NotificationPermissionsStatus) =>
  // eslint-disable-next-line import/namespace -- exported via `export *`, which the lint plugin cannot follow (tsc checks it)
  s.granted || s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

/** Asks for permission (Android 13+ needs a channel first). Resolves to whether reminders can be shown. */
export async function requestReminderPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return true;
  if (!current.canAskAgain) return false;
  return isGranted(await Notifications.requestPermissionsAsync());
}

let lastSignature = '';

/** Replaces every scheduled reminder with `reminders`; skips the work when nothing changed. */
export async function scheduleReminders(reminders: Reminder[]): Promise<void> {
  const signature = reminders.map((r) => `${r.id}|${r.date.getTime()}|${r.title}|${r.body}`).join('\n');
  if (signature === lastSignature) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  lastSignature = '';
  if (reminders.length === 0) {
    lastSignature = signature;
    return;
  }
  if (!isGranted(await Notifications.getPermissionsAsync())) return;
  await ensureChannel();
  for (const r of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { url: r.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
    });
  }
  lastSignature = signature;
}
