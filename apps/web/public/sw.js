/* eslint-disable no-undef */
// MyFNG Web Push Service Worker (Phase B: true web push)

self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'MyFNG';
    const body = data.body || '';
    const actionUrl = data?.data?.action_url || '/dashboard/notifications';

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/favicon-32x32.png',
        badge: '/favicon-32x32.png',
        data: { actionUrl, raw: data },
      })
    );
  } catch (e) {
    // ignore
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.notification?.data?.actionUrl || '/dashboard/notifications';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        // Focus an existing tab if possible
        if ('focus' in client) {
          client.focus();
          try {
            client.navigate(actionUrl);
          } catch {
            // ignore
          }
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        await self.clients.openWindow(actionUrl);
      }
    })()
  );
});


