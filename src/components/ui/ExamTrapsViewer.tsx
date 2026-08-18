import React from 'react';
import { ExamTrapCard } from './ExamTrapCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface ExamTrapsViewerProps {
  content: string;
}

interface ParsedTrap {
  title?: string;
  trap: string;
  solution: string;
  banca?: string;
}

const parseExamTraps = (content: string): ParsedTrap[] => {
  const traps: ParsedTrap[] = [];
  
  // Padrão 1: ### O Erro ... #### Regra Corretiva
  const headingPattern = /###\s+(?:O\s+Erro|Armadilha|Pegadinha)[^\n]*\n([\s\S]*?)(?=####\s+(?:Regra Corretiva|Como Evitar|Vacina)|###|$)/gi;
  const solPattern = /####\s+(?:Regra Corretiva|Como Evitar|Vacina)[^\n]*\n([\s\S]*?)(?=###|$)/gi;

  const errors = [...content.matchAll(headingPattern)];
  const solutions = [...content.matchAll(solPattern)];

  if (errors.length > 0 && errors.length === solutions.length) {
    for (let i = 0; i < errors.length; i++) {
      traps.push({
        title: `Armadilha de Prova #${i + 1}`,
        trap: errors[i][1].trim(),
        solution: solutions[i][1].trim(),
      });
    }
    return traps;
  }

  // Padrão 2: Parágrafos com Problema / Como evitar
  const blocks = content.split(/\n\n+/);
  for (let i = 0; i < blocks.length - 1; i += 2) {
    const b1 = blocks[i].trim();
    const b2 = blocks[i + 1].trim();
    if (
      (b1.toLowerCase().includes('erro') || b1.toLowerCase().includes('supor') || b1.toLowerCase().includes('armadilha')) &&
      (b2.toLowerCase().includes('corretiv') || b2.toLowerCase().includes('fonema') || b2.toLowerCase().includes('evit') || b2.toLowerCase().includes('regra'))
    ) {
      traps.push({
        title: `Pegadinha de Concurso #${traps.length + 1}`,
        trap: b1,
        solution: b2,
      });
    }
  }

  return traps;
};

export const ExamTrapsViewer: React.FC<ExamTrapsViewerProps> = ({ content }) => {
  const traps = parseExamTraps(content);

  if (traps.length === 0) {
    return (
      <div className="prose prose-sm max-w-none text-slate-800">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="my-2 space-y-4">
      {traps.map((trap, idx) => (
        <ExamTrapCard
          key={idx}
          title={trap.title}
          trap={trap.trap}
          solution={trap.solution}
          banca={trap.banca}
        />
      ))}
    </div>
  );
};
