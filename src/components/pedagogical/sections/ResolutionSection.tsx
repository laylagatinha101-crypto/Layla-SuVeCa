import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import type { ProcedureView } from '../../../types/pedagogicalView';
import { ContentBlockRenderer } from '../blocks/ContentBlockRenderer';
import { InlineRichText } from '../blocks/InlineRichText';

interface ResolutionSectionProps {
  procedures?: ProcedureView[];
}

export const ResolutionSection: React.FC<ResolutionSectionProps> = ({ procedures = [] }) => {
  if (!procedures || procedures.length === 0) return null;

  return (
    <div className="space-y-6">
      {procedures.map((proc, pIdx) => (
        <div
          key={proc.procedureId || pIdx}
          className="overflow-hidden rounded-2xl border border-teal-200/80 bg-white p-5 shadow-xs sm:p-6"
        >
          <div className="flex items-center gap-2.5 border-b border-teal-100/80 pb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-800 text-xs font-black text-teal-100">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <h4 className="m-0 text-sm font-extrabold tracking-tight text-slate-900">
              <InlineRichText>{proc.title}</InlineRichText>
            </h4>
          </div>

          {proc.objective && (
            <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs text-teal-950 font-medium">
              <strong>Objetivo do Procedimento:</strong> <InlineRichText>{proc.objective}</InlineRichText>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {proc.blocks.map((block, bIdx) => (
              <ContentBlockRenderer key={bIdx} block={block} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
