import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export interface StepItem {
  number: number;
  title: string;
  description?: string;
  testFormula?: string;
}

interface ResolutionStepperProps {
  title?: string;
  steps: StepItem[];
}

export const ResolutionStepper: React.FC<ResolutionStepperProps> = ({
  title = 'Roteiro de Resolução Passo a Passo',
  steps,
}) => {
  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-teal-200/80 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex items-center gap-2.5 border-b border-teal-100/80 pb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-800 text-xs font-black text-teal-100">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <h4 className="m-0 text-sm font-extrabold tracking-tight text-slate-900">
          {title}
        </h4>
      </div>

      <div className="relative mt-6 space-y-6 pl-4 sm:pl-6">
        {/* Linha vertical conectora */}
        <div className="absolute left-[27px] sm:left-[35px] top-3 bottom-3 w-0.5 bg-teal-200" />

        {steps.map((step, idx) => (
          <div key={idx} className="relative flex items-start gap-4">
            <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-teal-700 text-xs font-black text-white shadow-xs">
              {step.number}
            </span>

            <div className="flex-1 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-teal-300 hover:bg-white">
              <h5 className="m-0 text-xs sm:text-sm font-bold text-slate-900">
                {step.title}
              </h5>

              {step.description && (
                <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">
                  {step.description}
                </p>
              )}

              {step.testFormula && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50/80 p-2.5 text-xs text-teal-950 font-medium">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" />
                  <div>
                    <strong className="block font-bold">Teste Prático:</strong>
                    {step.testFormula}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
