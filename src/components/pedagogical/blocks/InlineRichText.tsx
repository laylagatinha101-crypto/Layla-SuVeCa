import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface InlineRichTextProps {
  children: string;
  className?: string;
}

export const InlineRichText: React.FC<InlineRichTextProps> = ({ children, className = '' }) => {
  if (!children) return null;

  return (
    <span className={`inline-rich-text ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        components={{
          p: ({ children: pChildren }) => <>{pChildren}</>,
          strong: ({ children: sChildren }) => (
            <strong className="font-bold text-teal-950">{sChildren}</strong>
          ),
          em: ({ children: eChildren }) => (
            <em className="italic text-slate-800">{eChildren}</em>
          ),
          code: ({ children: cChildren }) => (
            <code className="rounded bg-teal-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-teal-800 ring-1 ring-teal-200">
              {cChildren}
            </code>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
};
