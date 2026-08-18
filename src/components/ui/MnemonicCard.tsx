import React, { useState } from 'react';
import { Brain, Copy, Check, Sparkles } from 'lucide-react';

interface MnemonicItem {
  key: string;
  label: string;
  details?: string;
}

interface MnemonicCardProps {
  title: string;
  formula: string;
  items?: MnemonicItem[];
  explanation?: string;
}

export const MnemonicCard: React.FC<MnemonicCardProps> = ({
  title,
  formula,
  items,
  explanation,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const handleCopy = () => {
    const textToCopy = `${title}: ${formula}\n${explanation || ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-5 overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/40 p-5 shadow-xs transition hover:border-amber-300">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100/80 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-300/60">
            <Brain className="h-4 w-4" />
          </span>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
              Fixação Mnemônica & Mantra
            </span>
            <h4 className="m-0 text-sm font-black tracking-tight text-slate-900">
              {title}
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-2xs transition hover:bg-amber-50"
          title="Copiar para o caderno de revisão / Anki"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-amber-700" />}
          <span>{copied ? 'Copiado!' : 'Copiar Mnemônico'}</span>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-xl border border-amber-300 bg-amber-100/90 px-3.5 py-1.5 text-sm font-black tracking-wide text-amber-950 shadow-2xs">
          {formula}
        </span>
        <span className="text-xs text-slate-500 font-medium">
          (Clique nos blocos para inspecionar)
        </span>
      </div>

      {explanation && (
        <p className="mt-3 text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
          {explanation}
        </p>
      )}

      {items && items.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => {
            const isSelected = selectedKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedKey(isSelected ? null : item.key)}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                  isSelected
                    ? 'border-amber-500 bg-amber-100/80 shadow-xs ring-1 ring-amber-400'
                    : 'border-slate-200 bg-white/90 hover:border-amber-300 hover:bg-amber-50/50'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-black text-amber-950">{item.key}</span>
                  <Sparkles className="h-3 w-3 text-amber-500" />
                </div>
                <span className="mt-1 text-[11px] font-bold text-slate-800">{item.label}</span>
                {item.details && isSelected && (
                  <span className="mt-1 text-[10px] text-slate-600 leading-tight">
                    {item.details}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
