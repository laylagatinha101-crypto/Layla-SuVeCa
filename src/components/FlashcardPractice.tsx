import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CadernoErroItem, ErrorFlashcard, FlashcardRating } from '../types/suveca';
import { auth, db, onAuthStateChanged } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Lightbulb,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { toLearnerFacingContent } from '../lib/learnerContent';
import { deriveErrorReviewStatus, scheduleFlashcard } from '../lib/spacedRepetition';
import { authenticatedFetch } from '../lib/authenticatedFetch';
import { EDITORIAL_FLASHCARDS } from '../data/editorialFlashcards.generated';
import { PEDAGOGICAL_KNOWLEDGE_BUILD } from '../data/pedagogicalKnowledge.generated';

const FLASHCARDS_STORAGE_PREFIX = 'suveca_flashcards';
const CURRICULUM_BUILD_ID = PEDAGOGICAL_KNOWLEDGE_BUILD.buildId;
const flashcardsStorageKey = (userId?: string) =>
  `${FLASHCARDS_STORAGE_PREFIX}_${CURRICULUM_BUILD_ID}_${userId || 'guest'}`;
const legacyFlashcardsStorageKey = (userId?: string) =>
  `${FLASHCARDS_STORAGE_PREFIX}_${userId || 'guest'}`;
const flashcardsDocumentId = `flashcards_caderno_${CURRICULUM_BUILD_ID}`;
const isCardDue = (card: ErrorFlashcard, now: number) =>
  !card.nextReviewAt || Number.isNaN(Date.parse(card.nextReviewAt)) || Date.parse(card.nextReviewAt) <= now;

const EDITORIAL_CARDS: ErrorFlashcard[] = EDITORIAL_FLASHCARDS.map((card) => ({
  id: card.id,
  moduleId: card.moduleId,
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

interface FlashcardPracticeProps {
  errors: CadernoErroItem[];
  onUpdateErrorStatus: (
    id: string,
    status: CadernoErroItem['status'],
    review?: Pick<CadernoErroItem, 'lastReviewedAt' | 'nextReviewAt'>
  ) => void;
  userId?: string;
  /** Quando informado pelo ModuleViewer, limita a base editorial à aula atual. */
  editorialModuleId?: string;
}

const isFlashcard = (value: unknown): value is ErrorFlashcard => {
  if (!value || typeof value !== 'object') return false;
  const card = value as Partial<ErrorFlashcard>;
  return (
    typeof card.id === 'string' &&
    (card.source === 'caderno' || card.source === 'suveca') &&
    typeof card.topic === 'string' &&
    typeof card.front === 'string' &&
    typeof card.back === 'string'
  );
};

const mergeEditorialCards = (savedCards: ErrorFlashcard[]): ErrorFlashcard[] => {
  const savedById = new Map(savedCards.map((card) => [card.id, card]));
  const editorialCards = EDITORIAL_CARDS.map((card) => {
    const saved = savedById.get(card.id);
    if (!saved) return card;
    return {
      ...card,
      hintUsedCount: saved.hintUsedCount,
      lastReviewUsedHint: saved.lastReviewUsedHint,
      lastReviewedAt: saved.lastReviewedAt,
      nextReviewAt: saved.nextReviewAt,
      correctCount: saved.correctCount,
      incorrectCount: saved.incorrectCount,
      repetitions: saved.repetitions,
      intervalDays: saved.intervalDays,
      easeFactor: saved.easeFactor,
      lapseCount: saved.lapseCount,
      lastRating: saved.lastRating,
      masteryScore: saved.masteryScore,
    };
  });
  const cadernoCards = Array.from(
    new Map(
      savedCards
        .filter((card) => card.source === 'caderno')
        .map((card) => [card.id, card] as const)
    ).values()
  );
  return [...editorialCards, ...cadernoCards];
};

const parseCurrentCards = (value: string | null): ErrorFlashcard[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { curriculumBuildId?: unknown; items?: unknown };
    if (
      parsed?.curriculumBuildId === CURRICULUM_BUILD_ID &&
      Array.isArray(parsed.items) &&
      parsed.items.every(isFlashcard)
    ) {
      return mergeEditorialCards(parsed.items);
    }
  } catch {
    // O chamador aplica o fallback seguro.
  }
  return null;
};

const parseLegacyCadernoCards = (value: string | null): ErrorFlashcard[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : [];
    return items.filter(isFlashcard).filter((card) => card.source === 'caderno');
  } catch {
    return [];
  }
};

export const FlashcardPractice: React.FC<FlashcardPracticeProps> = ({
  errors,
  onUpdateErrorStatus,
  userId,
  editorialModuleId,
}) => {
  const [authUserId, setAuthUserId] = useState<string | undefined>(() => auth.currentUser?.uid);
  const resolvedUserId = userId ?? authUserId;
  const storageKey = flashcardsStorageKey(resolvedUserId);
  const flashcardScopeRef = useRef(storageKey);
  const [flashcards, setFlashcards] = useState<ErrorFlashcard[]>(() => {
    const current = parseCurrentCards(localStorage.getItem(storageKey));
    if (current) return current;
    return mergeEditorialCards(
      parseLegacyCadernoCards(localStorage.getItem(legacyFlashcardsStorageKey(resolvedUserId)))
    );
  });
  const [mode, setMode] = useState<'caderno' | 'suveca'>('caderno');
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [isExplanationVisible, setIsExplanationVisible] = useState(false);
  const [reviewResult, setReviewResult] = useState<'correct' | 'incorrect' | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [isGeneratingFor, setIsGeneratingFor] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [reviewClock, setReviewClock] = useState(() => Date.now());
  const visibleFlashcards =
    flashcardScopeRef.current === storageKey ? flashcards : EDITORIAL_CARDS;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthUserId(currentUser?.uid);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setReviewClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    flashcardScopeRef.current = storageKey;
    setFlashcards(EDITORIAL_CARDS);
    setActiveCardId(null);
    setIsAnswerVisible(false);
    setIsHintVisible(false);
    setIsExplanationVisible(false);
    setReviewResult(null);
    setReviewFeedback(null);

    const loadFlashcards = async () => {
      let localCards = EDITORIAL_CARDS;
      try {
        localCards =
          parseCurrentCards(localStorage.getItem(storageKey)) ??
          mergeEditorialCards(
            parseLegacyCadernoCards(localStorage.getItem(legacyFlashcardsStorageKey(resolvedUserId)))
          );
      } catch (error) {
        console.error('Não foi possível carregar os flashcards locais:', error);
      }

      if (!resolvedUserId) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ curriculumBuildId: CURRICULUM_BUILD_ID, items: localCards })
        );
        localStorage.setItem(
          legacyFlashcardsStorageKey(),
          JSON.stringify({
            schemaVersion: 2,
            contentKind: 'personal_caderno_cards',
            items: localCards.filter((card) => card.source === 'caderno'),
          })
        );
        if (active) setFlashcards(localCards);
        return;
      }

      try {
        const ref = doc(db, 'users', resolvedUserId, 'data', flashcardsDocumentId);
        const snapshot = await getDoc(ref);
        const cloudData = snapshot.data();
        const cloudCards = cloudData?.items;
        if (
          snapshot.exists() &&
          cloudData?.curriculumBuildId === CURRICULUM_BUILD_ID &&
          Array.isArray(cloudCards) &&
          cloudCards.every(isFlashcard)
        ) {
          if (active) setFlashcards(mergeEditorialCards(cloudCards));
        } else {
          const legacySnapshot = await getDoc(
            doc(db, 'users', resolvedUserId, 'data', 'flashcards_caderno')
          );
          const legacyItems = legacySnapshot.data()?.items;
          const legacyCards = Array.isArray(legacyItems)
            ? legacyItems.filter(isFlashcard).filter((card) => card.source === 'caderno')
            : [];
          const initialCards = mergeEditorialCards([...localCards, ...legacyCards]);
          await setDoc(ref, {
            curriculumBuildId: CURRICULUM_BUILD_ID,
            items: initialCards,
            updatedAt: new Date().toISOString(),
          });
          await setDoc(doc(db, 'users', resolvedUserId, 'data', 'flashcards_caderno'), {
            schemaVersion: 2,
            contentKind: 'personal_caderno_cards',
            items: initialCards.filter((card) => card.source === 'caderno'),
            updatedAt: new Date().toISOString(),
          });
          if (active) setFlashcards(initialCards);
        }
      } catch (error) {
        console.error('Não foi possível sincronizar os flashcards:', error);
        if (active) setFlashcards(localCards);
      }
    };

    void loadFlashcards();
    return () => {
      active = false;
    };
  }, [resolvedUserId, storageKey]);

  const persistFlashcards = async (nextCards: ErrorFlashcard[]) => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ curriculumBuildId: CURRICULUM_BUILD_ID, items: nextCards })
    );
    localStorage.setItem(
      legacyFlashcardsStorageKey(resolvedUserId),
      JSON.stringify({
        schemaVersion: 2,
        contentKind: 'personal_caderno_cards',
        items: nextCards.filter((card) => card.source === 'caderno'),
      })
    );
    if (!resolvedUserId) return;

    try {
      const updatedAt = new Date().toISOString();
      await Promise.all([
        setDoc(doc(db, 'users', resolvedUserId, 'data', flashcardsDocumentId), {
          curriculumBuildId: CURRICULUM_BUILD_ID,
          items: nextCards,
          updatedAt,
        }),
        setDoc(doc(db, 'users', resolvedUserId, 'data', 'flashcards_caderno'), {
          schemaVersion: 2,
          contentKind: 'personal_caderno_cards',
          items: nextCards.filter((card) => card.source === 'caderno'),
          updatedAt,
        }),
      ]);
    } catch (error) {
      console.error('Não foi possível salvar os flashcards:', error);
    }
  };

  const cadernoCards = useMemo(
    () =>
      visibleFlashcards.filter(
        (card) => card.source === 'caderno' && !!card.errorId && errors.some((error) => error.id === card.errorId)
      ),
    [errors, visibleFlashcards]
  );
  const suvecaCards = useMemo(
    () => visibleFlashcards.filter(
      (card) => card.source === 'suveca' && (!editorialModuleId || card.moduleId === editorialModuleId)
    ),
    [editorialModuleId, visibleFlashcards]
  );
  const dueCadernoCards = useMemo(
    () => cadernoCards.filter((card) => isCardDue(card, reviewClock)),
    [cadernoCards, reviewClock]
  );
  const dueSuvecaCards = useMemo(
    () => suvecaCards.filter((card) => isCardDue(card, reviewClock)),
    [reviewClock, suvecaCards]
  );
  const activeCards = mode === 'caderno' ? dueCadernoCards : dueSuvecaCards;
  const reviewedCard = reviewResult
    ? visibleFlashcards.find((card) => card.id === activeCardId)
    : undefined;
  const activeCard = reviewedCard || activeCards.find((card) => card.id === activeCardId) || activeCards[0];
  const errorsWithoutCards = errors.filter(
    (error) => !cadernoCards.some((card) => card.errorId === error.id)
  );

  useEffect(() => {
    if (reviewResult) return;
    if (activeCardId && activeCards.some((card) => card.id === activeCardId)) return;
    const next = activeCards.length
      ? activeCards[Math.floor(Math.random() * activeCards.length)]
      : null;
    setActiveCardId(next?.id || null);
    setIsAnswerVisible(false);
    setIsHintVisible(false);
    setIsExplanationVisible(false);
    setReviewResult(null);
    setReviewFeedback(null);
  }, [activeCardId, activeCards, reviewResult]);

  const switchMode = (nextMode: 'caderno' | 'suveca') => {
    setMode(nextMode);
    setActiveCardId(null);
    setIsAnswerVisible(false);
    setIsHintVisible(false);
    setIsExplanationVisible(false);
    setReviewResult(null);
    setReviewFeedback(null);
  };

  const chooseNextCard = () => {
    if (!activeCards.length) return;
    const alternatives = activeCards.filter((card) => card.id !== activeCard?.id);
    const pool = alternatives.length ? alternatives : activeCards;
    const next = pool[Math.floor(Math.random() * pool.length)];
    setActiveCardId(next.id);
    setIsAnswerVisible(false);
    setIsHintVisible(false);
    setIsExplanationVisible(false);
    setReviewResult(null);
    setReviewFeedback(null);
  };

  const generateFlashcardsForError = async (error: CadernoErroItem) => {
    setIsGeneratingFor(error.id);
    setGenerationMessage(null);
    try {
      const response = await authenticatedFetch('/api/gemini/generate-error-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error, count: 2 }),
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.flashcards)) {
        throw new Error(data.error || 'A IA não retornou flashcards válidos.');
      }

      const now = new Date().toISOString();
      const generatedCards: ErrorFlashcard[] = data.flashcards
        .filter((card: unknown) => {
          if (!card || typeof card !== 'object') return false;
          const candidate = card as { front?: unknown; back?: unknown; hint?: unknown; explanation?: unknown };
          return typeof candidate.front === 'string' && typeof candidate.back === 'string';
        })
        .map((card: { front: string; back: string; hint?: string; explanation?: string; sourceRefs?: unknown }, index: number) => ({
          id: `flash_${error.id}_${Date.now()}_${index}`,
          errorId: error.id,
          source: 'caderno',
          topic: error.conteudo,
          front: toLearnerFacingContent(card.front),
          back: toLearnerFacingContent(card.back),
          hint: toLearnerFacingContent(card.hint) || undefined,
          explanation: toLearnerFacingContent(card.explanation) || undefined,
          sourceRefs: Array.isArray(card.sourceRefs)
            ? card.sourceRefs.filter((reference): reference is string => typeof reference === 'string')
            : undefined,
          createdAt: now,
          correctCount: 0,
          incorrectCount: 0,
        }));

      if (!generatedCards.length) throw new Error('Nenhum card aproveitável foi gerado.');

      const nextCards = [...flashcards.filter((card) => card.errorId !== error.id), ...generatedCards];
      setFlashcards(nextCards);
      await persistFlashcards(nextCards);
      setMode('caderno');
      setActiveCardId(generatedCards[0].id);
      setIsAnswerVisible(false);
      setIsHintVisible(false);
      setIsExplanationVisible(false);
      setReviewResult(null);
      setGenerationMessage(`Criamos ${generatedCards.length} flashcards para “${error.conteudo}”.`);
    } catch (error) {
      console.error('Não foi possível gerar os flashcards:', error);
      setGenerationMessage(
        error instanceof Error ? error.message : 'Não foi possível gerar os flashcards agora.'
      );
    } finally {
      setIsGeneratingFor(null);
    }
  };

  const generateAllPendingCards = async () => {
    if (!errorsWithoutCards.length) return;
    setIsGeneratingFor('all');
    setGenerationMessage(null);

    let generated = 0;
    let nextCards = flashcards;
    for (const error of errorsWithoutCards) {
      try {
        const response = await authenticatedFetch('/api/gemini/generate-error-flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error, count: 2 }),
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.flashcards)) continue;

        const now = new Date().toISOString();
        const newCards: ErrorFlashcard[] = data.flashcards
          .filter((card: unknown) => {
            if (!card || typeof card !== 'object') return false;
            const candidate = card as { front?: unknown; back?: unknown };
            return typeof candidate.front === 'string' && typeof candidate.back === 'string';
          })
          .map((card: { front: string; back: string; hint?: string; explanation?: string; sourceRefs?: unknown }, index: number) => ({
            id: `flash_${error.id}_${Date.now()}_${index}`,
            errorId: error.id,
            source: 'caderno',
            topic: error.conteudo,
            front: toLearnerFacingContent(card.front),
            back: toLearnerFacingContent(card.back),
            hint: toLearnerFacingContent(card.hint) || undefined,
            explanation: toLearnerFacingContent(card.explanation) || undefined,
            sourceRefs: Array.isArray(card.sourceRefs)
              ? card.sourceRefs.filter((reference): reference is string => typeof reference === 'string')
              : undefined,
            createdAt: now,
            correctCount: 0,
            incorrectCount: 0,
        }));

        if (newCards.length) {
          nextCards = [...nextCards.filter((card) => card.errorId !== error.id), ...newCards];
          generated += newCards.length;
        }
      } catch (error) {
        console.error(`Não foi possível gerar cards para ${error.id}:`, error);
      }
    }

    if (generated) {
      setFlashcards(nextCards);
      await persistFlashcards(nextCards);
      setMode('caderno');
    }
    setIsGeneratingFor(null);
    setGenerationMessage(
      generated
        ? `${generated} flashcards foram gerados para sua revisão ativa.`
        : 'Não foi possível gerar cards para os erros pendentes agora.'
    );
  };

  const handleReview = (rating: FlashcardRating) => {
    if (!activeCard || reviewResult) return;
    const now = new Date();
    if (!isCardDue(activeCard, now.getTime())) return;

    const relatedError =
      activeCard.source === 'caderno' && activeCard.errorId
        ? errors.find((error) => error.id === activeCard.errorId)
        : undefined;
    const scheduledCard = scheduleFlashcard(activeCard, rating, isHintVisible, now);
    const nextCards = flashcards.map((card) => card.id === activeCard.id ? scheduledCard : card);
    setFlashcards(nextCards);
    void persistFlashcards(nextCards);
    setReviewResult(scheduledCard.lastRating === 'again' ? 'incorrect' : 'correct');
    setReviewClock(now.getTime());

    if (relatedError) {
      const relatedCards = nextCards.filter((card) => card.errorId === relatedError.id);
      const nextStatus = deriveErrorReviewStatus(relatedCards);
      const nextRuleReview = relatedCards
        .map((card) => card.nextReviewAt)
        .filter((date): date is string => Boolean(date))
        .sort()[0];
      onUpdateErrorStatus(relatedError.id, nextStatus, {
        lastReviewedAt: now.toISOString(),
        nextReviewAt: nextRuleReview,
      });
      setReviewFeedback(
        nextStatus === 'dominado'
          ? 'Todos os cartões desta regra demonstraram domínio sem ajuda. Regra dominada!'
          : scheduledCard.lastRating === 'again'
          ? 'Este cartão volta em cerca de 4 horas; os demais mantêm seus próprios intervalos.'
          : `Cartão agendado individualmente para ${Math.max(1, Math.round((scheduledCard.intervalDays || 0) * 24))} hora(s). A regra avança pelo cartão mais frágil.`
      );
    } else {
      setReviewFeedback(
        scheduledCard.lastRating !== 'again'
          ? 'Ótimo! Este conteúdo entrou no seu próximo ciclo de revisão.'
          : 'Sem problema: este conteúdo voltará em um intervalo curto para reforço.'
      );
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Revisão ativa com Flashcards</h1>
              <p className="text-xs text-slate-600 mt-1">
                {editorialModuleId
                  ? 'Gere cards com a Regra Decisiva do seu Caderno ou revise os conteúdos editoriais desta aula.'
                  : 'Gere cards com a Regra Decisiva do seu Caderno ou revise os conteúdos editoriais das aulas 00–14.'}
              </p>
            </div>
          </div>
          {errorsWithoutCards.length > 0 && (
            <button
              type="button"
              onClick={generateAllPendingCards}
              disabled={isGeneratingFor !== null}
              className="button-primary min-h-[44px] text-xs px-4 py-2.5 shrink-0"
            >
              {isGeneratingFor === 'all' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gerando cards...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Gerar cards pendentes ({errorsWithoutCards.length})</span>
                </>
              )}
            </button>
          )}
        </div>

        {generationMessage && (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" aria-live="polite">
            {generationMessage}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {errors.slice(0, 6).map((error) => {
            const hasCards = cadernoCards.some((card) => card.errorId === error.id);
            const generating = isGeneratingFor === error.id || isGeneratingFor === 'all';
            return (
              <div key={error.id} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 bg-slate-50">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{error.conteudo}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{hasCards ? 'Cards prontos para revisão' : 'Sem cards gerados'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void generateFlashcardsForError(error)}
                  disabled={isGeneratingFor !== null}
                  className="min-h-[44px] text-xs font-bold text-violet-800 bg-white border border-violet-200 hover:bg-violet-50 rounded-lg px-2.5 py-2 shrink-0 transition disabled:opacity-60"
                >
                  {generating ? 'Gerando...' : hasCards ? 'Gerar de novo' : 'Gerar IA'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-semibold" role="group" aria-label="Tipo de flashcard">
        <button
          type="button"
          onClick={() => switchMode('caderno')}
          aria-pressed={mode === 'caderno'}
          className={`flex-1 min-h-[44px] rounded-xl px-3 py-2.5 transition ${
            mode === 'caderno' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Meu Caderno ({dueCadernoCards.length}/{cadernoCards.length})
        </button>
        <button
          type="button"
          onClick={() => switchMode('suveca')}
          aria-pressed={mode === 'suveca'}
          className={`flex-1 min-h-[44px] rounded-xl px-3 py-2.5 transition ${
            mode === 'suveca' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {editorialModuleId ? 'Base desta aula' : 'Base editorial'} ({dueSuvecaCards.length}/{suvecaCards.length})
        </button>
      </div>

      {!activeCard ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3 shadow-xs">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            {mode === 'caderno' && cadernoCards.length
              ? 'Nenhum card do Caderno está devido agora'
              : mode === 'suveca' && suvecaCards.length
              ? 'Nenhum conteúdo editorial está devido agora'
              : mode === 'suveca' && editorialModuleId
              ? 'Esta aula ainda não possui cards editoriais'
              : 'Ainda não há cards para esta revisão'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {mode === 'caderno' && cadernoCards.length
              ? 'O intervalo de repetição espaçada está ativo. Volte no horário programado ou revise a base editorial.'
              : 'Gere cards com IA para algum erro acima ou pratique a base editorial na aba ao lado enquanto registra novos erros.'}
          </p>
        </div>
      ) : (
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5 tab-content-enter">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-violet-800 bg-violet-50 border border-violet-200 rounded-full px-3 py-1">
              {activeCard.topic}
            </span>
            <span className="text-[11px] text-slate-500">
              {activeCard.correctCount} domínio(s) · {activeCard.incorrectCount} revisão(ões)
            </span>
          </div>

          <div className="min-h-40 flex flex-col justify-center rounded-2xl bg-slate-50 border border-slate-200 p-5 sm:p-7">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Pergunta</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">{toLearnerFacingContent(activeCard.front)}</p>
            {activeCard.hint && !isAnswerVisible && (
              <div className="mt-4">
                {!isHintVisible ? (
                  <button
                    type="button"
                    onClick={() => setIsHintVisible(true)}
                    aria-expanded="false"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-800 transition hover:bg-violet-50"
                  >
                    <Lightbulb className="h-4 w-4" aria-hidden="true" />
                    Ver dica
                  </button>
                ) : (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-950" role="note">
                    <strong className="mb-1 flex items-center gap-2 text-violet-900">
                      <Lightbulb className="h-4 w-4" aria-hidden="true" /> Dica
                    </strong>
                    <p>{toLearnerFacingContent(activeCard.hint)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isAnswerVisible ? (
            <button type="button" onClick={() => setIsAnswerVisible(true)} className="button-primary min-h-[48px] w-full py-3 text-sm">
              Mostrar resposta
            </button>
          ) : (
            <>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 tab-content-enter">
                <span className="text-xs font-bold uppercase tracking-wide text-emerald-800 block mb-2">Resposta</span>
                <p className="text-sm text-emerald-950 leading-relaxed font-medium">{toLearnerFacingContent(activeCard.back)}</p>
              </div>

              {activeCard.explanation && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsExplanationVisible((visible) => !visible)}
                    aria-expanded={isExplanationVisible}
                    aria-controls={`flashcard-explanation-${activeCard.id}`}
                    className="mx-auto flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-50"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    {isExplanationVisible ? 'Ocultar explicação' : 'Ver explicação'}
                    {isExplanationVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {isExplanationVisible && (
                    <div
                      id={`flashcard-explanation-${activeCard.id}`}
                      className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 text-sm leading-relaxed text-slate-800 tab-content-enter"
                    >
                      <strong className="mb-2 block text-teal-950">Por que isso acontece?</strong>
                      <p className="whitespace-pre-wrap">{toLearnerFacingContent(activeCard.explanation)}</p>
                    </div>
                  )}
                </div>
              )}

              {reviewResult ? (
                <div className={`rounded-xl p-3 border text-xs font-semibold flex items-center justify-between gap-3 ${
                  reviewResult === 'correct'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <span>
                    {reviewFeedback ||
                      (reviewResult === 'correct'
                        ? 'Ótimo! O desempenho foi registrado.'
                        : 'Sem problema: este conteúdo voltará para revisão.')}
                  </span>
                  <button type="button" onClick={chooseNextCard} className="button-secondary min-h-[44px] text-xs px-3 py-2 whitespace-nowrap">
                    Próximo <ChevronRight className="w-3.5 h-3.5 text-teal-700" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" aria-label="Avalie a qualidade da recordação">
                  <button
                    type="button"
                    onClick={() => handleReview('again')}
                    className="min-h-[48px] bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 rounded-xl py-3 px-3 text-sm font-bold transition flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" /> Errei
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview('hard')}
                    className="min-h-[48px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl py-3 px-3 text-sm font-bold transition"
                  >
                    Difícil
                  </button>
                  <button type="button" onClick={() => handleReview('good')} className="min-h-[48px] bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-xl py-3 px-3 text-sm font-bold transition">
                    Bom
                  </button>
                  <button type="button" onClick={() => handleReview('easy')} className="min-h-[48px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl py-3 px-3 text-sm font-bold transition flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Fácil
                  </button>
                </div>
              )}
            </>
          )}

          {!reviewResult && (
            <button type="button" onClick={chooseNextCard} className="min-h-[44px] text-xs font-semibold text-slate-500 hover:text-teal-800 mx-auto flex items-center gap-1">
              Pular card <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </section>
      )}
    </div>
  );
};
