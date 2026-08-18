import React from 'react';
import type { ContentBlock } from '../../../types/pedagogicalView';
import { InlineRichText } from './InlineRichText';
import { FormulaBlock } from './FormulaBlock';
import { CanonicalTable } from './CanonicalTable';
import { CalloutBlock } from './CalloutBlock';
import { ConnectionMap } from '../../ui/ConnectionMap';

interface ContentBlockRendererProps {
  block: ContentBlock;
}

export const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({ block }) => {
  if (!block) return null;

  switch (block.type) {
    case 'paragraph':
      return (
        <p className="my-2.5 text-xs sm:text-sm font-medium leading-relaxed text-slate-800">
          <InlineRichText>{block.text}</InlineRichText>
        </p>
      );

    case 'heading': {
      const level = block.level || 2;
      const baseClasses = 'font-black tracking-tight text-teal-950';
      if (level === 1) return <h1 className={`my-4 text-xl sm:text-2xl ${baseClasses}`}><InlineRichText>{block.text}</InlineRichText></h1>;
      if (level === 2) return <h2 className={`my-3.5 text-lg sm:text-xl ${baseClasses}`}><InlineRichText>{block.text}</InlineRichText></h2>;
      if (level === 3) return <h3 className={`my-3 text-base sm:text-lg ${baseClasses}`}><InlineRichText>{block.text}</InlineRichText></h3>;
      if (level === 4) return <h4 className={`my-2.5 text-sm sm:text-base ${baseClasses}`}><InlineRichText>{block.text}</InlineRichText></h4>;
      return <h5 className={`my-2 text-xs sm:text-sm ${baseClasses}`}><InlineRichText>{block.text}</InlineRichText></h5>;
    }

    case 'list': {
      if (!block.items || block.items.length === 0) return null;
      if (block.ordered) {
        return (
          <ol className="my-3 space-y-1.5 pl-5 text-xs sm:text-sm text-slate-800 list-decimal marker:font-bold marker:text-teal-700">
            {block.items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                <InlineRichText>{item}</InlineRichText>
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="my-3 space-y-1.5 pl-5 text-xs sm:text-sm text-slate-800 list-disc marker:text-teal-600">
          {block.items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              <InlineRichText>{item}</InlineRichText>
            </li>
          ))}
        </ul>
      );
    }

    case 'formula':
      return <FormulaBlock text={block.text} />;

    case 'table_ref':
      if (block.table) {
        return <CanonicalTable table={block.table} />;
      }
      return null;

    case 'callout':
      return <CalloutBlock block={block} />;

    case 'diagram':
      if (block.text) {
        return <ConnectionMap source={block.text} />;
      }
      return null;

    case 'code':
      return (
        <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed font-mono text-slate-900">
          <pre><code>{block.text}</code></pre>
        </div>
      );

    default:
      return null;
  }
};
