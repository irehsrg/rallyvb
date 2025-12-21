/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Take control immediately
self.skipWaiting();
clientsClaim();

// Clean up old caches
cleanupOutdatedCaches();

// Precache all assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache Google Fonts stylesheets
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

// Cache Google Fonts webfonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// ============================================================================
// PUSH NOTIFICATION HANDLERS
// ============================================================================

interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    type?: string;
    [key: string]: unknown;
  };
}

self.addEventListener('push', (event: PushEvent) => {
  console.log('[Rally SW] Push received:', event);

  let data: PushPayload = {
    title: 'Rally',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'rally-notification',
    data: {}
  };

  try {
    if (event.data) {
      const payload = event.data.json() as PushPayload;
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || `rally-${Date.now()}`,
        data: payload.data || {}
      };
    }
  } catch (e) {
    console.error('[Rally SW] Error parsing push data:', e);
    // Try to get as text
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title!, options)
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[Rally SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Determine URL to open based on notification type
  let urlToOpen = '/';
  const notificationData = event.notification.data as PushPayload['data'];

  if (notificationData?.url) {
    urlToOpen = notificationData.url;
  } else if (notificationData?.type) {
    switch (notificationData.type) {
      case 'session_created':
      case 'session_reminder':
        urlToOpen = '/';
        break;
      case 'waitlist_update':
        urlToOpen = '/';
        break;
      case 'game_results':
        urlToOpen = '/profile';
        break;
      default:
        urlToOpen = '/';
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if a window is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', () => {
  console.log('[Rally SW] Push subscription changed');
  // The main app will handle re-subscribing on next load
});

console.log('[Rally SW] Service worker loaded');
