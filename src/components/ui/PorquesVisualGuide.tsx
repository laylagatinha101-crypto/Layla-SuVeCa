import React, { useState } from 'react';
import { HelpCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface PorqueItem {
  forma: string;
  classe: string;
  macete: string;
  regra: string;
  exemplos: string[];
  tag: string;
  accent: string;
}

const PORQUES_DATA: PorqueItem[] = [
  {
    forma: 'Por que',
    classe: 'Preposição + Pronome (Interrogativo, Indefinido ou Relativo)',
    macete: 'Equivale a "por qual razão", "por qual motivo" ou "pelo qual / pela qual"',
    regra: 'Utilizado em início ou meio de frases interrogativas (diretas ou indiretas) e em orações adjetivas relativas.',
    exemplos: [
      'Por que você não compareceu à aula ontem? (pergunta direta)',
      'Não entendi por que houve tanta discussão. (pergunta indireta)',
      'Os caminhos por que passei eram íngremes. (= pelos quais passei)'
    ],
    tag: 'Pergunta / Relativo',
    accent: 'border-blue-200 bg-blue-50/60 text-blue-900'
  },
  {
    forma: 'Por quê',
    classe: 'Preposição + Pronome Tônico',
    macete: 'Fim de frase ou imediatamente antes de pontuação (?, !, .)',
    regra: 'A proximidade da pontuação final atrai a tonicidade para o "que", exigindo acento circunflexo.',
    exemplos: [
      'Eles decidiram adiar o projeto, mas não disseram por quê.',
      'Você ainda não enviou o relatório? Por quê?'
    ],
    tag: 'Fim de Frase / Pausa',
    accent: 'border-amber-200 bg-amber-50/60 text-amber-900'
  },
  {
    forma: 'Porque',
    classe: 'Conjunção Coordenativa Explicativa ou Subordinada Causal',
    macete: 'Equivale a "pois", "já que", "visto que" ou "para que"',
    regra: 'Utilizado em respostas, justificativas, causas explicativas e orações subordinadas.',
    exemplos: [
      'Não fui trabalhar ontem porque estava com febre alta. (causa)',
      'Venha logo, porque já vai começar o evento. (explicação / imperativo)'
    ],
    tag: 'Resposta / Causa / Pois',
    accent: 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
  },
  {
    forma: 'Porquê',
    classe: 'Substantivo Masculino (O motivo, A razão)',
    macete: 'Vem antecedido por determinante (o, um, este, seu, do) e aceita plural',
    regra: 'Palavra substantivada oxítona terminada em -e, atuando como núcleo de termo sintático.',
    exemplos: [
      'Gostaria de compreender o porquê de tamanha pressa. (= o motivo)',
      'Existem muitos porquês inexplicáveis na decisão. (aceita plural)'
    ],
    tag: 'Substantivo (O Motivo)',
    accent: 'border-purple-200 bg-purple-50/60 text-purple-900'
  }
];

export const PorquesVisualGuide: React.FC = () => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const current = PORQUES_DATA[selectedIdx];

  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-teal-200/80 bg-white shadow-sm transition">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 px-5 py-4 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700/60 text-emerald-300 ring-1 ring-white/20">
            <HelpCircle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="m-0 text-base font-bold tracking-tight text-white">
              Guia Visual Decisório: Os 4 Porquês
            </h3>
            <p className="m-0 text-xs text-teal-100/80">
              Critérios morfológicos, testes de substituição e macetes de fixação rápida
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PORQUES_DATA.map((item, idx) => {
            const isSelected = idx === selectedIdx;
            return (
              <button
                key={item.forma}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-teal-600 bg-teal-50/80 shadow-xs ring-2 ring-teal-500/30'
                    : 'border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-base font-extrabold tracking-tight text-slate-900">
                    {item.forma}
                  </span>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-teal-600" />}
                </div>
                <span className="mt-1 text-[11px] font-medium text-slate-500">
                  {item.tag}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black tracking-tight text-teal-950">
              {current.forma}
            </span>
            <span className="rounded-md bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-900">
              {current.classe}
            </span>
          </div>

          <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50/70 p-3 text-sm font-medium text-teal-900">
            <span className="font-bold">Teste Prático:</span> {current.macete}
          </div>

          <p className="mt-3 text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">Regra Normativa:</span> {current.regra}
          </p>

          <div className="mt-4">
            <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">
              Exemplos Canônicos de Concursos:
            </h4>
            <ul className="mt-2 space-y-1.5 pl-0">
              {current.exemplos.map((ex, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-800"
                >
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                  <span>{ex}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
