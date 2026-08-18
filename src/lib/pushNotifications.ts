import { firebaseApp } from './firebase';
import { registerAppServiceWorker } from './pwa';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export type PushSetupFailureReason =
  | 'unsupported'
  | 'permission-denied'
  | 'missing-vapid-key'
  | 'token-unavailable'
  | 'service-worker-unavailable';

export type PushSetupResult =
  | { ok: true; token: string; registration: ServiceWorkerRegistration }
  | { ok: false; reason: PushSetupFailureReason };

export const supportsPushNotifications = () =>
  typeof window !== 'undefined'
  && window.isSecureContext
  && 'Notification' in window
  && 'PushManager' in window
  && 'serviceWorker' in navigator;

const loadMessaging = () => import('firebase/messaging');

/** Requests permission only from a user action and obtains an FCM token bound
 * to the app service worker. */
export const requestPushToken = async (): Promise<PushSetupResult> => {
  if (!supportsPushNotifications()) return { ok: false, reason: 'unsupported' };
  if (!VAPID_KEY) return { ok: false, reason: 'missing-vapid-key' };

  const permission = await window.Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'permission-denied' };

  const registration = await registerAppServiceWorker();
  if (!registration) return { ok: false, reason: 'service-worker-unavailable' };

  const messagingModule = await loadMessaging();
  if (!(await messagingModule.isSupported())) return { ok: false, reason: 'unsupported' };

  const messaging = messagingModule.getMessaging(firebaseApp);
  const token = await messagingModule.getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) return { ok: false, reason: 'token-unavailable' };
  return { ok: true, token, registration };
};

export const removePushToken = async () => {
  if (!supportsPushNotifications()) return;

  try {
    const messagingModule = await loadMessaging();
    if (await messagingModule.isSupported()) {
      await messagingModule.deleteToken(messagingModule.getMessaging(firebaseApp));
    }
  } catch (error) {
    // Firestore subscription removal still prevents future server sends.
    console.warn('Não foi possível remover o token local de push:', error);
  }
};

export const getTokenDocumentId = async (token: string) => {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return `fcm_${Array.from(new Uint8Array(digest)).slice(0, 12).map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  // Fallback for unusual browsers without SubtleCrypto. It is only used as a
  // document identifier, never as a security primitive.
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fcm_${(hash >>> 0).toString(36)}_${token.length}`;
};

export const listenForForegroundPushes = async (
  onPayload: (payload: { title?: string; body?: string; url?: string; silent?: boolean }) => void
) => {
  if (!supportsPushNotifications() || window.Notification.permission !== 'granted') {
    return () => undefined;
  }

  try {
    const messagingModule = await loadMessaging();
    if (!(await messagingModule.isSupported())) return () => undefined;
    return messagingModule.onMessage(messagingModule.getMessaging(firebaseApp), (payload) => {
      const data = payload.data || {};
      onPayload({
        title: data.title,
        body: data.body,
        url: data.url,
        silent: data.silent === 'true',
      });
    });
  } catch (error) {
    console.warn('Não foi possível ouvir notificações em primeiro plano:', error);
    return () => undefined;
  }
};
