import React, { isValidElement, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ChevronDown, ListTree } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { ResponsiveTable } from './ResponsiveTable';
import { ConnectionMap, looksLikeConnectionMap } from './ConnectionMap';
import { QuestionBlock, type QuestionBlockModel } from './QuestionBlock';
import { PedagogicalCallout } from './PedagogicalCallout';
import { ActiveRecallChecklist } from './ActiveRecallChecklist';
import { GlossaryGrid, type GlossaryItem } from './GlossaryGrid';
import { SuvecaConnectionViewer } from './SuvecaConnectionViewer';
import { CanonicalRulesViewer } from './CanonicalRulesViewer';
import { ExamTrapsViewer } from './ExamTrapsViewer';

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** Enables a table of contents and collapsible sections in long study units. */
  pedagogical?: boolean;
}

interface DocumentSection {
  id: string;
  title: string;
  body: string;
}

type ContentSegment =
  | { kind: 'markdown'; content: string }
  | ({ kind: 'question' } & QuestionBlockModel);

const slug = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 72);

const splitDocumentSections = (content: string) => {
  const lines = content.split(/\r?\n/);
  const sections: DocumentSection[] = [];
  const intro: string[] = [];
  let current: { title: string; lines: string[] } | null = null;
  let fenced = false;

  const finish = () => {
    if (!current) return;
    const baseId = slug(current.title) || `secao-${sections.length + 1}`;
    const duplicates = sections.filter((section) => section.id.startsWith(baseId)).length;
    sections.push({
      id: duplicates ? `${baseId}-${duplicates + 1}` : baseId,
      title: current.title,
      body: current.lines.join('\n').trim(),
    });
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = !fenced ? /^##\s+(.+?)\s*$/.exec(line) : null;
    if (heading) {
      finish();
      current = { title: heading[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      intro.push(line);
    }
  }
  finish();
  return { intro: intro.join('\n').trim(), sections };
};

const extractQuestionMetadata = (title: string) => {
  const metadata = /\(([^()]*)\)\s*$/.exec(title);
  if (!metadata) return { title };
  const year = /\b(?:19|20)\d{2}\b/.exec(metadata[1])?.[0];
  const board = metadata[1]
    .replace(/\b(?:19|20)\d{2}\b/g, '')
    .replace(/^[\s,;\/-]+|[\s,;\/-]+$/g, '')
    .trim();
  return {
    title: title.slice(0, metadata.index).trim(),
    board: board || undefined,
    year,
  };
};

const splitAlternatives = (statement: string) => {
  const pattern = /(?:^|\n|\s)([A-E])\)\s*([\s\S]*?)(?=(?:\n|\s)[A-E]\)\s|$)/g;
  const matches = [...statement.matchAll(pattern)];
  if (matches.length < 2) return { prompt: statement.trim(), options: [] as Array<{ letter: string; text: string }> };
  const firstIndex = matches[0].index ?? statement.length;
  return {
    prompt: statement.slice(0, firstIndex).trim(),
    options: matches.map((match) => ({ letter: match[1], text: match[2].trim() })),
  };
};

const parseQuestion = (title: string, body: string): QuestionBlockModel => {
  const fields: Record<'prompt' | 'solution' | 'answer' | 'extra', string[]> = {
    prompt: [], solution: [], answer: [], extra: [],
  };
  let active: keyof typeof fields = 'extra';

  for (const line of body.split('\n')) {
    const field = /^\s*-\s+\*\*(Enunciado|Resolução(?: e Justificativa)?|Gabarito):\*\*\s*(.*)$/i.exec(line);
    if (field) {
      active = /^enunciado/i.test(field[1]) ? 'prompt' : /^gabarito/i.test(field[1]) ? 'answer' : 'solution';
      if (field[2]) fields[active].push(field[2]);
    } else {
      fields[active].push(line);
    }
  }

  const { prompt, options } = splitAlternatives(fields.prompt.join('\n').trim());
  return {
    ...extractQuestionMetadata(title),
    prompt: prompt || undefined,
    options,
    solution: fields.solution.join('\n').trim() || undefined,
    answer: fields.answer.join('\n').trim() || undefined,
    extra: fields.extra.join('\n').trim() || undefined,
  };
};

const splitQuestionSegments = (markdown: string): ContentSegment[] => {
  const lines = markdown.split(/\r?\n/);
  const segments: ContentSegment[] = [];
  let markdownLines: string[] = [];
  let question: { title: string; level: number; lines: string[] } | null = null;
  let fenced = false;

  const flushMarkdown = () => {
    const content = markdownLines.join('\n').trim();
    if (content) segments.push({ kind: 'markdown', content });
    markdownLines = [];
  };
  const flushQuestion = () => {
    if (!question) return;
    segments.push({ kind: 'question', ...parseQuestion(question.title, question.lines.join('\n')) });
    question = null;
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = !fenced ? /^(#{3,6})\s+(Quest(?:ã|a)o\s+\d+[^\n]*)$/i.exec(line) : null;
    const otherHeading = !fenced ? /^(#{1,6})\s+/.exec(line) : null;
    const boundary = Boolean(question && otherHeading && otherHeading[1].length <= question.level);
    if (heading) {
      flushQuestion();
      flushMarkdown();
      question = { title: heading[2], level: heading[1].length, lines: [] };
    } else if (boundary) {
      flushQuestion();
      markdownLines.push(line);
    } else if (question) {
      question.lines.push(line);
    } else {
      markdownLines.push(line);
    }
  }
  flushQuestion();
  flushMarkdown();
  return segments;
};

const extractCodeSource = (children: ReactNode): string | null => {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    const collected = children.map(extractCodeSource);
    return collected.every((item) => item !== null) ? collected.join('') : null;
  }
  if (isValidElement(children)) {
    const childProps = children.props as { children?: ReactNode };
    return extractCodeSource(childProps?.children);
  }
  return null;
};

const parseTextContent = (children: ReactNode): string => {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(parseTextContent).join('');
  if (isValidElement(children)) {
    const childProps = children.props as { children?: ReactNode };
    return parseTextContent(childProps?.children);
  }
  return '';
};

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  let tableNumber = 0;
  const segments = useMemo(() => splitQuestionSegments(content), [content]);
  const renderPlainMarkdown = (markdown: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
      components={{
        table: ({ children }) => {
          tableNumber += 1;
          return <ResponsiveTable caption={`Tabela ${tableNumber} — conteúdo pedagógico`}>{children}</ResponsiveTable>;
        },
        pre: ({ children }) => {
          const source = extractCodeSource(children);
          if (source !== null && looksLikeConnectionMap(source)) return <ConnectionMap source={source} />;
          return (
            <div className="code-scroll my-4 min-w-0 max-w-full" role="region" aria-label="Bloco de código com rolagem horizontal" tabIndex={0}>
              <span className="mb-1 block text-xs font-semibold text-teal-700" aria-hidden="true">Role horizontalmente se necessário</span>
              <pre className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed"><code>{source ?? children}</code></pre>
            </div>
          );
        },
        code: ({ children, className: codeClassName }) => (
          <code className={`font-mono text-xs text-teal-800 ${codeClassName || ''}`}>{children}</code>
        ),
        blockquote: ({ children }) => {
          const text = parseTextContent(children);
          if (text.includes('Objetivo de aprendizagem') || text.includes('Objetivo:')) {
            return <PedagogicalCallout type="objective">{children}</PedagogicalCallout>;
          }
          if (text.includes('SuVeCA') || text.includes('Limite do Método') || text.includes('Limite do método')) {
            return <PedagogicalCallout type="method_limit">{children}</PedagogicalCallout>;
          }
          if (text.includes('Insight') || text.includes('Dica')) {
            return <PedagogicalCallout type="insight">{children}</PedagogicalCallout>;
          }
          return (
            <blockquote className="my-3 rounded-r-lg border-l-4 border-teal-600 bg-teal-50/60 p-3 italic text-slate-800">
              {children}
            </blockquote>
          );
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  );

  return <>{segments.map((segment, index) => segment.kind === 'question' ? (
    <QuestionBlock key={`${segment.title}-${index}`} {...segment} renderMarkdown={renderPlainMarkdown} />
  ) : (
    <React.Fragment key={index}>{renderPlainMarkdown(segment.content)}</React.Fragment>
  ))}</>;
};

const renderSectionBody = (section: DocumentSection) => {
  const titleLower = section.title.toLowerCase();

  // 1. Conexão com o método SuVeCA
  if (titleLower.includes('suveca') || titleLower.includes('conexão com o método')) {
    return <SuvecaConnectionViewer content={section.body} />;
  }

  // 2. Regras decisivas
  if (titleLower.includes('regras decisivas')) {
    return <CanonicalRulesViewer content={section.body} />;
  }

  // 3. Erros comuns e pegadinhas
  if (titleLower.includes('erros comuns') || titleLower.includes('pegadinhas')) {
    return <ExamTrapsViewer content={section.body} />;
  }

  // 4. Síntese para recuperação ativa / Checklist
  if (titleLower.includes('recuperação ativa') || titleLower.includes('síntese')) {
    const lines = section.body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const checklistItems = lines
      .filter((l) => /^(?:\d+\.|\*|-)\s+/.test(l))
      .map((l) => l.replace(/^(?:\d+\.|\*|-)\s+/, '').trim());
    if (checklistItems.length >= 2) {
      return <ActiveRecallChecklist items={checklistItems} unitTitle={section.title} />;
    }
  }

  // 5. Glossário Operacional / Conceitos
  if (titleLower.includes('glossário') || titleLower.includes('conceitos')) {
    const lines = section.body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const glossaryItems: GlossaryItem[] = [];
    for (const line of lines) {
      const matchBold = line.match(/^[-*]\s+\*\*([^*:]+):\*\*\s*(.+)/);
      const matchDash = line.match(/^[-*]\s*(?:—|–|-)\s*([^:]+):\s*(.+)/);
      const matchSimple = line.match(/^[-*]\s*([A-ZÀ-Ú][^:]{2,50}):\s*(.+)/);
      
      const match = matchBold || matchDash || matchSimple;
      if (match) {
        glossaryItems.push({
          term: match[1].replace(/^[—–-]\s*/, '').trim(),
          definition: match[2].trim(),
        });
      }
    }
    if (glossaryItems.length >= 2) {
      return <GlossaryGrid items={glossaryItems} title={section.title} />;
    }
  }

  // 6. Demais seções (Explicação, Roteiros, Pré-requisitos, Contrastes, etc.)
  return <MarkdownRenderer content={section.body} />;
};

const PedagogicalDocument: React.FC<{ content: string }> = ({ content }) => {
  const { intro, sections } = useMemo(() => splitDocumentSections(content), [content]);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(sections.slice(0, 1).map((section) => section.id)),
  );

  if (sections.length < 2) return <MarkdownRenderer content={content} />;

  const setSectionOpen = (id: string, open: boolean) => setOpenSections((current) => {
    const next = new Set(current);
    if (open) next.add(id);
    else next.delete(id);
    return next;
  });
  const openFromToc = (id: string) => {
    setSectionOpen(id, true);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const allOpen = openSections.size === sections.length;

  return (
    <div className="pedagogical-document">
      {intro && <MarkdownRenderer content={intro} />}
      <nav className="my-5 rounded-2xl border border-teal-200 bg-teal-50/50 p-4" aria-label="Sumário desta unidade">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 flex items-center gap-2 text-base font-bold text-teal-950"><ListTree className="h-5 w-5" /> Nesta unidade</h2>
          <button type="button" onClick={() => setOpenSections(allOpen ? new Set() : new Set(sections.map((section) => section.id)))} className="min-h-11 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-teal-900 hover:bg-teal-50">
            {allOpen ? 'Recolher todas' : 'Expandir todas'}
          </button>
        </div>
        <ol className="m-0 grid list-none gap-1 p-0 sm:grid-cols-2">
          {sections.map((section, index) => (
            <li key={section.id} className="m-0">
              <button type="button" onClick={() => openFromToc(section.id)} className="flex min-h-11 w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm leading-snug text-teal-950 hover:bg-white">
                <span className="font-bold text-teal-700">{index + 1}.</span><span>{section.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-3">
        {sections.map((section, index) => (
          <details key={section.id} id={section.id} open={openSections.has(section.id)} onToggle={(event) => setSectionOpen(section.id, event.currentTarget.open)} className="group scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/70 px-4 py-3 text-left text-base font-bold text-slate-950 hover:bg-slate-100 sm:px-5">
              <span><span className="mr-2 text-teal-700">{index + 1}.</span>{section.title}</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-teal-700 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-slate-200 px-4 py-4 sm:px-5 sm:py-5">
              {renderSectionBody(section)}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '', pedagogical = false }) => (
  <div className={`reading-content min-w-0 max-w-full text-slate-800 ${className}`}>
    {pedagogical ? <PedagogicalDocument content={content} /> : <MarkdownRenderer content={content} />}
  </div>
);
