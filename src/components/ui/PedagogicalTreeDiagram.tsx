import React, { useState } from 'react';
import { Network, Copy, Check, Maximize2, LayoutGrid, ListTree, Code2 } from 'lucide-react';
import { ModalShell } from './ModalShell';

interface TreeNodeItem {
  label: string;
  badge?: string;
  details?: string;
}

interface TreeCategory {
  title: string;
  items: TreeNodeItem[];
}

interface PedagogicalTreeDiagramProps {
  source: string;
}

const parseTreeDiagram = (raw: string): { title: string; categories: TreeCategory[] } => {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  let title = 'Esquema Estruturado da Unidade';
  const categories: TreeCategory[] = [];
  let currentCat: TreeCategory | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (i === 0 && !line.startsWith('├') && !line.startsWith('└') && !line.startsWith('-')) {
      title = line.replace(/[│┌┐└┘─▼▲►◄═├└┬┴┼|]/g, '').trim();
      continue;
    }

    const isBranch = line.includes('├─') || line.includes('└─') || line.startsWith('- ') || line.startsWith('* ');

    if (!isBranch && (line.match(/^\d+\.\s+/) || line.startsWith('#') || line === line.toUpperCase()) && line.length < 80) {
      if (currentCat && currentCat.items.length > 0) {
        categories.push(currentCat);
      }
      currentCat = {
        title: line.replace(/^[#\s\d.]+\s*/, '').replace(/[│┌┐└┘─▼▲►◄═├└┬┴┼|]/g, '').trim() || line.trim(),
        items: []
      };
      continue;
    }

    const cleanLine = line
      .replace(/^[\s│├└─*•]+/, '')
      .replace(/[│┌┐└┘─▼▲►◄═├└┬┴┼|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanLine) {
      if (!currentCat) {
        currentCat = { title: 'Tópicos Principais', items: [] };
      }
      const badgeMatch = cleanLine.match(/\(([^)]+)\)$|\[([^\]]+)\]$/);
      let badge: string | undefined;
      let label = cleanLine;

      if (badgeMatch) {
        badge = badgeMatch[1] || badgeMatch[2];
        label = cleanLine.replace(/\s*(?:\([^)]+\)|\[[^\]]+\])$/, '').trim();
      }

      currentCat.items.push({ label, badge });
    }
  }

  if (currentCat && currentCat.items.length > 0) {
    categories.push(currentCat);
  }

  if (categories.length === 0) {
    categories.push({
      title: 'Estrutura Geral',
      items: lines.map((l) => ({ label: l.replace(/[│┌┐└┘─▼▲►◄═├└┬┴┼|]/g, '').trim() }))
    });
  }

  return { title, categories };
};

export const PedagogicalTreeDiagram: React.FC<PedagogicalTreeDiagramProps> = ({ source }) => {
  const [viewMode, setViewMode] = useState<'cards' | 'tree' | 'raw'>('cards');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { title, categories } = parseTreeDiagram(source);

  const handleCopy = () => {
    navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    if (viewMode === 'raw') {
      return (
        <pre className="m-0 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs font-mono text-emerald-300 leading-relaxed">
          {source}
        </pre>
      );
    }

    if (viewMode === 'tree') {
      return (
        <div className="space-y-4">
          {categories.map((cat, i) => (
            <div key={i} className="border-l-2 border-teal-500 pl-4">
              <h4 className="m-0 text-sm font-bold text-teal-950">{cat.title}</h4>
              <ul className="mt-2 space-y-1.5 pl-2 text-xs text-slate-700">
                {cat.items.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                    <span className="font-medium text-slate-900">{item.label}</span>
                    {item.badge && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.badge}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {categories.map((cat, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/50 transition hover:border-teal-200"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-100 text-xs font-bold text-teal-800">
                  {i + 1}
                </span>
                <h4 className="m-0 text-sm font-bold text-slate-900">{cat.title}</h4>
              </div>
            </div>

            <div className="grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {cat.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-between rounded-lg border border-slate-200/80 bg-white p-3 shadow-2xs hover:border-teal-300"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <h5 className="m-0 text-xs font-bold text-teal-950">{item.label}</h5>
                    {item.badge && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="my-6 overflow-hidden rounded-2xl border border-teal-200/80 bg-white shadow-sm transition">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700/60 text-emerald-300 ring-1 ring-white/20">
              <Network className="h-5 w-5" />
            </span>
            <div>
              <h3 className="m-0 text-base font-bold tracking-tight text-white">{title}</h3>
              <p className="m-0 text-xs text-teal-100/80">
                Esquema sintático, taxonômico e relações estruturadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-teal-950/50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                  viewMode === 'cards' ? 'bg-teal-700 text-white shadow-xs' : 'text-teal-200 hover:text-white'
                }`}
                title="Visualização em Cards"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                  viewMode === 'tree' ? 'bg-teal-700 text-white shadow-xs' : 'text-teal-200 hover:text-white'
                }`}
                title="Visualização em Árvore"
              >
                <ListTree className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Árvore</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                  viewMode === 'raw' ? 'bg-teal-700 text-white shadow-xs' : 'text-teal-200 hover:text-white'
                }`}
                title="Visualização em Código"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Texto</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg border border-teal-400/30 bg-teal-800/40 px-2 py-1.5 text-xs font-medium text-teal-100 transition hover:bg-teal-700/50 hover:text-white"
              title="Copiar esquema"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1 rounded-lg border border-teal-400/30 bg-teal-800/40 px-2 py-1.5 text-xs font-medium text-teal-100 transition hover:bg-teal-700/50 hover:text-white"
              title="Expandir em tela cheia"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">{renderContent()}</div>
      </div>

      {isFullscreen && (
        <ModalShell
          isOpen={isFullscreen}
          onClose={() => setIsFullscreen(false)}
          title={title}
          maxWidth="max-w-5xl"
        >
          <div className="p-6">{renderContent()}</div>
        </ModalShell>
      )}
    </>
  );
};
