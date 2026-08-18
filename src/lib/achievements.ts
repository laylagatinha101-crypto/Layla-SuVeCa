export type AchievementId = 'first_note' | 'streak_10';

export interface AchievementProgress {
  currentStreak: number;
  bestStreak: number;
  /** Consecutive calendar days with a completed study activity. */
  studyStreak: number;
  longestStudyStreak: number;
  /** Local calendar day (YYYY-MM-DD) of the last completed module or quiz. */
  lastStudyDate?: string;
  unlocked: Partial<Record<AchievementId, string>>;
}

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  kind: 'note' | 'streak';
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_note',
    title: 'Caneta em ação',
    description: 'Registre a sua primeira anotação de estudo.',
    kind: 'note',
  },
  {
    id: 'streak_10',
    title: 'Sequência de ouro',
    description: 'Conquiste 10 acertos seguidos em exercícios ou simulados.',
    kind: 'streak',
  },
];

export const EMPTY_ACHIEVEMENT_PROGRESS: AchievementProgress = {
  currentStreak: 0,
  bestStreak: 0,
  studyStreak: 0,
  longestStudyStreak: 0,
  lastStudyDate: undefined,
  unlocked: {},
};

const isAchievementId = (value: string): value is AchievementId =>
  value === 'first_note' || value === 'streak_10';

export const normalizeAchievementProgress = (
  value: unknown
): AchievementProgress => {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_ACHIEVEMENT_PROGRESS, unlocked: {} };
  }

  const candidate = value as Partial<AchievementProgress>;
  const unlocked: Partial<Record<AchievementId, string>> = {};

  if (candidate.unlocked && typeof candidate.unlocked === 'object') {
    Object.entries(candidate.unlocked).forEach(([id, unlockedAt]) => {
      if (isAchievementId(id) && typeof unlockedAt === 'string') {
        unlocked[id] = unlockedAt;
      }
    });
  }

  return {
    currentStreak:
      typeof candidate.currentStreak === 'number' && candidate.currentStreak >= 0
        ? candidate.currentStreak
        : 0,
    bestStreak:
      typeof candidate.bestStreak === 'number' && candidate.bestStreak >= 0
        ? candidate.bestStreak
        : 0,
    studyStreak:
      typeof candidate.studyStreak === 'number' && candidate.studyStreak >= 0
        ? candidate.studyStreak
        : 0,
    longestStudyStreak:
      typeof candidate.longestStudyStreak === 'number' && candidate.longestStudyStreak >= 0
        ? candidate.longestStudyStreak
        : 0,
    lastStudyDate:
      typeof candidate.lastStudyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate.lastStudyDate)
        ? candidate.lastStudyDate
        : undefined,
    unlocked,
  };
};

const unlock = (
  progress: AchievementProgress,
  achievementId: AchievementId,
  now: string
): AchievementProgress => {
  if (progress.unlocked[achievementId]) return progress;

  return {
    ...progress,
    unlocked: {
      ...progress.unlocked,
      [achievementId]: now,
    },
  };
};

export const recordStudyNote = (
  progress: AchievementProgress,
  now = new Date().toISOString()
): AchievementProgress => unlock(progress, 'first_note', now);

export const recordAnswerResult = (
  progress: AchievementProgress,
  isCorrect: boolean,
  now = new Date().toISOString()
): AchievementProgress => {
  const currentStreak = isCorrect ? progress.currentStreak + 1 : 0;
  let next: AchievementProgress = {
    ...progress,
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
  };

  if (currentStreak >= 10) {
    next = unlock(next, 'streak_10', now);
  }

  return next;
};

/**
 * Uses the learner's local day instead of UTC so a late-night Brazilian study
 * session does not unexpectedly break the daily sequence. Calling it more
 * than once on the same day is intentionally idempotent.
 */
export const studyDayKey = (value: Date = new Date()) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate()
  ).padStart(2, '0')}`;

/**
 * A streak remains alive until the end of the day after the last activity.
 * If two calendar days are missed, present it as zero without mutating cloud
 * state merely because the profile was opened.
 */
export const getActiveStudyStreak = (
  progress: AchievementProgress,
  now = new Date()
) => {
  if (!progress.lastStudyDate) return 0;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return progress.lastStudyDate === studyDayKey(now) ||
    progress.lastStudyDate === studyDayKey(yesterday)
    ? progress.studyStreak
    : 0;
};

export const recordStudyActivity = (
  progress: AchievementProgress,
  now = new Date()
): AchievementProgress => {
  const today = studyDayKey(now);
  if (progress.lastStudyDate === today) return progress;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const continuesStreak = progress.lastStudyDate === studyDayKey(yesterday);
  const studyStreak = continuesStreak ? progress.studyStreak + 1 : 1;

  return {
    ...progress,
    studyStreak,
    longestStudyStreak: Math.max(progress.longestStudyStreak, studyStreak),
    lastStudyDate: today,
  };
};

export const hasNewUnlock = (
  previous: AchievementProgress,
  next: AchievementProgress
): AchievementId | null => {
  const newlyUnlocked = ACHIEVEMENTS.find(
    (achievement) =>
      !previous.unlocked[achievement.id] && next.unlocked[achievement.id]
  );

  return newlyUnlocked?.id || null;
};
