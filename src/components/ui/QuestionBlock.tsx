import React, { useId } from 'react';
import { BadgeCheck, Building2, CalendarDays, CircleHelp } from 'lucide-react';

export interface QuestionBlockModel {
  title: string;
  prompt?: string;
  options: Array<{ letter: string; text: string }>;
  solution?: string;
  answer?: string;
  extra?: string;
  board?: string;
  year?: string;
}

interface QuestionBlockProps extends QuestionBlockModel {
  renderMarkdown: (markdown: string) => React.ReactNode;
}

export const QuestionBlock: React.FC<QuestionBlockProps> = ({
  title,
  prompt,
  options,
  solution,
  answer,
  extra,
  board,
  year,
  renderMarkdown,
}) => {
  const statementId = useId();

  return (
  <article className="question-block my-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
          <CircleHelp className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-bold text-slate-950">{title}</h3>
          {(board || year) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              {board && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1"><Building2 className="h-3.5 w-3.5" />{board}</span>}
              {year && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1"><CalendarDays className="h-3.5 w-3.5" />{year}</span>}
            </div>
          )}
        </div>
      </div>
    </header>

    <div className="space-y-5 px-4 py-5 sm:px-5">
      {prompt && (
        <section aria-labelledby={statementId}>
          <h4 id={statementId} className="mb-2 text-xs font-bold uppercase tracking-wide text-teal-800">Enunciado</h4>
          <div className="text-sm leading-relaxed text-slate-800">{renderMarkdown(prompt)}</div>
        </section>
      )}

      {options.length > 0 && (
        <section aria-label="Alternativas">
          <ol className="m-0 grid list-none gap-2 p-0">
            {options.map((option) => (
              <li key={option.letter} className="grid grid-cols-[2rem_1fr] items-start gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm leading-relaxed text-slate-800">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-800" aria-hidden="true">{option.letter}</span>
                <span className="min-w-0 pt-1">{renderMarkdown(option.text)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {solution && (
        <details className="group rounded-xl border border-blue-200 bg-blue-50/50" open>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-blue-950">
            Solução e justificativa
            <span className="text-xs font-semibold text-blue-700 group-open:hidden">Abrir</span>
          </summary>
          <div className="border-t border-blue-200 px-4 py-4 text-sm leading-relaxed text-slate-800">{renderMarkdown(solution)}</div>
        </details>
      )}

      {answer && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div><strong>Gabarito:</strong> {renderMarkdown(answer)}</div>
        </div>
      )}

      {extra && <div className="border-t border-slate-200 pt-4">{renderMarkdown(extra)}</div>}
    </div>
  </article>
  );
};
