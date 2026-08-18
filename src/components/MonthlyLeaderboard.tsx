import React from 'react';
import { Crown, LockKeyhole, Medal, RefreshCw, Trophy, UserRound } from 'lucide-react';
import type { User } from '../lib/firebase';
import {
  useMonthlyLeaderboard,
  type LeaderboardAttempt,
} from '../hooks/useMonthlyLeaderboard';

interface MonthlyLeaderboardProps {
  user?: User | null;
  attempts?: readonly LeaderboardAttempt[];
}

const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
};

const rankStyle = (rank: number) => {
  if (rank === 1) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (rank === 2) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (rank === 3) return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-slate-50 text-slate-500 border-slate-200';
};

export const MonthlyLeaderboard: React.FC<MonthlyLeaderboardProps> = ({
  user,
  attempts = [],
}) => {
  const {
    monthKey,
    correctAnswers,
    entries,
    isLoading,
    isSyncing,
    error,
    shareFirstName,
    updateShareFirstName,
  } = useMonthlyLeaderboard({ user, attempts });

  return (
    <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-800 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full">
            <Trophy className="w-3.5 h-3.5" />
            Ranking mensal
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Mais acertos em {monthLabel(monthKey)}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Acertos de práticas editoriais validados no servidor neste mês.
          </p>
        </div>
        {user && (
          <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-2.5 text-right">
            <div className="text-xl font-black text-teal-800">{correctAnswers}</div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-teal-700">acertos validados</div>
          </div>
        )}
      </div>

      {!user ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex items-start gap-3 text-sm text-slate-600">
          <LockKeyhole className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <p>Entre na sua conta para participar e consultar o ranking mensal.</p>
        </div>
      ) : (
        <>
          <label className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shareFirstName}
              onChange={(event) => updateShareFirstName(event.target.checked)}
              className="mt-0.5 w-4 h-4 accent-teal-700"
            />
            <span className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Mostrar apenas meu primeiro nome no ranking. Por padrão, seu perfil aparece como
              <strong className="text-slate-800"> Estudante SuVeCA</strong>; e-mail, foto e histórico de questões nunca são públicos.
            </span>
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 p-3 text-xs font-medium">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2" aria-label="Carregando ranking">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Finalize um simulado para inaugurar o ranking deste mês.
            </div>
          ) : (
            <ol className="space-y-2" aria-label="Classificação do ranking mensal">
              {entries.map((entry, index) => {
                const rank = index + 1;
                return (
                  <li
                    key={entry.id}
                    className={`rounded-xl border p-3.5 flex items-center gap-3 ${
                      entry.isCurrentUser
                        ? 'bg-teal-50 border-teal-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black ${rankStyle(rank)}`}>
                      {rank === 1 ? <Crown className="w-4 h-4" /> : rank}
                    </span>
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0">
                      <UserRound className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-slate-900 truncate">
                        {entry.alias}{entry.isCurrentUser ? ' (você)' : ''}
                      </div>
                      <div className="text-xs text-slate-500">Acertos no mês</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-teal-800 font-black text-lg">
                      {rank <= 3 && <Medal className="w-4 h-4 text-amber-600" />}
                      {entry.correctAnswers}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {isSyncing && (
            <p className="text-xs text-teal-700 font-medium flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Validando sua pontuação...
            </p>
          )}
        </>
      )}
    </section>
  );
};
