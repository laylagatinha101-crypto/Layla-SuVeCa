export type QuestionType = 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';

export interface QuizOption {
  letter: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  bank?: string;
  topic?: string;
  supportText?: string;
  questionText: string;
  options?: QuizOption[];
  correctAnswer: string; // 'C', 'E', or 'A', 'B', 'C', 'D', 'E'
  commentary: string;
  /** Origem pedagógica; conteúdo da fonte editorial nunca deve ser reescrito pelo app. */
  origin?: 'official' | 'authorial' | 'ai_generated';
  officialQuestionId?: string;
  questionSetVersion?: string;
  moduleId?: string;
  conceptIds?: string[];
  sourceRefs?: string[];
  resolution?: {
    decisiveRule?: string;
    mentalTest?: string;
    whyCorrect?: string;
    distractors?: Array<{ option: string; explanation: string }>;
    contrastOrException?: string;
    nextConceptId?: string;
  };
}

export interface ModuleSection {
  title: string;
  contentMarkdown: string;
  /** Conteúdo aprofundado publicado separadamente e carregado apenas quando o aluno o abre. */
  contentUrl?: string;
  summary?: string;
  lessonId?: string;
  groupId?: string;
  canonicalTopicId?: string;
  estimatedMinutes?: number;
  searchTerms?: string[];
  /** Rastreabilidade editorial da revisão integral do corpus. */
  editorial?: {
    reviewVersion: string;
    changeType:
      | 'expanded_after_fulltext_review'
      | 'new_module_after_architecture_gap'
      | 'correct'
      | 'expand'
      | 'new_section'
      | 'replace_from_pedagogical_source';
    integrationUnitId?: string;
    authority?: Record<string, unknown>;
    sourceProvider?: string;
    evidenceRefs: Array<{
      sourceId: string;
      sourceTitle: string;
      fulltextSha256: string;
      characterRange: [number, number];
      passageId?: string;
      passageTextSha256?: string;
      editorialDecision?: string;
    }>;
  };
  sourceConceptIds?: string[];
  /** Relação pedagógica exata deste grupo com a SuVeCA; não herda automaticamente o nível da aula. */
  suvecaMethod?: SuvecaMethodConnection;
  limitsAndExceptions?: string[];
  contrasts?: string[];
  examTraps?: string[];
  keyTable?: {
    headers: string[];
    rows: string[][];
  };
  highlightBox?: {
    title: string;
    text: string;
    type?: 'warning' | 'tip' | 'rule';
  };
}

export type KnowledgeEditorialStatus =
  | 'pending_semantic_review'
  | 'pending_editorial_review'
  | 'approved_ai_reviewed'
  | 'needs_revision'
  | 'insufficient_evidence'
  | 'conflicting_evidence'
  | 'reviewed'
  | 'approved'
  | 'deprecated';

export interface KnowledgeSourceRef {
  id: string;
  title: string;
  type: string;
  url?: string | null;
  score: number;
}

export interface ModuleKnowledgeMeta {
  kbVersion: string;
  buildId: string;
  editorialStatus: KnowledgeEditorialStatus;
  reviewVersion?: string;
  reviewedAt?: string;
  reviewerType?: 'ai' | 'human';
  reviewConfidence?: number | null;
  sourceCount: number;
  sources: KnowledgeSourceRef[];
}

export interface SuvecaMethodConnection {
  methodId: string;
  equation: string;
  definition: string;
  authorityNote: string;
  level: 'central' | 'strong' | 'support' | 'indirect' | 'outside_core' | 'review';
  label: string;
  summary: string;
  steps: string[];
  limits: string[];
}

export interface ModuleData {
  id: string; // 'mod0' ... 'mod14' ou 'simulado'
  num: number | string;
  title: string;
  subtitle: string;
  description: string;
  estimatedMinutes?: number;
  sections: ModuleSection[];
  questions?: QuizQuestion[];
  /** Aplicação da metodologia SuVeCA ao conteúdo desta aula, sem alterar a autoridade normativa. */
  suvecaMethod?: SuvecaMethodConnection;
  /** Proveniência da fonte editorial das aulas 00–14. */
  knowledge?: ModuleKnowledgeMeta;
}

export interface SuvecaBlock {
  text: string;
  category: 'SUJEITO' | 'VERBO' | 'COMPLEMENTO' | 'ADJUNTO_ADVERBIAL' | 'ADJUNTO_ADNOMINAL' | 'PREDICATIVO' | 'CONECTOR' | 'VOCATIVO' | 'APOSTO';
  shortLabel: string; // 'Su', 'Ve', 'C(OD)', 'C(OI)', 'Aadv', etc.
  colorTag: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'cyan' | 'gray';
  morphology?: string;
  explanation: string;
}

export interface SuvecaAnalysisResult {
  sentence: string;
  order: string;
  verbalVoice: string;
  /** Sequência dos blocos tal como aparecem na frase, por exemplo A + Ve + Su. */
  surfacePattern?: string;
  /** Relações reconstruídas pelo mapa, sem impor a ordem direta à frase original. */
  relationalMap?: string;
  implicitElements?: string[];
  blocks: SuvecaBlock[];
  summaryExplanation: string;
  contestTips?: string[];
  knowledgeSources?: string[];
}

export interface CadernoErroItem {
  id: string;
  date: string;
  conteudo: string;
  erroCometido: string;
  regraDecisiva: string;
  novoExemplo: string;
  status: 'dia0' | 'dia1' | 'dia7' | 'dia30' | 'dominado';
  moduleRef?: string;
  origin?: 'manual' | 'module_question' | 'official_question' | 'simulado' | 'ai_generated';
  questionId?: string;
  questionText?: string;
  selectedAnswer?: string;
  correctAnswer?: string;
  bank?: string;
  year?: number;
  difficulty?: string;
  topic?: string;
  conceptIds?: string[];
  sourceRefs?: string[];
  lastReviewedAt?: string;
  nextReviewAt?: string;
}

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export interface ErrorFlashcard {
  id: string;
  errorId?: string;
  /** Módulo editorial ao qual o cartão pertence; usado no recorte contextual da apostila. */
  moduleId?: string;
  source: 'caderno' | 'suveca';
  topic: string;
  front: string;
  back: string;
  hint?: string;
  explanation?: string;
  /** Internal provenance for audit; never render in learner-facing content. */
  sourceRefs?: string[];
  hintUsedCount?: number;
  lastReviewUsedHint?: boolean;
  createdAt: string;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  correctCount: number;
  incorrectCount: number;
  /** Campos individuais do agendamento SM-2 simplificado. */
  repetitions?: number;
  intervalDays?: number;
  easeFactor?: number;
  lapseCount?: number;
  lastRating?: FlashcardRating;
  masteryScore?: number;
}

export interface StudyPreferences {
  enabled: boolean;
  reminderTime: string;
  secondaryReminderEnabled: boolean;
  secondaryReminderTime: string;
  daysOfWeek: string[];
  topics: {
    cadernoErros: boolean;
    dicasGramatica: boolean;
    simuladoMetas: boolean;
    dueloDesafios: boolean;
  };
  emailBackupEnabled: boolean;
  soundEnabled: boolean;
  timeZone: string;
  updatedAt: string;
}

export interface PomodoroSession {
  id: string;
  topic: string;
  moduleId?: string;
  mode: 'foco' | 'pausa_curta' | 'pausa_longa';
  durationMinutes: number;
  completedAt: string;
  note?: string;
}

export interface TopicAttemptStats {
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
}

export interface SimuladoAttempt {
  id: string;
  completedAt: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  percentage: number;
  timerEnabled: boolean;
  timeRemainingSeconds?: number;
  byTopic: Record<string, TopicAttemptStats>;
  /** Respostas brutas enviadas para validação do placar no backend. */
  answerMap?: Record<string, string>;
  questionSetVersion?: string;
}

export interface ChecklistItem {
  id: string;
  topic: string;
  moduleNum: number;
  status: 'nao_iniciado' | 'em_estudo' | 'dominado' | 'revisar';
}

export interface DecisionOption {
  label: string;
  targetNodeId?: string;
  result?: string;
  ruleExplanation?: string;
  examples?: string[];
}

export interface DecisionNode {
  id: string;
  title: string;
  question: string;
  options: DecisionOption[];
}

export interface DecisionTreeSet {
  id: string;
  title: string;
  description: string;
  startNodeId: string;
  nodes: Record<string, DecisionNode>;
}
