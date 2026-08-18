import React, { useMemo, useState } from 'react';
import { Quote, RefreshCw } from 'lucide-react';
import {
  DAILY_MOTIVATIONS,
  type DailyMotivation,
  getDailyMotivation,
} from '../data/dailyMotivation';

export const DailyMotivationCard: React.FC = () => {
  const initialMotivation = useMemo(() => getDailyMotivation(), []);
  const [motivation, setMotivation] = useState<DailyMotivation>(initialMotivation);

  const showAnother = () => {
    if (DAILY_MOTIVATIONS.length < 2) return;
    const currentIndex = DAILY_MOTIVATIONS.findIndex(
      (item) => item.id === motivation.id
    );
    const offset = 1 + Math.floor(Math.random() * (DAILY_MOTIVATIONS.length - 1));
    setMotivation(DAILY_MOTIVATIONS[(currentIndex + offset) % DAILY_MOTIVATIONS.length]);
  };

  return (
    <section className="rounded-2xl border border-violet-200 bg-linear-to-br from-violet-50 via-white to-sky-50 p-5 shadow-xs sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-800 shadow-xs">
          <Quote className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-violet-800">
              Frase motivacional do dia · {motivation.theme}
            </span>
            <button type="button" onClick={showAnother} className="button-ghost px-2 py-1 text-[11px]">
              <RefreshCw className="h-3.5 w-3.5" /> Outra frase
            </button>
          </div>
          <blockquote className="mt-2 text-base font-bold leading-relaxed text-slate-900 sm:text-lg">
            “{motivation.quote}”
          </blockquote>
          <p className="mt-2 text-xs font-semibold text-slate-600">— {motivation.author}</p>
        </div>
      </div>
    </section>
  );
};
