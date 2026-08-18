import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Sparkles,
  Target,
} from 'lucide-react';
import type { CadernoErroItem, ErrorFlashcard } from '../types/suveca';
import { db } from '../lib/firebase';
import { ProgressBar } from './ui/ProgressBar';
import { EDITORIAL_FLASHCARDS } from '../data/editorialFlashcards.generated';
import { PEDAGOGICAL_KNOWLEDGE_BUILD } from '../data/pedagogicalKnowledge.generated';

const FLASHCARDS_STORAGE_PREFIX = 'suveca_flashcards';
const AGENDA_STORAGE_PREFIX = 'suveca_daily_review_agenda';
const CURRICULUM_BUILD_ID = PEDAGOGICAL_KNOWLEDGE_BUILD.buildId;
const flashcardsDocumentId = `flashcards_caderno_${CURRICULUM_BUILD_ID}`;
const agendaDocumentId = `daily_review_agenda_${CURRICULUM_BUILD_ID}`;

const storageScope = (userId?: string) => userId || 'guest';
const flashcardsStorageKey = (userId?: string) =>
  `${FLASHCARDS_STORAGE_PREFIX}_${CURRICULUM_BUILD_ID}_${storageScope(userId)}`;
const legacyFlashcardsStorageKey = (userId?: string) =>
  `${FLASHCARDS_STORAGE_PREFIX}_${storageScope(userId)}`;
const agendaStorageKey = (userId?: string) =>
  `${AGENDA_STORAGE_PREFIX}_${CURRICULUM_BUILD_ID}_${storageScope(userId)}`;

interface DailyReviewProgress {
  curriculumBuildId: string;
  day: string;
  completedCount: number;
  goal: number;
  updatedAt?: string;
}

interface DailyReviewDashboardProps {
  errors: CadernoErroItem[];
  userId?: string;
  onOpenErrors: () => void;
}

const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const emptyProgress = (): DailyReviewProgress => ({
  curriculumBuildId: CURRICULUM_BUILD_ID,
  day: dayKey(),
  completedCount: 0,
  goal: 10,
});

const normalizeProgress = (value: unknown): DailyReviewProgress => {
  const fallback = emptyProgress();
  if (!value || typeof value !== 'object') return fallback;

  const candidate = value as Partial<DailyReviewProgress>;
  if (candidate.curriculumBuildId !== CURRICULUM_BUILD_ID) return fallback;
  const validGoal =
    typeof candidate.goal === 'number' && [5, 10, 15, 20].includes(candidate.goal)
      ? candidate.goal
      : fallback.goal;
  const isCurrentDay = candidate.day === fallback.day;

  return {
    curriculumBuildId: CURRICULUM_BUILD_ID,
    day: fallback.day,
    completedCount:
      isCurrentDay && typeof candidate.completedCount === 'number'
        ? Math.max(0, Math.floor(candidate.completedCount))
        : 0,
    goal: validGoal,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
  };
};

const readLocalProgress = (userId?: string) => {
  try {
    const saved = localStorage.getItem(agendaStorageKey(userId));
    return saved ? normalizeProgress(JSON.parse(saved)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
};

const isFlashcard = (value: unknown): value is ErrorFlashcard => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ErrorFlashcard>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.front === 'string' &&
    typeof candidate.back === 'string' &&
    (candidate.source === 'caderno' || candidate.source === 'suveca')
  );
};

const EDITORIAL_CARDS: ErrorFlashcard[] = EDITORIAL_FLASHCARDS.map((card) => ({
  id: card.id,
  source: 'suveca',
  topic: card.topic,
  front: card.front,
  back: card.back,
  hint: card.hint,
  explanation: card.explanation,
  sourceRefs: [...card.sourceRefs],
  createdAt: card.createdAt,
  correctCount: card.correctCount,
  incorrectCount: card.incorrectCount,
}));
const EDITORIAL_CARD_IDS = new Set(EDITORIAL_CARDS.map((card) => card.id));

const normalizeCards = (value: unknown): ErrorFlashcard[] => {
  const saved = Array.isArray(value)
    ? value
        .filter(isFlashcard)
        .filter((card) => card.source === 'caderno' || EDITORIAL_CARD_IDS.has(card.id))
    : [];
  const savedById = new Map(saved.map((card) => [card.id, card]));
  const editorial = EDITORIAL_CARDS.map((card) => {
    const progress = savedById.get(card.id);
    return {
      ...card,
      hintUsedCount: progress?.hintUsedCount,
      lastReviewUsedHint: progress?.lastReviewUsedHint,
      lastReviewedAt: progress?.lastReviewedAt,
      nextReviewAt: progress?.nextReviewAt,
      correctCount: progress?.correctCount ?? card.correctCount,
      incorrectCount: progress?.incorrectCount ?? card.incorrectCount,
      repetitions: progress?.repetitions,
      intervalDays: progress?.intervalDays,
      easeFactor: progress?.easeFactor,
      lapseCount: progress?.lapseCount,
      lastRating: progress?.lastRating,
      masteryScore: progress?.masteryScore,
    };
  });
  const caderno = Array.from(
    new Map(
      saved
        .filter((card) => card.source === 'caderno')
        .map((card) => [card.id, card] as const)
    ).values()
  );
  return [...editorial, ...caderno];
};

const readLocalCards = (userId?: string) => {
  try {
    const saved = localStorage.getItem(flashcardsStorageKey(userId));
    if (saved) {
      const parsed = JSON.parse(saved) as { curriculumBuildId?: unknown; items?: unknown };
      if (parsed?.curriculumBuildId === CURRICULUM_BUILD_ID) return normalizeCards(parsed.items);
    }
    const legacy = localStorage.getItem(legacyFlashcardsStorageKey(userId));
    const parsedLegacy = legacy ? (JSON.parse(legacy) as unknown) : [];
    const legacyItems = Array.isArray(parsedLegacy)
      ? parsedLegacy
      : parsedLegacy && typeof parsedLegacy === 'object' && Array.isArray((parsedLegacy as { items?: unknown }).items)
      ? (parsedLegacy as { items: unknown[] }).items
      : [];
    return normalizeCards(legacyItems.filter(isFlashcard).filter((card) => card.source === 'caderno'));
  } catch {
    return EDITORIAL_CARDS;
  }
};

const isDue = (card: ErrorFlashcard, now: number) => {
  if (!card.nextReviewAt) return true;
  const reviewDate = Date.parse(card.nextReviewAt);
  return Number.isNaN(reviewDate) || reviewDate <= now;
};

const formatReviewTime = (value?: string) => {
  if (!value) return 'Sem revisão agendada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Disponível agora';

  const today = dayKey();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const prefix =
    dayKey(date) === today
      ? 'Hoje'
      : dayKey(date) === dayKey(tomorrowDate)
      ? 'Amanhã'
      : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  return `${prefix}, ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

const statusLabel = (status: CadernoErroItem['status']) => {
  const labels: Record<CadernoErroItem['status'], string> = {
    dia0: 'Dia 0',
    dia1: 'Dia 1',
    dia7: 'Dia 7',
    dia30: 'Dia 30',
    dominado: 'Dominado',
  };
  return labels[status];
};

/**
 * A single, low-friction agenda for the revision work that already exists in
 * the Caderno. Card schedules remain owned by FlashcardPractice; this screen
 * only aggregates them and stores the learner's daily goal progress.
 */
export const DailyReviewDashboard: React.FC<DailyReviewDashboardProps> = ({
  errors,
  userId,
  onOpenErrors,
}) => {
  const scope = storageScope(userId);
  const [cards, setCards] = useState<ErrorFlashcard[]>(() => readLocalCards(userId));
  const [progress, setProgress] = useState<DailyReviewProgress>(() => readLocalProgress(userId));
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const [isLoadingCards, setIsLoadingCards] = useState(Boolean(userId));
  const [reviewNow, setReviewNow] = useState(() => Date.now());

  // Refresh the due/next-review labels while the agenda stays open without
  // polling Firestore or changing any learner data.
  useEffect(() => {
    const timer = window.setInterval(() => setReviewNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const currentDay = dayKey(new Date(reviewNow));
    setProgress((current) =>
      current.day === currentDay
        ? current
        : {
            curriculumBuildId: CURRICULUM_BUILD_ID,
            day: currentDay,
            completedCount: 0,
            goal: current.goal,
            updatedAt: new Date().toISOString(),
          }
    );
  }, [reviewNow]);

  useEffect(() => {
    let cancelled = false;
    const localCards = readLocalCards(userId);
    setCards(localCards);
    setProgress(readLocalProgress(userId));
    setReadyScope(null);

    if (!userId) {
      setIsLoadingCards(false);
      setReadyScope('guest');
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingCards(true);
    const loadAgenda = async () => {
      try {
        const [cardsSnapshot, progressSnapshot, legacyCardsSnapshot] = await Promise.all([
          getDoc(doc(db, 'users', userId, 'data', flashcardsDocumentId)),
          getDoc(doc(db, 'users', userId, 'data', agendaDocumentId)),
          getDoc(doc(db, 'users', userId, 'data', 'flashcards_caderno')),
        ]);
        if (cancelled) return;

        if (
          cardsSnapshot.exists() &&
          cardsSnapshot.data()?.curriculumBuildId === CURRICULUM_BUILD_ID
        ) {
          setCards(normalizeCards(cardsSnapshot.data()?.items));
        } else {
          const legacyItems = legacyCardsSnapshot.data()?.items;
          const migratedCards = normalizeCards(
            Array.isArray(legacyItems)
              ? legacyItems.filter(isFlashcard).filter((card) => card.source === 'caderno')
              : localCards.filter((card) => card.source === 'caderno')
          );
          setCards(migratedCards);
          const updatedAt = new Date().toISOString();
          await Promise.all([
            setDoc(doc(db, 'users', userId, 'data', flashcardsDocumentId), {
              curriculumBuildId: CURRICULUM_BUILD_ID,
              items: migratedCards,
              updatedAt,
            }),
            setDoc(doc(db, 'users', userId, 'data', 'flashcards_caderno'), {
              schemaVersion: 2,
              contentKind: 'personal_caderno_cards',
              items: migratedCards.filter((card) => card.source === 'caderno'),
              updatedAt,
            }),
          ]);
        }
        if (
          progressSnapshot.exists() &&
          progressSnapshot.data()?.curriculumBuildId === CURRICULUM_BUILD_ID
        ) {
          setProgress(normalizeProgress(progressSnapshot.data()));
        }
      } catch (error) {
        console.error('Não foi possível carregar a agenda diária:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingCards(false);
          setReadyScope(userId);
        }
      }
    };

    void loadAgenda();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (readyScope !== scope) return;
    localStorage.setItem(
      flashcardsStorageKey(userId),
      JSON.stringify({ curriculumBuildId: CURRICULUM_BUILD_ID, items: cards })
    );
    localStorage.setItem(
      legacyFlashcardsStorageKey(userId),
      JSON.stringify({
        schemaVersion: 2,
        contentKind: 'personal_caderno_cards',
        items: cards.filter((card) => card.source === 'caderno'),
      })
    );
  }, [cards, readyScope, scope, userId]);

  useEffect(() => {
    if (readyScope !== scope) return;
    localStorage.setItem(agendaStorageKey(userId), JSON.stringify(progress));
    if (!userId) return;

    const timeout = window.setTimeout(() => {
      void setDoc(
        doc(db, 'users', userId, 'data', agendaDocumentId),
        {
          ...progress,
          curriculumBuildId: CURRICULUM_BUILD_ID,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((error) => console.error('Não foi possível salvar a meta diária:', error));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [progress, readyScope, scope, userId]);

  const now = reviewNow;
  const dueCards = useMemo(
    () => cards.filter((card) => isDue(card, now)),
    [cards, now]
  );
  const pendingErrors = useMemo(
    () => errors.filter((error) => error.status !== 'dominado'),
    [errors]
  );
  const nextReview = useMemo(
    () =>
      cards
        .filter((card) => card.nextReviewAt && !isDue(card, now))
        .sort(
          (first, second) =>
            Date.parse(first.nextReviewAt || '') - Date.parse(second.nextReviewAt || '')
        )[0]?.nextReviewAt,
    [cards, now]
  );
  const currentDay = dayKey(new Date(reviewNow));
  const completedToday = useMemo(
    () => cards.filter((card) => card.lastReviewedAt?.slice(0, 10) === currentDay).length,
    [cards, currentDay]
  );
  const goalPercent = Math.min(100, Math.round((completedToday / progress.goal) * 100));

  const setGoal = useCallback((goal: number) => {
    setProgress((current) => ({
      ...normalizeProgress(current),
      goal,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <header className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
              <CalendarCheck className="w-3.5 h-3.5" />
              Agenda de hoje
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-3">
              Review Diário
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
              Reúna cards vencidos, regras pendentes e uma meta pequena o suficiente para manter a constância.
            </p>
          </div>
          <button onClick={onOpenErrors} className="button-primary shrink-0 min-h-11 px-4 text-sm">
            <Sparkles className="w-4 h-4" />
            Abrir revisão ativa
          </button>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Meta de revisão</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {completedToday}<span className="text-base text-slate-500">/{progress.goal}</span>
                <span className="text-sm font-semibold text-slate-600 ml-2">cards revisados</span>
              </div>
            </div>
            <div className="flex items-center gap-2" aria-label="Escolher meta diária">
              {[5, 10, 15].map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => setGoal(goal)}
                  className={`min-w-11 min-h-10 px-2 rounded-lg text-xs font-bold border transition ${
                    progress.goal === goal
                      ? 'bg-teal-800 text-white border-teal-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  aria-pressed={progress.goal === goal}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar value={goalPercent} showPercent={false} ariaLabel={`${goalPercent}% da meta diária concluída`} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-600">
              {goalPercent >= 100
                ? 'Meta diária concluída pelas revisões registradas nos flashcards.'
                : 'A meta avança automaticamente a cada cartão efetivamente revisado.'}
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Resumo das revisões">
        <article className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="mt-4 text-2xl font-black text-slate-900">{isLoadingCards ? '—' : dueCards.length}</div>
          <div className="text-sm font-bold text-slate-800">Cards vencidos</div>
          <p className="text-xs text-slate-500 mt-1">Prontos para repetição espaçada.</p>
        </article>
        <article className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="mt-4 text-2xl font-black text-slate-900">{pendingErrors.length}</div>
          <div className="text-sm font-bold text-slate-800">Erros pendentes</div>
          <p className="text-xs text-slate-500 mt-1">Regras do Caderno ainda em ciclo.</p>
        </article>
        <article className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs sm:col-span-2 lg:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div className="mt-4 text-sm font-bold text-slate-800">Próxima revisão</div>
          <p className="text-sm font-semibold text-teal-800 mt-1">
            {dueCards.length > 0 ? 'Disponível agora' : formatReviewTime(nextReview)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Baseada no intervalo dos flashcards.</p>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-700" />
              <h2 className="font-bold text-slate-900">Fila de flashcards</h2>
            </div>
            <button onClick={onOpenErrors} className="text-xs font-bold text-teal-800 hover:text-teal-950 inline-flex items-center gap-1 min-h-10">
              Revisar <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {dueCards.length === 0 ? (
            <p className="text-sm text-slate-500 py-7 text-center">Nenhum card vencido agora. Continue registrando seus erros para alimentar a revisão.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dueCards.slice(0, 4).map((card) => (
                <li key={card.id} className="rounded-xl bg-violet-50/60 border border-violet-100 p-3">
                  <p className="text-xs font-bold text-violet-950 truncate">{card.topic}</p>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{card.front}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-700" />
              <h2 className="font-bold text-slate-900">Regras que pedem atenção</h2>
            </div>
            <button onClick={onOpenErrors} className="text-xs font-bold text-teal-800 hover:text-teal-950 inline-flex items-center gap-1 min-h-10">
              Caderno <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {pendingErrors.length === 0 ? (
            <p className="text-sm text-slate-500 py-7 text-center">Seu Caderno está em dia. Registre novas regras decisivas quando errar.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pendingErrors.slice(0, 4).map((error) => (
                <li key={error.id} className="rounded-xl bg-amber-50/60 border border-amber-100 p-3 flex gap-3">
                  <span className="shrink-0 text-[10px] font-black text-amber-800 bg-white border border-amber-200 rounded-md px-2 py-1 h-fit">
                    {statusLabel(error.status)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{error.conteudo}</p>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{error.regraDecisiva}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
