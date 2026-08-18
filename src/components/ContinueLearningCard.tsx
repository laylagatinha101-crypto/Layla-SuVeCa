import { BookOpen, ChevronRight, RotateCcw } from 'lucide-react';
import type { CadernoErroItem, ModuleData } from '../types/suveca';

interface ContinueLearningCardProps {
  module: ModuleData;
  pendingErrors: CadernoErroItem[];
  onContinueModule: () => void;
  onReview: () => void;
}

export function ContinueLearningCard({
  module,
  pendingErrors,
  onContinueModule,
  onReview,
}: ContinueLearningCardProps) {
  const dueCount = pendingErrors.filter((error) => {
    if (!error.nextReviewAt) return error.status === 'dia0';
    const dueAt = Date.parse(error.nextReviewAt);
    return Number.isNaN(dueAt) || dueAt <= Date.now();
  }).length;

  return (
    <section className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-white p-5 shadow-xs sm:p-7" aria-labelledby="continue-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-teal-800">Continue de onde parou</p>
          <h1 id="continue-title" className="mt-2 text-xl font-extrabold text-slate-950 sm:text-2xl">
            {module.title}
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {dueCount > 0
              ? `${dueCount} revisão${dueCount === 1 ? '' : 'ões'} vencida${dueCount === 1 ? '' : 's'} antes do próximo bloco.`
              : 'Retome a aula atual e conclua uma prática para consolidar o aprendizado.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:min-w-56">
          {dueCount > 0 && (
            <button type="button" onClick={onReview} className="button-primary min-h-[44px] justify-center">
              <RotateCcw className="h-4 w-4" /> Revisar agora ({dueCount})
            </button>
          )}
          <button type="button" onClick={onContinueModule} className="button-secondary min-h-[44px] justify-center">
            <BookOpen className="h-4 w-4 text-teal-700" /> Continuar aula <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
