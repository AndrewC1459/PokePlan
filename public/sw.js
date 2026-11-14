// Poképlan service worker: makes the app installable and lets reminder notifications open it.
// It does not cache anything, so every visit loads the latest deploy.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Clicking a reminder focuses an open Poképlan window, or opens one.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (open) return open.focus();
    return self.clients.openWindow(event.notification.data?.url || '/');
  })());
});
