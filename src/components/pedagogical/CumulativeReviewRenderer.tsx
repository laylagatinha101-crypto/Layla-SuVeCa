import React, { useState } from 'react';
import { ChevronDown, ListTree, RotateCcw, CheckSquare, Square, Scale, BookOpen, Layers } from 'lucide-react';
import type { CumulativeReviewView } from '../../types/pedagogicalView';
import { SuvecaSection } from './sections/SuvecaSection';
import { ContentBlockRenderer } from './blocks/ContentBlockRenderer';
import { InlineRichText } from './blocks/InlineRichText';
import { PedagogicalCallout } from '../ui/PedagogicalCallout';

interface CumulativeReviewRendererProps {
  view: CumulativeReviewView;
}

export const CumulativeReviewRenderer: React.FC<CumulativeReviewRendererProps> = ({ view }) => {
  if (!view || !view.unit) return null;

  const { unit, sections } = view;

  const [checkedProtocol, setCheckedProtocol] = useState<Record<number, boolean>>({});
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(['suveca', 'rules', 'synthesis'])
  );

  const toggleSection = (id: string, isOpen: boolean) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleProtocolItem = (idx: number) => {
    setCheckedProtocol((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const protocolItems = sections.activeReviewProtocol?.items || [];
  const completedProtocol = Object.values(checkedProtocol).filter(Boolean).length;
  const protocolPercent = protocolItems.length > 0 ? Math.round((completedProtocol / protocolItems.length) * 100) : 0;

  return (
    <div className="cumulative-review-view space-y-6">
      {/* Cabeçalho da Unidade de Revisão */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-teal-800">
          <RotateCcw className="h-4 w-4 text-teal-600" />
          <span>Revisão Geral Cumulativa • Aula 14 ({unit.sectionId})</span>
        </div>
        <h1 className="m-0 text-2xl sm:text-3xl font-black tracking-tight text-teal-950">
          {unit.title}
        </h1>
      </div>

      {/* Objetivo de Revisão */}
      {unit.objective && (
        <PedagogicalCallout type="objective">
          <p className="m-0 leading-relaxed font-medium">
            <InlineRichText>{unit.objective}</InlineRichText>
          </p>
        </PedagogicalCallout>
      )}

      {/* Sumário das 6 Seções */}
      <nav className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 sm:p-5" aria-label="Sumário da revisão">
        <h2 className="m-0 mb-3 flex items-center gap-2 text-base font-bold text-teal-950">
          <ListTree className="h-5 w-5 text-teal-700" /> Roteiro de Revisão (6 Dimensões)
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 text-xs sm:text-sm font-semibold text-teal-950">
          <div>1. Conexão com o método SuVeCA</div>
          <div>2. Mapa de conceitos prioritários</div>
          <div>3. Regras priorizadas de prova</div>
          <div>4. Síntese estruturada</div>
          <div>5. Exemplos para recuperação</div>
          <div>6. Protocolo de revisão ativa</div>
        </div>
      </nav>

      {/* Seção 1: Conexão SuVeCA */}
      <details
        id="suveca"
        open={openSections.has('suveca')}
        onToggle={(e) => toggleSection('suveca', e.currentTarget.open)}
        className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/80 px-4 py-3.5 text-sm sm:text-base font-bold text-slate-950 hover:bg-slate-100 sm:px-5 transition">
          <span><span className="mr-2 text-teal-700">1.</span>Conexão com o método SuVeCA</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-teal-700 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-slate-200 p-4 sm:p-6">
          <SuvecaSection view={sections.suveca} />
        </div>
      </details>

      {/* Seção 2: Mapa de Conceitos */}
      {sections.conceptMap?.items?.length > 0 && (
        <details
          id="concepts"
          open={openSections.has('concepts')}
          onToggle={(e) => toggleSection('concepts', e.currentTarget.open)}
          className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/80 px-4 py-3.5 text-sm sm:text-base font-bold text-slate-950 hover:bg-slate-100 sm:px-5 transition">
            <span><span className="mr-2 text-teal-700">2.</span>Mapa de Conceitos ({sections.conceptMap.items.length} tópicos)</span>
            <ChevronDown className="h-5 w-5 shrink-0 text-teal-700 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-200 p-4 sm:p-6">
            <div className="flex flex-wrap gap-2">
              {sections.conceptMap.items.map((item, idx) => (
                <span
                  key={idx}
                  className="rounded-xl border border-teal-200/90 bg-teal-50/70 px-3 py-1.5 text-xs font-bold text-teal-950 shadow-2xs"
                >
                  <InlineRichText>{item}</InlineRichText>
                </span>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* Seção 3: Regras Priorizadas */}
      {sections.prioritizedRules?.items?.length > 0 && (
        <details
          id="rules"
          open={openSections.has('rules')}
          onToggle={(e) => toggleSection('rules', e.currentTarget.open)}
          className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/80 px-4 py-3.5 text-sm sm:text-base font-bold text-slate-950 hover:bg-slate-100 sm:px-5 transition">
            <span><span className="mr-2 text-teal-700">3.</span>Regras Priorizadas de Prova ({sections.prioritizedRules.items.length})</span>
            <ChevronDown className="h-5 w-5 shrink-0 text-teal-700 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-200 p-4 sm:p-6">
            <div className="space-y-2.5">
              {sections.prioritizedRules.items.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3.5 text-xs sm:text-sm text-slate-900"
                >
                  <Scale className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                  <div className="leading-relaxed font-medium">
                    <InlineRichText>{rule}</InlineRichText>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* Seção 4: Síntese Estruturada */}
      {sections.structuredSynthesis?.blocks?.length > 0 && (
        <details
          id="synthesis"
          open={openSections.has('synthesis')}
          onToggle={(e) => toggleSection('synthesis', e.currentTarget.open)}
          className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/80 px-4 py-3.5 text-sm sm:text-base font-bold text-slate-950 hover:bg-slate-100 sm:px-5 transition">
            <span><span className="mr-2 text-teal-700">4.</span>Síntese Estruturada</span>
            <ChevronDown className="h-5 w-5 shrink-0 text-teal-700 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-200 p-4 sm:p-6 space-y-3">
            {sections.structuredSynthesis.blocks.map((block, idx) => (
              <ContentBlockRenderer key={idx} block={block} />
            ))}
          </div>
        </details>
      )}

      {/* Seção 5: Exemplos para Recuperação */}
      {sections.recoveryExamples?.blocks?.length > 0 && (
        <details
          id="recovery"
          open={openSections.has('recovery')}
          onToggle={(e) => toggleSection('recovery', e.currentTarget.open)}
          className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/80 px-4 py-3.5 text-sm sm:text-base font-bold text-slate-950 hover:bg-slate-100 sm:px-5 transition">
            <span><span className="mr-2 text-teal-700">5.</span>Exemplos para Recuperação</span>
            <ChevronDown className="h-5 w-5 shrink-0 text-teal-700 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-200 p-4 sm:p-6 space-y-3">
            {sections.recoveryExamples.blocks.map((block, idx) => (
              <ContentBlockRenderer key={idx} block={block} />
            ))}
          </div>
        </details>
      )}

      {/* Seção 6: Protocolo de Revisão Ativa */}
      {protocolItems.length > 0 && (
        <details
          id="protocol"
          open={openSections.has('protocol')}
          onToggle={(e) => toggleSection('protocol', e.currentTarget.open)}
          className="group overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-2xs"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 bg-teal-50/80 px-4 py-3.5 text-sm sm:text-base font-bold text-teal-950 hover:bg-teal-100 sm:px-5 transition">
            <span><span className="mr-2 text-teal-700">6.</span>Protocolo de Revisão Ativa ({completedProtocol}/{protocolItems.length})</span>
            <ChevronDown className="h-5 w-5 shrink-0 text-teal-700 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-teal-200 p-4 sm:p-6 space-y-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${protocolPercent}%` }}
              />
            </div>
            <div className="space-y-2">
              {protocolItems.map((item, idx) => {
                const isChecked = !!checkedProtocol[idx];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleProtocolItem(idx)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                      isChecked
                        ? 'border-emerald-300 bg-emerald-50/50 text-slate-900'
                        : 'border-slate-200/80 bg-slate-50/50 hover:border-teal-300 hover:bg-white text-slate-800'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span className={`text-xs sm:text-sm font-medium leading-relaxed ${isChecked ? 'line-through text-slate-500' : ''}`}>
                      <InlineRichText>{item}</InlineRichText>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </details>
      )}
    </div>
  );
};
