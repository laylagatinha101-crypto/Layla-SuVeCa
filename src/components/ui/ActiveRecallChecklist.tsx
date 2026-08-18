import React, { useState } from 'react';
import { CheckSquare, Square, Award } from 'lucide-react';

interface ActiveRecallChecklistProps {
  items: string[];
  unitTitle?: string;
}

export const ActiveRecallChecklist: React.FC<ActiveRecallChecklistProps> = ({
  items,
  unitTitle = 'Checklist de Domínio da Unidade',
}) => {
  const [checkedState, setCheckedState] = useState<Record<number, boolean>>({});

  const toggleItem = (idx: number) => {
    setCheckedState((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const completedCount = Object.values(checkedState).filter(Boolean).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-teal-200/80 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100/80 pb-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800">
            Recuperação Ativa & Autoavaliação
          </span>
          <h4 className="m-0 text-sm font-black text-slate-900">{unitTitle}</h4>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-900 border border-teal-200">
          <Award className="h-4 w-4 text-teal-600" />
          <span>
            {completedCount} de {totalCount} dominados ({progressPercent}%)
          </span>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-5 space-y-2">
        {items.map((item, idx) => {
          const isChecked = !!checkedState[idx];
          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggleItem(idx)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                isChecked
                  ? 'border-emerald-300 bg-emerald-50/50 text-slate-900'
                  : 'border-slate-200/80 bg-slate-50/50 hover:border-teal-300 hover:bg-white text-slate-800'
              }`}
            >
              {isChecked ? (
                <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span
                className={`text-xs sm:text-sm font-medium leading-relaxed ${
                  isChecked ? 'line-through text-slate-500' : ''
                }`}
              >
                {item}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
