import React from 'react';
import { AlertTriangle, ShieldCheck, Tag } from 'lucide-react';

interface ExamTrapCardProps {
  banca?: string;
  trap: string;
  solution: string;
  title?: string;
}

export const ExamTrapCard: React.FC<ExamTrapCardProps> = ({
  banca,
  trap,
  solution,
  title = 'Armadilha de Prova vs. Vacina Metódica'
}) => {
  return (
    <div className="my-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>{title}</span>
        </div>
        {banca && (
          <span className="flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
            <Tag className="h-3 w-3 text-slate-500" />
            {banca}
          </span>
        )}
      </div>

      <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {/* Lado Vermelho: A Pegadinha da Banca */}
        <div className="bg-rose-50/40 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-rose-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-200 text-rose-800">
              ✕
            </span>
            A Pegadinha / Raciocínio Errado
          </div>
          <p className="mt-2 text-xs sm:text-sm text-rose-950 leading-relaxed font-medium">
            {trap}
          </p>
        </div>

        {/* Lado Verde: A Vacina / Regra Definitiva */}
        <div className="bg-emerald-50/40 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-emerald-800">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            A Vacina / Regra Definitiva
          </div>
          <p className="mt-2 text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium">
            {solution}
          </p>
        </div>
      </div>
    </div>
  );
};
