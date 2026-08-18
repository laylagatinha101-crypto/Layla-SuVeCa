/* global firebase */

const CACHE_NAME = 'suveca-shell-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/suveca-icon.svg'
];

const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('suveca-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isSameOrigin(request)) return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || (await caches.match('/')))
    );
    return;
  }

  const isCodeAsset = request.destination === 'script' || request.destination === 'style' || url.pathname.startsWith('/assets/');
  const isStaticAsset = ['image', 'font'].includes(request.destination) || isCodeAsset;

  if (!isStaticAsset) return;

  // Code assets (JS/CSS) use Network First so newly deployed lazy chunks match the active shell
  if (isCodeAsset) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || Response.error())
    );
    return;
  }

  // Media assets (images/fonts) use Cache First
  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
  );
});

const showReviewNotification = (payload = {}) => {
  const title = payload.title || 'Hora da revisão SuVeCA';
  const body = payload.body || 'Há regras decisivas esperando sua revisão ativa.';
  return self.registration.showNotification(title, {
    body,
    icon: '/icons/suveca-icon.svg',
    badge: '/icons/suveca-icon.svg',
    tag: payload.tag || 'suveca-daily-review',
    renotify: Boolean(payload.renotify),
    silent: payload.silent === true || payload.silent === 'true',
    data: { url: payload.url || '/' }
  });
};

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_REVIEW_NOTIFICATION') {
    event.waitUntil(showReviewNotification(event.data.payload));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const matchingWindow = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (matchingWindow) {
        matchingWindow.focus();
        return matchingWindow.navigate(targetUrl);
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Firebase Cloud Messaging uses a data-only payload so this handler owns the
// presentation and the notification stays useful even when the app is closed.
try {
  importScripts('/firebase-messaging-config.js');
  importScripts(
    'https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js'
  );

  if (self.__SUVECA_FIREBASE_CONFIG__ && firebase?.messaging) {
    firebase.initializeApp(self.__SUVECA_FIREBASE_CONFIG__);
    firebase.messaging().onBackgroundMessage((payload) => {
      const data = payload?.data || {};
      return showReviewNotification({
        title: data.title,
        body: data.body,
        url: data.url,
        tag: data.tag || 'suveca-daily-review',
        silent: data.silent
      });
    });
  }
} catch (error) {
  // PWA caching continues to work if Firebase Messaging is unavailable.
  console.warn('Firebase Messaging não foi iniciado no service worker.', error);
}
