import React, { useEffect, useMemo, useState } from 'react';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { BellRing, Info, Send, Smartphone, WifiOff } from 'lucide-react';
import { db } from '../lib/firebase';
import {
  getTokenDocumentId,
  listenForForegroundPushes,
  removePushToken,
  requestPushToken,
  supportsPushNotifications,
  type PushSetupFailureReason,
} from '../lib/pushNotifications';
import { showServiceWorkerNotification } from '../lib/pwa';

interface PushNotificationSettingsProps {
  userId?: string;
  reminderTime: string;
  pendingErrorCount: number;
}

const DEVICE_STORAGE_PREFIX = 'suveca_push_subscription';

const deviceStorageKey = (userId: string) => `${DEVICE_STORAGE_PREFIX}_${userId}`;

const readDeviceId = (userId: string) => {
  try {
    return window.localStorage.getItem(deviceStorageKey(userId));
  } catch {
    return null;
  }
};

const storeDeviceId = (userId: string, deviceId?: string) => {
  try {
    if (deviceId) {
      window.localStorage.setItem(deviceStorageKey(userId), deviceId);
    } else {
      window.localStorage.removeItem(deviceStorageKey(userId));
    }
  } catch {
    // A private browsing quota error should not stop the subscription itself.
  }
};

const pushSettingsRef = (userId: string) =>
  doc(db, 'users', userId, 'data', 'push_notifications');

const friendlySetupError = (reason: PushSetupFailureReason) => {
  switch (reason) {
    case 'missing-vapid-key':
      return 'Falta configurar a chave VAPID de Web Push neste ambiente.';
    case 'permission-denied':
      return 'A permissão foi negada. Libere as notificações nas configurações do navegador.';
    case 'service-worker-unavailable':
      return 'O modo offline não pôde ser iniciado neste dispositivo.';
    case 'token-unavailable':
      return 'Não foi possível criar a inscrição de notificação. Tente novamente.';
    default:
      return 'Push não é compatível com este navegador ou com esta conexão.';
  }
};

/**
 * Opt-in for an FCM token associated with the current device. The subscription
 * is private at users/{uid}/push_subscriptions and the schedule preference is
 * stored separately in users/{uid}/data/push_notifications for the backend.
 */
export const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = ({
  userId,
  reminderTime,
  pendingErrorCount,
}) => {
  const [isEnabledOnDevice, setIsEnabledOnDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isSupported = supportsPushNotifications();

  const browserLabel = useMemo(() => {
    if (!isSupported) return 'Indisponível neste navegador';
    if (window.Notification.permission === 'denied') return 'Bloqueado pelo navegador';
    return isEnabledOnDevice ? 'Ativo neste dispositivo' : 'Desativado neste dispositivo';
  }, [isEnabledOnDevice, isSupported]);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setIsEnabledOnDevice(false);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setMessage(null);

    const loadSubscription = async () => {
      const deviceId = readDeviceId(userId);
      if (!deviceId) {
        if (!cancelled) {
          setIsEnabledOnDevice(false);
          setIsLoading(false);
        }
        return;
      }

      try {
        const snapshot = await getDoc(
          doc(db, 'users', userId, 'push_subscriptions', deviceId)
        );
        if (!cancelled) {
          setIsEnabledOnDevice(snapshot.exists() && snapshot.data()?.enabled === true);
        }
      } catch (error) {
        console.warn('Não foi possível consultar a inscrição de push:', error);
        if (!cancelled) setIsEnabledOnDevice(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadSubscription();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Keep a subscribed account's preferred delivery time in sync with the
  // ordinary daily reminder control without asking for permission again.
  useEffect(() => {
    if (!userId || !isEnabledOnDevice) return;

    const timer = window.setTimeout(() => {
      void setDoc(
        pushSettingsRef(userId),
        {
          enabled: true,
          reminderTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((error) => console.warn('Não foi possível atualizar o horário de push:', error));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [isEnabledOnDevice, reminderTime, userId]);

  // Data-only messages are shown via the service worker even while the tab is
  // open, keeping one visual treatment for foreground and background delivery.
  useEffect(() => {
    if (!isEnabledOnDevice) return;
    let unsubscribe: (() => void) | undefined;

    void listenForForegroundPushes((payload) => {
      void showServiceWorkerNotification({
        title: payload.title || 'Hora da revisão SuVeCA',
        body: payload.body || 'Há regras decisivas aguardando sua revisão.',
        url: payload.url || '/',
        tag: 'suveca-daily-review',
      });
    }).then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => unsubscribe?.();
  }, [isEnabledOnDevice]);

  const enablePush = async () => {
    if (!userId) {
      setMessage('Entre na sua conta para associar os lembretes a este dispositivo.');
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const result = await requestPushToken();
      if (result.ok === false) {
        setMessage(friendlySetupError(result.reason));
        return;
      }

      const subscriptionId = await getTokenDocumentId(result.token);
      const now = new Date().toISOString();
      await Promise.all([
        setDoc(
          doc(db, 'users', userId, 'push_subscriptions', subscriptionId),
          {
            schemaVersion: 1,
            token: result.token,
            enabled: true,
            platform: 'web',
            createdAt: now,
            updatedAt: now,
            lastSeenAt: now,
          },
          { merge: true }
        ),
        setDoc(
          pushSettingsRef(userId),
          {
            schemaVersion: 1,
            enabled: true,
            reminderTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
            updatedAt: now,
          },
          { merge: true }
        ),
      ]);

      storeDeviceId(userId, subscriptionId);
      setIsEnabledOnDevice(true);
      setMessage('Push ativado. O aviso continuará funcionando com o navegador fechado.');
    } catch (error) {
      console.error('Não foi possível ativar as notificações push:', error);
      setMessage('Não foi possível salvar a inscrição de push. Tente novamente.');
    } finally {
      setIsWorking(false);
    }
  };

  const disablePush = async () => {
    if (!userId) return;
    setIsWorking(true);
    setMessage(null);

    try {
      const subscriptionId = readDeviceId(userId);
      if (subscriptionId) {
        await deleteDoc(doc(db, 'users', userId, 'push_subscriptions', subscriptionId));
      }
      await removePushToken();
      storeDeviceId(userId);
      setIsEnabledOnDevice(false);
      setMessage('Push desativado para esta conta neste dispositivo.');
    } catch (error) {
      console.error('Não foi possível desativar as notificações push:', error);
      setMessage('Não foi possível remover a inscrição agora. Tente novamente.');
    } finally {
      setIsWorking(false);
    }
  };

  const sendTest = async () => {
    const sent = await showServiceWorkerNotification({
      title: 'Teste de push SuVeCA',
      body: pendingErrorCount > 0
        ? `Você tem ${pendingErrorCount} regra(s) pronta(s) para revisar.`
        : 'Tudo em dia no Caderno de Erros. Excelente ritmo!',
      url: '/',
      tag: 'suveca-push-test',
    });
    setMessage(sent ? 'Notificação de teste enviada pelo service worker.' : 'O service worker ainda está iniciando. Tente novamente em instantes.');
  };

  return (
    <section className="mt-4 rounded-xl border border-teal-200 bg-white/80 p-3.5 sm:p-4" aria-label="Notificações push">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
            {isSupported ? <Smartphone className="h-4.5 w-4.5" /> : <WifiOff className="h-4.5 w-4.5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900">Lembretes push mesmo com o app fechado</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                isEnabledOnDevice
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-100 text-slate-600'
              }`}>
                {isLoading ? 'Verificando...' : browserLabel}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-600">
              Assine neste dispositivo para receber a revisão das {reminderTime}, inclusive fora da plataforma. Requer conexão segura (HTTPS) e login.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {isEnabledOnDevice ? (
            <>
              <button type="button" onClick={() => void sendTest()} className="button-secondary px-3 py-2 text-xs" disabled={isWorking}>
                <Send className="h-3.5 w-3.5" /> Testar push
              </button>
              <button type="button" onClick={() => void disablePush()} className="button-secondary px-3 py-2 text-xs" disabled={isWorking}>
                Desativar push
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void enablePush()}
              className="button-primary px-3 py-2 text-xs"
              disabled={isLoading || isWorking || !isSupported}
            >
              <BellRing className="h-3.5 w-3.5" /> {isWorking ? 'Ativando...' : 'Ativar push'}
            </button>
          )}
        </div>
      </div>

      {!userId && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-800">
          <Info className="h-3.5 w-3.5 shrink-0" /> O login é necessário para não perder a inscrição ao trocar de dispositivo.
        </p>
      )}

      {message && (
        <p className="mt-3 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
};
