import type { QuizQuestion } from '../types/suveca';
import { formatOfficialContent } from './officialContent';

export interface OfficialQuestionIndexItem {
  questionId: string;
  editorialHashSha256: string;
  editorialProjection: {
    primaryLessonId: string;
    lessonIds: string[];
    difficulty: 'UNSPECIFIED';
    answerType: 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';
    correctAnswer: string;
    topicNames: string[];
    banks: string[];
    organizations: string[];
    years: number[];
    hasCommentary: boolean;
    extractionConfidence: number;
    answerConfidence: number;
  };
  suvecaDerived: {
    moduleIds: string[];
    conceptIds: string[];
  };
}

export interface OfficialQuestionDetail {
  questionId: string;
  provenance: {
    kind: 'editorial_question';
    payloadPolicy: 'source_preserved';
    buildId: string;
    questionSetVersion: string;
    editorialHashSha256: string;
  };
  editorial: {
    raw: Record<string, unknown>;
    normalized: Record<string, unknown>;
  };
  editorialProjection: OfficialQuestionIndexItem['editorialProjection'];
  suvecaDerived: {
    moduleIds: string[];
    conceptIds: string[];
  };
}

export interface OfficialQuestionFilters {
  moduleId?: string;
  conceptId?: string;
  topic?: string;
  bank?: string;
  year?: string | number;
  difficulty?: string;
  query?: string;
}

const queryString = (filters: OfficialQuestionFilters & { offset?: number; limit?: number }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
};

export async function fetchOfficialQuestions(
  filters: OfficialQuestionFilters,
  options: { offset?: number; limit?: number } = {},
) {
  const response = await fetch(`/api/knowledge/questions?${queryString({ ...filters, ...options })}`);
  if (!response.ok) throw new Error('Falha ao consultar as questões editoriais.');
  return response.json() as Promise<{
    buildId: string;
    questionSetVersion: string;
    total: number;
    offset: number;
    limit: number;
    items: OfficialQuestionIndexItem[];
  }>;
}

export async function fetchOfficialQuestion(questionId: string) {
  const response = await fetch(`/api/knowledge/questions/${encodeURIComponent(questionId)}`);
  if (!response.ok) throw new Error('Falha ao carregar a questão editorial.');
  return response.json() as Promise<OfficialQuestionDetail>;
}

export async function fetchOfficialQuestionSample(filters: OfficialQuestionFilters, count = 10) {
  const response = await fetch('/api/knowledge/questions/sample', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...filters, count }),
  });
  if (!response.ok) throw new Error('Falha ao montar a amostra de questões editoriais.');
  return response.json() as Promise<{
    count: number;
    questionSetVersion: string;
    questions: OfficialQuestionDetail[];
  }>;
}

export function officialDetailToQuizQuestion(detail: OfficialQuestionDetail): QuizQuestion {
  const normalized = detail.editorial.normalized as {
    primaryLessonId?: string;
    questionType?: 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';
    supportText?: string;
    prompt?: string;
    options?: Array<{ letter?: string; label?: string; text?: string }>;
    correctAnswer?: string;
    commentary?: string;
    bank?: string | null;
    sourceLabel?: string | null;
    conceptIds?: string[];
    sourceRefs?: string[];
  };
  const multipleChoice = normalized.questionType === 'MULTIPLA_ESCOLHA';
  return {
    id: detail.questionId,
    type: multipleChoice ? 'MULTIPLA_ESCOLHA' : 'CERTO_ERRADO',
    bank: formatOfficialContent(normalized.bank || normalized.sourceLabel || 'Fonte editorial da apostila'),
    topic: detail.editorialProjection.topicNames[0] || normalized.primaryLessonId || 'Língua Portuguesa',
    supportText: formatOfficialContent(normalized.supportText) || undefined,
    questionText: formatOfficialContent(normalized.prompt),
    options: multipleChoice
      ? (normalized.options || []).map((option, index) => ({
          letter: String(option.letter || option.label || String.fromCharCode(65 + index)).toUpperCase(),
          text: formatOfficialContent(option.text),
        }))
      : undefined,
    correctAnswer: String(normalized.correctAnswer || detail.editorialProjection.correctAnswer),
    commentary: formatOfficialContent(normalized.commentary || 'Comentário não disponível na fonte editorial.'),
    origin: 'official',
    officialQuestionId: detail.questionId,
    questionSetVersion: detail.provenance.questionSetVersion,
    moduleId: detail.suvecaDerived.moduleIds[0],
    conceptIds: normalized.conceptIds || detail.suvecaDerived.conceptIds,
    sourceRefs: [`QUESTION:${detail.questionId}`, ...(normalized.sourceRefs || [])],
  };
}
