import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChecklistItem } from '../types/suveca';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  BookOpen,
  FileText,
  Award,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ProgressBar } from './ui/ProgressBar';
import { MODULES_DATA } from '../data/modulesData';
import { PEDAGOGICAL_KNOWLEDGE_BUILD } from '../data/pedagogicalKnowledge.generated';

const CHECKLIST_STORAGE_KEY = `suveca_checklist_editorial_${PEDAGOGICAL_KNOWLEDGE_BUILD.buildId}`;
const INITIAL_CHECKLIST: ChecklistItem[] = MODULES_DATA
  .filter((module) => /^mod\d+$/.test(module.id))
  .map((module) => ({
    id: `editorial-${module.id}`,
    topic: module.title,
    moduleNum: Number(module.num),
    status: 'nao_iniciado' as const,
  }));

export const StudyPlanner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'checklist' | 'weeks' | 'essay'>('checklist');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const tabListRef = useRef<HTMLDivElement>(null);
  const [tabScroll, setTabScroll] = useState({ left: false, right: true });

  const updateTabScroll = useCallback(() => {
    const element = tabListRef.current;
    if (!element) return;
    setTabScroll({
      left: element.scrollLeft > 4,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    });
  }, []);

  const scrollTabs = (direction: -1 | 1) => {
    tabListRef.current?.scrollBy({ left: direction * 220, behavior: 'smooth' });
  };

  useEffect(() => {
    const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (saved) {
      try {
        setChecklist(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    updateTabScroll();
    window.addEventListener('resize', updateTabScroll);
    return () => window.removeEventListener('resize', updateTabScroll);
  }, [updateTabScroll]);

  const handleUpdateChecklistStatus = (
    id: string,
    status: ChecklistItem['status']
  ) => {
    const updated = checklist.map((item) =>
      item.id === id ? { ...item, status } : item
    );
    setChecklist(updated);
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(updated));
  };

  const masteredCount = checklist.filter((c) => c.status === 'dominado').length;
  const progressPct = Math.round((masteredCount / checklist.length) * 100);

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* Header Banner */}
      <header className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center space-x-2 bg-teal-50 text-teal-800 border border-teal-200 text-xs px-3 py-1 rounded-full font-semibold">
            <CalendarCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>Gestão Estratégica do Edital</span>
          </div>
          <div className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {masteredCount} de {checklist.length} Tópicos Dominados ({progressPct}%)
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Trilha de 8 Semanas & Checklist do Edital
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
          Monitore o seu progresso em cada tópico cobrado pelos editais de concursos e siga o cronograma tático de preparação discursiva e objetiva.
        </p>

        {/* Progress Bar */}
        <ProgressBar value={progressPct} showPercent={false} size="md" ariaLabel={`${progressPct}% dos tópicos do edital dominados`} />
      </header>

      {/* Tabs */}
      <div className="relative flex items-center rounded-2xl border border-slate-200 bg-slate-100 p-1.5 text-xs font-medium">
        <button type="button" onClick={() => scrollTabs(-1)} disabled={!tabScroll.left} className="mr-1 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs disabled:opacity-30" aria-label="Ver abas anteriores"><ChevronLeft className="h-4 w-4" /></button>
        <div ref={tabListRef} onScroll={updateTabScroll} className="flex min-w-0 flex-1 items-center space-x-2 overflow-x-auto scroll-smooth" role="tablist" aria-label="Seções do planejamento">
        <button
          onClick={() => setActiveTab('checklist')}
          className={`px-4 py-2.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'checklist'
              ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Checklist do Edital
        </button>
        <button
          onClick={() => setActiveTab('weeks')}
          className={`px-4 py-2.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'weeks'
              ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Trilha de 8 Semanas
        </button>
        <button
          onClick={() => setActiveTab('essay')}
          className={`px-4 py-2.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'essay'
              ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Ciclo de revisão
        </button>
        </div>
        <button type="button" onClick={() => scrollTabs(1)} disabled={!tabScroll.right} className="ml-1 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs disabled:opacity-30" aria-label="Ver próximas abas"><ChevronRight className="h-4 w-4" /></button>
      </div>

      {activeTab === 'checklist' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-700" />
            <span>Matriz do Edital de Língua Portuguesa</span>
          </h2>

          <div className="space-y-3">
            {checklist.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 shrink-0">
                    Aula {String(item.moduleNum).padStart(2, '0')}
                  </span>
                  <span className="font-semibold text-slate-800 leading-snug">{item.topic}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                  {[
                    { id: 'nao_iniciado', label: 'Não Iniciado', color: 'bg-slate-100 text-slate-600' },
                    { id: 'em_estudo', label: 'Em Estudo', color: 'bg-amber-50 text-amber-800 border-amber-200' },
                    { id: 'revisar', label: 'Revisar', color: 'bg-purple-50 text-purple-800 border-purple-200' },
                    { id: 'dominado', label: 'Dominado!', color: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() =>
                        handleUpdateChecklistStatus(item.id, st.id as ChecklistItem['status'])
                      }
                      className={`text-[11px] px-2.5 py-1.5 rounded-lg transition font-medium border cursor-pointer ${
                        item.status === st.id
                          ? 'bg-teal-800 text-white border-teal-800 font-bold shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'weeks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { sem: 1, mods: 'Aulas 00 e 01', f: 'Ortografia e Classes de Palavras I', tasks: ['Diagnóstico de ortografia', 'Acentuação, hífen e porquês', 'Classes variáveis em contexto'] },
            { sem: 2, mods: 'Aulas 02 e 03', f: 'Conectores e Pronomes', tasks: ['Relações das preposições e conjunções', 'Referenciação pronominal', 'Colocação pronominal em contexto'] },
            { sem: 3, mods: 'Aulas 04 e 05', f: 'Sistema Verbal', tasks: ['Tempos, modos e formas nominais', 'Correlação e vozes verbais', 'Transitividade e funções da partícula se'] },
            { sem: 4, mods: 'Aulas 06 e 07', f: 'Sintaxe da Oração e do Período', tasks: ['Reconstrução da ordem direta', 'Termos da oração', 'Coordenação e subordinação'] },
            { sem: 5, mods: 'Aulas 08 e 09', f: 'Pontuação e Concordância', tasks: ['Pontuação guiada pela estrutura sintática', 'Concordância verbal', 'Concordância nominal e casos especiais'] },
            { sem: 6, mods: 'Aula 10', f: 'Regência e Crase', tasks: ['Regência por acepção e estrutura', 'Procedimento decisório da crase', 'Questões cumulativas da aula'] },
            { sem: 7, mods: 'Aulas 11, 12 e 13', f: 'Texto, Sentido e Interpretação', tasks: ['Coesão, coerência e reescrita', 'Relações semânticas e figuras', 'Recorrência, inferência e tipologia'] },
            { sem: 8, mods: 'Aula 14 + Simulado', f: 'Revisão Cumulativa', tasks: ['Revisão ativa pelos temas prioritários', 'Simulado editorial de 20 questões', 'Revisão do Caderno de Erros'] },
          ].map((w) => (
            <div
              key={w.sem}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  Semana {w.sem}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">{w.mods}</span>
              </div>

              <h3 className="text-sm font-bold text-slate-900">{w.f}</h3>

              <ul className="space-y-1.5 text-xs text-slate-600">
                {w.tasks.map((t, i) => (
                  <li key={i} className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'essay' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="space-y-2 border-b border-slate-100 pb-4">
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              Integração pedagógica das aulas 00–14
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Como transformar estudo em domínio recuperável
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Use a apostila como percurso principal e combine cada aula com suas expansões didáticas, roteiros de decisão, questões editoriais, flashcards e registros do Caderno de Erros.
            </p>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <h3 className="font-bold text-teal-900 text-sm">
                Ciclo de aprendizagem em quatro movimentos
              </h3>
              <p className="text-slate-800 font-semibold text-xs bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                COMPREENDER A REGRA → APLICAR O PROCEDIMENTO → RECUPERAR SEM CONSULTA → CORRIGIR E REVISAR
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <h3 className="font-bold text-emerald-900 text-sm">
                Checklist para encerrar uma sessão
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-slate-700 font-medium">
                <li>Explique com suas palavras a regra decisiva estudada.</li>
                <li>Resolva ao menos uma questão sem consultar o gabarito.</li>
                <li>Registre o erro pelo motivo, não apenas pela resposta correta.</li>
                <li>Agende a recuperação ativa por flashcard ou roteiro de decisão.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
