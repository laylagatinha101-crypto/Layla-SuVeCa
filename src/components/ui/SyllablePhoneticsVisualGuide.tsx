import React, { useState } from 'react';
import { Volume2, Sparkles, Calculator, CheckCircle2 } from 'lucide-react';

interface PredefinedWord {
  word: string;
  letras: number;
  fonemas: number;
  explicacao: string;
}

const PREDEFINED_WORDS: PredefinedWord[] = [
  { word: 'exceção', letras: 7, fonemas: 6, explicacao: 'Dígrafo XC (-1) e dígrafo vocálico ÃO (-0, vogal nasal) ➔ 6 fonemas' },
  { word: 'tóxico', letras: 6, fonemas: 7, explicacao: 'Dífono X = /ks/ (+1) ➔ 7 fonemas' },
  { word: 'sintaxe', letras: 7, fonemas: 6, explicacao: 'Dígrafo vocálico IN (-1), X com som de /s/ (neutro) ➔ 6 fonemas' },
  { word: 'pneu', letras: 4, fonemas: 4, explicacao: 'Encontro consonantal perfeito PN (ambas soam) ➔ 4 fonemas' },
  { word: 'guerra', letras: 6, fonemas: 4, explicacao: 'Dígrafo GU diante de E (-1) e dígrafo RR (-1) ➔ 4 fonemas' },
  { word: 'chuva', letras: 5, fonemas: 4, explicacao: 'Dígrafo consonantal CH (-1) ➔ 4 fonemas' }
];

export const SyllablePhoneticsVisualGuide: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vogal' | 'encontros' | 'calculadora'>('vogal');
  const [selectedWord, setSelectedWord] = useState<PredefinedWord>(PREDEFINED_WORDS[0]);

  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-teal-200/80 bg-white shadow-sm transition">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 px-5 py-4 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700/60 text-emerald-300 ring-1 ring-white/20">
            <Volume2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="m-0 text-base font-bold tracking-tight text-white">
              Guia Visual Interativo: Fonética e Estudo da Sílaba
            </h3>
            <p className="m-0 text-xs text-teal-100/80">
              Estrutura silábica, encontros fonéticos e contagem exata de fonemas
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200/80 bg-slate-50/60 px-5 py-2">
        <div className="flex gap-2">
          {[
            { id: 'vogal', label: '1. Mantra da Vogal Única' },
            { id: 'encontros', label: '2. Encontros Vocálicos e Consonantais' },
            { id: 'calculadora', label: '3. Calculadora de Fonemas' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === tab.id
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {activeTab === 'vogal' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <h4 className="m-0 text-sm font-extrabold uppercase tracking-wide">
                  Regra Áurea da Fonética Portuguesa
                </h4>
              </div>
              <p className="mt-2 text-base font-black tracking-tight text-emerald-900">
                "Não há sílaba sem vogal, e NUNCA há mais de uma vogal em uma mesma sílaba."
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                A vogal é o único e obrigatório centro acústico de toda sílaba na língua portuguesa.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="text-xs font-bold uppercase text-teal-800">Vogal ($V$) — Pico de Força</span>
                <p className="mt-1 text-xs text-slate-600">
                  Som emitido com máxima energia articulatória. A letra <strong>"A" é SEMPRE vogal</strong> em qualquer circunstância.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="text-xs font-bold uppercase text-teal-800">Semivogal ($SV$) — Som Brando</span>
                <p className="mt-1 text-xs text-slate-600">
                  Apoio fonético com som de /i/ ou /u/ que se junta à vogal principal na mesma sílaba (ex.: <em>p<strong>ai</strong></em>, <em>c<strong>éu</strong></em>).
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'encontros' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h4 className="m-0 text-sm font-extrabold text-teal-950">Encontros Vocálicos</h4>
              <ul className="mt-3 space-y-2 pl-0 text-xs text-slate-700">
                <li className="rounded-md border border-slate-200 bg-white p-2.5">
                  <strong>Ditongo:</strong> Vogal + Semivogal na mesma sílaba.
                  <div className="mt-1 text-slate-500">Ex.: <em>pei-xe</em> (Decrescente: V+SV), <em>sér-rie</em> (Crescente: SV+V).</div>
                </li>
                <li className="rounded-md border border-slate-200 bg-white p-2.5">
                  <strong>Hiato:</strong> Duas vogais consecutivas em sílabas distintas ($V + V$).
                  <div className="mt-1 text-slate-500">Ex.: <em>sa-ú-de</em>, <em>pa-ís</em>, <em>co-e-lho</em>.</div>
                </li>
                <li className="rounded-md border border-slate-200 bg-white p-2.5">
                  <strong>Tritongo:</strong> $SV + V + SV$ na mesma sílaba.
                  <div className="mt-1 text-slate-500">Ex.: <em>U-ru-guai</em>, <em>quais-quer</em>.</div>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h4 className="m-0 text-sm font-extrabold text-teal-950">Dígrafos vs. Encontros Consonantais</h4>
              <ul className="mt-3 space-y-2 pl-0 text-xs text-slate-700">
                <li className="rounded-md border border-slate-200 bg-white p-2.5">
                  <strong>Dígrafo (2L = 1F):</strong> Duas letras produzem um só fonema.
                  <div className="mt-1 text-slate-500">Ex.: <em>chu-va</em> ($-1$), <em>car-ro</em> ($-1$), <em>cam-po</em> ($-1$).</div>
                </li>
                <li className="rounded-md border border-slate-200 bg-white p-2.5">
                  <strong>Encontro Consonantal:</strong> Ambas as consoantes são ouvidas claramente.
                  <div className="mt-1 text-slate-500">Ex.: <em>pra-to</em> ($2L = 2F$), <em>pneu</em> ($4L = 4F$), <em>af-ta</em> ($4L = 4F$).</div>
                </li>
                <li className="rounded-md border border-slate-200 bg-white p-2.5">
                  <strong>Dífono (1L = 2F):</strong> A letra X condensa dois sons (/ks/).
                  <div className="mt-1 text-slate-500">Ex.: <em>tá-xi</em> ($4L + 1 = 5F$), <em>tó-rax</em> ($5L + 1 = 6F$).</div>
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'calculadora' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-teal-700" />
                <span className="text-xs font-extrabold uppercase tracking-wide text-teal-900">
                  Fórmula Matemática Canônica de Fonemas:
                </span>
              </div>
              <p className="mt-2 text-sm font-black text-teal-950">
                {'Fonemas (F) = Letras (L) - (Dígrafos + H inicial) + (Dífonos do X)'}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold uppercase text-slate-500">
                Selecione uma palavra clássica de prova para auditar:
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {PREDEFINED_WORDS.map((item) => {
                  const isSelected = item.word === selectedWord.word;
                  return (
                    <button
                      key={item.word}
                      type="button"
                      onClick={() => setSelectedWord(item)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                        isSelected
                          ? 'border-teal-600 bg-teal-700 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'
                      }`}
                    >
                      {item.word}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500">Palavra:</span>
                  <div className="text-lg font-black text-slate-900">{selectedWord.word}</div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <span className="text-[11px] font-semibold text-slate-500">Letras ($L$):</span>
                  <div className="text-lg font-black text-blue-700">{selectedWord.letras} letras</div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <span className="text-[11px] font-semibold text-slate-500">Fonemas ($F$):</span>
                  <div className="text-lg font-black text-emerald-700">{selectedWord.fonemas} fonemas</div>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 border-t border-slate-200/80 pt-3 text-xs text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span><strong>Análise:</strong> {selectedWord.explicacao}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
