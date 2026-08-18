import React, { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';

export interface GlossaryItem {
  term: string;
  category?: string;
  definition: string;
}

interface GlossaryGridProps {
  title?: string;
  items: GlossaryItem[];
}

export const GlossaryGrid: React.FC<GlossaryGridProps> = ({
  title = 'Glossário Operacional & Conceitos Canônicos',
  items,
}) => {
  const [query, setQuery] = useState('');

  const filtered = items.filter(
    (item) =>
      item.term.toLowerCase().includes(query.toLowerCase()) ||
      item.definition.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-teal-200/80 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100/80 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-800 text-xs font-black text-teal-100">
            <BookOpen className="h-4 w-4" />
          </span>
          <h4 className="m-0 text-sm font-black text-slate-900">{title}</h4>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar conceitos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:bg-white focus:outline-hidden"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {filtered.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition hover:border-teal-300 hover:bg-white"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-black text-teal-950">{item.term}</span>
                {item.category && (
                  <span className="rounded bg-teal-100/80 px-1.5 py-0.5 text-[10px] font-bold text-teal-900">
                    {item.category}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-slate-700 leading-relaxed font-medium">
                {item.definition}
              </p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-2 py-6 text-center text-xs text-slate-500">
            Nenhum conceito encontrado para "{query}".
          </p>
        )}
      </div>
    </div>
  );
};
