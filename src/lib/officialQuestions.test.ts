import { describe, expect, it } from 'vitest';
import { officialDetailToQuizQuestion, type OfficialQuestionDetail } from './officialQuestions';

const detail = (normalized: Record<string, unknown>): OfficialQuestionDetail => ({
  questionId: 'A00:aula00.q0001',
  provenance: {
    kind: 'editorial_question',
    payloadPolicy: 'source_preserved',
    buildId: '0123456789abcdef',
    questionSetVersion: 'editorial-corpus-0123456789abcdef',
    editorialHashSha256: 'hash',
  },
  editorial: { raw: {}, normalized },
  editorialProjection: {
    primaryLessonId: 'A00',
    lessonIds: ['A00'],
    difficulty: 'UNSPECIFIED',
    answerType: normalized.questionType === 'MULTIPLA_ESCOLHA' ? 'MULTIPLA_ESCOLHA' : 'CERTO_ERRADO',
    correctAnswer: String(normalized.correctAnswer || 'C'),
    topicNames: ['Ortografia Oficial'],
    banks: ['Fonte'],
    organizations: [],
    years: [2024],
    hasCommentary: true,
    extractionConfidence: 0.98,
    answerConfidence: 0.99,
  },
  suvecaDerived: { moduleIds: ['mod0'], conceptIds: ['pt.teste'] },
});

describe('officialDetailToQuizQuestion', () => {
  it('converts a true/false editorial item and preserves its build version', () => {
    const question = officialDetailToQuizQuestion(detail({
      primaryLessonId: 'A00',
      questionType: 'CERTO_ERRADO',
      prompt: 'Julgue o item.',
      correctAnswer: 'E',
      commentary: 'O item está errado porque contraria a regra.',
    }));

    expect(question).toMatchObject({
      id: 'A00:aula00.q0001',
      type: 'CERTO_ERRADO',
      correctAnswer: 'E',
      origin: 'official',
      moduleId: 'mod0',
      questionSetVersion: 'editorial-corpus-0123456789abcdef',
    });
    expect(question.options).toBeUndefined();
  });

  it('converts labels and support text for a multiple-choice item', () => {
    const question = officialDetailToQuizQuestion(detail({
      questionType: 'MULTIPLA_ESCOLHA',
      supportText: 'Texto de apoio.',
      prompt: 'Assinale a opção correta.',
      options: [
        { label: 'a', text: 'Primeira alternativa.' },
        { letter: 'B', text: 'Segunda alternativa.' },
      ],
      correctAnswer: 'B',
      commentary: 'A alternativa B aplica a regra.',
    }));

    expect(question.supportText).toBe('Texto de apoio.');
    expect(question.options).toEqual([
      { letter: 'A', text: 'Primeira alternativa.' },
      { letter: 'B', text: 'Segunda alternativa.' },
    ]);
    expect(question.correctAnswer).toBe('B');
  });
});
