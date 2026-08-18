import type { CadernoErroItem, ErrorFlashcard, FlashcardRating } from '../types/suveca';

const DAY_MS = 24 * 60 * 60 * 1000;

const effectiveRating = (rating: FlashcardRating, usedHint: boolean): FlashcardRating => {
  if (!usedHint) return rating;
  if (rating === 'easy') return 'good';
  if (rating === 'good') return 'hard';
  if (rating === 'hard') return 'again';
  return rating;
};

/**
 * Deterministic, per-card SM-2 adaptation. Hints reduce the effective grade,
 * so recognition with assistance cannot masquerade as unaided recall.
 */
export const scheduleFlashcard = (
  card: ErrorFlashcard,
  requestedRating: FlashcardRating,
  usedHint: boolean,
  now = new Date(),
): ErrorFlashcard => {
  const rating = effectiveRating(requestedRating, usedHint);
  const ease = Math.min(3, Math.max(1.3, card.easeFactor ?? 2.5));
  const repetitions = Math.max(0, card.repetitions ?? 0);
  const previousInterval = Math.max(0, card.intervalDays ?? 0);

  let nextEase = ease;
  let nextRepetitions = repetitions;
  let intervalDays = previousInterval;
  let lapseCount = card.lapseCount ?? 0;
  let masteryDelta = 0;

  if (rating === 'again') {
    nextEase = Math.max(1.3, ease - 0.2);
    nextRepetitions = 0;
    intervalDays = 4 / 24;
    lapseCount += 1;
    masteryDelta = -0.25;
  } else if (rating === 'hard') {
    nextEase = Math.max(1.3, ease - 0.15);
    nextRepetitions += 1;
    intervalDays = repetitions === 0 ? 1 : Math.max(1, previousInterval * 1.2);
    masteryDelta = 0.08;
  } else if (rating === 'good') {
    nextRepetitions += 1;
    intervalDays = repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.max(1, previousInterval * ease);
    masteryDelta = 0.18;
  } else {
    nextEase = Math.min(3, ease + 0.15);
    nextRepetitions += 1;
    intervalDays = repetitions === 0 ? 4 : Math.max(4, previousInterval * nextEase * 1.3);
    masteryDelta = 0.28;
  }

  const masteryScore = Math.min(1, Math.max(0, (card.masteryScore ?? 0) + masteryDelta));
  const reviewedAt = now.toISOString();
  return {
    ...card,
    repetitions: nextRepetitions,
    intervalDays: Number(intervalDays.toFixed(3)),
    easeFactor: Number(nextEase.toFixed(2)),
    lapseCount,
    lastRating: rating,
    masteryScore: Number(masteryScore.toFixed(2)),
    correctCount: card.correctCount + (rating === 'again' ? 0 : 1),
    incorrectCount: card.incorrectCount + (rating === 'again' ? 1 : 0),
    hintUsedCount: (card.hintUsedCount || 0) + (usedHint ? 1 : 0),
    lastReviewUsedHint: usedHint,
    lastReviewedAt: reviewedAt,
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
  };
};

export const isCardMastered = (card: ErrorFlashcard) =>
  (card.repetitions ?? 0) >= 3 &&
  (card.intervalDays ?? 0) >= 21 &&
  (card.masteryScore ?? 0) >= 0.75 &&
  !card.lastReviewUsedHint;

/** The rule follows the weakest card; only unanimous mastery marks it mastered. */
export const deriveErrorReviewStatus = (
  cards: ErrorFlashcard[],
): CadernoErroItem['status'] => {
  if (!cards.length) return 'dia0';
  if (cards.every(isCardMastered)) return 'dominado';
  const minimumRepetitions = Math.min(...cards.map((card) => card.repetitions ?? 0));
  if (minimumRepetitions >= 3) return 'dia30';
  if (minimumRepetitions >= 2) return 'dia7';
  if (minimumRepetitions >= 1) return 'dia1';
  return 'dia0';
};
