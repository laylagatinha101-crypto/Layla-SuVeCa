import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { db, type User } from '../lib/firebase';
import { PEDAGOGICAL_KNOWLEDGE_BUILD } from '../data/pedagogicalKnowledge.generated';

export interface LeaderboardAttempt {
  completedAt?: string;
  createdAt?: string;
  correct?: number;
  correctCount?: number;
}

export interface MonthlyLeaderboardEntry {
  id: string;
  alias: string;
  correctAnswers: number;
  isCurrentUser: boolean;
}

const LEADERBOARD_LIMIT = 10;
const CURRICULUM_BUILD_ID = PEDAGOGICAL_KNOWLEDGE_BUILD.buildId;
const leaderboardDocumentKey = (monthKey: string) => `${monthKey}_${CURRICULUM_BUILD_ID}`;

const asNonNegativeInteger = (value: unknown): number => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.floor(numericValue)
    : 0;
};

// Leaderboard documents are written by Functions in the study product's
// timezone. Keep browser reads on the exact same month at midnight abroad.
export const getLeaderboardMonthKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year ?? date.getUTCFullYear()}-${month ?? String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Retained for charts/tests; the public ranking does not use browser totals. */
export const getMonthlyCorrectAnswers = (
  attempts: readonly LeaderboardAttempt[],
  monthKey = getLeaderboardMonthKey()
) =>
  attempts.reduce((total, attempt) => {
    const completedAt = attempt.completedAt || attempt.createdAt;
    if (!completedAt || getLeaderboardMonthKey(new Date(completedAt)) !== monthKey) {
      return total;
    }

    return total + asNonNegativeInteger(attempt.correctCount ?? attempt.correct);
  }, 0);

interface UseMonthlyLeaderboardOptions {
  user?: User | null;
  /** Kept for API compatibility. Scores are calculated by a Cloud Function. */
  attempts?: readonly LeaderboardAttempt[];
  entryLimit?: number;
}

/**
 * Reads server-verified ranking documents. The browser may submit answer maps
 * for validation, but it cannot write leaderboard entries or choose a score.
 */
export const useMonthlyLeaderboard = ({
  user,
  entryLimit = LEADERBOARD_LIMIT,
}: UseMonthlyLeaderboardOptions) => {
  const userId = user?.uid || null;
  const monthKey = useMemo(() => getLeaderboardMonthKey(), []);
  const leaderboardKey = useMemo(() => leaderboardDocumentKey(monthKey), [monthKey]);
  const [entries, setEntries] = useState<MonthlyLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareFirstName, setShareFirstName] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setShareFirstName(false);
    setCorrectAnswers(0);

    if (!userId) return () => {
      cancelled = true;
    };

    const loadSettings = async () => {
      try {
        const settingsSnapshot = await getDoc(
          doc(db, 'users', userId, 'data', 'leaderboard_preferences')
        );
        if (!cancelled) {
          setShareFirstName(settingsSnapshot.data()?.shareFirstName === true);
        }
      } catch (loadError) {
        console.error('Erro ao carregar preferências do ranking:', loadError);
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    const leaderboardQuery = query(
      collection(db, 'leaderboards', leaderboardKey, 'entries'),
      orderBy('correctAnswers', 'desc'),
      limit(entryLimit)
    );

    return onSnapshot(
      leaderboardQuery,
      (snapshot) => {
        setEntries(
          snapshot.docs.map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              alias:
                typeof data.alias === 'string' && data.alias.trim()
                  ? data.alias.slice(0, 32)
                  : 'Estudante SuVeCA',
              correctAnswers: asNonNegativeInteger(data.correctAnswers),
              isCurrentUser: entry.id === userId,
            };
          })
        );
        setIsLoading(false);
      },
      (snapshotError) => {
        console.error('Erro ao carregar ranking mensal:', snapshotError);
        setError('Não foi possível carregar o ranking agora.');
        setIsLoading(false);
      }
    );
  }, [entryLimit, leaderboardKey, userId]);

  useEffect(() => {
    if (!userId) {
      setCorrectAnswers(0);
      return;
    }

    // This record is written by the backend only after it recalculates the
    // attempt from the answer map sent by the client.
    return onSnapshot(
      doc(db, 'leaderboards', leaderboardKey, 'entries', userId),
      (snapshot) => {
        setCorrectAnswers(
          snapshot.exists()
            ? asNonNegativeInteger(snapshot.data().correctAnswers)
            : 0
        );
      },
      (snapshotError) => {
        console.error('Erro ao carregar sua pontuação validada:', snapshotError);
        setError('Não foi possível carregar sua pontuação validada agora.');
      }
    );
  }, [leaderboardKey, userId]);

  const updateShareFirstName = useCallback(
    (shouldShare: boolean) => {
      if (!userId) return;

      setShareFirstName(shouldShare);
      void setDoc(
        doc(db, 'users', userId, 'data', 'leaderboard_preferences'),
        {
          shareFirstName: shouldShare,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((saveError) => {
        console.error('Erro ao salvar preferência do ranking:', saveError);
        setError('Não foi possível salvar sua preferência de privacidade.');
      });
    },
    [userId]
  );

  return {
    monthKey,
    correctAnswers,
    entries,
    isLoading,
    // The client no longer syncs scores: validation happens on the backend.
    isSyncing: false,
    error,
    shareFirstName,
    updateShareFirstName,
  };
};
