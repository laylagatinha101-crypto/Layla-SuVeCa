import React from 'react';
import { GitFork, ArrowDown, CheckCircle, XCircle } from 'lucide-react';

interface FlowchartStep {
  num: number;
  title: string;
  condition?: string;
  yesAction?: string;
  noAction?: string;
}

interface PedagogicalFlowchartProps {
  source: string;
}

const parseFlowchart = (raw: string): { title: string; steps: FlowchartStep[]; formula?: string } => {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  let title = 'Algoritmo Decisório Operacional';
  const steps: FlowchartStep[] = [];
  let formula: string | undefined;

  let currentStep: Partial<FlowchartStep> | null = null;

  for (const line of lines) {
    if (line.includes('[INÍCIO') || line.includes('[Início')) {
      const match = line.match(/\[In[ií]cio(?::\s*([^\]]+))?\]/i);
      if (match && match[1]) title = match[1].trim();
      continue;
    }

    if (line.includes('[FÓRMULA') || line.includes('[Fórmula') || line.includes('FÓRMULA FINAL')) {
      formula = line.replace(/[\[\]]/g, '').replace(/^FÓRMULA FINAL:?\s*/i, '').trim();
      continue;
    }

    const stepMatch = line.match(/^(?:PASSO\s+(\d+)|\d+\.\s*(?:Passo\s+(\d+))?):\s*(.+)/i);
    if (stepMatch) {
      if (currentStep && currentStep.num) {
        steps.push(currentStep as FlowchartStep);
      }
      const num = parseInt(stepMatch[1] || stepMatch[2] || `${steps.length + 1}`, 10);
      currentStep = {
        num,
        title: stepMatch[3].replace(/[│┌┐└┘─▼▲►◄═├└┬┴┼|]/g, '').trim()
      };
      continue;
    }

    if (currentStep) {
      if (line.includes('SIM:') || line.includes('SE SIM:')) {
        currentStep.yesAction = line.replace(/.*(?:SIM:|SE SIM:)\s*/i, '').replace(/[│┌┐└┘─▼▲►◄═├└┬┴┼|]/g, '').trim();
      } else if (line.includes('NÃO:') || line.includes('SE NÃO:')) {
        currentStep.noAction = line.replace(/.*(?:NÃO:|SE NÃO:)\s*/i, '').replace(/[│┌┐└┘─▼▲►◄═├└┬┴┼|]/g, '').trim();
      } else if (line.includes('?')) {
        currentStep.condition = line.replace(/[│┌┐└┘─▼▲►◄═├└┬┴┼|]/g, '').trim();
      }
    }
  }

  if (currentStep && currentStep.num) {
    steps.push(currentStep as FlowchartStep);
  }

  return { title, steps, formula };
};

export const PedagogicalFlowchart: React.FC<PedagogicalFlowchartProps> = ({ source }) => {
  const { title, steps, formula } = parseFlowchart(source);

  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-teal-200/80 bg-white shadow-sm transition">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 px-5 py-4 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700/60 text-emerald-300 ring-1 ring-white/20">
            <GitFork className="h-5 w-5" />
          </span>
          <div>
            <h3 className="m-0 text-base font-bold tracking-tight text-white">
              {title}
            </h3>
            <p className="m-0 text-xs text-teal-100/80">
              Roteiro estruturado de resolução lógica passo a passo
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {steps.map((step, idx) => (
          <React.Fragment key={step.num}>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-teal-300 hover:bg-white">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-800 text-xs font-black text-teal-100">
                  {step.num}
                </span>
                <div className="flex-1 space-y-2">
                  <h4 className="m-0 text-sm font-bold text-slate-900">
                    {step.title}
                  </h4>

                  {step.condition && (
                    <div className="text-xs font-semibold text-teal-900 bg-teal-50/80 rounded-md p-2 border border-teal-100">
                      Critério: {step.condition}
                    </div>
                  )}

                  {(step.yesAction || step.noAction) && (
                    <div className="grid gap-2 sm:grid-cols-2 pt-1">
                      {step.yesAction && (
                        <div className="flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs text-emerald-900">
                          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                          <div>
                            <strong className="block font-bold">SE SIM:</strong>
                            {step.yesAction}
                          </div>
                        </div>
                      )}
                      {step.noAction && (
                        <div className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 p-2.5 text-xs text-rose-900">
                          <XCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                          <div>
                            <strong className="block font-bold">SE NÃO:</strong>
                            {step.noAction}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {idx < steps.length - 1 && (
              <div className="flex justify-center -my-2 text-teal-600">
                <ArrowDown className="h-4 w-4" />
              </div>
            )}
          </React.Fragment>
        ))}

        {formula && (
          <div className="mt-4 rounded-xl border border-teal-300 bg-teal-50/80 p-4 text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Regra de Decisão Final:
            </span>
            <div className="mt-1 text-sm font-black text-teal-950">
              {formula}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
