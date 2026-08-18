import { describe, expect, it } from 'vitest';
import type { ErrorFlashcard } from '../types/suveca';
import { deriveErrorReviewStatus, scheduleFlashcard } from './spacedRepetition';

const card = (id: string): ErrorFlashcard => ({
  id,
  errorId: 'error-1',
  source: 'caderno',
  topic: 'Concordância',
  front: 'Pergunta',
  back: 'Resposta',
  createdAt: '2026-01-01T00:00:00.000Z',
  correctCount: 0,
  incorrectCount: 0,
});

describe('repetição espaçada por cartão', () => {
  it('penaliza resposta com dica e não altera cartões irmãos', () => {
    const now = new Date('2026-08-12T12:00:00.000Z');
    const first = scheduleFlashcard(card('a'), 'good', true, now);
    const sibling = card('b');

    expect(first.lastRating).toBe('hard');
    expect(first.intervalDays).toBe(1);
    expect(sibling.nextReviewAt).toBeUndefined();
  });

  it('só domina a regra quando todos os cartões demonstram domínio', () => {
    const mastered = {
      ...card('a'),
      repetitions: 4,
      intervalDays: 30,
      masteryScore: 0.9,
      lastReviewUsedHint: false,
    };
    const weak = { ...card('b'), repetitions: 1, intervalDays: 1, masteryScore: 0.2 };

    expect(deriveErrorReviewStatus([mastered, weak])).toBe('dia1');
    expect(deriveErrorReviewStatus([mastered, { ...mastered, id: 'b' }])).toBe('dominado');
  });
});
