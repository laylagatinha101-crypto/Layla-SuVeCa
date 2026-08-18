import React, { useState } from 'react';
import { ChevronDown, ListTree, Target } from 'lucide-react';
import type { PedagogicalUnitView } from '../../types/pedagogicalView';
import { SuvecaSection } from './sections/SuvecaSection';
import { PrerequisitesSection } from './sections/PrerequisitesSection';
import { ExplanationSection } from './sections/ExplanationSection';
import { RulesSection } from './sections/RulesSection';
import { ResolutionSection } from './sections/ResolutionSection';
import { ContrastsSection } from './sections/ContrastsSection';
import { ExamplesSection } from './sections/ExamplesSection';
import { MnemonicsSection } from './sections/MnemonicsSection';
import { TrapsSection } from './sections/TrapsSection';
import { GlossarySection } from './sections/GlossarySection';
import { RecallSection } from './sections/RecallSection';
import { OfficialQuestionsSection } from './sections/OfficialQuestionsSection';
import { PedagogicalCallout } from '../ui/PedagogicalCallout';

interface PedagogicalUnitRendererProps {
  view: PedagogicalUnitView;
}

interface SectionDescriptor {
  id: string;
  title: string;
  render: () => React.ReactNode;
}

export const PedagogicalUnitRenderer: React.FC<PedagogicalUnitRendererProps> = ({ view }) => {
  if (!view || !view.unit) return null;

  const { unit, sections, officialQuestions } = view;

  // Monta lista dinâmica das seções que de fato possuem conteúdo
  const presentSections: SectionDescriptor[] = [];

  if (sections.suveca) {
    presentSections.push({
      id: 'suveca',
      title: 'Conexão com o método SuVeCA',
      render: () => <SuvecaSection view={sections.suveca} />,
    });
  }

  if (sections.prerequisites && (sections.prerequisites.blocks?.length || sections.prerequisites.maps?.length)) {
    presentSections.push({
      id: 'prerequisites',
      title: 'Pré-requisitos e modelo mental',
      render: () => <PrerequisitesSection {...sections.prerequisites} />,
    });
  }

  if (sections.explanation && sections.explanation.blocks?.length) {
    presentSections.push({
      id: 'explanation',
      title: 'Explicação didática aprofundada',
      render: () => <ExplanationSection {...sections.explanation} />,
    });
  }

  if (sections.rules && sections.rules.items?.length) {
    presentSections.push({
      id: 'rules',
      title: 'Regras decisivas',
      render: () => <RulesSection {...sections.rules} />,
    });
  }

  if (sections.resolution && sections.resolution.procedures?.length) {
    presentSections.push({
      id: 'resolution',
      title: 'Roteiros de resolução',
      render: () => <ResolutionSection {...sections.resolution} />,
    });
  }

  if (sections.contrasts && sections.contrasts.items?.length) {
    presentSections.push({
      id: 'contrasts',
      title: 'Contrastes que a prova explora',
      render: () => <ContrastsSection {...sections.contrasts} />,
    });
  }

  if (sections.examples && sections.examples.items?.length) {
    presentSections.push({
      id: 'examples',
      title: 'Exemplos comentados',
      render: () => <ExamplesSection {...sections.examples} />,
    });
  }

  if (sections.mnemonics && sections.mnemonics.blocks?.length) {
    presentSections.push({
      id: 'mnemonics',
      title: 'Memorização inteligente',
      render: () => <MnemonicsSection {...sections.mnemonics} />,
    });
  }

  if (sections.traps && (sections.traps.items?.length || sections.traps.supplementaryBlocks?.length)) {
    presentSections.push({
      id: 'traps',
      title: 'Erros comuns e pegadinhas',
      render: () => <TrapsSection {...sections.traps} />,
    });
  }

  if (sections.glossary && sections.glossary.blocks?.length) {
    presentSections.push({
      id: 'glossary',
      title: 'Glossário operacional',
      render: () => <GlossarySection {...sections.glossary} />,
    });
  }

  if (sections.recall && sections.recall.blocks?.length) {
    presentSections.push({
      id: 'recall',
      title: 'Síntese para recuperação ativa',
      render: () => <RecallSection {...sections.recall} />,
    });
  }

  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(presentSections.slice(0, 1).map((s) => s.id)),
  );

  const toggleSection = (id: string, isOpen: boolean) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const openFromToc = (id: string) => {
    toggleSection(id, true);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const allOpen = openSections.size === presentSections.length;

  return (
    <div className="pedagogical-unit-view space-y-6">
      {/* Cabeçalho da Unidade */}
      <div>
        <h1 className="m-0 text-2xl sm:text-3xl font-black tracking-tight text-teal-950">
          {unit.title}
        </h1>
      </div>

      {/* Objetivos de Aprendizagem */}
      {unit.learningObjectives && unit.learningObjectives.length > 0 && (
        <PedagogicalCallout type="objective">
          <p className="m-0 leading-relaxed font-medium">
            {unit.learningObjectives.join(' ')}
          </p>
        </PedagogicalCallout>
      )}

      {/* Sumário Dinâmico */}
      <nav className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 sm:p-5" aria-label="Sumário desta unidade">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 flex items-center gap-2 text-base font-bold text-teal-950">
            <ListTree className="h-5 w-5 text-teal-700" /> Nesta unidade ({presentSections.length} seções)
          </h2>
          <button
            type="button"
            onClick={() => setOpenSections(allOpen ? new Set() : new Set(presentSections.map((s) => s.id)))}
            className="min-h-11 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-teal-900 hover:bg-teal-50 transition cursor-pointer"
          >
            {allOpen ? 'Recolher todas' : 'Expandir todas'}
          </button>
        </div>

        <ol className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
          {presentSections.map((section, index) => (
            <li key={section.id} className="m-0">
              <button
                type="button"
                onClick={() => openFromToc(section.id)}
                className="flex min-h-11 w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs sm:text-sm leading-snug text-teal-950 hover:bg-white transition cursor-pointer"
              >
                <span className="font-bold text-teal-700">{index + 1}.</span>
                <span className="font-semibold">{section.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Lista de Seções em Accordion */}
      <div className="space-y-3.5">
        {presentSections.map((section, index) => (
          <details
            key={section.id}
            id={section.id}
            open={openSections.has(section.id)}
            onToggle={(e) => toggleSection(section.id, e.currentTarget.open)}
            className="group scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/80 px-4 py-3.5 text-left text-sm sm:text-base font-bold text-slate-950 hover:bg-slate-100 sm:px-5 transition">
              <span>
                <span className="mr-2 text-teal-700">{index + 1}.</span>
                {section.title}
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-teal-700 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-slate-200 p-4 sm:p-6">
              {section.render()}
            </div>
          </details>
        ))}
      </div>

      {/* Questões Oficiais da Unidade */}
      {officialQuestions && officialQuestions.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-200">
          <OfficialQuestionsSection questions={officialQuestions} />
        </div>
      )}
    </div>
  );
};
