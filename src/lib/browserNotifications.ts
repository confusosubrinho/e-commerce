/**
 * Notificações nativas do navegador (Notification API).
 * Usado no painel admin para alertar sobre novos pedidos/notificações.
 */

export type NotificationPermission = 'default' | 'granted' | 'denied';

export function isBrowserNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission {
  if (!isBrowserNotificationSupported()) return 'denied';
  return (Notification.permission as NotificationPermission) ?? 'default';
}

export function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!isBrowserNotificationSupported()) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  if (Notification.permission === 'denied') return Promise.resolve('denied');
  return Notification.requestPermission().then((p) => p as NotificationPermission);
}

export function showBrowserNotification(
  title: string,
  options?: { body?: string; link?: string; tag?: string }
): void {
  if (typeof window === 'undefined' || !isBrowserNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  const n = new Notification(title, {
    body: options?.body ?? '',
    tag: options?.tag ?? 'admin-notification',
    icon: '/favicon.ico',
  });

  const link = options?.link;
  n.onclick = () => {
    n.close();
    if (link && window.focus) {
      window.focus();
      window.location.href = link;
    }
  };
}
