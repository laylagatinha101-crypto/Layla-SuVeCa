import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QuizQuestion, SimuladoAttempt, TopicAttemptStats } from '../types/suveca';
import { auth, db, onAuthStateChanged } from '../lib/firebase';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { useModalFocus } from '../hooks/useModalFocus';
import { authenticatedFetch } from '../lib/authenticatedFetch';
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Bot,
  AlertTriangle,
  Award,
  ChevronRight,
  ChevronLeft,
  PlusCircle,
  FileText,
  Pause,
  Play,
  TimerOff,
  Save,
} from 'lucide-react';

const DEFAULT_EXAM_DURATION_SECONDS = 40 * 60;
const PAUSED_SIMULADO_STORAGE_PREFIX = 'suveca_simulado_pausado';
const pausedSimuladoStorageKey = (userId?: string) =>
  `${PAUSED_SIMULADO_STORAGE_PREFIX}_${userId || 'guest'}`;

interface PausedSimuladoState {
  version: 1;
  storageScope: string;
  questionSignature: string;
  userAnswers: Record<string, string>;
  currentQIndex: number;
  secondsLeft: number;
  timerEnabled: boolean;
  savedAt: string;
}

interface SimuladoEngineProps {
  questions: QuizQuestion[];
  userId?: string;
  onAddErrorToNotebook: (
    conteudo: string,
    erroCometido: string,
    regraDecisiva: string,
    metadata?: Partial<import('../types/suveca').CadernoErroItem>
  ) => void;
  onAnswerResult?: (correct: boolean) => void;
  onCompleteAttempt?: (attempt: SimuladoAttempt) => void;
}

export const SimuladoEngine: React.FC<SimuladoEngineProps> = ({
  questions,
  userId,
  onAddErrorToNotebook,
  onAnswerResult,
  onCompleteAttempt,
}) => {
  const [activeTab, setActiveTab] = useState<'simulado' | 'generator'>('simulado');

  // Simulado State
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_EXAM_DURATION_SECONDS);
  const [isTimerEnabled, setIsTimerEnabled] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [savedSession, setSavedSession] = useState<PausedSimuladoState | null>(null);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [timerMessage, setTimerMessage] = useState<string | null>(null);
  const [addedErrors, setAddedErrors] = useState<Record<string, boolean>>({});
  const [isAnswerCardOpen, setIsAnswerCardOpen] = useState(false);
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | undefined>(
    () => auth.currentUser?.uid
  );
  const answeredQuestionIds = useRef(new Set<string>());
  const hasRecordedAttempt = useRef(false);
  const hasChangedCurrentAttempt = useRef(false);
  const previousStorageScope = useRef<string | null>(null);
  const answerCardCloseRef = useRef<HTMLButtonElement>(null);
  const answerCardDialogRef = useModalFocus(
    isAnswerCardOpen,
    () => setIsAnswerCardOpen(false),
    answerCardCloseRef
  );

  // AI Questão Generator State
  const [genTopic, setGenTopic] = useState('Concordância Verbal e Impessoalidade');
  const [genBank, setGenBank] = useState('CEBRASPE (Certo/Errado)');
  const [genCount, setGenCount] = useState(3);
  const [genQuestions, setGenQuestions] = useState<QuizQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [genUserAnswers, setGenUserAnswers] = useState<Record<string, string>>({});

  const questionSignature = useMemo(
    () => questions.map((question) => question.id).join('|'),
    [questions]
  );
  const persistenceUserId = userId ?? authenticatedUserId;
  const pausedStorageKey = pausedSimuladoStorageKey(persistenceUserId);
  const isExamPaused = isTimerEnabled && !isTimerRunning && !isSubmitted;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthenticatedUserId(currentUser?.uid);
    });
    return () => unsubscribe();
  }, []);

  // Never keep an in-progress attempt visible when the active account changes.
  useEffect(() => {
    if (previousStorageScope.current === null) {
      previousStorageScope.current = pausedStorageKey;
      return;
    }
    if (previousStorageScope.current === pausedStorageKey) return;

    previousStorageScope.current = pausedStorageKey;
    setUserAnswers({});
    setIsSubmitted(false);
    setCurrentQIndex(0);
    setSecondsLeft(DEFAULT_EXAM_DURATION_SECONDS);
    setIsTimerEnabled(false);
    setIsTimerRunning(false);
    setSavedSession(null);
    setTimerMessage(null);
    setAddedErrors({});
    answeredQuestionIds.current.clear();
    hasRecordedAttempt.current = false;
    hasChangedCurrentAttempt.current = false;
  }, [pausedStorageKey]);

  const goToQuestion = (index: number) => {
    if (isExamPaused) return;
    setCurrentQIndex(index);
    setIsAnswerCardOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPausedSession = (): PausedSimuladoState => ({
    version: 1,
    storageScope: pausedStorageKey,
    questionSignature,
    userAnswers,
    currentQIndex,
    secondsLeft,
    timerEnabled: isTimerEnabled,
    savedAt: new Date().toISOString(),
  });

  const isValidPausedSession = (candidate: unknown): candidate is PausedSimuladoState => {
    if (!candidate || typeof candidate !== 'object') return false;
    const session = candidate as Partial<PausedSimuladoState>;
    return (
      session.version === 1 &&
      session.storageScope === pausedStorageKey &&
      session.questionSignature === questionSignature &&
      typeof session.secondsLeft === 'number' &&
      session.secondsLeft >= 0 &&
      typeof session.currentQIndex === 'number' &&
      typeof session.timerEnabled === 'boolean' &&
      typeof session.savedAt === 'string' &&
      !!session.userAnswers &&
      typeof session.userAnswers === 'object'
    );
  };

  const savePausedSession = async (session = getPausedSession()) => {
    setIsSavingSession(true);
    try {
      localStorage.setItem(pausedStorageKey, JSON.stringify(session));
      if (persistenceUserId) {
        await setDoc(
          doc(db, 'users', persistenceUserId, 'data', 'simulado_em_andamento'),
          session
        );
      }
      setSavedSession(session);
      setTimerMessage('Simulado pausado e salvo. Você pode retomá-lo quando quiser.');
    } catch (error) {
      console.error('Não foi possível salvar o simulado pausado:', error);
      setTimerMessage('O simulado foi pausado, mas não foi possível salvar o progresso agora.');
    } finally {
      setIsSavingSession(false);
    }
  };

  const clearPausedSession = async () => {
    localStorage.removeItem(pausedStorageKey);
    setSavedSession(null);
    if (!persistenceUserId) return;

    try {
      await deleteDoc(doc(db, 'users', persistenceUserId, 'data', 'simulado_em_andamento'));
    } catch (error) {
      console.error('Não foi possível limpar o simulado salvo:', error);
    }
  };

  useEffect(() => {
    let isCurrent = true;

    const loadPausedSession = async () => {
      let localSession: PausedSimuladoState | null = null;
      try {
        const saved = localStorage.getItem(pausedStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (isValidPausedSession(parsed)) localSession = parsed;
        }
      } catch (error) {
        console.error('Não foi possível ler o simulado salvo localmente:', error);
      }

      let cloudSession: PausedSimuladoState | null = null;
      if (persistenceUserId) {
        try {
          const snapshot = await getDoc(
            doc(db, 'users', persistenceUserId, 'data', 'simulado_em_andamento')
          );
          if (snapshot.exists() && isValidPausedSession(snapshot.data())) {
            cloudSession = snapshot.data() as PausedSimuladoState;
          }
        } catch (error) {
          console.error('Não foi possível recuperar o simulado salvo:', error);
        }
      }

      const newestSession = [localSession, cloudSession]
        .filter((session): session is PausedSimuladoState => session !== null)
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];

      if (isCurrent && !hasChangedCurrentAttempt.current && newestSession) {
        setSavedSession(newestSession);
      }
    };

    void loadPausedSession();
    return () => {
      isCurrent = false;
    };
  }, [pausedStorageKey, persistenceUserId, questionSignature]);

  // Countdown only starts after the user explicitly enables and starts it.
  useEffect(() => {
    if (!isTimerEnabled || !isTimerRunning || isSubmitted || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, isSubmitted, isTimerEnabled, isTimerRunning]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectAnswer = (qId: string, val: string) => {
    if (isSubmitted || isExamPaused) return;
    hasChangedCurrentAttempt.current = true;

    if (!answeredQuestionIds.current.has(qId)) {
      answeredQuestionIds.current.add(qId);
      const question = questions.find((item) => item.id === qId);
      if (question) onAnswerResult?.(val === question.correctAnswer);
    }

    setUserAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const finishSimulado = (skipConfirmation = false) => {
    if (!skipConfirmation && answeredCount < questions.length) {
      const confirmFinish = window.confirm(
        `Você respondeu ${answeredCount} de ${questions.length} questões. Deseja realmente finalizar o simulado agora?`
      );
      if (!confirmFinish) return;
    }
    setIsSubmitted(true);
    setIsTimerRunning(false);
    setIsAnswerCardOpen(false);
    hasChangedCurrentAttempt.current = true;
    void clearPausedSession();
    recordAttempt();
  };

  const handleSubmitSimulado = () => finishSimulado();

  const handleEnableTimer = () => {
    hasChangedCurrentAttempt.current = true;
    setIsTimerEnabled(true);
    setIsTimerRunning(true);
    setTimerMessage('Cronômetro ativado: a contagem continuará enquanto você navega pela tela.');
  };

  const handlePauseTimer = () => {
    hasChangedCurrentAttempt.current = true;
    setIsTimerRunning(false);
    const session = getPausedSession();
    void savePausedSession(session);
  };

  const handleResumeTimer = () => {
    hasChangedCurrentAttempt.current = true;
    setIsTimerRunning(true);
    setTimerMessage('Cronômetro retomado. Boa prova!');
    void clearPausedSession();
  };

  const handleRestorePausedSession = () => {
    if (!savedSession) return;
    setUserAnswers(savedSession.userAnswers);
    answeredQuestionIds.current = new Set(Object.keys(savedSession.userAnswers));
    setCurrentQIndex(
      Math.min(Math.max(savedSession.currentQIndex, 0), Math.max(questions.length - 1, 0))
    );
    setSecondsLeft(savedSession.secondsLeft);
    setIsTimerEnabled(savedSession.timerEnabled);
    setIsTimerRunning(false);
    setIsSubmitted(false);
    setAddedErrors({});
    setActiveTab('simulado');
    setTimerMessage('Estado restaurado. Retome o cronômetro quando estiver pronto.');
  };

  const handleResetSimulado = () => {
    hasChangedCurrentAttempt.current = true;
    setUserAnswers({});
    setIsSubmitted(false);
    setCurrentQIndex(0);
    setSecondsLeft(DEFAULT_EXAM_DURATION_SECONDS);
    setIsTimerEnabled(false);
    setIsTimerRunning(false);
    setTimerMessage(null);
    setAddedErrors({});
    answeredQuestionIds.current.clear();
    hasRecordedAttempt.current = false;
    void clearPausedSession();
  };

  const handleAddAllErrors = () => {
    questions.forEach((q) => {
      if (userAnswers[q.id] && userAnswers[q.id] !== q.correctAnswer) {
        if (!addedErrors[q.id]) {
          onAddErrorToNotebook(
            q.topic || 'Simulado Final SuVeCA',
            `Errei a questão ${q.id}: marquei ${userAnswers[q.id]} e o gabarito era ${q.correctAnswer}`,
            q.commentary,
            {
              origin: q.origin === 'official' ? 'official_question' : q.origin === 'ai_generated' ? 'ai_generated' : 'simulado',
              questionId: q.officialQuestionId || q.id,
              questionText: q.questionText,
              selectedAnswer: userAnswers[q.id],
              correctAnswer: q.correctAnswer,
              bank: q.bank,
              topic: q.topic,
              moduleRef: q.moduleId,
              conceptIds: q.conceptIds,
              sourceRefs: q.sourceRefs,
            }
          );
          setAddedErrors((prev) => ({ ...prev, [q.id]: true }));
        }
      }
    });
  };

  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setGenUserAnswers({});
    try {
      const response = await authenticatedFetch('/api/gemini/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: genTopic,
          bank: genBank,
          count: genCount,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setGenerationError(data.error || 'Não foi possível gerar questões agora.');
      } else if (data.questions) {
        setGenQuestions(data.questions);
      }
    } catch (err) {
      console.error(err);
      setGenerationError('Falha de conexão ao gerar questões.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Score Calculations
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = questions.reduce(
    (acc, q) => (userAnswers[q.id] === q.correctAnswer ? acc + 1 : acc),
    0
  );
  const unansweredCount = Math.max(questions.length - answeredCount, 0);
  // Official score treats omitted items as not correct, keeping total and topical accuracy aligned.
  const wrongCount = Math.max(questions.length - correctCount, 0);
  const answeredWrongCount = Math.max(answeredCount - correctCount, 0);
  const percentage = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  const byTopic = questions.reduce<Record<string, TopicAttemptStats>>((stats, question) => {
    const topic = question.topic?.trim() || 'Geral';
    const previous = stats[topic] || { total: 0, correct: 0, wrong: 0, accuracy: 0 };
    const answer = userAnswers[question.id];
    const correct = answer === question.correctAnswer;

    stats[topic] = {
      total: previous.total + 1,
      correct: previous.correct + (correct ? 1 : 0),
      wrong: previous.wrong + (correct ? 0 : 1),
      accuracy: 0,
    };
    return stats;
  }, {});

  Object.values(byTopic).forEach((stats) => {
    stats.accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
  });

  const recordAttempt = () => {
    if (hasRecordedAttempt.current) return;
    hasRecordedAttempt.current = true;
    onCompleteAttempt?.({
      id: `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      completedAt: new Date().toISOString(),
      totalQuestions: questions.length,
      answeredCount,
      correctCount,
      wrongCount,
      unansweredCount,
      percentage,
      timerEnabled: isTimerEnabled,
      timeRemainingSeconds: isTimerEnabled ? secondsLeft : undefined,
      byTopic,
      answerMap: { ...userAnswers },
      questionSetVersion: isOfficialQuestionSet && sharedQuestionSetVersion
        ? sharedQuestionSetVersion
        : questions.some((question) => question.origin === 'ai_generated')
        ? 'ai-generated-v1'
        : undefined,
    });
  };

  useEffect(() => {
    if (!isTimerEnabled || !isTimerRunning || isSubmitted || secondsLeft > 0) return;
    finishSimulado(true);
  }, [secondsLeft, isSubmitted, isTimerEnabled, isTimerRunning]);

  const currentQ = questions[currentQIndex];
  const isOfficialQuestion = currentQ?.origin === 'official';
  const isOfficialQuestionSet = questions.length > 0 && questions.every((question) => question.origin === 'official');
  const questionSetVersions = new Set(questions.map((question) => question.questionSetVersion).filter(Boolean));
  const sharedQuestionSetVersion = questionSetVersions.size === 1 && questions.every((question) => question.questionSetVersion)
    ? [...questionSetVersions][0]
    : undefined;
  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* Top Mode Header */}
      <header className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 bg-teal-50 text-teal-800 border border-teal-200 text-xs px-3 py-1 rounded-full font-semibold">
            <GraduationCap className="w-3.5 h-3.5 text-teal-700" />
            <span>Ambiente Editorial de Provas</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Simulado Geral & Banco de Questões
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Responda sob tempo controlado ou gere questões inéditas orientadas por inteligência artificial.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('simulado')}
            className={`px-4 py-2 rounded-lg transition cursor-pointer ${
              activeTab === 'simulado'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isOfficialQuestionSet ? 'Simulado editorial' : 'Simulado autoral'} ({questions.length} Questões)
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'generator'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            <span>Gerador IA de Questões</span>
          </button>
        </div>
      </header>

      {activeTab === 'simulado' ? (
        <div className="space-y-6">
          {savedSession?.storageScope === pausedStorageKey && !isSubmitted && (
            <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 tab-content-enter">
              <div className="flex items-start gap-3">
                <Save className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold text-amber-950">Há um simulado pausado salvo</h2>
                  <p className="text-xs text-amber-900 mt-0.5">
                    {Object.keys(savedSession.userAnswers).length} resposta(s) e {formatTime(savedSession.secondsLeft)} restantes.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => void clearPausedSession()}
                  className="button-secondary text-xs px-3 py-2"
                >
                  Descartar
                </button>
                <button onClick={handleRestorePausedSession} className="button-primary text-xs px-3 py-2">
                  Retomar prova
                </button>
              </div>
            </section>
          )}

          {/* Mobile Sticky Bar for Exam Mode */}
          {!isSubmitted && (
            <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-2.5 shadow-2xs flex items-center justify-between -mx-4 sm:-mx-6 mb-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                <span className="bg-teal-100 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md font-bold">
                  Q{currentQIndex + 1}/{questions.length}
                </span>
                {isTimerEnabled ? (
                  <div className="flex items-center space-x-1 text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-teal-700" />
                    <span>{formatTime(secondsLeft)}</span>
                  </div>
                ) : (
                  <span className="text-slate-500 font-medium">Sem cronômetro</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsAnswerCardOpen(true)}
                className="button-secondary min-h-[44px] text-xs py-1.5 px-3 flex items-center space-x-1.5 font-bold"
                aria-haspopup="dialog"
                aria-controls="answer-card-dialog"
              >
                <FileText className="w-3.5 h-3.5 text-teal-700" />
                <span>Gabarito ({answeredCount}/{questions.length})</span>
              </button>
            </div>
          )}

          {/* Status Bar: Timer + Progress */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-medium">
              {isTimerEnabled ? (
                <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border ${
                  isTimerRunning
                    ? 'bg-teal-50 border-teal-200 text-teal-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}>
                  <Clock className="w-4 h-4 text-teal-700" />
                  <span>
                    Tempo restante: <strong>{formatTime(secondsLeft)}</strong>
                    {!isTimerRunning && <em className="not-italic text-amber-800"> (pausado)</em>}
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700">
                  <TimerOff className="w-4 h-4 text-slate-500" />
                  <span>Cronômetro opcional desativado</span>
                </div>
              )}
              <div className="text-slate-600">
                Respondidas: <strong>{answeredCount}</strong> / {questions.length}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isSubmitted ? (
                <>
                  {!isTimerEnabled ? (
                    <button
                      type="button"
                      onClick={handleEnableTimer}
                      className="button-secondary min-h-[44px] text-xs sm:text-sm px-4 py-2"
                      title="Ativar cronômetro regressivo de 40 minutos"
                    >
                      <Play className="w-4 h-4 text-teal-700" />
                      <span>Ativar cronômetro</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={isTimerRunning ? handlePauseTimer : handleResumeTimer}
                      disabled={isSavingSession}
                      className="button-secondary min-h-[44px] text-xs sm:text-sm px-4 py-2"
                    >
                      {isTimerRunning ? (
                        <>
                          <Pause className="w-4 h-4 text-amber-700" />
                          <span>{isSavingSession ? 'Salvando...' : 'Pausar e salvar'}</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 text-teal-700" />
                          <span>Retomar cronômetro</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSubmitSimulado}
                    disabled={answeredCount === 0}
                    className="button-primary min-h-[44px] text-xs sm:text-sm px-5 py-2"
                  >
                    Finalizar e Corrigir Prova
                  </button>
                </>
              ) : (
                  <button
                    type="button"
                    onClick={handleResetSimulado}
                    className="button-secondary min-h-[44px] text-xs sm:text-sm px-4 py-2"
                >
                  <RotateCcw className="w-4 h-4 text-teal-700" />
                  <span>Refazer Simulado</span>
                </button>
              )}
            </div>
          </div>

          {timerMessage && !isSubmitted && (
            <p className="text-xs text-slate-600 -mt-3" aria-live="polite">{timerMessage}</p>
          )}

          {/* Results Summary Card when Submitted */}
          {isSubmitted && (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-900 border border-teal-200 flex items-center justify-center font-black text-2xl">
                    {percentage}%
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Resultado Consolidado da Prova
                    </h2>
                    <p className="text-xs text-slate-500">
                      Aproveitamento total: {correctCount} acertos de {questions.length} itens.
                    </p>
                  </div>
                </div>

                {answeredWrongCount > 0 && (
                  <button
                    onClick={handleAddAllErrors}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-900 text-xs font-bold px-4 py-2.5 rounded-xl border border-rose-200 flex items-center space-x-2 transition cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-rose-700" />
                    <span>Adicionar Todos os Erros ao Caderno</span>
                  </button>
                )}
              </div>

              {/* Performance Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-medium">Acertos</span>
                  <div className="text-2xl font-black text-emerald-700">{correctCount}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-medium">Erros / em branco</span>
                  <div className="text-2xl font-black text-rose-700">{wrongCount}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-medium">Aproveitamento</span>
                  <div className="text-2xl font-black text-teal-800">{percentage}%</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-1">
                  <span className="text-xs text-slate-500 font-medium">Diagnóstico</span>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    {percentage >= 80 ? 'Excelente (Zona de Aprovado)' : percentage >= 60 ? 'Bom (Necessita revisão pontual)' : 'Atenção às aulas fundamentais'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Question Navigator Grid */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              Cartão de Respostas / Acesso Rápido:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {questions.map((q, idx) => {
                const userAns = userAnswers[q.id];
                const isCurrent = idx === currentQIndex;
                let btnStyle = 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100';

                if (isSubmitted) {
                  if (userAns === q.correctAnswer) {
                    btnStyle = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
                  } else if (userAns) {
                    btnStyle = 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
                  } else {
                    btnStyle = 'bg-slate-100 text-slate-400 border-slate-200';
                  }
                } else if (userAns) {
                  btnStyle = 'bg-teal-100 text-teal-900 border-teal-300 font-bold';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goToQuestion(idx)}
                    disabled={isExamPaused}
                    aria-label={`Ir para a questão ${idx + 1}${userAns ? ', respondida' : ', não respondida'}`}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`w-11 h-11 rounded-lg text-xs font-bold transition border flex items-center justify-center cursor-pointer ${btnStyle} ${
                      isCurrent ? 'ring-2 ring-teal-700 ring-offset-1 font-extrabold' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Question Card */}
          {currentQ && (
            <div
              key={currentQ.id}
              className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 question-content-enter"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
                  Questão {currentQIndex + 1} de {questions.length}
                </span>
                <span className="text-xs text-slate-700 font-medium">
                  {currentQ.type === 'CERTO_ERRADO' ? 'Certo ou Errado' : 'Múltipla Escolha'}
                </span>
              </div>

              {currentQ.supportText && (
                <div className="bg-slate-50 p-4 rounded-xl text-xs sm:text-sm italic text-slate-700 border-l-3 border-teal-700 shadow-2xs">
                  "{currentQ.supportText}"
                </div>
              )}

              <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
                {currentQ.questionText}
              </p>

              {/* Options */}
              {currentQ.type === 'CERTO_ERRADO' ? (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {['C', 'E'].map((val) => {
                    const isSelected = userAnswers[currentQ.id] === val;
                    const isCorrectVal = val === currentQ.correctAnswer;

                    let btnClass = 'bg-white text-slate-800 border-slate-200 hover:border-teal-600 hover:bg-slate-50';
                    if (isSubmitted) {
                      if (isCorrectVal) btnClass = 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold';
                      else if (isSelected) btnClass = 'bg-rose-50 text-rose-900 border-rose-300 font-bold';
                    } else if (isSelected) {
                      btnClass = 'bg-teal-50 text-teal-900 border-teal-300 font-bold';
                    }

                    return (
                      <button
                        key={val}
                        onClick={() => handleSelectAnswer(currentQ.id, val)}
                        disabled={isSubmitted || isExamPaused}
                        className={`p-4 rounded-xl font-bold text-sm sm:text-base transition border min-h-[44px] cursor-pointer ${btnClass}`}
                      >
                        {val === 'C' ? 'CERTO' : 'ERRADO'}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {currentQ.options?.map((opt) => {
                    const isSelected = userAnswers[currentQ.id] === opt.letter;
                    const isCorrectOpt = opt.letter === currentQ.correctAnswer;

                    let optClass = 'bg-white text-slate-800 border-slate-200 hover:border-teal-600 hover:bg-slate-50';
                    if (isSubmitted) {
                      if (isCorrectOpt) optClass = 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold';
                      else if (isSelected) optClass = 'bg-rose-50 text-rose-900 border-rose-300 font-bold';
                    } else if (isSelected) {
                      optClass = 'bg-teal-50 text-teal-900 border-teal-300 font-bold';
                    }

                    return (
                      <button
                        key={opt.letter}
                        onClick={() => handleSelectAnswer(currentQ.id, opt.letter)}
                        disabled={isSubmitted || isExamPaused}
                        className={`w-full text-left p-4 rounded-xl text-xs sm:text-sm font-medium transition border flex items-start space-x-3 min-h-[44px] cursor-pointer ${optClass}`}
                      >
                        <span className="font-bold shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs">
                          {opt.letter}
                        </span>
                        <span className="pt-0.5 leading-relaxed">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Display Explanation if Submitted */}
              {isSubmitted && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-900">
                      {isOfficialQuestion ? 'Comentário editorial preservado:' : 'Gabarito comentado autoral:'}
                    </span>
                    {userAnswers[currentQ.id] !== currentQ.correctAnswer && (
                      <button
                        onClick={() =>
                          onAddErrorToNotebook(
                            currentQ.topic || 'Simulado Final',
                            `Errei a questão ${currentQ.id}: marquei ${userAnswers[currentQ.id] || 'sem resposta'} e o gabarito era ${currentQ.correctAnswer}`,
                            currentQ.commentary,
                            {
                              origin: currentQ.origin === 'official' ? 'official_question' : currentQ.origin === 'ai_generated' ? 'ai_generated' : 'simulado',
                              questionId: currentQ.officialQuestionId || currentQ.id,
                              questionText: currentQ.questionText,
                              selectedAnswer: userAnswers[currentQ.id],
                              correctAnswer: currentQ.correctAnswer,
                              bank: currentQ.bank,
                              topic: currentQ.topic,
                              moduleRef: currentQ.moduleId,
                              conceptIds: currentQ.conceptIds,
                              sourceRefs: currentQ.sourceRefs,
                            }
                          )
                        }
                        className="bg-white hover:bg-rose-50 text-rose-800 font-bold px-3 py-1 rounded-md border border-rose-300 text-xs transition cursor-pointer"
                      >
                        + Caderno de Erros
                      </button>
                    )}
                  </div>
                  <p className="text-slate-700 leading-relaxed pt-1">
                    {currentQ.commentary}
                  </p>
                </div>
              )}

              {/* Prev / Next controls */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  disabled={currentQIndex === 0 || isExamPaused}
                  onClick={() => goToQuestion(currentQIndex - 1)}
                  className="button-secondary text-xs sm:text-sm min-h-[44px] px-4"
                >
                  <ChevronLeft className="w-4 h-4 text-teal-700" />
                  <span>Anterior</span>
                </button>

                <button
                  disabled={currentQIndex === questions.length - 1 || isExamPaused}
                  onClick={() => goToQuestion(currentQIndex + 1)}
                  className="button-primary text-xs sm:text-sm min-h-[44px] px-5"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Mobile Cartão de Respostas Drawer Modal */}
          {isAnswerCardOpen && (
            <div
              className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex flex-col justify-end lg:hidden"
              onClick={() => setIsAnswerCardOpen(false)}
            >
              <div
                ref={answerCardDialogRef}
                id="answer-card-dialog"
                className="bg-white rounded-t-2xl p-5 border-t border-slate-200 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="answer-card-dialog-title"
                tabIndex={-1}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 id="answer-card-dialog-title" className="font-bold text-slate-900 text-base">Cartão de Respostas</h3>
                    <p className="text-xs text-slate-500">
                      Respondidas: <strong>{answeredCount}</strong> de {questions.length}
                    </p>
                  </div>
                  <button
                    ref={answerCardCloseRef}
                    type="button"
                    onClick={() => setIsAnswerCardOpen(false)}
                    className="text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg"
                    aria-label="Fechar cartão de respostas"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-2 pt-1">
                  {questions.map((q, idx) => {
                    const userAns = userAnswers[q.id];
                    const isCurrent = idx === currentQIndex;
                    let btnStyle = 'bg-slate-50 text-slate-700 border-slate-200';

                    if (isSubmitted) {
                      if (userAns === q.correctAnswer) {
                        btnStyle = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
                      } else if (userAns) {
                        btnStyle = 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
                      }
                    } else if (userAns) {
                      btnStyle = 'bg-teal-100 text-teal-900 border-teal-300 font-bold';
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => goToQuestion(idx)}
                        disabled={isExamPaused}
                        aria-label={`Ir para a questão ${idx + 1}${userAns ? ', respondida' : ', não respondida'}`}
                        aria-current={isCurrent ? 'step' : undefined}
                        className={`h-11 rounded-xl text-xs font-bold border flex items-center justify-center transition cursor-pointer ${btnStyle} ${
                          isCurrent ? 'ring-2 ring-teal-700 ring-offset-1 font-black' : ''
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                {!isSubmitted && (
                  <button
                    onClick={handleSubmitSimulado}
                    disabled={answeredCount === 0}
                    className="button-primary w-full py-3.5 text-sm font-bold min-h-[48px] mt-2"
                  >
                    Finalizar e Corrigir Prova
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Mode 2: AI Questão Generator */
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
              <Bot className="w-5 h-5 text-teal-700" />
              <h2>Gerador Personalizado de Questões Inéditas por IA</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-900">
                  Assunto Gramatical:
                </label>
                <input
                  type="text"
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  className="input-field w-full p-3 text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-900">
                  Estilo de Banca:
                </label>
                <select
                  value={genBank}
                  onChange={(e) => setGenBank(e.target.value)}
                  className="input-field w-full p-3 text-xs sm:text-sm"
                >
                  <option value="CEBRASPE (Certo/Errado)">CEBRASPE (Certo/Errado)</option>
                  <option value="FGV (Múltipla Escolha)">FGV (Múltipla Escolha)</option>
                  <option value="FCC (Reescrita e Concordância)">FCC (Reescrita e Concordância)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-900">
                  Quantidade:
                </label>
                <select
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="input-field w-full p-3 text-xs sm:text-sm"
                >
                  <option value={3}>3 Questões</option>
                  <option value={5}>5 Questões</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerateQuestions}
              disabled={isGenerating}
              className="button-primary px-6 py-3 text-sm"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-white" />
                  <span>Gerando questões inéditas...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Gerar Questões com IA</span>
                </>
              )}
            </button>
            {generationError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{generationError}</p>}
          </div>

          {/* Generated Questions List */}
          {genQuestions.length > 0 && (
            <div className="space-y-6">
              {genQuestions.map((q, idx) => {
                const userAns = genUserAnswers[q.id];
                const isCorrect = userAns === q.correctAnswer;

                return (
                  <div
                    key={q.id || idx}
                    className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4 question-content-enter"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
                      Questão Inédita {idx + 1} ({genBank})
                    </span>

                    <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
                      {q.questionText}
                    </p>

                    <div className="flex space-x-3 pt-2">
                      {['C', 'E'].map((val) => (
                        <button
                          key={val}
                          onClick={() =>
                            setGenUserAnswers((prev) => ({ ...prev, [q.id]: val }))
                          }
                          className={`flex-1 py-3 rounded-xl font-bold text-sm transition border min-h-[44px] cursor-pointer ${
                            userAns === val
                              ? val === q.correctAnswer
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                                : 'bg-rose-50 text-rose-900 border-rose-300 font-bold'
                              : 'bg-white text-slate-800 border-slate-200 hover:border-teal-600 hover:bg-slate-50'
                          }`}
                        >
                          {val === 'C' ? 'CERTO' : 'ERRADO'}
                        </button>
                      ))}
                    </div>

                    {userAns && (
                      <div
                        className={`p-4 rounded-2xl border text-xs sm:text-sm space-y-2 ${
                          isCorrect
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                            : 'bg-rose-50/80 border-rose-200 text-rose-950'
                        }`}
                      >
                        <p className="font-bold">
                          {isCorrect ? '✓ Resposta Correta!' : `✕ Incorreto. Gabarito: ${q.correctAnswer}`}
                        </p>
                        <p className="leading-relaxed">
                          {q.commentary}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
