import React, { useState } from 'react';
import { SuvecaAnalysisResult, SuvecaBlock } from '../types/suveca';
import { authenticatedFetch } from '../lib/authenticatedFetch';
import { SUVECA_METHOD } from '../lib/suvecaMethod';
import {
  Sparkles,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  RotateCcw,
  Layers,
  Info,
  Send,
  HelpCircle,
  Maximize2,
  Minimize2,
  Database,
} from 'lucide-react';

const PRESET_SENTENCES = [
  'Ontem, os novos servidores entregaram cuidadosamente os relatórios ao diretor.',
  'Precisa-se de novos fiscais para o departamento de tributos.',
  'Embora o prazo fosse curto, os candidatos concluíram a prova tranquilos.',
] as const;

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  SUJEITO: { bg: 'bg-blue-50/90', text: 'text-blue-950', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-900 border-blue-300' },
  VERBO: { bg: 'bg-emerald-50/90', text: 'text-emerald-950', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  COMPLEMENTO: { bg: 'bg-amber-50/90', text: 'text-amber-950', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-900 border-amber-300' },
  ADJUNTO_ADVERBIAL: { bg: 'bg-purple-50/90', text: 'text-purple-950', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-900 border-purple-300' },
  ADJUNTO_ADNOMINAL: { bg: 'bg-violet-50/90', text: 'text-violet-950', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-900 border-violet-300' },
  PREDICATIVO: { bg: 'bg-pink-50/90', text: 'text-pink-950', border: 'border-pink-200', badge: 'bg-pink-100 text-pink-900 border-pink-300' },
  CONECTOR: { bg: 'bg-teal-50/90', text: 'text-teal-950', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-900 border-teal-300' },
  VOCATIVO: { bg: 'bg-rose-50/90', text: 'text-rose-950', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-900 border-rose-300' },
  APOSTO: { bg: 'bg-cyan-50/90', text: 'text-cyan-950', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
};

interface SuvecaAnalyzerProps {
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

export const SuvecaAnalyzer: React.FC<SuvecaAnalyzerProps> = ({
  isFocusMode = false,
  onToggleFocusMode,
}) => {
  const [inputText, setInputText] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState<SuvecaAnalysisResult | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<SuvecaBlock | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectPreset = (sentence: string) => {
    setInputText(sentence);
    setCurrentAnalysis(null);
    setSelectedBlock(null);
    setErrorMsg(null);
  };

  const handleAnalyzeWithAI = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setCurrentAnalysis(null);
    setSelectedBlock(null);

    try {
      const response = await authenticatedFetch('/api/suveca/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: inputText }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar análise.');
      }

      setCurrentAnalysis(data);
      if (data.blocks && data.blocks.length > 0) {
        setSelectedBlock(data.blocks[0]);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err.message || 'Erro de conexão com o servidor de IA. Tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`space-y-8 pb-16 mx-auto transition-[max-width] duration-300 ${
        isFocusMode ? 'max-w-7xl' : 'max-w-5xl'
      }`}
    >
      {/* Header Banner */}
      {isFocusMode ? (
        <div className="sticky top-3 z-30 flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-teal-900">
            <Maximize2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Modo Foco — Analisador SuVeCA</span>
          </div>
          <button type="button" onClick={onToggleFocusMode} className="button-secondary shrink-0 text-xs">
            <Minimize2 className="h-4 w-4 text-teal-700" /> Sair do foco
          </button>
        </div>
      ) : (
        <header className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center space-x-2 bg-teal-50 text-teal-800 border border-teal-200 text-xs px-3 py-1 rounded-full font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                <span>Analisador Sintático Tático por IA</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Desmontagem de Orações (Método SuVeCA)
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                Cole qualquer oração de concurso ou selecione um modelo. A ferramenta desmembrará a frase em blocos coloridos, indicando a função sintática, morfologia e pegadinhas de bancas.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleFocusMode}
              className="button-secondary shrink-0 text-xs"
              title="Ocultar a navegação e ampliar a área de análise"
            >
              <Maximize2 className="h-4 w-4 text-teal-700" /> Modo foco
            </button>
          </div>
        </header>
      )}

      <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5 sm:p-6" aria-labelledby="suveca-map-title">
        <div className="flex items-start gap-3">
          <Layers className="mt-0.5 h-5 w-5 shrink-0 text-teal-800" aria-hidden="true" />
          <div className="min-w-0 space-y-2">
            <h2 id="suveca-map-title" className="text-base font-extrabold text-teal-950 sm:text-lg">
              SuVeCA = {SUVECA_METHOD.equation}
            </h2>
            <p className="text-sm font-medium leading-relaxed text-teal-950">
              {SUVECA_METHOD.definition}
            </p>
            <p className="text-xs leading-relaxed text-slate-600">
              A análise mantém os blocos na ordem real da frase e reconstrói os vínculos entre eles. Um bloco pode estar posposto, implícito ou ausente.
            </p>
            <div className="flex flex-wrap gap-2 pt-1" aria-label="Exemplos de padrões SuVeCA">
              {SUVECA_METHOD.patterns.slice(0, 5).map((pattern) => (
                <span key={pattern.name} className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-bold text-teal-900" title={pattern.example}>
                  {pattern.surface}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Input Box & Presets */}
      <section className={`bg-white rounded-2xl border border-slate-200 shadow-xs space-y-5 ${isFocusMode ? 'p-5 sm:p-8 lg:p-10' : 'p-6 sm:p-8'}`}>
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-900">
            Digite ou cole uma frase para análise sintática:
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setCurrentAnalysis(null);
                  setSelectedBlock(null);
                  setErrorMsg(null);
                }}
                placeholder="Ex: Ontem, os fiscais entregaram o relatório ao diretor..."
                rows={isFocusMode ? 7 : 2}
                className={`input-field w-full resize-y p-3.5 pr-11 text-sm sm:text-base font-medium ${
                  isFocusMode ? 'min-h-48 text-base leading-relaxed' : ''
                }`}
                style={{ fontSize: '16px' }}
                onKeyDown={(e) => {
                  const shouldAnalyze =
                    e.key === 'Enter' &&
                    (!isFocusMode || e.ctrlKey || e.metaKey);
                  if (shouldAnalyze) {
                    e.preventDefault();
                    void handleAnalyzeWithAI();
                  }
                }}
              />
              {inputText && (
                <button
                  type="button"
                  onClick={() => {
                    setInputText('');
                    setCurrentAnalysis(null);
                    setSelectedBlock(null);
                    setErrorMsg(null);
                  }}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
                  aria-label="Limpar campo de texto"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={handleAnalyzeWithAI}
              disabled={isLoading || !inputText.trim()}
              className="button-primary px-6 py-3.5 text-sm sm:text-base font-bold whitespace-nowrap min-h-[48px] w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Analisar via IA</span>
                </>
              )}
            </button>
          </div>
          {isFocusMode && (
            <p className="text-xs text-slate-500">Use Ctrl/Cmd + Enter para analisar sem tirar as mãos do teclado.</p>
          )}
        </div>

        {/* Preset quick buttons */}
        {!isFocusMode && <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500">
            Exemplos de concursos para testar:
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_SENTENCES.map((preset, index) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                aria-label={`Usar frase de exemplo ${index + 1}: ${preset}`}
                aria-pressed={inputText === preset}
                title={preset}
                className={`text-xs px-3 py-1.5 rounded-lg text-left transition border font-medium cursor-pointer ${
                  inputText === preset
                    ? 'bg-teal-50 text-teal-900 border-teal-300 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                "{preset.substring(0, 48)}..."
              </button>
            ))}
          </div>
        </div>}

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-900 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {/* Main Analysis Display */}
      {currentAnalysis && (
        <section className="space-y-6 animate-in fade-in duration-300">
          {/* Sentence Structural Summary Box */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                  Frase Analisada
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-1">
                  "{currentAnalysis.sentence}"
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-full font-medium border border-slate-200">
                  Ordem: <strong>{currentAnalysis.order}</strong>
                </span>
                <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-full font-medium border border-slate-200">
                  Voz: <strong>{currentAnalysis.verbalVoice}</strong>
                </span>
              </div>
            </div>

            {(currentAnalysis.surfacePattern || currentAnalysis.relationalMap || currentAnalysis.implicitElements?.length) && (
              <div className="grid gap-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-4 md:grid-cols-2">
                {currentAnalysis.surfacePattern && (
                  <div className="rounded-xl border border-teal-200 bg-white p-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-teal-700">Ordem encontrada</span>
                    <p className="mt-1 font-mono text-sm font-bold text-teal-950">{currentAnalysis.surfacePattern}</p>
                  </div>
                )}
                {currentAnalysis.relationalMap && (
                  <div className="rounded-xl border border-teal-200 bg-white p-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-teal-700">Mapa relacional</span>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{currentAnalysis.relationalMap}</p>
                  </div>
                )}
                {currentAnalysis.implicitElements?.length ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 md:col-span-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-800">Elementos implícitos ou ausentes</span>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-950">
                      {currentAnalysis.implicitElements.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}

            {/* Visual Color-Coded SuVeCA Blocks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-700" />
                  <span>Blocos Sintáticos (Clique para inspecionar):</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                {currentAnalysis.blocks.map((block, idx) => {
                  const isSelected = selectedBlock?.text === block.text;
                  const style = CATEGORY_STYLES[block.category] || CATEGORY_STYLES.COMPLEMENTO;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedBlock(block)}
                      className={`p-3.5 sm:p-4 rounded-xl border transition cursor-pointer text-left ${style.bg} ${style.border} ${
                        isSelected
                          ? 'ring-2 ring-teal-700 ring-offset-2 shadow-sm font-bold'
                          : 'hover:border-slate-400 opacity-90 hover:opacity-100'
                      }`}
                    >
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${style.badge} block w-max mb-1.5`}>
                        {block.shortLabel}
                      </span>
                      <span className={`text-sm sm:text-base font-bold ${style.text}`}>
                        {block.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SuVeCA Legend Bar */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-900">Legenda:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Sujeito
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Verbo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Complemento
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Adjunto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Predicativo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Conector
              </span>
            </div>
          </div>

          {/* Selected Block Inspection Details */}
          {selectedBlock ? (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Info className="w-5 h-5 text-teal-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Inspeção do Termo: "{selectedBlock.text}"
                  </h3>
                </div>
                <span className="text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 px-3 py-1 rounded-full">
                  {selectedBlock.shortLabel}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-1">
                  <span className="text-xs font-bold text-teal-800 block">
                    Morfologia (Classes)
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium">
                    {selectedBlock.morphology || 'Classes gramaticais constitutivas do segmento.'}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-1">
                  <span className="text-xs font-bold text-teal-800 block">
                    Função Sintática na Oração
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium">
                    {selectedBlock.explanation}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
              <HelpCircle className="w-4 h-4 text-teal-700" />
              <span>Clique em qualquer bloco colorido para examinar morfológica e sintaticamente.</span>
            </div>
          )}

          {/* Pedagogical Commentary & Contest Pitfalls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-teal-900 font-bold text-sm border-b border-slate-100 pb-2">
                <BookOpen className="w-4 h-4 text-teal-700" />
                <h3>Explicação Pedagógica Geral</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {currentAnalysis.summaryExplanation}
              </p>
            </div>

            {currentAnalysis.contestTips && currentAnalysis.contestTips.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm border-b border-slate-100 pb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <h3>Pegadinhas de Concurso (Cebraspe, FGV, FCC)</h3>
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                  {currentAnalysis.contestTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {currentAnalysis.knowledgeSources && currentAnalysis.knowledgeSources.length > 0 && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 text-xs text-violet-950">
              <div className="flex items-center gap-2 font-bold">
                <Database className="h-4 w-4 text-violet-700" />
                Fontes recuperadas da Base Editorial
              </div>
              <p className="mt-2 text-violet-900">
                A análise foi conferida com {currentAnalysis.knowledgeSources.length}{' '}
                {currentAnalysis.knowledgeSources.length === 1 ? 'fonte editorial' : 'fontes editoriais'} da base.
                As referências técnicas permanecem registradas internamente.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
