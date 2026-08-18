import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  GitMerge,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  Search,
} from 'lucide-react';
import { MarkdownContent } from './ui/MarkdownContent';

interface DecisionProcedure {
  id: string;
  unitId: string;
  lessonId: string;
  groupId: string;
  moduleId: string;
  topic: string;
  canonicalTopicId: string;
  title: string;
  markdown: string;
  sourceRefs: string[];
}

interface DecisionProcedurePayload {
  schemaVersion: string;
  buildId: string;
  count: number;
  procedures: DecisionProcedure[];
}

const DECISION_PROCEDURES_URL = '/knowledge/pedagogical/decision-procedures.json';

const normalizeForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

const lessonLabel = (lessonId: string) => {
  const number = lessonId.match(/\d+/)?.[0];
  return number ? `Aula ${number}` : lessonId;
};

const isDecisionProcedure = (value: unknown): value is DecisionProcedure => {
  if (!value || typeof value !== 'object') return false;
  const procedure = value as Record<string, unknown>;
  return (
    typeof procedure.id === 'string' &&
    typeof procedure.lessonId === 'string' &&
    typeof procedure.topic === 'string' &&
    typeof procedure.title === 'string' &&
    typeof procedure.markdown === 'string'
  );
};

const parsePayload = (value: unknown): DecisionProcedurePayload => {
  if (!value || typeof value !== 'object') {
    throw new Error('A base de roteiros não possui um formato válido.');
  }

  const payload = value as Record<string, unknown>;
  if (!Array.isArray(payload.procedures)) {
    throw new Error('A base de roteiros não contém uma lista de procedimentos.');
  }

  const procedures = payload.procedures.filter(isDecisionProcedure);
  if (procedures.length !== payload.procedures.length || procedures.length === 0) {
    throw new Error('A base de roteiros está vazia ou contém registros inválidos.');
  }

  return {
    schemaVersion: String(payload.schemaVersion || ''),
    buildId: String(payload.buildId || ''),
    count: typeof payload.count === 'number' ? payload.count : procedures.length,
    procedures,
  };
};

export const DecisionTreeViewer: React.FC = () => {
  const [procedures, setProcedures] = useState<DecisionProcedure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(DECISION_PROCEDURES_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Não foi possível carregar os roteiros (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then(parsePayload)
      .then((payload) => {
        setProcedures(payload.procedures);
        setSelectedProcedureId((current) => current || payload.procedures[0]?.id || null);
      })
      .catch((caughtError: unknown) => {
        if (caughtError instanceof DOMException && caughtError.name === 'AbortError') return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Não foi possível carregar os roteiros de resolução.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [loadAttempt]);

  const lessons = useMemo(
    () =>
      [...new Set(procedures.map((procedure) => procedure.lessonId))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { numeric: true }),
      ),
    [procedures],
  );

  const topics = useMemo(() => {
    const lessonProcedures =
      selectedLesson === 'all'
        ? procedures
        : procedures.filter((procedure) => procedure.lessonId === selectedLesson);
    return [...new Set(lessonProcedures.map((procedure) => procedure.topic))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }, [procedures, selectedLesson]);

  const filteredProcedures = useMemo(() => {
    const query = normalizeForSearch(searchQuery.trim());
    return procedures.filter((procedure) => {
      if (selectedLesson !== 'all' && procedure.lessonId !== selectedLesson) return false;
      if (selectedTopic !== 'all' && procedure.topic !== selectedTopic) return false;
      if (!query) return true;

      return normalizeForSearch(
        `${procedure.title} ${procedure.topic} ${lessonLabel(procedure.lessonId)} ${procedure.markdown}`,
      ).includes(query);
    });
  }, [procedures, searchQuery, selectedLesson, selectedTopic]);

  useEffect(() => {
    if (filteredProcedures.length === 0) {
      setSelectedProcedureId(null);
      return;
    }
    if (!filteredProcedures.some((procedure) => procedure.id === selectedProcedureId)) {
      setSelectedProcedureId(filteredProcedures[0].id);
    }
  }, [filteredProcedures, selectedProcedureId]);

  const selectedProcedure = useMemo(
    () => procedures.find((procedure) => procedure.id === selectedProcedureId) || null,
    [procedures, selectedProcedureId],
  );

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLesson('all');
    setSelectedTopic('all');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <header className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
          <GitMerge className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
          <span>Roteiros editoriais de decisão</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Roteiros de resolução
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Encontre um procedimento, siga a sequência de análise e transforme regras de
          português em decisões objetivas durante a prova.
        </p>
      </header>

      {isLoading && (
        <div
          className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-600 shadow-xs"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin text-teal-700" aria-hidden="true" />
          <span className="text-sm font-semibold">Carregando roteiros de resolução…</span>
        </div>
      )}

      {!isLoading && error && (
        <div
          className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-xs"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
            <div className="space-y-3">
              <div>
                <h2 className="font-bold">Falha ao abrir a base pedagógica</h2>
                <p className="mt-1 text-sm text-rose-800">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="button-secondary px-4 py-2 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tentar novamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <section
            aria-labelledby="decision-filters-title"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="decision-filters-title" className="font-bold text-slate-900">
                  Localize o roteiro certo
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Pesquise por dúvida, assunto ou etapa do procedimento.
                </p>
              </div>
              <button
                type="button"
                onClick={clearFilters}
                disabled={
                  searchQuery.length === 0 && selectedLesson === 'all' && selectedTopic === 'all'
                }
                className="button-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Limpar filtros</span>
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(10rem,0.7fr)_minmax(12rem,1fr)]">
              <div>
                <label htmlFor="decision-search" className="mb-1.5 block text-xs font-bold text-slate-700">
                  Buscar nos roteiros
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="decision-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Ex.: crase, sujeito, reescrita…"
                    className="input-field min-h-11 w-full py-2 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="decision-lesson" className="mb-1.5 block text-xs font-bold text-slate-700">
                  Aula
                </label>
                <select
                  id="decision-lesson"
                  value={selectedLesson}
                  onChange={(event) => {
                    setSelectedLesson(event.target.value);
                    setSelectedTopic('all');
                  }}
                  className="input-field min-h-11 w-full px-3 py-2 text-sm"
                >
                  <option value="all">Todas as aulas</option>
                  {lessons.map((lessonId) => (
                    <option key={lessonId} value={lessonId}>
                      {lessonLabel(lessonId)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="decision-topic" className="mb-1.5 block text-xs font-bold text-slate-700">
                  Tema
                </label>
                <select
                  id="decision-topic"
                  value={selectedTopic}
                  onChange={(event) => setSelectedTopic(event.target.value)}
                  className="input-field min-h-11 w-full px-3 py-2 text-sm"
                >
                  <option value="all">Todos os temas</option>
                  {topics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <ListChecks className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  <span>Resultados</span>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-600">
                  {filteredProcedures.length}
                </span>
              </div>

              <p className="sr-only" role="status" aria-live="polite">
                {filteredProcedures.length} roteiros encontrados.
              </p>

              {filteredProcedures.length > 0 ? (
                <nav
                  aria-label="Roteiros de resolução encontrados"
                  className="scrollbar-thin max-h-[42rem] overflow-y-auto p-2"
                >
                  <ul className="space-y-1">
                    {filteredProcedures.map((procedure) => {
                      const isSelected = procedure.id === selectedProcedureId;
                      return (
                        <li key={procedure.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedProcedureId(procedure.id)}
                            aria-current={isSelected ? 'true' : undefined}
                            className={`group flex min-h-11 w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 ${
                              isSelected
                                ? 'border-teal-200 bg-teal-50 text-teal-950'
                                : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-teal-700">
                                {lessonLabel(procedure.lessonId)} · {procedure.topic}
                              </span>
                              <span className="block text-xs font-semibold leading-5">
                                {procedure.title}
                              </span>
                            </span>
                            <ChevronRight
                              className={`mt-4 h-4 w-4 shrink-0 transition ${
                                isSelected
                                  ? 'translate-x-0 text-teal-700'
                                  : 'text-slate-300 group-hover:translate-x-0.5 group-hover:text-teal-700'
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              ) : (
                <div className="p-6 text-center">
                  <Search className="mx-auto h-6 w-6 text-slate-300" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">Nenhum roteiro encontrado</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Tente outro termo ou remova um dos filtros.
                  </p>
                </div>
              )}
            </aside>

            <main
              id="decision-procedure-content"
              aria-live="polite"
              className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-xs"
            >
              {selectedProcedure ? (
                <article aria-labelledby="selected-procedure-title">
                  <header className="border-b border-slate-200 bg-slate-50/70 p-5 sm:p-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-teal-800">
                        {lessonLabel(selectedProcedure.lessonId)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                        {selectedProcedure.topic}
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <BookOpen className="mt-1 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
                          Procedimento prático
                        </p>
                        <h2
                          id="selected-procedure-title"
                          className="mt-1 text-xl font-extrabold leading-tight text-slate-900 sm:text-2xl"
                        >
                          {selectedProcedure.title}
                        </h2>
                      </div>
                    </div>
                  </header>
                  <div className="p-5 sm:p-7">
                    <MarkdownContent content={selectedProcedure.markdown} className="mx-auto" />
                  </div>
                </article>
              ) : (
                <div className="flex min-h-64 items-center justify-center p-8 text-center">
                  <div>
                    <BookOpen className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Selecione um roteiro para começar.
                    </p>
                  </div>
                </div>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  );
};
