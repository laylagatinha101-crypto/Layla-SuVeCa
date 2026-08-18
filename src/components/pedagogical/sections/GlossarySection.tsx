import React, { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import type { ContentBlock } from '../../../types/pedagogicalView';
import { ContentBlockRenderer } from '../blocks/ContentBlockRenderer';
import { InlineRichText } from '../blocks/InlineRichText';

interface GlossarySectionProps {
  blocks?: ContentBlock[];
}

export const GlossarySection: React.FC<GlossarySectionProps> = ({ blocks = [] }) => {
  const [query, setQuery] = useState('');

  if (!blocks || blocks.length === 0) return null;

  // Extrai itens de lista do glossário para busca rápida
  const listItems: string[] = [];
  const otherBlocks: ContentBlock[] = [];

  for (const b of blocks) {
    if (b.type === 'list') {
      listItems.push(...b.items);
    } else {
      otherBlocks.push(b);
    }
  }

  const filteredItems = listItems.filter((item) =>
    item.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {otherBlocks.length > 0 && (
        <div className="space-y-2">
          {otherBlocks.map((b, idx) => (
            <ContentBlockRenderer key={idx} block={b} />
          ))}
        </div>
      )}

      {listItems.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-teal-200/80 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100/80 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-800 text-xs font-black text-teal-100">
                <BookOpen className="h-4 w-4" />
              </span>
              <h4 className="m-0 text-sm font-black text-slate-900">
                Glossário Operacional ({listItems.length} conceitos)
              </h4>
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
            {filteredItems.map((item, idx) => {
              const cleanItem = item.replace(/^[—–-]\s*/, '').trim();
              const colonIdx = cleanItem.indexOf(':');
              const term = colonIdx > -1 ? cleanItem.slice(0, colonIdx) : '';
              const def = colonIdx > -1 ? cleanItem.slice(colonIdx + 1) : cleanItem;

              return (
                <div
                  key={idx}
                  className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition hover:border-teal-300 hover:bg-white"
                >
                  <div>
                    {term && (
                      <span className="text-xs font-black text-teal-950">
                        <InlineRichText>{term}</InlineRichText>
                      </span>
                    )}
                    <p className="mt-1 text-xs text-slate-700 leading-relaxed font-medium">
                      <InlineRichText>{def}</InlineRichText>
                    </p>
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <p className="col-span-2 py-6 text-center text-xs text-slate-500">
                Nenhum conceito encontrado para "{query}".
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
