import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface FormulaBlockProps {
  text: string;
  className?: string;
}

export const FormulaBlock: React.FC<FormulaBlockProps> = ({ text, className = '' }) => {
  if (!text) return null;

  const rawMath = text.trim().startsWith('$$') ? text : `$$\n${text}\n$$`;

  return (
    <div className={`my-4 overflow-x-auto rounded-xl border border-teal-200/80 bg-teal-50/50 p-4 text-center text-teal-950 shadow-2xs ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
      >
        {rawMath}
      </ReactMarkdown>
    </div>
  );
};
