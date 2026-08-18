import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Calendar,
  Flame,
  Info,
  Mail,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Volume2,
  VolumeX,
  WifiOff,
  RotateCcw,
} from 'lucide-react';
import { db, type User } from '../lib/firebase';
import {
  getTokenDocumentId,
  listenForForegroundPushes,
  removePushToken,
  requestPushToken,
  supportsPushNotifications,
  type PushSetupFailureReason,
} from '../lib/pushNotifications';
import { showServiceWorkerNotification } from '../lib/pwa';
import type { StudyPreferences as StudyPreferencesType } from '../types/suveca';

interface StudyPreferencesProps {
  user?: User | null;
  pendingErrorCount?: number;
}

const STORAGE_KEY_PREFIX = 'suveca_study_prefs';
const DEVICE_STORAGE_PREFIX = 'suveca_push_subscription';

const DAYS_MAP = [
  { id: 'seg', label: 'Seg', fullName: 'Segunda-feira' },
  { id: 'ter', label: 'Ter', fullName: 'Terça-feira' },
  { id: 'qua', label: 'Qua', fullName: 'Quarta-feira' },
  { id: 'qui', label: 'Qui', fullName: 'Quinta-feira' },
  { id: 'sex', label: 'Sex', fullName: 'Sexta-feira' },
  { id: 'sab', label: 'Sáb', fullName: 'Sábado' },
  { id: 'dom', label: 'Dom', fullName: 'Domingo' },
];

const PRESET_TIMES = ['07:00', '09:00', '12:30', '18:00', '21:00'];

const DEFAULT_PREFERENCES: StudyPreferencesType = {
  enabled: true,
  reminderTime: '09:00',
  secondaryReminderEnabled: false,
  secondaryReminderTime: '20:00',
  daysOfWeek: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
  topics: {
    cadernoErros: true,
    dicasGramatica: true,
    simuladoMetas: true,
    dueloDesafios: false,
  },
  // E-mail is opt-in. Never enable an external communication channel by default.
  emailBackupEnabled: false,
  soundEnabled: true,
  timeZone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo' : 'America/Sao_Paulo',
  updatedAt: new Date().toISOString(),
};

const storageKeyForUser = (userId?: string | null) =>
  `${STORAGE_KEY_PREFIX}_${userId || 'guest'}`;

const deviceStorageKey = (userId: string) =>
  `${DEVICE_STORAGE_PREFIX}_${userId}`;

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
    // Ignore private browsing quota limits
  }
};

const readLocalPreferences = (userId?: string | null): StudyPreferencesType => {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      topics: {
        ...DEFAULT_PREFERENCES.topics,
        ...(parsed.topics || {}),
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const friendlySetupError = (reason: PushSetupFailureReason) => {
  switch (reason) {
    case 'missing-vapid-key':
      return 'Falta configurar a chave VAPID de Web Push neste ambiente.';
    case 'permission-denied':
      return 'A permissão para notificações foi negada. Permita nas configurações do seu navegador.';
    case 'service-worker-unavailable':
      return 'O Service Worker não pôde ser registrado neste navegador.';
    case 'token-unavailable':
      return 'Não foi possível obter a inscrição FCM. Tente novamente.';
    default:
      return 'Push não é suportado neste navegador ou conexão sem HTTPS.';
  }
};

export const StudyPreferences: React.FC<StudyPreferencesProps> = ({
  user,
  pendingErrorCount = 0,
}) => {
  const userId = user?.uid;
  const isSupported = supportsPushNotifications();

  const [prefs, setPrefs] = useState<StudyPreferencesType>(() =>
    readLocalPreferences(userId)
  );
  const [isPushActiveOnDevice, setIsPushActiveOnDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load preferences from Firestore / LocalStorage
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      setMessage(null);

      const localData = readLocalPreferences(userId);
      setPrefs(localData);

      if (!userId) {
        setIsPushActiveOnDevice(false);
        setIsLoading(false);
        return;
      }

      try {
        // Load study_preferences document
        const prefsRef = doc(db, 'users', userId, 'data', 'study_preferences');
        const pushSettingsRef = doc(db, 'users', userId, 'data', 'push_notifications');
        const notificationSettingsRef = doc(db, 'users', userId, 'data', 'notification_preferences');

        const [prefsSnap, pushSnap, notificationSnap] = await Promise.all([
          getDoc(prefsRef),
          getDoc(pushSettingsRef),
          getDoc(notificationSettingsRef),
        ]);

        if (cancelled) return;

        let merged = { ...localData };

        if (prefsSnap.exists()) {
          const remote = prefsSnap.data() as Partial<StudyPreferencesType>;
          merged = {
            ...merged,
            ...remote,
            topics: {
              ...merged.topics,
              ...(remote.topics || {}),
            },
          };
        } else if (pushSnap.exists()) {
          const pushData = pushSnap.data();
          if (pushData?.reminderTime) {
            merged.reminderTime = pushData.reminderTime;
          }
          if (typeof pushData?.enabled === 'boolean') {
            merged.enabled = pushData.enabled;
          }
        }

        if (notificationSnap.exists()) {
          merged.emailBackupEnabled = notificationSnap.data()?.emailReviewEnabled === true;
        }

        setPrefs(merged);
        window.localStorage.setItem(storageKeyForUser(userId), JSON.stringify(merged));

        // Check if device subscription exists
        const deviceId = readDeviceId(userId);
        if (deviceId) {
          const deviceSnap = await getDoc(
            doc(db, 'users', userId, 'push_subscriptions', deviceId)
          );
          if (!cancelled) {
            setIsPushActiveOnDevice(deviceSnap.exists() && deviceSnap.data()?.enabled === true);
          }
        } else {
          setIsPushActiveOnDevice(false);
        }
      } catch (error) {
        console.warn('Erro ao carregar preferências de estudo do Firestore:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Foreground push listener
  useEffect(() => {
    if (!isPushActiveOnDevice) return;
    let unsubscribe: (() => void) | undefined;

    void listenForForegroundPushes((payload) => {
      void showServiceWorkerNotification({
        title: payload.title || 'Hora dos estudos SuVeCA!',
        body: payload.body || 'Mantenha sua rotina e conquiste sua vaga.',
        url: payload.url || '/',
        tag: 'suveca-study-reminder',
        silent: payload.silent,
      });
    }).then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => unsubscribe?.();
  }, [isPushActiveOnDevice]);

  // Save changes helper
  const savePreferences = async (updated: StudyPreferencesType) => {
    setPrefs(updated);
    const storageKey = storageKeyForUser(userId);
    window.localStorage.setItem(storageKey, JSON.stringify(updated));

    if (!userId) {
      setMessage({
        text: 'Preferências salvas localmente neste dispositivo.',
        type: 'info',
      });
      return;
    }

    setIsWorking(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        ...updated,
        updatedAt: now,
      };

      await Promise.all([
        setDoc(doc(db, 'users', userId, 'data', 'study_preferences'), payload, { merge: true }),
        setDoc(
          doc(db, 'users', userId, 'data', 'push_notifications'),
          {
            schemaVersion: 1,
            enabled: updated.enabled,
            reminderTime: updated.reminderTime,
            secondaryReminderEnabled: updated.secondaryReminderEnabled,
            secondaryReminderTime: updated.secondaryReminderTime,
            daysOfWeek: updated.daysOfWeek,
            topics: updated.topics,
            soundEnabled: updated.soundEnabled,
            timeZone: updated.timeZone,
            updatedAt: now,
          },
          { merge: true }
        ),
        setDoc(
          doc(db, 'users', userId, 'data', 'notification_preferences'),
          {
            emailReviewEnabled: updated.emailBackupEnabled,
            updatedAt: now,
          },
          { merge: true }
        ),
      ]);

      setMessage({
        text: 'Preferências salvas com sucesso na sua conta e sincronizadas com o FCM!',
        type: 'success',
      });
    } catch (error) {
      console.error('Erro ao salvar preferências no Firestore:', error);
      setMessage({
        text: 'Sua alteração foi salva localmente, mas houve erro ao conectar ao servidor.',
        type: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const handleTogglePush = async () => {
    if (!userId) {
      setMessage({
        text: 'Faça login com sua conta Google para vincular as notificações FCM a este dispositivo.',
        type: 'info',
      });
      return;
    }

    if (isPushActiveOnDevice) {
      // Disable Push
      setIsWorking(true);
      try {
        const subscriptionId = readDeviceId(userId);
        if (subscriptionId) {
          await deleteDoc(doc(db, 'users', userId, 'push_subscriptions', subscriptionId));
        }
        await removePushToken();
        storeDeviceId(userId);
        setIsPushActiveOnDevice(false);
        setMessage({
          text: 'Notificações FCM desativadas neste dispositivo.',
          type: 'info',
        });
      } catch (error) {
        console.error('Erro ao desativar push FCM:', error);
        setMessage({
          text: 'Erro ao desativar as notificações. Tente novamente.',
          type: 'error',
        });
      } finally {
        setIsWorking(false);
      }
    } else {
      // Enable Push via FCM
      setIsWorking(true);
      try {
        const result = await requestPushToken();
        if (result.ok === false) {
          setMessage({
            text: friendlySetupError(result.reason),
            type: 'error',
          });
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
            doc(db, 'users', userId, 'data', 'push_notifications'),
            {
              schemaVersion: 1,
              enabled: true,
              reminderTime: prefs.reminderTime,
              secondaryReminderEnabled: prefs.secondaryReminderEnabled,
              secondaryReminderTime: prefs.secondaryReminderTime,
              daysOfWeek: prefs.daysOfWeek,
              topics: prefs.topics,
              soundEnabled: prefs.soundEnabled,
              timeZone: prefs.timeZone,
              updatedAt: now,
            },
            { merge: true }
          ),
        ]);

        storeDeviceId(userId, subscriptionId);
        setIsPushActiveOnDevice(true);
        setMessage({
          text: '✨ Notificações FCM ativadas! Você receberá lembretes diários mesmo com o navegador fechado.',
          type: 'success',
        });
      } catch (error) {
        console.error('Erro ao registrar token FCM:', error);
        setMessage({
          text: 'Não foi possível concluir a ativação de notificações FCM.',
          type: 'error',
        });
      } finally {
        setIsWorking(false);
      }
    }
  };

  const handleSendTestNotification = async () => {
    const title = '🔔 Lembrete de Estudos SuVeCA';
    const body = pendingErrorCount > 0
      ? `Você tem ${pendingErrorCount} regra(s) do Caderno de Erros para revisar agora.`
      : 'Hora de manter sua sequência e praticar com o Método SuVeCA!';

    const sent = await showServiceWorkerNotification({
      title,
      body,
      url: '/',
      tag: 'suveca-test-fcm',
    });

    if (sent) {
      setMessage({
        text: 'Notificação de teste enviada com sucesso pelo Service Worker!',
        type: 'success',
      });
    } else {
      setMessage({
        text: 'Não foi possível disparar a notificação. Verifique as permissões do seu navegador.',
        type: 'error',
      });
    }
  };

  const toggleDay = (dayId: string) => {
    const currentDays = prefs.daysOfWeek;
    let nextDays: string[];
    if (currentDays.includes(dayId)) {
      if (currentDays.length <= 1) return; // Must keep at least one day
      nextDays = currentDays.filter((d) => d !== dayId);
    } else {
      nextDays = [...currentDays, dayId];
    }
    void savePreferences({ ...prefs, daysOfWeek: nextDays });
  };

  const applyDaysPreset = (preset: 'all' | 'weekdays' | 'weekend') => {
    let nextDays: string[];
    if (preset === 'all') {
      nextDays = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    } else if (preset === 'weekdays') {
      nextDays = ['seg', 'ter', 'qua', 'qui', 'sex'];
    } else {
      nextDays = ['sab', 'dom'];
    }
    void savePreferences({ ...prefs, daysOfWeek: nextDays });
  };

  const toggleTopic = (key: keyof StudyPreferencesType['topics']) => {
    const updatedTopics = {
      ...prefs.topics,
      [key]: !prefs.topics[key],
    };
    void savePreferences({ ...prefs, topics: updatedTopics });
  };

  const resetToDefaults = () => {
    void savePreferences({ ...DEFAULT_PREFERENCES, updatedAt: new Date().toISOString() });
  };

  const browserStatusLabel = useMemo(() => {
    if (!isSupported) return 'Indisponível neste navegador';
    if (typeof window !== 'undefined' && window.Notification?.permission === 'denied') {
      return 'Bloqueado pelo navegador';
    }
    return isPushActiveOnDevice ? 'FCM Ativo neste dispositivo' : 'Dispositivo pronto para ativar';
  }, [isPushActiveOnDevice, isSupported]);

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <section className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-6 -translate-y-6 opacity-10 pointer-events-none">
          <BellRing className="w-64 h-64" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-700/60 border border-teal-500/40 text-xs font-bold text-teal-200 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Firebase Cloud Messaging (FCM)
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Preferências de Estudo & Lembretes
          </h2>
          <p className="mt-2 text-sm sm:text-base text-teal-100 leading-relaxed">
            Configure seus horários de revisão, frequência diária e focos do método SuVeCA para manter a disciplina nos concursos.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              isPushActiveOnDevice
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                : 'bg-white/10 text-teal-200 border-white/20'
            }`}>
              {isPushActiveOnDevice ? <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isLoading ? 'Verificando dispositivo...' : browserStatusLabel}
            </span>

            {userId && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-teal-200 border border-white/20">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
                Sincronizado na Nuvem
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Message Feedback Banner */}
      {message && (
        <div
          className={`rounded-xl p-4 flex items-start gap-3 border text-sm transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : message.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
          role="status"
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : message.type === 'error' ? (
            <Info className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs sm:text-sm leading-relaxed">{message.text}</div>
        </div>
      )}

      {/* FCM Push Activation Card */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
              isPushActiveOnDevice
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-teal-50 text-teal-800 border-teal-200'
            }`}>
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Lembretes Push no Dispositivo (FCM)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Receba notificações mesmo quando a aba do navegador estiver fechada ou o celular bloqueado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isPushActiveOnDevice && (
              <button
                type="button"
                onClick={() => void handleSendTestNotification()}
                disabled={isWorking}
                className="button-secondary text-xs px-3 py-2"
                title="Dispara uma notificação de teste pelo Service Worker"
              >
                <Send className="w-3.5 h-3.5 text-teal-700" />
                Testar Push
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleTogglePush()}
              disabled={isLoading || isWorking || !isSupported}
              className={`button-primary text-xs px-4 py-2 flex items-center gap-2 ${
                isPushActiveOnDevice ? 'bg-slate-800 hover:bg-slate-900' : ''
              }`}
            >
              {isWorking ? (
                <span>Processando...</span>
              ) : isPushActiveOnDevice ? (
                <>
                  <Bell className="w-4 h-4" /> Desativar neste Dispositivo
                </>
              ) : (
                <>
                  <BellRing className="w-4 h-4" /> Ativar Notificações FCM
                </>
              )}
            </button>
          </div>
        </div>

        {!userId && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-center gap-3 text-xs text-amber-800">
            <Info className="w-4 h-4 shrink-0 text-amber-700" />
            <span>
              Você está no perfil de visitante. Faça login com Google para manter seus horários e inscrições FCM sincronizados entre celulares e computadores.
            </span>
          </div>
        )}
      </section>

      {/* Schedule Preferences Section */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-700" />
            Horários do Lembrete Diário
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Defina o melhor momento do seu dia para abrir a plataforma e resolver questões.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Primary Reminder Time */}
          <div className="rounded-xl p-4 bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="primaryTimeInput" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Horário Principal
              </label>
              <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                {prefs.reminderTime} h
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="primaryTimeInput"
                type="time"
                value={prefs.reminderTime}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) {
                    void savePreferences({ ...prefs, reminderTime: val });
                  }
                }}
                className="input-field text-base font-bold px-3 py-2 w-36 text-center"
              />
              <span className="text-xs text-slate-500">
                Horário padrão para a rotina do método SuVeCA.
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold text-slate-500">Sugestões rápidas:</div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TIMES.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => void savePreferences({ ...prefs, reminderTime: time })}
                    className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition-all ${
                      prefs.reminderTime === time
                        ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary Reminder (Night Review) */}
          <div className="rounded-xl p-4 bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="secondaryReminderToggle" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                Segundo Lembrete (Revisão da Noite)
              </label>
              <input
                id="secondaryReminderToggle"
                type="checkbox"
                checked={prefs.secondaryReminderEnabled}
                onChange={(e) =>
                  void savePreferences({
                    ...prefs,
                    secondaryReminderEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-teal-700 rounded cursor-pointer"
              />
            </div>

            <div className={`space-y-3 transition-all ${prefs.secondaryReminderEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={prefs.secondaryReminderTime}
                  disabled={!prefs.secondaryReminderEnabled}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) {
                      void savePreferences({ ...prefs, secondaryReminderTime: val });
                    }
                  }}
                  className="input-field text-base font-bold px-3 py-2 w-36 text-center"
                />
                <span className="text-xs text-slate-500">
                  Reforço noturno para o Caderno de Erros.
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Recomendado para fechar o dia zerando as regras pendentes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Days of Week Section */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-700" />
              Dias da Semana
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Escolha em quais dias da semana você deseja ser lembrado.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => applyDaysPreset('all')}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:border-teal-300"
            >
              Todos os Dias
            </button>
            <button
              type="button"
              onClick={() => applyDaysPreset('weekdays')}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:border-teal-300"
            >
              Dias Úteis
            </button>
            <button
              type="button"
              onClick={() => applyDaysPreset('weekend')}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:border-teal-300"
            >
              Fim de Semana
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {DAYS_MAP.map((day) => {
            const isSelected = prefs.daysOfWeek.includes(day.id);
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => toggleDay(day.id)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  isSelected
                    ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-300'
                }`}
              >
                <span className="text-xs font-black uppercase tracking-wider">{day.label}</span>
                <span className="text-[10px] opacity-80 truncate">{day.fullName.split('-')[0]}</span>
                {isSelected && <Check className="w-3.5 h-3.5 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Content Topics Focus */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Flame className="w-5 h-5 text-teal-700" />
            Conteúdo e Foco das Notificações
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Selecione quais alertas de conteúdo são prioritários para você.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
            prefs.topics.cadernoErros ? 'bg-teal-50/70 border-teal-300' : 'bg-slate-50 border-slate-200'
          }`}>
            <input
              type="checkbox"
              checked={prefs.topics.cadernoErros}
              onChange={() => toggleTopic('cadernoErros')}
              className="w-4 h-4 mt-0.5 accent-teal-700 rounded"
            />
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-900">Caderno de Erros</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Avisos para revisar regras decisivas pendentes no seu ciclo de repetição espaçada.
              </div>
            </div>
          </label>

          <label className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
            prefs.topics.dicasGramatica ? 'bg-teal-50/70 border-teal-300' : 'bg-slate-50 border-slate-200'
          }`}>
            <input
              type="checkbox"
              checked={prefs.topics.dicasGramatica}
              onChange={() => toggleTopic('dicasGramatica')}
              className="w-4 h-4 mt-0.5 accent-teal-700 rounded"
            />
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-900">Dicas Diárias do Prof. SuVeCA</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Macetes práticos de concordância, regência e crase direto no seu lembrete.
              </div>
            </div>
          </label>

          <label className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
            prefs.topics.simuladoMetas ? 'bg-teal-50/70 border-teal-300' : 'bg-slate-50 border-slate-200'
          }`}>
            <input
              type="checkbox"
              checked={prefs.topics.simuladoMetas}
              onChange={() => toggleTopic('simuladoMetas')}
              className="w-4 h-4 mt-0.5 accent-teal-700 rounded"
            />
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-900">Simulados e Metas Diárias</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Incentivo para resolver a bateria de questões do dia e manter sua sequência ativa.
              </div>
            </div>
          </label>

          <label className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
            prefs.topics.dueloDesafios ? 'bg-teal-50/70 border-teal-300' : 'bg-slate-50 border-slate-200'
          }`}>
            <input
              type="checkbox"
              checked={prefs.topics.dueloDesafios}
              onChange={() => toggleTopic('dueloDesafios')}
              className="w-4 h-4 mt-0.5 accent-teal-700 rounded"
            />
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-900">Desafios e Duelos</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Convocação para rodadas rápidas na Arena de Duelo e atualizações do ranking mensal.
              </div>
            </div>
          </label>
        </div>
      </section>

      {/* Additional Channels & Settings */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-teal-700" />
            Canais Complementares & Configurações
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Garantia de retenção e fuso horário para suas notificações.
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.emailBackupEnabled}
              onChange={(e) => void savePreferences({ ...prefs, emailBackupEnabled: e.target.checked })}
              className="w-4 h-4 mt-0.5 accent-teal-700 rounded"
            />
            <div className="text-xs sm:text-sm">
              <span className="font-bold text-slate-800 block">
                Lembrete por E-mail em caso de inatividade (48h)
              </span>
              <span className="text-slate-600 text-xs block mt-0.5 leading-relaxed">
                Envio automático de um e-mail de retomada de estudos caso fique mais de dois dias sem registrar atividades.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.soundEnabled}
              onChange={(e) => void savePreferences({ ...prefs, soundEnabled: e.target.checked })}
              className="w-4 h-4 mt-0.5 accent-teal-700 rounded"
            />
            <div className="text-xs sm:text-sm flex items-center gap-2">
              {prefs.soundEnabled ? <Volume2 className="w-4 h-4 text-teal-700" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <div>
                <span className="font-bold text-slate-800 block">
                  Som nos Avisos do Service Worker
                </span>
                <span className="text-slate-600 text-xs block mt-0.5">
                  Tocar sinal sonoro ao exibir avisos de primeiro plano.
                </span>
              </div>
            </div>
          </label>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-100">
          <div>
            Fuso Horário do Dispositivo: <strong className="text-slate-800">{prefs.timeZone}</strong>
          </div>
          <button
            type="button"
            onClick={resetToDefaults}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 underline"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrões
          </button>
        </div>
      </section>
    </div>
  );
};
