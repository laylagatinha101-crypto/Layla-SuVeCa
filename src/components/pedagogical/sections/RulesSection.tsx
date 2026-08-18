import React from 'react';
import { Scale, CheckCircle } from 'lucide-react';
import type { CanonicalEntityView } from '../../../types/pedagogicalView';
import { ContentBlockRenderer } from '../blocks/ContentBlockRenderer';
import { InlineRichText } from '../blocks/InlineRichText';

interface RulesSectionProps {
  items: CanonicalEntityView[];
}

export const RulesSection: React.FC<RulesSectionProps> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3.5 sm:grid-cols-2">
        {items.map((rule, idx) => (
          <div
            key={rule.entityId || idx}
            className="flex flex-col justify-between rounded-2xl border border-teal-200/90 bg-gradient-to-br from-white to-teal-50/30 p-4 sm:p-5 shadow-xs transition hover:border-teal-400 hover:shadow-sm"
          >
            <div>
              <div className="flex items-start justify-between gap-2 border-b border-teal-100/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-800 font-bold text-xs">
                    <Scale className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="m-0 text-xs sm:text-sm font-black text-slate-900 leading-tight">
                    <InlineRichText>{rule.title}</InlineRichText>
                  </h4>
                </div>
                <span className="shrink-0 rounded-md bg-teal-100/80 px-2 py-0.5 text-[10px] font-black uppercase text-teal-900">
                  Norma
                </span>
              </div>

              <div className="mt-3 space-y-2 text-xs sm:text-sm">
                {rule.blocks.map((block, bIdx) => (
                  <ContentBlockRenderer key={bIdx} block={block} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
