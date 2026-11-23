import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

/** Opens the screen a tapped reminder points to (its `data.url`). */
export function useNotificationTaps(enabled: boolean) {
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = lastResponse?.notification.request.content.data?.url;
    if (!enabled || typeof url !== 'string' || lastResponse?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    router.push(url as Href);
    void Notifications.clearLastNotificationResponseAsync();
  }, [lastResponse, enabled]);
}
