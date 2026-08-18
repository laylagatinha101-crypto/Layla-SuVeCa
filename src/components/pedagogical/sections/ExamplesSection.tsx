import React from 'react';
import { BookOpenCheck } from 'lucide-react';
import type { WorkedExampleView } from '../../../types/pedagogicalView';
import { ContentBlockRenderer } from '../blocks/ContentBlockRenderer';
import { InlineRichText } from '../blocks/InlineRichText';

interface ExamplesSectionProps {
  items?: WorkedExampleView[];
}

export const ExamplesSection: React.FC<ExamplesSectionProps> = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-5">
      {items.map((example, eIdx) => (
        <div
          key={example.exampleId || eIdx}
          className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-teal-300 sm:p-6"
        >
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
              <BookOpenCheck className="h-4 w-4" />
            </span>
            <h4 className="m-0 text-sm font-bold text-slate-900">
              <InlineRichText>{example.title}</InlineRichText>
            </h4>
          </div>

          <div className="mt-4 space-y-2">
            {example.blocks.map((block, bIdx) => (
              <ContentBlockRenderer key={bIdx} block={block} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
