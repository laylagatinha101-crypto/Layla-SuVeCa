import React, { useMemo } from 'react';
import { ArrowRight, Lightbulb, RefreshCw, Sparkles } from 'lucide-react';
import { DAILY_TIPS, DailyTip, getDailyTip } from '../data/dailyTips';

interface DailyTipCardProps {
  onOpenModule?: (moduleId: string) => void;
}

export const DailyTipCard: React.FC<DailyTipCardProps> = ({ onOpenModule }) => {
  const tip = useMemo(() => getDailyTip(), []);
  const [shownTip, setShownTip] = React.useState<DailyTip>(tip);

  const handleShowAnother = () => {
    if (DAILY_TIPS.length < 2) return;
    const currentIndex = DAILY_TIPS.findIndex((item) => item.id === shownTip.id);
    const offset = 1 + Math.floor(Math.random() * (DAILY_TIPS.length - 1));
    setShownTip(DAILY_TIPS[(currentIndex + offset) % DAILY_TIPS.length]);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 via-white to-teal-50 p-5 sm:p-6 shadow-xs">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-200/35 blur-2xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900">
              <Sparkles className="h-3.5 w-3.5" />
              Dica do dia
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-800">{shownTip.category}</p>
              <h2 className="mt-1 text-lg font-extrabold leading-snug text-slate-900 sm:text-xl">
                {shownTip.rule}
              </h2>
            </div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-700 shadow-xs">
            <Lightbulb className="h-5 w-5" />
          </div>
        </div>

        <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{shownTip.explanation}</p>
        <blockquote className="rounded-xl border border-teal-100 bg-white/85 px-4 py-3 text-sm font-medium italic text-teal-950">
          “{shownTip.example}”
        </blockquote>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {shownTip.moduleId && onOpenModule && (
            <button
              type="button"
              onClick={() => onOpenModule(shownTip.moduleId!)}
              className="button-primary text-xs"
            >
              Ver na apostila <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleShowAnother}
            className="button-ghost text-xs"
            title="Mostrar outra regra do banco curado"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Outra dica
          </button>
        </div>
      </div>
    </section>
  );
};
