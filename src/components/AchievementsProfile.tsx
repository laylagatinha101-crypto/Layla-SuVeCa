import React, { useState } from 'react';
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  FilePenLine,
  Flame,
  LockKeyhole,
  Sliders,
  Trophy,
} from 'lucide-react';
import type { User } from '../lib/firebase';
import {
  ACHIEVEMENTS,
  getActiveStudyStreak,
  type AchievementDefinition,
  type AchievementProgress,
} from '../lib/achievements';
import { MonthlyLeaderboard } from './MonthlyLeaderboard';
import { StudyPreferences } from './StudyPreferences';
import type { LeaderboardAttempt } from '../hooks/useMonthlyLeaderboard';

interface AchievementsProfileProps {
  user?: User | null;
  progress: AchievementProgress;
  isLoading?: boolean;
  onOpenModules?: () => void;
  attempts?: readonly LeaderboardAttempt[];
  pendingErrorCount?: number;
}

type ProfileSubTab = 'achievements' | 'preferences';

const iconForAchievement = (achievement: AchievementDefinition) =>
  achievement.kind === 'note' ? FilePenLine : Flame;

const formatUnlockedDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Conquistada';
  return `Conquistada em ${parsed.toLocaleDateString('pt-BR')}`;
};

export const AchievementsProfile: React.FC<AchievementsProfileProps> = ({
  user,
  progress,
  isLoading = false,
  onOpenModules,
  attempts = [],
  pendingErrorCount = 0,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ProfileSubTab>('achievements');

  const unlockedCount = ACHIEVEMENTS.filter(
    (achievement) => progress.unlocked[achievement.id]
  ).length;
  const activeStudyStreak = getActiveStudyStreak(progress);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <header className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-5 sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Perfil do usuário'}
              className="w-14 h-14 rounded-2xl object-cover border border-teal-200"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-black text-xl border border-teal-200">
              {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'S'}
            </div>
          )}
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
              <Trophy className="w-3.5 h-3.5" />
              Perfil do Estudante SuVeCA
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
              {user?.displayName || 'Seu perfil de estudos'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Gerencie suas conquistas, histórico e preferências de lembretes diários FCM.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="rounded-xl bg-teal-50 border border-teal-200 px-5 py-3 text-center">
            <div className="text-2xl font-black text-teal-800">
              {unlockedCount}/{ACHIEVEMENTS.length}
            </div>
            <div className="text-[11px] uppercase tracking-wide font-bold text-teal-700">
              badges obtidos
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Sub-Tabs inside Profile */}
      <nav aria-label="Navegação do Perfil" className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('achievements')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm transition-all ${
            activeSubTab === 'achievements'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-700" />
          Conquistas & Ranking
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('preferences')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm transition-all ${
            activeSubTab === 'preferences'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Sliders className="w-4 h-4 text-teal-700" />
          Preferências de Estudo & FCM
        </button>
      </nav>

      {/* Sub-Tab 1: Achievements & Ranking */}
      {activeSubTab === 'achievements' && (
        <div className="space-y-8">
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Progresso de conquistas">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center border border-orange-200">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold">Sequência atual</div>
                <div className="text-xl font-black text-slate-900">
                  {progress.currentStreak} acerto{progress.currentStreak === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold">Melhor sequência</div>
                <div className="text-xl font-black text-slate-900">
                  {progress.bestStreak} acerto{progress.bestStreak === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-200">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold">Sequência diária</div>
                <div className="text-xl font-black text-slate-900">
                  {activeStudyStreak} dia{activeStudyStreak === 1 ? '' : 's'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Melhor: {progress.longestStudyStreak} dia{progress.longestStudyStreak === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          </section>

          {/* Quick Callout to Preferences */}
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl p-5 border border-teal-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 border border-teal-300">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Configure seus lembretes diários FCM</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Defina horários e dias de estudo para nunca perder o ritmo da sua aprovação.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('preferences')}
              className="button-primary text-xs px-4 py-2 shrink-0"
            >
              Abrir Preferências de Estudo
            </button>
          </div>

          <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Meus badges</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {isLoading ? 'Sincronizando suas conquistas...' : 'As conquistas são salvas no seu perfil.'}
                </p>
              </div>
              {onOpenModules && !progress.unlocked.first_note && (
                <button type="button" onClick={onOpenModules} className="button-secondary text-xs">
                  <FilePenLine className="w-4 h-4 text-teal-700" />
                  Fazer uma anotação
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ACHIEVEMENTS.map((achievement) => {
                const unlockedAt = progress.unlocked[achievement.id];
                const Icon = unlockedAt ? iconForAchievement(achievement) : LockKeyhole;

                return (
                  <article
                    key={achievement.id}
                    className={`rounded-2xl p-5 border flex items-start gap-4 ${
                      unlockedAt
                        ? 'bg-amber-50/70 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center border ${
                        unlockedAt
                          ? 'bg-white text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-slate-900">{achievement.title}</h3>
                        {unlockedAt && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{achievement.description}</p>
                      <p className={`text-xs font-semibold mt-3 ${unlockedAt ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {unlockedAt ? formatUnlockedDate(unlockedAt) : 'Ainda não desbloqueada'}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <MonthlyLeaderboard user={user} attempts={attempts} />
        </div>
      )}

      {/* Sub-Tab 2: Study Preferences Screen */}
      {activeSubTab === 'preferences' && (
        <StudyPreferences user={user} pendingErrorCount={pendingErrorCount} />
      )}
    </div>
  );
};

