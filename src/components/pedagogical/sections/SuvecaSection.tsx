import React from 'react';
import { Compass, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { SuvecaConnectionView } from '../../../types/pedagogicalView';
import { InlineRichText } from '../blocks/InlineRichText';

interface SuvecaSectionProps {
  view: SuvecaConnectionView;
}

export const SuvecaSection: React.FC<SuvecaSectionProps> = ({ view }) => {
  if (!view) return null;

  return (
    <div className="space-y-5">
      {/* Banner Principal da Equação SuVeCA */}
      <div className="overflow-hidden rounded-2xl border border-teal-300/80 bg-gradient-to-br from-teal-900 via-teal-950 to-slate-900 p-5 sm:p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-700/50 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/40">
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-400">
                Arquitetura Metodológica
              </span>
              <h3 className="m-0 text-base sm:text-lg font-black tracking-tight text-white">
                {view.label || 'Equação & Conexão SuVeCA'}
              </h3>
            </div>
          </div>
          <span className="rounded-full bg-teal-800/80 px-3 py-1 text-xs font-bold text-teal-200 ring-1 ring-teal-500/30">
            {view.primaryLinguisticLayer ? `Camada: ${view.primaryLinguisticLayer}` : 'Sintaxe e Ordem Direta'}
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-teal-500/30 bg-teal-950/60 p-3.5 sm:p-4 font-mono text-xs sm:text-sm font-black text-teal-200">
          Sujeito (Su) + Verbo (Ve) + Complemento (C) + Adjunto (A) + Predicativo
        </div>

        {view.summary && (
          <p className="mt-3.5 text-xs sm:text-sm leading-relaxed text-teal-100 font-medium">
            <InlineRichText>{view.summary}</InlineRichText>
          </p>
        )}
      </div>

      {/* Como Aplicar neste Tema */}
      {view.steps && view.steps.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h4 className="m-0 mb-3 flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-teal-950">
            <CheckCircle2 className="h-4 w-4 text-teal-700" />
            Como Aplicar neste Tema
          </h4>
          <ol className="space-y-2 pl-4 text-xs sm:text-sm text-slate-800 list-decimal marker:font-bold marker:text-teal-700">
            {view.steps.map((step, idx) => (
              <li key={idx} className="leading-relaxed">
                <InlineRichText>{step}</InlineRichText>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Testes Decisivos */}
      {view.decisiveTests && view.decisiveTests.length > 0 && (
        <div className="rounded-2xl border border-teal-200/80 bg-teal-50/40 p-5 shadow-xs">
          <h4 className="m-0 mb-3 flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-teal-950">
            <ArrowRight className="h-4 w-4 text-teal-700" />
            Testes Decisivos de Validação
          </h4>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {view.decisiveTests.map((test, idx) => (
              <div key={idx} className="rounded-xl border border-teal-200 bg-white p-3 text-xs text-slate-800 shadow-2xs">
                <InlineRichText>{test}</InlineRichText>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Limite do Método SuVeCA */}
      {view.limits && view.limits.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-blue-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 ring-1 ring-blue-300">
              <ShieldAlert className="h-4 w-4 text-blue-700" />
            </span>
            <h4 className="m-0 text-xs font-black uppercase tracking-wider text-blue-950">
              Fronteira & Limite do Método SuVeCA
            </h4>
          </div>
          <div className="mt-2.5 space-y-1.5 text-xs sm:text-sm font-medium leading-relaxed text-slate-800">
            {view.limits.map((limit, idx) => (
              <p key={idx} className="m-0">
                <InlineRichText>{limit}</InlineRichText>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
