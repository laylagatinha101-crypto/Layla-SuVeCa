import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import {
  Bolt,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  LockKeyhole,
  Medal,
  Play,
  RotateCcw,
  Timer,
  Trophy,
  XCircle,
} from 'lucide-react';
import { db, type User } from '../lib/firebase';
import {
  EDITORIAL_DUEL_QUESTIONS,
  EDITORIAL_DUEL_QUESTION_SET_VERSION,
} from '../data/editorialDuelQuestions.generated';

const ROUND_DURATION_SECONDS = 60;
const LEADERBOARD_LIMIT = 10;
const LOCAL_HISTORY_PREFIX = 'suveca_duel_history';

interface DuelOption {
  id: string;
  text: string;
}

interface DuelQuestion {
  id: string;
  prompt: string;
  options: DuelOption[];
  correctOptionId: string;
  explanation: string;
}

interface DuelRoundResult {
  id: string;
  playedAt: string;
  score: number;
  correctAnswers: number;
  answeredCount: number;
  totalResponseMs: number;
  fastestResponseMs?: number;
  /** Transcript only. The public score is recalculated by a Cloud Function. */
  answerLog?: DuelAnswerLogItem[];
}

interface DuelAnswerLogItem {
  questionId: string;
  optionId: string;
  responseMs: number;
}

interface DuelLeaderboardEntry {
  id: string;
  alias: string;
  bestScore: number;
  bestCorrectAnswers: number;
  bestResponseMs?: number;
  isCurrentUser: boolean;
}

interface DuelArenaProps {
  user?: User | null;
  onRoundComplete?: () => void;
}

const DUEL_QUESTION_SET_VERSION = EDITORIAL_DUEL_QUESTION_SET_VERSION;
const DUEL_BUILD_ID = DUEL_QUESTION_SET_VERSION.replace(/^editorial-duel-/, '');

const DUEL_QUESTIONS: DuelQuestion[] = EDITORIAL_DUEL_QUESTIONS.map((question) => ({
  id: question.id,
  prompt: question.prompt,
  options: question.options.map((option) => ({ ...option })),
  correctOptionId: question.correctOptionId,
  explanation: question.explanation,
}));

const localHistoryKey = (userId?: string) =>
  `${LOCAL_HISTORY_PREFIX}_${DUEL_BUILD_ID}_${userId || 'guest'}`;

const getMonthKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year ?? date.getUTCFullYear()}-${month ?? String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const asNonNegativeInteger = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0;
};

const asPositiveInteger = (value: unknown) => {
  const normalized = asNonNegativeInteger(value);
  return normalized > 0 ? normalized : undefined;
};

const shuffle = <T,>(values: readonly T[]) => {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [output[index], output[swapWith]] = [output[swapWith], output[index]];
  }
  return output;
};

const formatTime = (seconds: number) =>
  `00:${Math.max(0, seconds).toString().padStart(2, '0')}`;

const formatResponseTime = (milliseconds?: number) =>
  milliseconds ? `${(milliseconds / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s` : '—';

const rankStyle = (rank: number) => {
  if (rank === 1) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (rank === 2) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (rank === 3) return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-slate-50 text-slate-500 border-slate-200';
};

const readLocalHistory = (userId?: string): DuelRoundResult[] => {
  try {
    const raw = localStorage.getItem(localHistoryKey(userId));
    if (!raw) return [];
    const history = JSON.parse(raw);
    if (!Array.isArray(history)) return [];
    return history.filter((entry): entry is DuelRoundResult =>
      entry &&
      typeof entry.id === 'string' &&
      typeof entry.score === 'number' &&
      typeof entry.playedAt === 'string'
    );
  } catch {
    return [];
  }
};

/** Fast, asynchronous competitive practice: 60 seconds, grammar decisions and a score that rewards both accuracy and response time. */
export const DuelArena: React.FC<DuelArenaProps> = ({ user, onRoundComplete }) => {
  const userId = user?.uid;
  const monthKey = useMemo(() => getMonthKey(), []);
  const leaderboardKey = useMemo(() => `${monthKey}_${DUEL_BUILD_ID}`, [monthKey]);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [roundQuestions, setRoundQuestions] = useState<DuelQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_DURATION_SECONDS);
  const [timerAnnouncement, setTimerAnnouncement] = useState('');
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [shareName, setShareName] = useState(false);
  const [entries, setEntries] = useState<DuelLeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [localBestScore, setLocalBestScore] = useState(() =>
    Math.max(0, ...readLocalHistory(userId).map((entry) => entry.score))
  );
  const [finishedResult, setFinishedResult] = useState<DuelRoundResult | null>(null);
  const questionStartedAt = useRef(Date.now());
  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  const answeredRef = useRef(0);
  const totalResponseMsRef = useRef(0);
  const fastestResponseMsRef = useRef<number | undefined>(undefined);
  const answerLogRef = useRef<DuelAnswerLogItem[]>([]);
  const hasFinishedRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);

  const currentQuestion = roundQuestions[currentIndex];

  useEffect(() => {
    setLocalBestScore(Math.max(0, ...readLocalHistory(userId).map((entry) => entry.score)));
  }, [userId]);

  useEffect(() => {
    let isCurrent = true;
    if (!userId) {
      setShareName(false);
      return () => {
        isCurrent = false;
      };
    }

    void getDoc(doc(db, 'users', userId, 'data', 'leaderboard_preferences'))
      .then((snapshot) => {
        if (isCurrent) setShareName(snapshot.data()?.shareFirstName === true);
      })
      .catch(() => {
        if (isCurrent) setShareName(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setIsLoadingLeaderboard(false);
      setLeaderboardError(null);
      return;
    }

    setIsLoadingLeaderboard(true);
    setLeaderboardError(null);
    const leaderboardQuery = query(
      collection(db, 'duel_leaderboards', leaderboardKey, 'entries'),
      orderBy('bestScore', 'desc'),
      limit(LEADERBOARD_LIMIT)
    );

    return onSnapshot(
      leaderboardQuery,
      (snapshot) => {
        const nextEntries = snapshot.docs
          .map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              alias:
                typeof data.alias === 'string' && data.alias.trim()
                  ? data.alias.trim().slice(0, 32)
                  : 'Estudante SuVeCA',
              bestScore: asNonNegativeInteger(data.bestScore),
              bestCorrectAnswers: asNonNegativeInteger(data.bestCorrectAnswers),
              bestResponseMs: asPositiveInteger(data.bestResponseMs),
              isCurrentUser: entry.id === userId,
            };
          })
          .sort(
            (first, second) =>
              second.bestScore - first.bestScore ||
              second.bestCorrectAnswers - first.bestCorrectAnswers ||
              (first.bestResponseMs || Number.MAX_SAFE_INTEGER) -
                (second.bestResponseMs || Number.MAX_SAFE_INTEGER)
          );
        setEntries(nextEntries);
        setIsLoadingLeaderboard(false);
      },
      (error) => {
        console.error('Não foi possível carregar o placar do duelo:', error);
        setLeaderboardError('Não foi possível carregar o placar agora.');
        setIsLoadingLeaderboard(false);
      }
    );
  }, [leaderboardKey, userId]);

  const persistRound = useCallback(
    async (result: DuelRoundResult) => {
      const previousHistory = readLocalHistory(userId);
      const nextHistory = [result, ...previousHistory].slice(0, 30);
      localStorage.setItem(localHistoryKey(userId), JSON.stringify(nextHistory));
      setLocalBestScore(Math.max(...nextHistory.map((entry) => entry.score)));

      if (!userId || !result.answerLog?.length) return;

      setIsSavingScore(true);
      try {
        // Totals calculated in the browser stay local feedback only. The
        // server receives a compact transcript and derives the public score.
        await setDoc(doc(db, 'users', userId, 'duel_submissions', result.id), {
          schemaVersion: 1,
          questionSetVersion: DUEL_QUESTION_SET_VERSION,
          answerLog: result.answerLog,
          clientFinishedAt: result.playedAt,
        });
      } catch (error) {
        console.error('Não foi possível salvar o resultado do duelo:', error);
        setLeaderboardError('Seu resultado ficou salvo neste aparelho, mas não entrou no placar agora.');
      } finally {
        setIsSavingScore(false);
      }
    },
    [userId]
  );

  const finishRound = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);

    const result: DuelRoundResult = {
      id: `duel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      playedAt: new Date().toISOString(),
      score: scoreRef.current,
      correctAnswers: correctRef.current,
      answeredCount: answeredRef.current,
      totalResponseMs: totalResponseMsRef.current,
      fastestResponseMs: fastestResponseMsRef.current,
      answerLog: [...answerLogRef.current],
    };
    setFinishedResult(result);
    setPhase('finished');
    onRoundComplete?.();
    void persistRound(result);
  }, [onRoundComplete, persistRound]);

  useEffect(() => {
    if (phase !== 'playing') return;
    if (secondsLeft <= 0) {
      finishRound();
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [finishRound, phase, secondsLeft]);

  useEffect(() => {
    if (phase === 'playing' && [30, 10, 5, 0].includes(secondsLeft)) {
      setTimerAnnouncement(secondsLeft === 0 ? 'Tempo encerrado.' : `${secondsLeft} segundos restantes.`);
    }
  }, [phase, secondsLeft]);

  const startRound = useCallback(() => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    hasFinishedRef.current = false;
    scoreRef.current = 0;
    correctRef.current = 0;
    answeredRef.current = 0;
    totalResponseMsRef.current = 0;
    fastestResponseMsRef.current = undefined;
    answerLogRef.current = [];
    setRoundQuestions(shuffle(DUEL_QUESTIONS));
    setCurrentIndex(0);
    setSecondsLeft(ROUND_DURATION_SECONDS);
    setScore(0);
    setCorrectAnswers(0);
    setAnsweredCount(0);
    setSelectedOptionId(null);
    setLastAnswerCorrect(null);
    setFinishedResult(null);
    questionStartedAt.current = Date.now();
    setPhase('playing');
  }, []);

  const selectOption = useCallback(
    (optionId: string) => {
      if (phase !== 'playing' || !currentQuestion || selectedOptionId) return;

      const responseMs = Math.max(0, Date.now() - questionStartedAt.current);
      const isCorrect = optionId === currentQuestion.correctOptionId;
      const speedBonus = Math.max(0, 100 - Math.floor(responseMs / 100));
      const earnedPoints = isCorrect ? 100 + speedBonus : 0;

      answeredRef.current += 1;
      totalResponseMsRef.current += responseMs;
      fastestResponseMsRef.current = Math.min(
        fastestResponseMsRef.current ?? Number.MAX_SAFE_INTEGER,
        responseMs
      );
      answerLogRef.current.push({
        questionId: currentQuestion.id,
        optionId,
        responseMs,
      });
      if (isCorrect) {
        correctRef.current += 1;
        scoreRef.current += earnedPoints;
      }

      setSelectedOptionId(optionId);
      setLastAnswerCorrect(isCorrect);
      setAnsweredCount(answeredRef.current);
      setCorrectAnswers(correctRef.current);
      setScore(scoreRef.current);

      advanceTimerRef.current = window.setTimeout(() => {
        if (hasFinishedRef.current) return;
        if (currentIndex >= roundQuestions.length - 1) {
          finishRound();
          return;
        }
        setCurrentIndex((current) => {
          return current + 1;
        });
        setSelectedOptionId(null);
        setLastAnswerCorrect(null);
        questionStartedAt.current = Date.now();
      }, 650);
    },
    [currentIndex, currentQuestion, finishRound, phase, roundQuestions.length, selectedOptionId]
  );

  const updateShareName = useCallback(
    async (nextValue: boolean) => {
      setShareName(nextValue);
      if (!userId) return;
      try {
        await setDoc(
          doc(db, 'users', userId, 'data', 'leaderboard_preferences'),
          { shareFirstName: nextValue, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      } catch (error) {
        console.error('Não foi possível atualizar a privacidade do placar:', error);
        setShareName(!nextValue);
      }
    },
    [userId]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (phase !== 'playing' || !currentQuestion || selectedOptionId) return;
      const index = Number(event.key) - 1;
      if (index < 0 || index >= currentQuestion.options.length) return;
      event.preventDefault();
      selectOption(currentQuestion.options[index].id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, phase, selectOption, selectedOptionId]);

  useEffect(() => () => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
  }, []);

  const accuracy = answeredCount ? Math.round((correctAnswers / answeredCount) * 100) : 0;
  const averageResponse = finishedResult && finishedResult.answeredCount
    ? Math.round(finishedResult.totalResponseMs / finishedResult.answeredCount)
    : undefined;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <header className="bg-slate-950 text-white rounded-2xl p-6 sm:p-8 overflow-hidden relative border border-slate-800 shadow-xs">
        <div className="absolute -right-10 -top-12 w-48 h-48 rounded-full bg-teal-400/15 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-100 bg-teal-400/15 border border-teal-300/30 px-3 py-1 rounded-full">
              <Bolt className="w-3.5 h-3.5 text-teal-300" />
              Modo competitivo
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">Duelo SuVeCA</h1>
            <p className="mt-2 text-sm text-slate-300 max-w-xl leading-relaxed">
              Resolva itens da base editorial antes do relógio zerar. Acerto e velocidade formam sua pontuação.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/15 px-5 py-3 text-center shrink-0">
            <div className="text-2xl font-black">{localBestScore}</div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-teal-200">melhor local</div>
          </div>
        </div>
      </header>

      <section className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-xs">
        {phase === 'idle' && (
          <div className="text-center max-w-xl mx-auto py-4 sm:py-8">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 mx-auto flex items-center justify-center">
              <Timer className="w-7 h-7" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">60 segundos de revisão editorial</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Cada acerto vale 100 pontos, mais um bônus de até 100 pela resposta rápida. Você pode usar as teclas 1–4 para responder.
            </p>
            <button onClick={startRound} className="button-primary mt-6 min-h-12 px-6">
              <Play className="w-4 h-4" />
              Iniciar duelo
            </button>
          </div>
        )}

        {phase === 'playing' && currentQuestion && (
          <div className="space-y-5 question-content-enter">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl px-3 py-2 border font-black tabular-nums ${
                  secondsLeft <= 10
                    ? 'bg-rose-50 text-rose-800 border-rose-200 motion-safe:animate-pulse'
                    : 'bg-slate-50 text-slate-900 border-slate-200'
                }`} role="timer" aria-live="off" aria-label={`${secondsLeft} segundos restantes`}>
                  <Clock className="w-4 h-4 inline mr-1.5 align-[-2px]" />
                  {formatTime(secondsLeft)}
                </div>
                <span className="sr-only" aria-live="polite">{timerAnnouncement}</span>
                <span className="text-xs font-semibold text-slate-500">Questão {currentIndex + 1}</span>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <div className="text-lg leading-none font-black text-teal-800">{score}</div>
                  <div className="text-[10px] uppercase tracking-wide font-bold text-slate-500">pontos</div>
                </div>
                <div>
                  <div className="text-lg leading-none font-black text-slate-900">{correctAnswers}</div>
                  <div className="text-[10px] uppercase tracking-wide font-bold text-slate-500">acertos</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 sm:p-7">
              <p className="text-base sm:text-xl font-bold text-slate-900 leading-relaxed">{currentQuestion.prompt}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Alternativas da questão">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedOptionId === option.id;
                const isCorrect = option.id === currentQuestion.correctOptionId;
                const feedbackClass = selectedOptionId
                  ? isCorrect
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : isSelected
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-white border-slate-200 text-slate-500 opacity-70'
                  : 'bg-white border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-slate-800';

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectOption(option.id)}
                    disabled={selectedOptionId !== null}
                    className={`min-h-14 rounded-xl border p-3 text-left flex items-center gap-3 transition font-semibold text-sm disabled:cursor-default ${feedbackClass}`}
                  >
                    <span className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-black">
                      {index + 1}
                    </span>
                    <span>{option.text}</span>
                  </button>
                );
              })}
            </div>

            {selectedOptionId && (
              <div className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${
                lastAnswerCorrect
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`} aria-live="polite">
                {lastAnswerCorrect ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{currentQuestion.explanation}</span>
              </div>
            )}
          </div>
        )}

        {phase === 'finished' && finishedResult && (
          <div className="text-center max-w-2xl mx-auto py-2 sm:py-5 tab-content-enter">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 mx-auto flex items-center justify-center">
              <Trophy className="w-7 h-7" />
            </div>
            <h2 className="mt-4 text-xl sm:text-2xl font-black text-slate-900">Tempo esgotado!</h2>
            <p className="mt-1 text-sm text-slate-600">Seu resultado já foi registrado para a sequência diária de estudos.</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 text-left">
              {[
                { label: 'Pontuação', value: finishedResult.score },
                { label: 'Acertos', value: finishedResult.correctAnswers },
                { label: 'Precisão', value: `${accuracy}%` },
                { label: 'Tempo médio', value: formatResponseTime(averageResponse) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="text-lg font-black text-slate-900">{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-wide font-bold text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>

            <button onClick={startRound} className="button-primary mt-6 min-h-12 px-6">
              <RotateCcw className="w-4 h-4" />
              Jogar novamente
            </button>
            {isSavingScore && <p className="text-xs text-teal-700 font-semibold mt-3">Atualizando placar...</p>}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-800 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full">
              <Trophy className="w-3.5 h-3.5" />
              Placar do mês
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Os mais rápidos no Duelo</h2>
            <p className="mt-1 text-sm text-slate-500">Classificação por pontos, acertos e melhor tempo de resposta.</p>
          </div>
          {user && (
            <label className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-start gap-2 cursor-pointer max-w-xs">
              <input
                type="checkbox"
                checked={shareName}
                onChange={(event) => void updateShareName(event.target.checked)}
                className="mt-0.5 w-4 h-4 accent-teal-700"
              />
              <span className="text-xs text-slate-600 leading-relaxed">Mostrar meu primeiro nome no próximo resultado.</span>
            </label>
          )}
        </div>

        {!user ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex items-start gap-3 text-sm text-slate-600">
            <LockKeyhole className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <p>Entre na sua conta para publicar resultados e acompanhar o placar mensal. Seu melhor local continua salvo neste aparelho.</p>
          </div>
        ) : leaderboardError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{leaderboardError}</div>
        ) : isLoadingLeaderboard ? (
          <div className="space-y-2" aria-label="Carregando placar">
            {[0, 1, 2].map((item) => <div key={item} className="h-14 rounded-xl bg-slate-100 motion-safe:animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Seja a primeira pessoa a registrar um duelo neste mês.</div>
        ) : (
          <ol className="space-y-2" aria-label="Classificação do duelo">
            {entries.map((entry, index) => {
              const rank = index + 1;
              return (
                <li key={entry.id} className={`rounded-xl border p-3.5 flex items-center gap-3 ${entry.isCurrentUser ? 'bg-teal-50 border-teal-200' : 'bg-white border-slate-200'}`}>
                  <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black ${rankStyle(rank)}`}>
                    {rank === 1 ? <Crown className="w-4 h-4" /> : rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-slate-900 truncate">{entry.alias}{entry.isCurrentUser ? ' (você)' : ''}</div>
                    <div className="text-xs text-slate-500">{entry.bestCorrectAnswers} acerto(s) · melhor resposta {formatResponseTime(entry.bestResponseMs)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-teal-800 font-black text-lg">
                    {rank <= 3 && <Medal className="w-4 h-4 text-amber-600" />}
                    {entry.bestScore}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <p className="text-center text-xs text-slate-700 flex items-center justify-center gap-1.5">
        <Flame className="w-3.5 h-3.5 text-orange-600" />
        O Duelo conta como atividade de estudo concluída para sua sequência diária.
      </p>
    </div>
  );
};
