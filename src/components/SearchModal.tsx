import React, { useEffect, useRef, useState } from 'react';
import { MODULES_DATA } from '../data/modulesData';
import { getHighlightedSegments, getModuleSearchSnippet, moduleMatchesSearch } from '../lib/search';
import { useModalFocus } from '../hooks/useModalFocus';
import { Search, X, ChevronRight, BookOpen } from 'lucide-react';
import { Database, FilePenLine } from 'lucide-react';
import type { CadernoErroItem } from '../types/suveca';
import { fetchOfficialQuestions, type OfficialQuestionIndexItem } from '../lib/officialQuestions';
import { hasSearchMatch } from '../lib/search';
import { PEDAGOGICAL_KNOWLEDGE_BUILD } from '../data/pedagogicalKnowledge.generated';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (moduleId: string) => void;
  errors?: CadernoErroItem[];
  userId?: string;
  onOpenOfficialQuestions?: () => void;
}

const HighlightedText: React.FC<{ text: string; query: string }> = ({ text, query }) => (
  <>
    {getHighlightedSegments(text, query).map((segment, index) =>
      segment.matched ? (
        <mark
          // The index is stable for a fixed search query and keeps the output
          // safe: no HTML interpolation is used for the highlight.
          key={`${segment.text}-${index}`}
          className="rounded bg-yellow-200 px-0.5 text-inherit decoration-transparent"
        >
          {segment.text}
        </mark>
      ) : (
        <React.Fragment key={`${segment.text}-${index}`}>{segment.text}</React.Fragment>
      )
    )}
  </>
);

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectModule,
  errors = [],
  userId,
  onOpenOfficialQuestions,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [officialResults, setOfficialResults] = useState<OfficialQuestionIndexItem[]>([]);
  const [isLoadingOfficial, setIsLoadingOfficial] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useModalFocus(isOpen, onClose, searchInputRef);
  const query = searchTerm.trim();

  useEffect(() => {
    if (query.length < 2) {
      setOfficialResults([]);
      setIsLoadingOfficial(false);
      return;
    }
    let active = true;
    setIsLoadingOfficial(true);
    const timer = window.setTimeout(() => {
      void fetchOfficialQuestions({ query }, { limit: 6 })
        .then((result) => { if (active) setOfficialResults(result.items); })
        .catch(() => { if (active) setOfficialResults([]); })
        .finally(() => { if (active) setIsLoadingOfficial(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const results = MODULES_DATA.filter((module) => moduleMatchesSearch(module, query));
  const errorResults = query ? errors.filter((error) => hasSearchMatch(
    `${error.conteudo} ${error.erroCometido} ${error.regraDecisiva} ${error.questionText || ''}`,
    query
  )).slice(0, 6) : [];
  const noteResults = query ? MODULES_DATA.flatMap((module) => {
    try {
      const key = userId
        ? `suveca_module_notes_${PEDAGOGICAL_KNOWLEDGE_BUILD.buildId}_${userId}_${module.id}`
        : `suveca_module_notes_${PEDAGOGICAL_KNOWLEDGE_BUILD.buildId}_guest_${module.id}`;
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      const notes = Object.values(JSON.parse(stored) as Record<string, string>)
        .join(' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return hasSearchMatch(notes, query) ? [{ module, notes }] : [];
    } catch { return []; }
  }).slice(0, 5) : [];
  const resultSummary = query
    ? `${results.length + errorResults.length + noteResults.length + officialResults.length} resultados encontrados para ${query}.`
    : `${results.length} aulas e práticas disponíveis. Digite um termo para filtrar.`;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 shadow-2xl max-w-xl w-full h-[100dvh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-150 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
        tabIndex={-1}
      >
        <h2 id="search-modal-title" className="sr-only">Buscar em aulas, anotações, erros e questões editoriais</h2>

        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center space-x-3 shrink-0">
          <form
            className="flex-1 flex items-center space-x-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/20 shadow-2xs"
            role="search"
            onSubmit={(event) => event.preventDefault()}
          >
            <Search className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <label htmlFor="module-search" className="sr-only">Pesquisar aulas e conteúdos</label>
            <input
              ref={searchInputRef}
              id="module-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar crase, concordância, regência, porquês..."
              className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
              style={{ fontSize: '16px' }}
              aria-describedby="module-search-summary"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg transition"
                aria-label="Limpar pesquisa"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-200/60 transition"
            aria-label="Fechar busca"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <p id="module-search-summary" className="sr-only" role="status" aria-live="polite">
          {resultSummary}
        </p>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-2" aria-label="Resultados da busca">
          {results.length + errorResults.length + noteResults.length + officialResults.length === 0 && !isLoadingOfficial ? (
            <div className="text-center py-12 space-y-2">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">
                Nenhum conteúdo encontrado para “{searchTerm}”
              </p>
              <p className="text-xs text-slate-500">
                Tente pesquisar termos como “crase”, “sujeito”, “concordância” ou “vírgula”.
              </p>
            </div>
          ) : (
            <>
            {results.slice(0, query ? 10 : results.length).map((module) => {
              const snippet = getModuleSearchSnippet(module, query);
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => {
                    onSelectModule(module.id);
                    onClose();
                  }}
                  className="w-full min-h-[64px] text-left p-3.5 sm:p-4 rounded-xl bg-slate-50 hover:bg-teal-50/60 focus-visible:bg-teal-50 border border-slate-200 hover:border-teal-300 focus-visible:border-teal-500 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-md border border-teal-200 shrink-0">
                        {/^mod\d+$/.test(module.id) ? `Aula ${String(module.num).padStart(2, '0')}` : module.title}
                      </span>
                      <span className="text-sm font-bold text-slate-900 group-hover:text-teal-900 truncate">
                        <HighlightedText text={module.title} query={query} />
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-3 leading-relaxed">
                      <HighlightedText text={snippet.text} query={query} />
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-700 transition shrink-0" aria-hidden="true" />
                </button>
              );
            })}
            {errorResults.length > 0 && <h3 className="px-1 pt-4 text-xs font-extrabold uppercase tracking-wide text-slate-700">Caderno de Erros</h3>}
            {errorResults.map((error) => (
              <div key={error.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-950"><BookOpen className="h-4 w-4" /> <HighlightedText text={error.conteudo} query={query} /></div>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-700"><HighlightedText text={error.regraDecisiva} query={query} /></p>
              </div>
            ))}
            {noteResults.length > 0 && <h3 className="px-1 pt-4 text-xs font-extrabold uppercase tracking-wide text-slate-700">Minhas anotações</h3>}
            {noteResults.map(({ module, notes }) => (
              <button key={module.id} type="button" onClick={() => { onSelectModule(module.id); onClose(); }} className="w-full rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-left">
                <div className="flex items-center gap-2 text-sm font-bold text-sky-950"><FilePenLine className="h-4 w-4" /> {module.title}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-700"><HighlightedText text={notes} query={query} /></p>
              </button>
            ))}
            {(officialResults.length > 0 || isLoadingOfficial) && <h3 className="px-1 pt-4 text-xs font-extrabold uppercase tracking-wide text-slate-700">Questões editoriais</h3>}
            {isLoadingOfficial && <p role="status" className="p-3 text-xs text-slate-600">Consultando o banco editorial…</p>}
            {officialResults.map((question) => (
              <button key={question.questionId} type="button" onClick={() => { onOpenOfficialQuestions?.(); onClose(); }} className="w-full rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-left">
                <div className="flex items-center gap-2 text-sm font-bold text-violet-950"><Database className="h-4 w-4" /> Questão {question.questionId}</div>
                <p className="mt-1 text-xs leading-5 text-slate-700">{question.editorialProjection.topicNames.join(', ') || 'Língua Portuguesa'} · {question.editorialProjection.banks.join(', ') || 'Fonte da apostila'}</p>
              </button>
            ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
