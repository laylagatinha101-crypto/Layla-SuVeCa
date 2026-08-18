import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ExamTrapView, ContentBlock } from '../../../types/pedagogicalView';
import { ContentBlockRenderer } from '../blocks/ContentBlockRenderer';
import { InlineRichText } from '../blocks/InlineRichText';

interface TrapsSectionProps {
  items?: ExamTrapView[];
  supplementaryBlocks?: ContentBlock[];
}

export const TrapsSection: React.FC<TrapsSectionProps> = ({ items = [], supplementaryBlocks = [] }) => {
  if (items.length === 0 && supplementaryBlocks.length === 0) return null;

  return (
    <div className="space-y-5">
      {items.map((trap, idx) => (
        <div
          key={trap.trapId || idx}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>{trap.title || `Armadilha de Prova #${idx + 1}`}</span>
            </div>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-rose-800">
              Pegadinha de Banca
            </span>
          </div>

          <div className="p-4 sm:p-5">
            {trap.blocks && trap.blocks.length > 0 ? (
              <div className="space-y-2">
                {trap.blocks.map((b, bIdx) => (
                  <ContentBlockRenderer key={bIdx} block={b} />
                ))}
              </div>
            ) : (
              <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                {trap.errorPattern && (
                  <div className="bg-rose-50/40 p-4">
                    <span className="text-xs font-extrabold uppercase text-rose-800">O Erro Induzido:</span>
                    <p className="mt-1.5 text-xs sm:text-sm text-rose-950 font-medium leading-relaxed">
                      <InlineRichText>{trap.errorPattern}</InlineRichText>
                    </p>
                  </div>
                )}
                {trap.correctiveRule && (
                  <div className="bg-emerald-50/40 p-4">
                    <span className="text-xs font-extrabold uppercase text-emerald-800">A Vacina Definitiva:</span>
                    <p className="mt-1.5 text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed">
                      <InlineRichText>{trap.correctiveRule}</InlineRichText>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {supplementaryBlocks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="space-y-2">
            {supplementaryBlocks.map((b, bIdx) => (
              <ContentBlockRenderer key={bIdx} block={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
