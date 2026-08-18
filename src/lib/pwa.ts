const SERVICE_WORKER_URL = '/sw.js';

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export const supportsServiceWorker = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator;

/** Registers the app shell once. Registration is deliberately independent of
 * notification permission, so offline reading works for every visitor. */
export const registerAppServiceWorker = (): Promise<ServiceWorkerRegistration | null> => {
  if (!supportsServiceWorker()) return Promise.resolve(null);

  // In development mode, unregister any active service worker and clear caches to prevent stale Vite modules
  if (import.meta.env.DEV) {
    return navigator.serviceWorker.getRegistrations().then((registrations) => {
      return Promise.all(registrations.map((r) => r.unregister())).then(() => {
        if ('caches' in window) {
          void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
        }
        return null;
      });
    }).catch(() => null);
  }

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: '/' })
      .then(async (registration) => {
        // Do not block the app on an update check; it simply makes deployments
        // visible sooner to returning learners.
        void registration.update();
        await navigator.serviceWorker.ready;
        return registration;
      })
      .catch((error) => {
        console.warn('Não foi possível registrar o modo offline:', error);
        return null;
      });
  }

  return registrationPromise;
};

export const showServiceWorkerNotification = async (payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  silent?: boolean;
}) => {
  const registration = await registerAppServiceWorker();
  const worker = registration?.active || registration?.waiting || registration?.installing;
  worker?.postMessage({ type: 'SHOW_REVIEW_NOTIFICATION', payload });
  return Boolean(worker);
};
