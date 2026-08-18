import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  Coffee,
  CheckCircle2,
  Sparkles,
  Maximize2,
  Minimize2,
  Clock,
  History,
  Trash2,
  Plus,
  BookOpen,
  Target,
  PenLine,
  X,
  Flame,
} from 'lucide-react';
import { MODULES_DATA } from '../data/modulesData';
import type { PomodoroSession } from '../types/suveca';
import type { User } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type PomodoroMode = 'foco' | 'pausa_curta' | 'pausa_longa';

interface PomodoroTimerProps {
  selectedModuleId?: string;
  onCompleteSession?: (session: PomodoroSession) => void;
  user?: User | null;
  onAskTutor?: (context: string) => void;
  isFloatingInitially?: boolean;
  onExpandTab?: () => void;
}

const DEFAULT_DURATIONS: Record<PomodoroMode, number> = {
  foco: 25,
  pausa_curta: 5,
  pausa_longa: 15,
};

const MODE_LABELS: Record<PomodoroMode, { title: string; subtitle: string; colorClass: string; borderClass: string; bgBadge: string }> = {
  foco: {
    title: 'Sessão de Foco',
    subtitle: 'Concentre-se em um tópico sem interrupções',
    colorClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    bgBadge: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  pausa_curta: {
    title: 'Pausa Curta',
    subtitle: 'Descanse a mente, beba água ou se espreguice',
    colorClass: 'text-teal-700',
    borderClass: 'border-teal-200',
    bgBadge: 'bg-teal-100 text-teal-900 border-teal-300',
  },
  pausa_longa: {
    title: 'Pausa Longa',
    subtitle: 'Intervalo prolongado para renovar a energia',
    colorClass: 'text-sky-700',
    borderClass: 'border-sky-200',
    bgBadge: 'bg-sky-100 text-sky-900 border-sky-300',
  },
};

const FOCUS_PRESETS = [15, 25, 30, 45, 60];

const storageKeyFor = (userId?: string | null) =>
  userId ? `suveca_pomodoro_history_${userId}` : 'suveca_pomodoro_history_guest';

const readStoredSessions = (userId?: string | null): PomodoroSession[] => {
  try {
    const raw = localStorage.getItem(storageKeyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Plays a gentle synthesized double-chime using Web Audio API */
export const playPomodoroChime = () => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    // First pitch: C5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Second pitch: E5
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.2);
    gain2.gain.setValueAtTime(0.25, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.85);
  } catch (err) {
    console.warn('Efeito sonoro do Pomodoro indisponível:', err);
  }
};

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  selectedModuleId = 'mod0',
  onCompleteSession,
  user,
  onAskTutor,
  isFloatingInitially = false,
  onExpandTab,
}) => {
  const [mode, setMode] = useState<PomodoroMode>('foco');
  const [durations, setDurations] = useState<Record<PomodoroMode, number>>(DEFAULT_DURATIONS);
  const [timeLeft, setTimeLeft] = useState<number>(DEFAULT_DURATIONS.foco * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(isFloatingInitially);

  // Topic selection state
  const selectedModule = MODULES_DATA.find((m) => m.id === selectedModuleId) || MODULES_DATA[0];
  const [selectedTopicModuleId, setSelectedTopicModuleId] = useState<string>(selectedModule.id);
  const [customTopicName, setCustomTopicName] = useState<string>('');
  const [useCustomTopic, setUseCustomTopic] = useState<boolean>(false);

  // Session Note Modal state
  const [pendingCompletion, setPendingCompletion] = useState<{
    completedMode: PomodoroMode;
    completedTopic: string;
    completedModuleId?: string;
    completedMinutes: number;
  } | null>(null);
  const [completionNote, setCompletionNote] = useState<string>('');

  // History state
  const currentUserId = user?.uid || null;
  const [sessions, setSessions] = useState<PomodoroSession[]>(() =>
    readStoredSessions(currentUserId)
  );

  // Timer Ref for drift-free countdown
  const targetEndTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Determine current display topic name
  const currentTopic = useCustomTopic
    ? customTopicName.trim() || 'Estudo Livre'
    : MODULES_DATA.find((m) => m.id === selectedTopicModuleId)?.title || 'Método SuVeCA';

  // Load cloud sessions on login
  useEffect(() => {
    const local = readStoredSessions(currentUserId);
    setSessions(local);

    if (!currentUserId) return;

    const loadCloudSessions = async () => {
      try {
        const ref = doc(db, 'users', currentUserId, 'data', 'pomodoro_sessions');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const items = snap.data()?.items;
          if (Array.isArray(items)) {
            setSessions(items as PomodoroSession[]);
            localStorage.setItem(storageKeyFor(currentUserId), JSON.stringify(items));
          }
        }
      } catch (err) {
        console.error('Erro ao carregar histórico Pomodoro do Firestore:', err);
      }
    };
    void loadCloudSessions();
  }, [currentUserId]);

  // Sync sessions to storage
  const saveSessions = useCallback(
    (newSessions: PomodoroSession[]) => {
      setSessions(newSessions);
      localStorage.setItem(storageKeyFor(currentUserId), JSON.stringify(newSessions));

      if (currentUserId) {
        const ref = doc(db, 'users', currentUserId, 'data', 'pomodoro_sessions');
        void setDoc(ref, {
          items: newSessions,
          updatedAt: new Date().toISOString(),
        }).catch((err) => console.error('Erro ao sincronizar histórico Pomodoro:', err));
      }
    },
    [currentUserId]
  );

  // Update time when mode or configured duration changes and timer is paused
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(durations[mode] * 60);
    }
  }, [mode, durations, isRunning]);

  // Handle completion trigger
  const handleTimerFinished = useCallback(() => {
    setIsRunning(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    targetEndTimeRef.current = null;

    if (soundEnabled) {
      playPomodoroChime();
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Sessão Pomodoro Concluída! 🎉', {
          body: `Você concluiu ${durations[mode]} min de ${MODE_LABELS[mode].title.toLowerCase()} em "${currentTopic}".`,
          icon: '/favicon.ico',
        });
      } catch {
        // Ignore notification constructor errors
      }
    }

    if (mode === 'foco') {
      setIsMinimized(false);
      setPendingCompletion({
        completedMode: mode,
        completedTopic: currentTopic,
        completedModuleId: useCustomTopic ? undefined : selectedTopicModuleId,
        completedMinutes: durations.foco,
      });
    }
  }, [durations, mode, currentTopic, useCustomTopic, selectedTopicModuleId, soundEnabled]);

  // Interval Tick
  useEffect(() => {
    if (!isRunning) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    if (!targetEndTimeRef.current) {
      targetEndTimeRef.current = Date.now() + timeLeft * 1000;
    }

    timerIntervalRef.current = window.setInterval(() => {
      if (!targetEndTimeRef.current) return;
      const remainingMs = targetEndTimeRef.current - Date.now();
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0) {
        handleTimerFinished();
      }
    }, 500);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRunning, timeLeft, handleTimerFinished]);

  // Control Handlers
  const togglePlay = () => {
    if (isRunning) {
      setIsRunning(false);
      targetEndTimeRef.current = null;
    } else {
      if (timeLeft <= 0) {
        setTimeLeft(durations[mode] * 60);
      }
      targetEndTimeRef.current = Date.now() + (timeLeft > 0 ? timeLeft : durations[mode] * 60) * 1000;
      setIsRunning(true);

      // Request notification permission on first play
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    targetEndTimeRef.current = null;
    setTimeLeft(durations[mode] * 60);
  };

  const handleSkip = () => {
    setIsRunning(false);
    targetEndTimeRef.current = null;
    if (mode === 'foco') {
      setMode('pausa_curta');
    } else if (mode === 'pausa_curta') {
      setMode('foco');
    } else {
      setMode('foco');
    }
  };

  const handleSetDuration = (minutes: number) => {
    setDurations((prev) => ({ ...prev, [mode]: minutes }));
    if (!isRunning) {
      setTimeLeft(minutes * 60);
    }
  };

  const handleSaveCompletion = () => {
    if (!pendingCompletion) return;

    const newSession: PomodoroSession = {
      id: `pomo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      topic: pendingCompletion.completedTopic,
      moduleId: pendingCompletion.completedModuleId,
      mode: pendingCompletion.completedMode,
      durationMinutes: pendingCompletion.completedMinutes,
      completedAt: new Date().toISOString(),
      note: completionNote.trim() || undefined,
    };

    const updated = [newSession, ...sessions];
    saveSessions(updated);

    if (onCompleteSession) {
      onCompleteSession(newSession);
    }

    setPendingCompletion(null);
    setCompletionNote('');

    // Switch to short break automatically after logging focus session
    setMode('pausa_curta');
  };

  const handleDeleteSession = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id);
    saveSessions(updated);
  };

  // Metrics
  const totalSeconds = durations[mode] * 60;
  const progressPercent = totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - timeLeft) / totalSeconds) * 100)) : 0;
  const formattedMinutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const formattedSeconds = String(timeLeft % 60).padStart(2, '0');

  const todayStr = new Date().toLocaleDateString('pt-BR');
  const todaySessions = sessions.filter(
    (s) => new Date(s.completedAt).toLocaleDateString('pt-BR') === todayStr && s.mode === 'foco'
  );
  const totalFocusMinutesToday = todaySessions.reduce((acc, s) => acc + s.durationMinutes, 0);

  // If floating mini widget
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-20 right-4 z-40 flex items-center gap-3 rounded-full border border-amber-300 bg-amber-950/90 text-amber-50 px-4 py-2.5 shadow-xl backdrop-blur-md transition-all hover:bg-amber-950 sm:bottom-6 sm:right-6"
        role="region"
        aria-label="Cronômetro Pomodoro em mini-painel"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {isRunning && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                isRunning ? 'bg-amber-400' : 'bg-slate-400'
              }`}
            />
          </span>
          <span className="font-mono text-base font-bold tracking-wider text-amber-300">
            {formattedMinutes}:{formattedSeconds}
          </span>
        </div>

        <div className="hidden max-w-[140px] truncate text-xs text-amber-200 sm:block">
          {currentTopic}
        </div>

        <button
          type="button"
          onClick={togglePlay}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-amber-950 hover:bg-amber-400 transition-colors"
          title={isRunning ? 'Pausar' : 'Iniciar'}
        >
          {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsMinimized(false);
            if (onExpandTab) onExpandTab();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-amber-300 hover:bg-amber-800/60 transition-colors"
          title="Expandir Cronômetro"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex flex-wrap items-center gap-2">
              Cronômetro de Foco Pomodoro
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Técnica SuVeCA
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Gerencie sessões de estudo focadas em tópicos gramaticais e descanse a mente em intervalos programados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
              soundEnabled
                ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                : 'border-slate-200 bg-slate-100 text-slate-400'
            }`}
            title={soundEnabled ? 'Sons ativados' : 'Sons desativados'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-amber-600" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Som LIG' : 'Som DES'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            title="Minimizar para mini-painel flutuante"
          >
            <Minimize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Minimizar</span>
          </button>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1.5">
        <button
          type="button"
          onClick={() => {
            setMode('foco');
            setIsRunning(false);
          }}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs sm:text-sm font-semibold transition-all ${
            mode === 'foco'
              ? 'bg-amber-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Target className="h-4 w-4" />
          <span>Foco ({durations.foco}m)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('pausa_curta');
            setIsRunning(false);
          }}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs sm:text-sm font-semibold transition-all ${
            mode === 'pausa_curta'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Coffee className="h-4 w-4" />
          <span>Pausa Curta ({durations.pausa_curta}m)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('pausa_longa');
            setIsRunning(false);
          }}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs sm:text-sm font-semibold transition-all ${
            mode === 'pausa_longa'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Pausa Longa ({durations.pausa_longa}m)</span>
        </button>
      </div>

      {/* Main Timer Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left / Center Timer Circle Display */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 border border-slate-200 relative overflow-hidden">
          {/* Progress ring background */}
          <div className="relative flex items-center justify-center my-2">
            <svg className="h-56 w-56 sm:h-64 sm:w-64 -rotate-90 transform" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="52"
                className="stroke-slate-200"
                strokeWidth="7"
                fill="none"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                className={`transition-all duration-500 ${
                  mode === 'foco'
                    ? 'stroke-amber-500'
                    : mode === 'pausa_curta'
                    ? 'stroke-teal-500'
                    : 'stroke-sky-500'
                }`}
                strokeWidth="7"
                strokeDasharray="326.72"
                strokeDashoffset={326.72 - (326.72 * progressPercent) / 100}
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            {/* Central Time Text */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-slate-900">
                {formattedMinutes}:{formattedSeconds}
              </span>
              <span className={`mt-1 rounded-full px-3 py-0.5 text-xs font-bold ${MODE_LABELS[mode].bgBadge}`}>
                {MODE_LABELS[mode].title}
              </span>
            </div>
          </div>

          {/* Preset time quick buttons for current mode */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-slate-500 font-medium mr-1">Duração:</span>
            {FOCUS_PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => handleSetDuration(mins)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  durations[mode] === mins
                    ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {mins} min
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Reiniciar cronômetro"
            >
              <RotateCcw className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className={`flex h-14 min-w-[150px] items-center justify-center gap-2 rounded-xl text-base font-bold text-white shadow-md transition-all active:scale-95 ${
                isRunning
                  ? 'bg-slate-800 hover:bg-slate-900'
                  : mode === 'foco'
                  ? 'bg-amber-700 hover:bg-amber-800'
                  : mode === 'pausa_curta'
                  ? 'bg-teal-700 hover:bg-teal-800'
                  : 'bg-sky-700 hover:bg-sky-800'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="h-5 w-5 fill-current" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 fill-current ml-1" />
                  <span>Iniciar Foco</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Pular para o próximo modo"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Right Column: Topic Configuration & Today's Summary */}
        <div className="lg:col-span-5 space-y-5">
          {/* Topic Selector Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-amber-600" />
              <span>Tópico em Estudo</span>
            </label>

            {!useCustomTopic ? (
              <div className="space-y-2">
                <select
                  aria-label="Tópico em estudo"
                  value={selectedTopicModuleId}
                  onChange={(e) => setSelectedTopicModuleId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {MODULES_DATA.filter((module) => /^mod\d+$/.test(module.id)).map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setUseCustomTopic(true)}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Digitar tópico personalizado...</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customTopicName}
                  onChange={(e) => setCustomTopicName(e.target.value)}
                  placeholder="Ex: Exercícios de Crase - Banca FCC"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setUseCustomTopic(false)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-800 hover:underline"
                >
                  ← Selecionar das aulas da apostila
                </button>
              </div>
            )}
          </div>

          {/* Today's Focus Metrics */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 font-bold">
                <Flame className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-amber-900">Total Focado Hoje</div>
                <div className="text-lg font-extrabold text-amber-950">
                  {totalFocusMinutesToday} min{' '}
                  <span className="text-xs font-normal text-amber-800">
                    ({todaySessions.length} {todaySessions.length === 1 ? 'ciclo' : 'ciclos'})
                  </span>
                </div>
              </div>
            </div>

            {onAskTutor && (
              <button
                type="button"
                onClick={() =>
                  onAskTutor(`Gostaria de uma orientação do Professor SuVeCA para planejar meu ciclo de estudos focado no tópico: "${currentTopic}".`)
                }
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors shrink-0"
              >
                Pedir Dica de Foco
              </button>
            )}
          </div>

          {/* Recent History Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-slate-500" />
                <span>Histórico de Sessões Recentes</span>
              </span>
              <span className="text-xs text-slate-500">{sessions.length} registradas</span>
            </div>

            {sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                Nenhuma sessão registrada ainda. Inicie um ciclo de foco para guardar seu progresso!
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {sessions.slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>{session.topic}</span>
                      </div>
                      <div className="text-slate-500 flex items-center gap-2">
                        <span>{new Date(session.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span className="font-bold text-amber-800">{session.durationMinutes} min</span>
                        {session.note && <span className="italic text-slate-600 truncate max-w-[150px]">"{session.note}"</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSession(session.id)}
                      className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                      title="Excluir do histórico"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post-Session Modal: Record Study Note */}
      {pendingCompletion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-bold">
                  <CheckCircle2 className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Ciclo de Foco Concluído!</h3>
                  <p className="text-xs text-slate-500">
                    {pendingCompletion.completedMinutes} minutos de estudo dedicado em "{pendingCompletion.completedTopic}".
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPendingCompletion(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                <PenLine className="h-3.5 w-3.5 text-amber-600" />
                <span>Nota da Sessão (Opcional)</span>
              </label>
              <textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                placeholder="Ex: Revisei 12 exemplos de regência verbal e fixei a regra decisiva do verbo visar."
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveCompletion}
                className="w-full rounded-xl bg-amber-700 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-amber-800 transition-colors"
              >
                Salvar Sessão e Ir para Pausa
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
