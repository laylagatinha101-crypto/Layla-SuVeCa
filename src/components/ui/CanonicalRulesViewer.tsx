import React from 'react';
import { ShieldCheck, Scale, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface CanonicalRulesViewerProps {
  content: string;
}

interface RuleItem {
  title: string;
  body: string;
  isNumbered?: boolean;
  number?: number;
}

const parseRules = (content: string): { intro: string; rules: RuleItem[] } => {
  const lines = content.split(/\r?\n/);
  const rules: RuleItem[] = [];
  const introLines: string[] = [];
  let currentRule: RuleItem | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    const bulletMatch = trimmed.match(/^[-*]\s+\*\*([^*:]+):\*\*\s*(.*)/);
    const simpleBulletMatch = trimmed.match(/^[-*]\s+([A-ZÀ-Ú][^:]{2,40}):\s*(.*)/);

    if (numMatch) {
      if (currentRule) rules.push(currentRule);
      currentRule = {
        title: `Regra ${numMatch[1]}: ${numMatch[2]}`,
        body: '',
        isNumbered: true,
        number: parseInt(numMatch[1], 10),
      };
    } else if (bulletMatch) {
      if (currentRule) rules.push(currentRule);
      currentRule = {
        title: bulletMatch[1].trim(),
        body: bulletMatch[2].trim(),
      };
    } else if (simpleBulletMatch) {
      if (currentRule) rules.push(currentRule);
      currentRule = {
        title: simpleBulletMatch[1].trim(),
        body: simpleBulletMatch[2].trim(),
      };
    } else if (currentRule) {
      currentRule.body = currentRule.body ? `${currentRule.body}\n${trimmed}` : trimmed;
    } else {
      introLines.push(line);
    }
  }

  if (currentRule) rules.push(currentRule);
  return { intro: introLines.join('\n').trim(), rules };
};

export const CanonicalRulesViewer: React.FC<CanonicalRulesViewerProps> = ({ content }) => {
  const { intro, rules } = parseRules(content);

  if (rules.length === 0) {
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
      {intro && (
        <div className="prose prose-sm max-w-none text-slate-700">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
          >
            {intro}
          </ReactMarkdown>
        </div>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className="flex flex-col justify-between rounded-2xl border border-teal-200/90 bg-gradient-to-br from-white to-teal-50/30 p-4 sm:p-5 shadow-xs transition hover:border-teal-400 hover:shadow-sm"
          >
            <div>
              <div className="flex items-start justify-between gap-2 border-b border-teal-100/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-800 font-bold text-xs">
                    <Scale className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="m-0 text-xs sm:text-sm font-black text-slate-900 leading-tight">
                    {rule.title}
                  </h4>
                </div>
                <span className="shrink-0 rounded-md bg-teal-100/80 px-2 py-0.5 text-[10px] font-black uppercase text-teal-900">
                  Norma
                </span>
              </div>

              {rule.body && (
                <div className="mt-3 text-xs sm:text-sm font-medium leading-relaxed text-slate-700">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                  >
                    {rule.body}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
