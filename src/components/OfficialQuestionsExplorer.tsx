import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  fetchOfficialQuestion,
  fetchOfficialQuestionSample,
  fetchOfficialQuestions,
  officialDetailToQuizQuestion,
  type OfficialQuestionDetail,
  type OfficialQuestionFilters,
  type OfficialQuestionIndexItem,
} from '../lib/officialQuestions';
import type { QuizQuestion } from '../types/suveca';
import { MODULES_DATA } from '../data/modulesData';
import { formatOfficialContent } from '../lib/officialContent';
import { useModalFocus } from '../hooks/useModalFocus';

const PAGE_SIZE = 12;

interface EditorialNormalizedQuestion {
  primaryLessonId?: string;
  questionType?: 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';
  supportText?: string;
  prompt?: string;
  options?: Array<{ letter?: string; label?: string; text?: string }>;
  correctAnswer?: string;
  commentary?: string;
  bank?: string | null;
  organization?: string | null;
  year?: number | null;
  sourceLabel?: string | null;
}

interface OfficialQuestionsExplorerProps {
  onStartSimulado?: (questions: QuizQuestion[]) => void;
}

const answerLabel = (answer?: string) => {
  const normalized = String(answer || '').trim().toUpperCase();
  if (normalized === 'C' || normalized === 'CERTO' || normalized === 'CORRETO') return 'Certo';
  if (normalized === 'E' || normalized === 'ERRADO' || normalized === 'INCORRETO') return 'Errado';
  return normalized;
};

export function OfficialQuestionsExplorer({ onStartSimulado }: OfficialQuestionsExplorerProps) {
  const moduleOptions = useMemo(
    () =>
      MODULES_DATA.filter((module) => /^mod\d+$/.test(module.id)).map((module) => ({
        value: module.id,
        label: `Aula ${String(module.num).padStart(2, '0')} — ${module.title}`,
      })),
    []
  );
  const [filters, setFilters] = useState<OfficialQuestionFilters>({});
  const [draftQuery, setDraftQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<OfficialQuestionIndexItem[]>([]);
  const [total, setTotal] = useState(0);
  const [buildId, setBuildId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<OfficialQuestionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isBuildingSample, setIsBuildingSample] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isDetailOpen = Boolean(detail || isLoadingDetail);
  const closeDetail = useCallback(() => {
    setDetail(null);
    setIsLoadingDetail(false);
  }, []);
  const detailDialogRef = useModalFocus(isDetailOpen, closeDetail, closeButtonRef);

  useEffect(() => {
    if (detail) closeButtonRef.current?.focus();
  }, [detail]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await fetchOfficialQuestions(filters, { offset, limit: PAGE_SIZE });
      setItems(result.items);
      setTotal(result.total);
      setBuildId(result.buildId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as questões editoriais.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateFilter = (key: keyof OfficialQuestionFilters, value: string) => {
    setOffset(0);
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  };

  const openQuestion = async (questionId: string) => {
    setIsLoadingDetail(true);
    setError('');
    try {
      setDetail(await fetchOfficialQuestion(questionId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível abrir a questão editorial.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const startEditorialSimulado = async () => {
    if (!onStartSimulado) return;
    setIsBuildingSample(true);
    setError('');
    try {
      const sample = await fetchOfficialQuestionSample(filters, 10);
      onStartSimulado(sample.questions.map(officialDetailToQuizQuestion));
    } catch (sampleError) {
      setError(sampleError instanceof Error ? sampleError.message : 'Não foi possível montar a prática editorial.');
    } finally {
      setIsBuildingSample(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-5" aria-labelledby="editorial-questions-title">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 shadow-xs sm:p-7">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-teal-700 p-2.5 text-white"><BookMarked className="h-5 w-5" /></span>
          <div>
            <h1 id="editorial-questions-title" className="text-xl font-extrabold text-slate-950 sm:text-2xl">
              Banco de questões editoriais
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              {buildId ? `${total} questões disponíveis nos filtros atuais. ` : 'Carregando o banco editorial da apostila. '}
              Enunciados, alternativas, gabaritos e comentários vêm do corpus das aulas 00–13; a Aula 14 organiza a revisão cumulativa.
            </p>
            {buildId && <p className="mt-2 font-mono text-[11px] text-teal-800">Build editorial {buildId}</p>}
            {onStartSimulado && (
              <button
                type="button"
                onClick={() => void startEditorialSimulado()}
                disabled={isBuildingSample || total === 0}
                className="button-primary mt-4 min-h-[44px] disabled:opacity-50"
              >
                {isBuildingSample ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookMarked className="h-4 w-4" />}
                Praticar 10 questões dos filtros
              </button>
            )}
          </div>
        </div>
      </header>

      <form
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          updateFilter('query', draftQuery);
        }}
      >
        <label className="relative sm:col-span-2 lg:col-span-2">
          <span className="sr-only">Buscar no banco editorial</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            className="input-field min-h-[44px] w-full pl-9"
            placeholder="Buscar no enunciado, comentário ou tema"
          />
        </label>
        <select
          aria-label="Filtrar por aula"
          className="input-field min-h-[44px]"
          value={filters.moduleId || ''}
          onChange={(event) => updateFilter('moduleId', event.target.value)}
        >
          <option value="">Todas as aulas</option>
          {moduleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <input aria-label="Filtrar por tema" className="input-field min-h-[44px]" value={filters.topic || ''} onChange={(event) => updateFilter('topic', event.target.value)} placeholder="Tema" />
        <input aria-label="Filtrar por banca ou fonte" className="input-field min-h-[44px]" value={filters.bank || ''} onChange={(event) => updateFilter('bank', event.target.value)} placeholder="Banca ou fonte" />
        <div className="flex gap-2">
          <input aria-label="Filtrar por ano" className="input-field min-h-[44px] min-w-0 flex-1" inputMode="numeric" value={filters.year || ''} onChange={(event) => updateFilter('year', event.target.value)} placeholder="Ano" />
          <button type="submit" className="button-primary min-h-[44px] min-w-[44px] px-3" aria-label="Aplicar busca"><Search className="h-4 w-4" /></button>
        </div>
      </form>

      {!isLoading && !error && (
        <div className="flex items-center justify-between text-sm text-slate-600" aria-live="polite">
          <span><strong className="text-slate-900">{total}</strong> questões encontradas</span>
          <span>Exibindo {total ? offset + 1 : 0}–{Math.min(offset + PAGE_SIZE, total)}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 font-bold text-rose-800 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </button>
        </div>
      )}

      {isLoading ? (
        <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm font-semibold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Carregando banco editorial…</div>
      ) : items.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.questionId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-teal-800">Questão editorial</p>
                  <h2 className="mt-1 font-bold text-slate-900">{item.editorialProjection.topicNames[0] || 'Língua Portuguesa'}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                  {item.editorialProjection.answerType === 'CERTO_ERRADO' ? 'CERTO/ERRADO' : 'MÚLTIPLA ESCOLHA'}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                {item.editorialProjection.banks.join(', ') || 'Fonte da apostila'}
                {item.editorialProjection.years.length ? ` · ${item.editorialProjection.years.join(', ')}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.suvecaDerived.moduleIds.map((moduleId) => <span key={moduleId} className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-800">{moduleId.replace('mod', 'Aula ')}</span>)}
                {item.editorialProjection.hasCommentary && <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">Comentada</span>}
              </div>
              <button type="button" onClick={() => void openQuestion(item.questionId)} className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 text-sm font-bold text-teal-800 hover:bg-teal-100"><ExternalLink className="h-4 w-4" /> Estudar questão</button>
            </article>
          ))}
        </div>
      ) : !error ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-600">
          Nenhuma questão corresponde aos filtros escolhidos.
        </div>
      ) : null}

      <nav className="flex justify-center gap-3" aria-label="Paginação das questões editoriais">
        <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="button-secondary min-h-[44px] disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Anterior</button>
        <button type="button" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)} className="button-secondary min-h-[44px] disabled:opacity-40">Próxima <ChevronRight className="h-4 w-4" /></button>
      </nav>

      {isDetailOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4">
          <div ref={detailDialogRef} tabIndex={-1} className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl outline-none sm:rounded-2xl sm:p-7" role="dialog" aria-modal="true" aria-label="Questão editorial completa">
            {isLoadingDetail || !detail ? (
              <div role="status" className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>
            ) : (() => {
              const normalized = detail.editorial.normalized as EditorialNormalizedQuestion;
              const isTrueFalse = normalized.questionType === 'CERTO_ERRADO';
              const correctAnswer = String(normalized.correctAnswer || detail.editorialProjection.correctAnswer).toUpperCase();
              const source = normalized.bank || normalized.sourceLabel || 'Fonte editorial da apostila';
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-teal-800">Questão editorial</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-700"><ShieldCheck className="h-3.5 w-3.5" /> Conteúdo da fonte preservado</p>
                    </div>
                    <button ref={closeButtonRef} type="button" onClick={closeDetail} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl hover:bg-slate-100" aria-label="Fechar questão"><X className="h-5 w-5" /></button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold"><Database className="mr-1 inline h-3.5 w-3.5" />{formatOfficialContent(source)}</span>
                    {normalized.year && <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold">{normalized.year}</span>}
                    <span className="rounded-lg bg-violet-50 px-2.5 py-1 font-semibold text-violet-800">{normalized.primaryLessonId || detail.editorialProjection.primaryLessonId}</span>
                  </div>
                  {normalized.supportText && <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{formatOfficialContent(normalized.supportText)}</div>}
                  <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-900">{formatOfficialContent(normalized.prompt)}</p>
                  {isTrueFalse ? (
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {['C', 'E'].map((answer) => (
                        <div key={answer} className={`rounded-xl border p-3 text-center text-sm font-bold ${correctAnswer === answer ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600'}`}>
                          {correctAnswer === answer && <CheckCircle2 className="mr-1 inline h-4 w-4" />}{answer === 'C' ? 'Certo' : 'Errado'}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ol className="mt-5 space-y-2">
                      {(normalized.options || []).map((option, index) => {
                        const letter = String(option.letter || option.label || String.fromCharCode(65 + index)).toUpperCase();
                        return <li key={`${letter}-${index}`} className={`rounded-xl border p-3 text-sm leading-6 ${correctAnswer === letter ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}><strong>{letter}.</strong> {formatOfficialContent(option.text)}</li>;
                      })}
                    </ol>
                  )}
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <h3 className="font-bold text-amber-950">Comentário pedagógico · gabarito {answerLabel(correctAnswer)}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-amber-950">{formatOfficialContent(normalized.commentary) || 'Comentário não disponível na fonte editorial.'}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}
