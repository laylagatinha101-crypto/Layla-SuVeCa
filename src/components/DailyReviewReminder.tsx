import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Bell, BellOff, CheckCircle2, Clock3, Mail, ShieldCheck } from 'lucide-react';
import type { CadernoErroItem } from '../types/suveca';
import { db } from '../lib/firebase';
import { PushNotificationSettings } from './PushNotificationSettings';

const DEFAULT_REMINDER_TIME = '09:00';
const STORAGE_PREFIX = 'suveca_daily_review_reminder';

interface ReminderPreference {
  enabled: boolean;
  reminderTime: string;
  lastNotifiedOn?: string;
  updatedAt: string;
}

interface DailyReviewReminderProps {
  errors: CadernoErroItem[];
  userId?: string;
  /** Mantém a rotina de aviso ativa sem exibir o cartão fora do Caderno. */
  hidden?: boolean;
}

const createDefaultPreference = (): ReminderPreference => ({
  enabled: false,
  reminderTime: DEFAULT_REMINDER_TIME,
  updatedAt: new Date().toISOString(),
});

const storageKeyFor = (userId?: string) =>
  `${STORAGE_PREFIX}_${userId || 'guest'}`;

const isValidTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const normalizePreference = (value: unknown): ReminderPreference => {
  const fallback = createDefaultPreference();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const candidate = value as Partial<ReminderPreference>;
  return {
    enabled: candidate.enabled === true,
    reminderTime: isValidTime(candidate.reminderTime)
      ? candidate.reminderTime
      : DEFAULT_REMINDER_TIME,
    lastNotifiedOn:
      typeof candidate.lastNotifiedOn === 'string'
        ? candidate.lastNotifiedOn
        : undefined,
    updatedAt:
      typeof candidate.updatedAt === 'string'
        ? candidate.updatedAt
        : fallback.updatedAt,
  };
};

const readLocalPreference = (userId?: string): ReminderPreference => {
  if (typeof window === 'undefined') return createDefaultPreference();

  try {
    const saved = window.localStorage.getItem(storageKeyFor(userId));
    return saved ? normalizePreference(JSON.parse(saved)) : createDefaultPreference();
  } catch {
    return createDefaultPreference();
  }
};

const localDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isAtOrAfterReminderTime = (time: string, date = new Date()) => {
  const [hour, minute] = time.split(':').map(Number);
  return date.getHours() * 60 + date.getMinutes() >= hour * 60 + minute;
};

const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

/**
 * Sends one browser notification per local day while the application is open.
 * A linked FCM push subscription can extend the same schedule to background
 * delivery through the app service worker.
 */
export const DailyReviewReminder: React.FC<DailyReviewReminderProps> = ({
  errors,
  userId,
  hidden = false,
}) => {
  const scope = userId ? `user:${userId}` : 'guest';
  const [preference, setPreference] = useState<ReminderPreference>(() =>
    readLocalPreference(userId)
  );
  const [hydratedScope, setHydratedScope] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [emailReviewEnabled, setEmailReviewEnabled] = useState(false);
  const [isLoadingEmailPreference, setIsLoadingEmailPreference] = useState(Boolean(userId));
  const deliveredDayRef = useRef<string | null>(null);

  const pendingErrorCount = useMemo(
    () => errors.filter((error) => error.status !== 'dominado').length,
    [errors]
  );

  useEffect(() => {
    let cancelled = false;
    const localPreference = readLocalPreference(userId);

    setHydratedScope(null);
    setIsLoading(true);
    setPreference(localPreference);
    setMessage(null);
    deliveredDayRef.current = null;

    const finishHydration = (nextPreference: ReminderPreference) => {
      if (cancelled) return;
      setPreference(nextPreference);
      setHydratedScope(scope);
      setIsLoading(false);
    };

    if (!userId) {
      finishHydration(localPreference);
      return () => {
        cancelled = true;
      };
    }

    const loadCloudPreference = async () => {
      try {
        const reminderRef = doc(
          db,
          'users',
          userId,
          'data',
          'daily_review_reminder'
        );
        const snapshot = await getDoc(reminderRef);
        if (cancelled) return;

        finishHydration(
          snapshot.exists()
            ? normalizePreference(snapshot.data())
            : localPreference
        );
      } catch (error) {
        console.error('Não foi possível carregar a preferência de lembrete:', error);
        finishHydration(localPreference);
      }
    };

    void loadCloudPreference();
    return () => {
      cancelled = true;
    };
  }, [scope, userId]);

  useEffect(() => {
    let cancelled = false;
    setEmailReviewEnabled(false);
    setIsLoadingEmailPreference(Boolean(userId));

    if (!userId) {
      setIsLoadingEmailPreference(false);
      return () => {
        cancelled = true;
      };
    }

    void getDoc(doc(db, 'users', userId, 'data', 'notification_preferences'))
      .then((snapshot) => {
        if (!cancelled) {
          setEmailReviewEnabled(snapshot.data()?.emailReviewEnabled === true);
        }
      })
      .catch((error) => {
        console.warn('Não foi possível carregar a preferência de e-mail:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingEmailPreference(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (hydratedScope !== scope || typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(
        storageKeyFor(userId),
        JSON.stringify(preference)
      );
    } catch (error) {
      console.error('Não foi possível salvar o lembrete neste dispositivo:', error);
    }

    if (!userId) return;

    const saveTimer = window.setTimeout(() => {
      const payload: Record<string, unknown> = {
        enabled: preference.enabled,
        reminderTime: preference.reminderTime,
        updatedAt: preference.updatedAt,
      };
      if (preference.lastNotifiedOn !== undefined) {
        payload.lastNotifiedOn = preference.lastNotifiedOn;
      }

      void setDoc(
        doc(db, 'users', userId, 'data', 'daily_review_reminder'),
        payload,
        { merge: true }
      ).catch((error) => {
        console.error('Não foi possível sincronizar o lembrete:', error);
      });
    }, 350);

    return () => window.clearTimeout(saveTimer);
  }, [hydratedScope, preference, scope, userId]);

  const updatePreference = useCallback(
    (updater: (current: ReminderPreference) => ReminderPreference) => {
      setPreference((current) => ({
        ...updater(current),
        updatedAt: new Date().toISOString(),
      }));
    },
    []
  );

  const deliverReminder = useCallback(
    (isManualTest = false) => {
      if (!notificationsSupported()) {
        setMessage('Este navegador não oferece notificações nesta página.');
        return false;
      }

      if (window.Notification.permission !== 'granted') {
        setMessage('Autorize as notificações para receber o lembrete diário.');
        return false;
      }

      if (!isManualTest && pendingErrorCount === 0) return false;

      const today = localDayKey();
      if (!isManualTest && (preference.lastNotifiedOn === today || deliveredDayRef.current === today)) {
        return false;
      }

      try {
        new window.Notification(
          isManualTest ? 'Lembrete SuVeCA ativado' : 'Hora da revisão SuVeCA',
          {
            body: isManualTest
              ? `Você tem ${pendingErrorCount} regra(s) pendente(s) para revisar.`
              : `${pendingErrorCount} regra(s) do Caderno de Erros aguardam sua revisão ativa.`,
            tag: 'suveca-daily-review',
          }
        );
        if (!isManualTest) {
          deliveredDayRef.current = today;
          updatePreference((current) => ({ ...current, lastNotifiedOn: today }));
        }
        setMessage(
          isManualTest
            ? 'Notificação de teste enviada.'
            : 'Lembrete diário enviado para este dispositivo.'
        );
        return true;
      } catch (error) {
        console.error('Não foi possível mostrar o lembrete:', error);
        setMessage('O navegador bloqueou a notificação. Verifique as permissões do site.');
        return false;
      }
    },
    [pendingErrorCount, preference.lastNotifiedOn, updatePreference]
  );

  useEffect(() => {
    if (
      hydratedScope !== scope ||
      !preference.enabled ||
      !notificationsSupported() ||
      window.Notification.permission !== 'granted'
    ) {
      return;
    }

    const checkReminder = () => {
      if (isAtOrAfterReminderTime(preference.reminderTime)) {
        deliverReminder();
      }
    };

    checkReminder();
    const interval = window.setInterval(checkReminder, 60_000);
    window.addEventListener('focus', checkReminder);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkReminder);
    };
  }, [deliverReminder, hydratedScope, preference.enabled, preference.reminderTime, scope]);

  const handleEnable = async () => {
    if (!notificationsSupported()) {
      setMessage('Este navegador não oferece notificações nesta página.');
      return;
    }

    try {
      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') {
        updatePreference((current) => ({ ...current, enabled: false }));
        setMessage('Permissão não concedida. Você pode liberá-la nas configurações do navegador.');
        return;
      }

      updatePreference((current) => ({ ...current, enabled: true }));
      setMessage('Lembretes diários ativados. Escolha abaixo o melhor horário para revisar.');
    } catch (error) {
      console.error('Não foi possível solicitar a permissão de notificação:', error);
      setMessage('Não foi possível solicitar a permissão de notificação agora.');
    }
  };

  const handleDisable = () => {
    updatePreference((current) => ({ ...current, enabled: false }));
    setMessage('Lembretes diários desativados neste dispositivo.');
  };

  const updateEmailReminder = (enabled: boolean) => {
    if (!userId) return;
    setEmailReviewEnabled(enabled);
    void setDoc(
      doc(db, 'users', userId, 'data', 'notification_preferences'),
      {
        emailReviewEnabled: enabled,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ).catch((error) => {
      console.error('Não foi possível salvar a preferência de e-mail:', error);
      setEmailReviewEnabled(!enabled);
      setMessage('Não foi possível salvar a preferência de e-mail agora.');
    });
  };

  const permission = notificationsSupported()
    ? window.Notification.permission
    : 'unsupported';
  const canTest = preference.enabled && permission === 'granted';

  return (
    <section
      className={`rounded-2xl border border-violet-200 bg-linear-to-br from-violet-50 via-white to-teal-50 p-4 sm:p-5 shadow-xs ${
        hidden ? 'hidden' : 'mb-8'
      }`}
      aria-hidden={hidden || undefined}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-800">
            {preference.enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Aviso local de revisão</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                preference.enabled && permission === 'granted'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-100 text-slate-600'
              }`}>
                {isLoading
                  ? 'Sincronizando...'
                  : preference.enabled && permission === 'granted'
                  ? 'Ativo'
                  : 'Desativado'}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
              Com a plataforma aberta, receba um aviso às {preference.reminderTime} para revisar as {pendingErrorCount} regra(s) ainda pendente(s) no Caderno.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {preference.enabled ? (
            <button type="button" onClick={handleDisable} className="button-secondary text-xs">
              <BellOff className="h-4 w-4 text-slate-600" /> Desativar aviso local
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleEnable()}
              disabled={isLoading}
              className="button-primary text-xs"
            >
              <Bell className="h-4 w-4" /> Ativar aviso local
            </button>
          )}
          {canTest && (
            <button type="button" onClick={() => deliverReminder(true)} className="button-secondary text-xs">
              Testar agora
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-violet-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Clock3 className="h-4 w-4 text-violet-700" /> Horário diário
          <input
            type="time"
            value={preference.reminderTime}
            onChange={(event) => {
              const nextTime = event.target.value;
              if (isValidTime(nextTime)) {
                updatePreference((current) => ({ ...current, reminderTime: nextTime }));
              }
            }}
            disabled={isLoading}
            className="input-field px-2 py-1.5 text-xs"
            aria-label="Horário do lembrete diário"
          />
        </label>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
          A permissão só é solicitada ao ativar.
        </div>
      </div>

      <PushNotificationSettings
        userId={userId}
        reminderTime={preference.reminderTime}
        pendingErrorCount={pendingErrorCount}
      />

      {userId && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white/75 p-3.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={emailReviewEnabled}
            disabled={isLoadingEmailPreference}
            onChange={(event) => updateEmailReminder(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
          />
          <span>
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <Mail className="h-3.5 w-3.5 text-teal-700" /> Lembrete por e-mail após 48 horas
            </span>
            <span className="mt-1 block leading-relaxed">
              Receba um e-mail de retomada caso fique dois dias sem estudar. Você pode desativar quando quiser.
            </span>
          </span>
        </label>
      )}

      {message && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600" aria-live="polite">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-700" />
          {message}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        O aviso simples é emitido quando a plataforma estiver aberta ou voltar ao foco. Ative o push acima para receber o lembrete também com o navegador fechado.
      </p>
    </section>
  );
};
