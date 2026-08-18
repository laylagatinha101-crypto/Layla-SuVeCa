import React from 'react';
import { Compass, CheckCircle2, AlertCircle, ShieldAlert, Sparkles, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SuvecaConnectionViewerProps {
  content: string;
}

export const SuvecaConnectionViewer: React.FC<SuvecaConnectionViewerProps> = ({ content }) => {
  // Extrai blocos principais do markdown da seção SuVeCA
  const limitMatch = content.match(/>\s*\*\*Limite do m[ée]todo:\*\*\s*([\s\S]*?)(?=\n#{1,4}|$)/i);
  const limitText = limitMatch ? limitMatch[1].trim() : null;

  const cleanContent = content
    .replace(/>\s*\*\*Limite do m[ée]todo:\*\*\s*[\s\S]*?(?=\n#{1,4}|$)/i, '')
    .trim();

  return (
    <div className="my-2 space-y-5">
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
                Equação & Conexão SuVeCA
              </h3>
            </div>
          </div>
          <span className="rounded-full bg-teal-800/80 px-3 py-1 text-xs font-bold text-teal-200 ring-1 ring-teal-500/30">
            Sintaxe e Ordem Direta
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-teal-500/30 bg-teal-950/60 p-3.5 sm:p-4 font-mono text-xs sm:text-sm font-black text-teal-200">
          Sujeito (Su) + Verbo (Ve) + Complemento (C) + Adjunto (A) + Predicativo
        </div>
      </div>

      {/* Conteúdo Detalhado (Como Aplicar + Testes Decisivos) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="prose prose-sm max-w-none text-slate-800 prose-headings:text-teal-950 prose-headings:font-black prose-strong:text-teal-900 prose-li:my-1">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {cleanContent}
          </ReactMarkdown>
        </div>
      </div>

      {/* Banner de Limite do Método (Fronteira Sintática) */}
      {limitText && (
        <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-blue-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 ring-1 ring-blue-300">
              <ShieldAlert className="h-4 w-4 text-blue-700" />
            </span>
            <h4 className="m-0 text-xs font-black uppercase tracking-wider text-blue-950">
              Fronteira & Limite do Método SuVeCA
            </h4>
          </div>
          <p className="mt-2.5 text-xs sm:text-sm font-medium leading-relaxed text-slate-800">
            {limitText}
          </p>
        </div>
      )}
    </div>
  );
};
