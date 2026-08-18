import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// This is deliberately lazy: index.ts initializes the default Admin app at
// module load, while re-exported modules are evaluated before that body runs.
// Deferring initialization prevents duplicate-app errors in either order.
const getFirebaseApp = () => getApps().length ? getApps()[0] : initializeApp();

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

interface PushSettings {
  enabled?: unknown;
  reminderTime?: unknown;
  secondaryReminderEnabled?: unknown;
  secondaryReminderTime?: unknown;
  daysOfWeek?: unknown;
  topics?: unknown;
  soundEnabled?: unknown;
  timeZone?: unknown;
  lastDeliveredOn?: unknown;
  lastDeliveryDate?: unknown;
  deliveredSlots?: unknown;
}

interface PushSubscription {
  token?: unknown;
  enabled?: unknown;
}

const validTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const validTimeZone = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return 'America/Sao_Paulo';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return value;
  } catch {
    return 'America/Sao_Paulo';
  }
};

const localDateInfo = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '00';

  return {
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
    weekday: new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    }).format(date),
  };
};

const WEEKDAY_IDS: Record<string, string> = {
  Mon: 'seg',
  Tue: 'ter',
  Wed: 'qua',
  Thu: 'qui',
  Fri: 'sex',
  Sat: 'sab',
  Sun: 'dom',
};

const weekdayId = (weekday: string) => WEEKDAY_IDS[weekday] || '';

const minutesFor = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

const chunksOf = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const ownerIdFromSubscriptionPath = (path: string) => {
  const segments = path.split('/');
  return segments.length >= 4 && segments[0] === 'users' && segments[2] === 'push_subscriptions'
    ? segments[1]
    : null;
};

/**
 * Sends data-only FCM messages. The web service worker is responsible for the
 * visible notification, so a reminder also works after the tab was closed.
 *
 * Export this from functions/src/index.ts:
 *   export { sendDailyReviewPushes } from './pushNotifications.js';
 */
export const sendDailyReviewPushes = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
  },
  async () => {
    const firebaseApp = getFirebaseApp();
    const firestore = getFirestore(firebaseApp);
    const activeSubscriptions = await firestore
      .collectionGroup('push_subscriptions')
      .where('enabled', '==', true)
      .get();

    const subscriptionsByUser = new Map<string, typeof activeSubscriptions.docs>();
    for (const subscription of activeSubscriptions.docs) {
      const userId = ownerIdFromSubscriptionPath(subscription.ref.path);
      if (!userId) continue;
      const current = subscriptionsByUser.get(userId) || [];
      current.push(subscription);
      subscriptionsByUser.set(userId, current);
    }

    const now = new Date();
    let deliveredToUsers = 0;
    let removedTokens = 0;

    for (const [userId, subscriptionDocs] of subscriptionsByUser) {
      const settingsRef = firestore.doc(`users/${userId}/data/push_notifications`);
      const errorsRef = firestore.doc(`users/${userId}/data/caderno_erros`);
      const [settingsSnapshot, errorsSnapshot] = await Promise.all([
        settingsRef.get(),
        errorsRef.get(),
      ]);
      const settings = settingsSnapshot.data() as PushSettings | undefined;

      if (!settings || settings.enabled !== true || !validTime(settings.reminderTime)) {
        continue;
      }

      const timeZone = validTimeZone(settings.timeZone);
      const localTime = localDateInfo(now, timeZone);
      const configuredDays = Array.isArray(settings.daysOfWeek)
        ? settings.daysOfWeek.filter((day): day is string => typeof day === 'string')
        : [];
      if (configuredDays.length && !configuredDays.includes(weekdayId(localTime.weekday))) {
        continue;
      }

      const configuredTopics = settings.topics && typeof settings.topics === 'object'
        ? settings.topics as { cadernoErros?: unknown }
        : undefined;
      if (configuredTopics?.cadernoErros === false) continue;

      const schedules = [
        { id: 'primary', time: settings.reminderTime },
        ...(settings.secondaryReminderEnabled === true && validTime(settings.secondaryReminderTime)
          ? [{ id: 'secondary', time: settings.secondaryReminderTime }]
          : []),
      ];
      const deliveredSlots = settings.lastDeliveryDate === localTime.dateKey
        && Array.isArray(settings.deliveredSlots)
        ? settings.deliveredSlots.filter((slot): slot is string => typeof slot === 'string')
        : [];
      const dueSchedule = schedules.find(
        (schedule) => localTime.minutes >= minutesFor(schedule.time)
          && !deliveredSlots.includes(schedule.id)
      );

      // The scheduler can run a little late. Each configured slot is delivered
      // at most once on an enabled local weekday.
      if (!dueSchedule) continue;

      const errorItems = errorsSnapshot.data()?.items;
      const pendingCount = Array.isArray(errorItems)
        ? errorItems.filter((item) => item && typeof item === 'object' && (item as { status?: unknown }).status !== 'dominado').length
        : 0;
      if (pendingCount === 0) continue;

      const uniqueSubscriptions = new Map<string, (typeof subscriptionDocs)[number]>();
      for (const subscription of subscriptionDocs) {
        const data = subscription.data() as PushSubscription;
        if (data.enabled === true && typeof data.token === 'string' && data.token) {
          uniqueSubscriptions.set(data.token, subscription);
        }
      }

      const tokenEntries = Array.from(uniqueSubscriptions.entries());
      if (!tokenEntries.length) continue;

      let successfulDeliveries = 0;
      const invalidSubscriptionRefs: typeof subscriptionDocs = [];

      for (const batch of chunksOf(tokenEntries, 500)) {
        const response = await getMessaging(firebaseApp).sendEachForMulticast({
          tokens: batch.map(([token]) => token),
          data: {
            title: 'Hora da revisão SuVeCA',
            body: `${pendingCount} regra(s) decisiva(s) aguardam sua revisão ativa.`,
            url: '/',
            tag: 'suveca-daily-review',
            silent: settings.soundEnabled === false ? 'true' : 'false',
          },
          webpush: {
            headers: {
              Urgency: 'high',
            },
          },
        });

        response.responses.forEach((result, index) => {
          if (result.success) {
            successfulDeliveries += 1;
            return;
          }

          if (result.error && INVALID_TOKEN_CODES.has(result.error.code)) {
            invalidSubscriptionRefs.push(batch[index][1]);
          } else if (result.error) {
            logger.warn('Falha ao enviar push SuVeCA.', {
              userId,
              code: result.error.code,
            });
          }
        });
      }

      if (invalidSubscriptionRefs.length) {
        const writeBatch = firestore.batch();
        invalidSubscriptionRefs.forEach((subscription) => writeBatch.delete(subscription.ref));
        await writeBatch.commit();
        removedTokens += invalidSubscriptionRefs.length;
      }

      if (successfulDeliveries > 0) {
        await settingsRef.set(
          {
            lastDeliveredOn: localTime.dateKey,
            lastDeliveryDate: localTime.dateKey,
            deliveredSlots: [...new Set([...deliveredSlots, dueSchedule.id])],
            lastDeliveredAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        deliveredToUsers += 1;
      }
    }

    logger.info('Rotina de push diário concluída.', {
      candidateUsers: subscriptionsByUser.size,
      deliveredToUsers,
      removedTokens,
    });
  }
);
