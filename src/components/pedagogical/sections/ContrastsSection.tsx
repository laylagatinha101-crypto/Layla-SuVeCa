import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { ContrastView } from '../../../types/pedagogicalView';
import { ContentBlockRenderer } from '../blocks/ContentBlockRenderer';
import { InlineRichText } from '../blocks/InlineRichText';

interface ContrastsSectionProps {
  items?: ContrastView[];
}

export const ContrastsSection: React.FC<ContrastsSectionProps> = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-6">
      {items.map((contrast, cIdx) => (
        <div
          key={contrast.contrastId || cIdx}
          className="overflow-hidden rounded-2xl border border-teal-200/90 bg-white p-5 shadow-xs sm:p-6"
        >
          <div className="flex items-center justify-between gap-2 border-b border-teal-100/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
                <ArrowLeftRight className="h-4 w-4" />
              </span>
              <h4 className="m-0 text-sm font-black text-slate-900">
                <InlineRichText>{contrast.title}</InlineRichText>
              </h4>
            </div>
            {contrast.conceptA && contrast.conceptB && (
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800 border border-teal-200">
                {contrast.conceptA} vs {contrast.conceptB}
              </span>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {contrast.blocks.map((block, bIdx) => (
              <ContentBlockRenderer key={bIdx} block={block} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
