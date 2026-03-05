import { useState, useCallback } from 'react';
import {
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  type NotificationPermission,
} from '@/lib/browserNotifications';

export function useBrowserNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window !== 'undefined' ? getBrowserNotificationPermission() : 'denied'
  );
  const [isRequesting, setIsRequesting] = useState(false);

  const request = useCallback(async () => {
    if (!isBrowserNotificationSupported()) return 'denied';
    setIsRequesting(true);
    try {
      const result = await requestBrowserNotificationPermission();
      setPermission(result);
      return result;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  const supported = isBrowserNotificationSupported();

  return { supported, permission, requestPermission: request, isRequesting };
}
