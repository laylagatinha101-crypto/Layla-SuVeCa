import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { normalizePedagogicalMarkdown } from './lib/pedagogical-markdown.mjs';

const ROOT = process.cwd();
const SCHEMA_VERSION = '4.2.0';
const COMPILER_VERSION = '1.6.0';
const KNOWLEDGE_SHARD_SIZE = 15;
const EXPECTED_INTEGRATED_LESSONS = Array.from({ length: 14 }, (_, index) => String(index).padStart(2, '0'));
const EXPECTED_INTEGRATED_UNITS = 102;
const A14_SECTION_IDS = Array.from({ length: 13 }, (_, index) => `aula14.sec${String(index + 1).padStart(2, '0')}`);

const args = process.argv.slice(2);
const argumentValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const configuredSource = argumentValue('--source') || process.env.SUVECA_PEDAGOGICAL_SOURCE;
const sourceCandidates = [
  configuredSource,
  path.resolve(ROOT, '..', 'Notebook LM', 'Português'),
  path.resolve(ROOT, '..', 'Notebook LM'),
].filter(Boolean);

const resolvePortugueseRoot = () => {
  for (const candidate of sourceCandidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(path.join(resolved, 'Integracao_Pedagogica', 'v2', 'manifest.json'))) return resolved;
    if (fs.existsSync(path.join(resolved, 'Português', 'Integracao_Pedagogica', 'v2', 'manifest.json'))) {
      return path.join(resolved, 'Português');
    }
    if (fs.existsSync(path.join(resolved, 'Integracao_Pedagogica', 'manifest.json'))) return resolved;
    if (fs.existsSync(path.join(resolved, 'Português', 'Integracao_Pedagogica', 'manifest.json'))) {
      return path.join(resolved, 'Português');
    }
  }
  throw new Error(
    'Fonte editorial não encontrada. Use --source <pasta Português> ou SUVECA_PEDAGOGICAL_SOURCE.',
  );
};

const PORTUGUESE_ROOT = resolvePortugueseRoot();
const PUBLIC_ROOT = path.join(ROOT, 'public', 'knowledge', 'pedagogical');
const UNIT_OUTPUT_ROOT = path.join(PUBLIC_ROOT, 'units');
const SUVECA_METHOD_PATH = path.join(ROOT, 'knowledge', 'editorial', 'suveca-method.json');
const SUVECA_GROUP_CONNECTIONS_PATH = path.join(ROOT, 'knowledge', 'editorial', 'suveca-group-connections.json');
const SUVECA_EDITORIAL_CONNECTIONS_PATH = path.join(ROOT, 'knowledge', 'editorial', 'suveca-connections-editorial.json');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const readUtf8 = (file) => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const readJson = (file) => JSON.parse(readUtf8(file));
const readJsonl = (file) => {
  if (!fs.existsSync(file)) return [];
  return readUtf8(file)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${file}:${index + 1}: JSONL inválido (${error.message}).`);
      }
    });
};

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256(fs.readFileSync(file));
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const compactJson = (value) => `${JSON.stringify(value)}\n`;
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
};

assert(fs.existsSync(SUVECA_METHOD_PATH), 'Definição editorial do método SuVeCA ausente.');
assert(fs.existsSync(SUVECA_GROUP_CONNECTIONS_PATH), 'Conexões temáticas do método SuVeCA ausentes.');
assert(fs.existsSync(SUVECA_EDITORIAL_CONNECTIONS_PATH), 'Projeção editorial das conexões Gemini ausente.');
const suvecaMethod = readJson(SUVECA_METHOD_PATH);
const suvecaGroupConnections = readJson(SUVECA_GROUP_CONNECTIONS_PATH);
const suvecaEditorialConnections = readJson(SUVECA_EDITORIAL_CONNECTIONS_PATH);
assert(suvecaMethod.methodId === 'suveca-analysis-map-v1', 'Identidade do método SuVeCA inválida.');
assert(suvecaGroupConnections.methodId === suvecaMethod.methodId, 'Conexões temáticas pertencem a outro método.');
assert(suvecaEditorialConnections.methodId === suvecaMethod.methodId, 'Projeção editorial pertence a outro método.');
assert(suvecaEditorialConnections.kind === 'suveca_editorially_approved_connections', 'Projeção editorial inválida.');
assert(
  suvecaMethod.equation === 'Sujeito + Verbo + Complemento + Adjunto + Predicativo',
  'Equação pedagógica da SuVeCA inválida.',
);
assert(Array.isArray(suvecaMethod.workflow) && suvecaMethod.workflow.length >= 7, 'Fluxo SuVeCA incompleto.');
assert(
  Array.from({ length: 15 }, (_, index) => `A${String(index).padStart(2, '0')}`)
    .every((lessonId) => suvecaMethod.lessonConnections?.[lessonId]),
  'Conexões SuVeCA não cobrem as aulas A00–A14.',
);
const SUVECA_GROUP_LEVELS = ['central', 'strong', 'support', 'indirect', 'outside_core'];
assert(
  SUVECA_GROUP_LEVELS.every((level) => suvecaGroupConnections.taxonomy?.[level]),
  'Taxonomia temática SuVeCA incompleta.',
);

const relative = (file) => path.relative(ROOT, file).replaceAll(path.sep, '/');
const compactWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const clip = (value, length) => {
  const text = compactWhitespace(value);
  return text.length <= length ? text : `${text.slice(0, length - 1).trim()}…`;
};

const normalizeCodeFences = (markdown) => {
  let text = String(markdown || '');
  text = text.replace(/(?<!`)`\s*\n([\s\S]*?)\n\s*`(?!`)/g, (_, inner) => `\n\`\`\`text\n${inner.trim()}\n\`\`\`\n`);
  let open = false;
  const normalized = text
    .split('\n')
    .map((line) => {
      if (line.trim() !== '`') return line;
      open = !open;
      return open ? '```text' : '```';
    })
    .join('\n');
  const fenceCount = normalized.split('\n').filter((line) => /^\s*```/.test(line)).length;
  return fenceCount % 2 === 0 ? normalized : `${normalized}\n\n\`\`\``;
};

const stripTechnicalSections = (markdown) => markdown
  .replace(
    /\n#{3,6}\s+(?:Relações|Fontes|Proveniência|Rastreabilidade)[^\n]*\n[\s\S]*?(?=\n---\s*$|\n#{2,3}\s+|$)/gim,
    '\n',
  )
  .replace(
    /^\s*[-*]\s+\*{0,2}(?:Relacionado a|Relaciona-se a|Depende de|Aplicado em|Fundamenta|Exemplificado por|Sustentado por|Contrasta com|Possui alerta|Expande-se em):?\*{0,2}\s*.*$/gim,
    '',
  )
  .replace(/^\s*(?:[-*]\s+)?\*{0,2}(?:Proveniência|Rastreabilidade|Fonte técnica|Origens? cruzadas?|Confiança):?\*{0,2}\s*.*$/gim, '');

const stripTechnicalTableColumns = (markdown) => {
  const lines = markdown.split('\n');
  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
  const cells = (line) => line.trim().slice(1, -1).split(/(?<!\\)\|/).map((cell) => cell.trim());
  const isDivider = (line) => {
    if (!isTableRow(line)) return false;
    const row = cells(line);
    return row.length > 0 && row.every((cell) => /^:?-{3,}:?$/.test(cell));
  };
  const technicalHeader = (value) => /^(?:c[oó]digo(?: da (?:unidade|regra))?|id(?: de refer[eê]ncia| principal)?|refer[eê]ncia(?: detalhada| principal)?|unidade detalhada)$/i.test(value);

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!isTableRow(lines[index]) || !isDivider(lines[index + 1])) continue;
    const header = cells(lines[index]);
    const removed = new Set(header.map((value, position) => technicalHeader(value) ? position : -1).filter((position) => position >= 0));
    if (!removed.size || removed.size >= header.length) continue;

    let end = index;
    while (end < lines.length && isTableRow(lines[end])) end += 1;
    for (let rowIndex = index; rowIndex < end; rowIndex += 1) {
      const row = cells(lines[rowIndex]);
      lines[rowIndex] = `| ${row.filter((_, position) => !removed.has(position)).join(' | ')} |`;
    }
    index = end - 1;
  }
  return lines.join('\n');
};

export const cleanLearnerMarkdown = (value) => {
  let markdown = String(value || '').replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '');
  markdown = normalizeCodeFences(markdown);
  markdown = stripTechnicalSections(markdown);
  markdown = markdown
    .replace(
      /(\*{1,2})(?:CANON|MARK|ORAL|QUOTE|TERM|VIS|KB|PROC|EX|WARN|TIP|UNCERTAIN|REL|CARD)-[A-Z0-9_-]+\s+[—–-]\s+/g,
      '$1',
    )
    .replace(
      /^(#{2,6})\s+(?:CANON|MARK|ORAL|QUOTE|TERM|VIS|KB|PROC|EX|WARN|TIP|UNCERTAIN|REL|CARD)-[A-Z0-9_-]+\s+[—–-]\s+/gm,
      '$1 ',
    )
    .replace(/^\s*[-*]\s+`?\d{3}[A-Z]?\s+-\s+[^`\n]+?\s+-\s+720p\.md`?(?:\s*\([^\n)]*\))?\s*$/gim, '')
    .replace(/`?\b\d{3}[A-Z]?\s+-\s+[^`\n]+?\s+-\s+720p\.md`?(?:\s*\([^\n)]*\))?/gi, '')
    .replace(/\b(?:CANON|MARK|ORAL|QUOTE|TERM|VIS|KB|PROC|EX|WARN|TIP|UNCERTAIN|REL|CARD)-[A-Z0-9_-]+\b/g, '')
    .replace(/\bIP-A\d{2}-G\d{2}\b/gi, '')
    .replace(/`(?:thematic|corpus|map):[^`]+`/gi, '')
    .replace(/\[(?:PASSAGE|QUESTION|EDITORIAL|CORPUS):[^\]]+\]/gi, '')
    .replace(/==[0-9a-f]{6,}==/gi, '')
    .replace(/\b(?:proveniência|rastreabilidade):\s[^\n]*\n?/gi, '')
    .replace(/(?<!`)``(?!`)(?:\s*,\s*(?<!`)``(?!`))*/g, '')
    .replace(/\b\d{2}:\d{2}:\d{2}(?:[–—-]\d{2}:\d{2}:\d{2})?\b/g, '')
    .replace(/\bV\d{3}[A-Z]?\b/g, '')
    .replace(/\(`?\d{3}[A-Z]?`?\)/g, '')
    .replace(/\(\s*(?:vídeos?|videoaulas?|material de origem)\s*\d{0,3}[A-Z]?(?:\s*(?:,|e|a|[–—-])\s*\d{3}[A-Z]?)*\s*\)/gi, '')
    .replace(/\b(?:material de origem)(?:\s*(?:,|e|a|[–—-])\s*\d{3}[A-Z]?)+\b/gi, 'conteúdo integrado')
    .replace(/\b(?:n[oa]|neste|nesta)\s+(?:vídeo|videoaula|material de origem)\s*\d{0,3}[A-Z]?\b/gi, 'nesta unidade')
    .replace(/\b(?:d[oa])s?\s+(?:vídeos?|videoaulas?|material de origem)\s*\d{0,3}[A-Z]?(?:\s*(?:,|e|a|[–—-])\s*\d{3}[A-Z]?)*\b/gi, 'do conteúdo integrado')
    .replace(/\b(?:vídeos?|videoaulas?)\s*\d{0,3}[A-Z]?(?:\s*(?:,|e|a|[–—-])\s*\d{3}[A-Z]?)*\b/gi, 'conteúdo integrado')
    .replace(/\bvideoaulas?\b/gi, 'materiais didáticos')
    .replace(/\bvídeos?\b/gi, 'materiais didáticos')
    .replace(/\bA transcrição registra\b/gi, 'A formulação analisada é')
    .replace(/\bNa transcrição,?\b/gi, 'Na formulação,')
    .replace(/\btranscrições?\b/gi, 'registros textuais')
    .replace(/\btimestamps?\b/gi, 'marcadores')
    .replace(/\bslides?\b/gi, 'esquemas')
    .replace(/\bA professora Adriana Figueiredo\b/gi, 'A abordagem didática')
    .replace(/\bA professora\b/gi, 'A abordagem didática')
    .replace(/\bO professor\b/gi, 'A abordagem didática')
    .replace(/\bmaterial de origem\b/gi, 'conteúdo integrado')
    .replace(/\bdo\s+(?:grupo(?: temático)?|agrupamento(?: consolidado)?)\s+\*{0,2}G?\d{2}\*{0,2}\b/gi, 'desta unidade')
    .replace(/\b(?:o\s+)?(?:grupo(?: temático)?|agrupamento(?: consolidado)?)\s+\*{0,2}G?\d{2}\*{0,2}\b/gi, 'esta unidade')
    .replace(/\bG\d{2}\b/g, 'esta unidade')
    .replace(/,?\s*ministrad[oa]\s+pela\s+professora\s+Adriana\s+Figueiredo,?/gi, '')
    .replace(/\b#ANOTAAÍ\b/gi, 'síntese de memorização')
    .replace(/\(\s*(?:,\s*)?\)/g, '')
    .replace(/^\s*(?:Equipe Português Estratégia Concursos.*|Aula 14\s*-\s*Somente em PDF|\d+)\s*$/gim, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  markdown = stripTechnicalTableColumns(markdown)
    .replace(/^\s*[-*]\s+\*{0,2}(?:Relacionado a|Relaciona-se a|Depende de|Aplicado em|Fundamenta|Exemplificado por|Sustentado por|Contrasta com|Possui alerta|Expande-se em):?\*{0,2}\s*[.,;]?\s*$/gim, '')
    .replace(/^\s*[-*]\s+\*{0,2}[^*\n:]{1,100}:?\*{0,2}\s*[.,;]\s*$/gm, '')
    .replace(/^[ \t]*[-*+][ \t]*$/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return markdown ? `${markdown}\n` : '';
};

const plainText = (markdown) => compactWhitespace(
  cleanLearnerMarkdown(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?(?:\[([^\]]*)\])\([^)]*\)/g, '$1')
    .replace(/[*_~>#|$]/g, ' '),
);

const slug = (value) => compactWhitespace(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80);

const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'entre',
  'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos', 'por',
  'que', 'se', 'sem', 'sua', 'suas', 'seu', 'seus', 'um', 'uma', 'uns', 'umas', 'mais', 'menos',
  'aula', 'grupo', 'material', 'estudo', 'questao', 'questoes', 'concurso', 'concursos',
]);

const routingTerms = (...values) => {
  const counts = new Map();
  for (const value of values) {
    const normalized = plainText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    for (const word of normalized.split(/[^a-z0-9]+/)) {
      if (word.length < 3 || STOP_WORDS.has(word) || /^\d+$/.test(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, 80)
    .map(([word]) => word);
};

const fieldDefinitions = [
  ['prerequisites_and_mental_model', 'Pré-requisitos e modelo mental'],
  ['knowledge', 'Explicação didática aprofundada'],
  ['canonical_rules', 'Regras decisivas'],
  ['decision_procedures', 'Roteiros de resolução'],
  ['critical_contrasts', 'Contrastes que a prova explora'],
  ['worked_examples', 'Exemplos comentados'],
  ['mnemonics_and_tips', 'Memorização inteligente'],
  ['misconceptions_and_traps', 'Erros comuns e pegadinhas'],
  ['glossary', 'Glossário operacional'],
  ['pedagogical_synthesis', 'Síntese para recuperação ativa'],
];

const materializeSuvecaConnection = (connection, editorial = undefined) => {
  assert(connection, 'Conexão SuVeCA ausente.');
  const profile = suvecaGroupConnections.taxonomy?.[connection.level];
  const cleanList = (values) => (values || []).map((value) => cleanLearnerMarkdown(value).trim()).filter(Boolean);
  const steps = cleanList(editorial?.focusedSteps || connection.steps || profile?.steps);
  const limits = [...new Set([
    ...(connection.limits || profile?.limits || []),
    ...(editorial?.limits || []).slice(0, 2),
  ])].map((value) => cleanLearnerMarkdown(value).trim()).filter(Boolean);
  assert(connection.label || profile?.label, `Rótulo SuVeCA ausente para ${connection.level}.`);
  assert(connection.summary, `Resumo SuVeCA ausente para ${connection.level}.`);
  assert(Array.isArray(steps) && steps.length > 0, `Procedimento SuVeCA ausente para ${connection.level}.`);
  assert(Array.isArray(limits) && limits.length > 0, `Limite SuVeCA ausente para ${connection.level}.`);
  return {
    level: connection.level,
    label: connection.label || profile.label,
    summary: connection.summary,
    steps,
    limits,
    ...(editorial ? {
      editorialSourceId: editorial.sourceConnectionId,
      primaryLinguisticLayer: editorial.primaryLinguisticLayer,
      entryPoint: cleanLearnerMarkdown(editorial.entryPoint).trim(),
      decisiveTests: cleanList(editorial.decisiveTests),
      contrasts: cleanList(editorial.contrasts),
      examTraps: cleanList(editorial.examTraps),
      syntacticMapExtensions: editorial.syntacticMapExtensions,
      nonLinearOrder: editorial.nonLinearOrder,
      appApplications: editorial.appApplications,
      evidenceRefs: editorial.evidenceRefs,
      conflictAdjudications: editorial.conflictAdjudications,
      publicationStatus: editorial.publicationStatus,
      classificationReconciliation: editorial.classificationReconciliation,
    } : {}),
  };
};
const suvecaConnectionForLesson = (lessonId) => materializeSuvecaConnection(suvecaMethod.lessonConnections[lessonId]);
const suvecaConnectionForUnit = (lessonId, groupId) => {
  const key = `${lessonId}/${groupId}`;
  return materializeSuvecaConnection(
    suvecaGroupConnections.connections[key],
    suvecaEditorialConnections.connections[key],
  );
};
const compactRuntimeSuvecaConnection = (connection) => ({
  level: connection.level,
  label: connection.label,
  summary: connection.summary,
  steps: connection.steps.slice(0, 3).map((step) => clip(step, 260)),
  limits: connection.limits.slice(0, 1).map((limit) => clip(limit, 320)),
  ...(connection.editorialSourceId ? {
    editorialSourceId: connection.editorialSourceId,
    publicationStatus: connection.publicationStatus,
    classificationReconciliation: connection.classificationReconciliation,
  } : {}),
});
const compactIndexedSuvecaConnection = (connection) => ({
  level: connection.level,
  label: connection.label,
  summary: connection.summary,
  editorialSourceId: connection.editorialSourceId,
  publicationStatus: connection.publicationStatus,
  classificationReconciliation: connection.classificationReconciliation,
});
const buildSuvecaConnectionMarkdown = (connection) => [
  '## Conexão com o método SuVeCA',
  `**SuVeCA = ${suvecaMethod.equation}.**`,
  suvecaMethod.definition,
  `**${connection.label}:** ${connection.summary}`,
  `### Como aplicar neste tema\n\n${connection.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
  connection.decisiveTests?.length
    ? `### Testes decisivos\n\n${connection.decisiveTests.map((test) => `- ${test}`).join('\n')}`
    : '',
  connection.limits.length
    ? `> **Limite do método:** ${connection.limits.join(' ')}`
    : '',
].filter(Boolean).join('\n\n');

const demoteEmbeddedHeadings = (markdown) => {
  let fenced = false;
  return markdown.split('\n').map((line) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      return line;
    }
    if (fenced) return line;
    return line.replace(/^(#{1,6})\s+/, (match, hashes) => `${'#'.repeat(Math.min(6, Math.max(3, hashes.length + 1)))} `);
  }).join('\n');
};

const isV2 = fs.existsSync(path.join(PORTUGUESE_ROOT, 'Integracao_Pedagogica', 'v2', 'manifest.json'));
const globalManifestPath = isV2
  ? path.join(PORTUGUESE_ROOT, 'Integracao_Pedagogica', 'v2', 'manifest.json')
  : path.join(PORTUGUESE_ROOT, 'Integracao_Pedagogica', 'manifest.json');
const globalManifest = readJson(globalManifestPath);

if (isV2) {
  assert(globalManifest.structuralStatus === 'valid', 'Integracao_Pedagogica v2 com status estrutural inválido.');
  assert(globalManifest.publicationStatus === 'publishable', 'Integracao_Pedagogica v2 não está aprovada para publicação.');
  assert(globalManifest.counts?.units === EXPECTED_INTEGRATED_UNITS, `Esperadas ${EXPECTED_INTEGRATED_UNITS} unidades integradas na v2.`);
} else {
  assert(globalManifest.status === 'complete', 'Integracao_Pedagogica global não está completa.');
  assert(globalManifest.totals?.pending_groups === 0, 'Integracao_Pedagogica ainda possui grupos pendentes.');
  assert(globalManifest.totals?.integrated_groups === EXPECTED_INTEGRATED_UNITS, `Esperadas ${EXPECTED_INTEGRATED_UNITS} unidades integradas.`);
}

const aiKnowledgePath = path.join(PORTUGUESE_ROOT, 'Integracao_Pedagogica', 'v2', 'projections', 'ai', 'knowledge.jsonl');
const aiKnowledgeRecords = isV2 && fs.existsSync(aiKnowledgePath) ? readJsonl(aiKnowledgePath) : [];
const aiKnowledgeByUnitId = new Map(aiKnowledgeRecords.map((item) => [item.unitId, item]));
const tablesPath = path.join(PORTUGUESE_ROOT, 'Integracao_Pedagogica', 'v2', 'canonical', 'tables.jsonl');
const tablesRecords = isV2 && fs.existsSync(tablesPath) ? readJsonl(tablesPath) : [];
const tablesById = Object.fromEntries(tablesRecords.map((t) => [t.entityId, t]));

const isAsciiDiagram = (text) => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const boxMatches = trimmed.match(/[│├──└──┌┐└┘─▼▲►◄═├└┬┴┼]/gu)?.length || 0;
  if (boxMatches >= 3) return true;
  if (trimmed.includes('├──') || trimmed.includes('└──') || trimmed.includes('┌──') || (trimmed.includes('│') && trimmed.split(/\r?\n/).length >= 2)) {
    return true;
  }
  if (trimmed.startsWith('[Início:') || (trimmed.includes('Passo 1:') && (trimmed.includes('──►') || trimmed.includes('SIM:')))) {
    return true;
  }
  if ((trimmed.includes('──►') || trimmed.includes('───►') || trimmed.includes('─►') || trimmed.includes('├──')) && (trimmed.includes('SIM:') || trimmed.includes('NÃO:'))) {
    return true;
  }
  return false;
};

const renderBlock = (block, tables = {}) => {
  if (block.type === 'heading') return `${'#'.repeat(Math.min(6, Math.max(2, block.level || 2)))} ${block.text || ''}`;
  if (block.type === 'paragraph') {
    const text = block.text || '';
    if (isAsciiDiagram(text)) {
      return `\`\`\`text\n${text.trim()}\n\`\`\``;
    }
    return text;
  }
  if (block.type === 'list') {
    return (block.items || []).map((item, i) => block.ordered ? `${i + 1}. ${item}` : `- ${item}`).join('\n');
  }
  if (block.type === 'callout') return `> ${block.text || ''}`;
  if (block.type === 'code') return `\`\`\`${block.language || 'text'}\n${(block.text || '').trim()}\n\`\`\``;
  if (block.type === 'formula') return `$$\n${(block.text || '').trim()}\n$$`;
  if (block.type === 'table_ref' && tables[block.tableId]) {
    const table = tables[block.tableId];
    const headers = table.headers || [];
    return `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n` +
      (table.rows || []).map((row) => `| ${row.join(' | ')} |`).join('\n');
  }
  return block.text || '';
};

const renderFragment = (fragment, tables = {}) => {
  return (fragment.contentBlocks || []).map((b) => renderBlock(b, tables)).filter(Boolean).join('\n\n');
};

const buildUnitMarkdown = (unit, methodConnection) => {
  const objective = (unit.learning_objectives || []).map((item) => cleanLearnerMarkdown(item).trim()).filter(Boolean);
  const sections = fieldDefinitions.flatMap(([key, heading]) => {
    const content = demoteEmbeddedHeadings(cleanLearnerMarkdown(unit.pedagogical_sections?.[key]));
    return content ? [`## ${heading}\n\n${content.trim()}`] : [];
  });
  const methodBeforeContent = !['indirect', 'outside_core'].includes(methodConnection.level);
  return normalizePedagogicalMarkdown([
    `# ${unit.title}`,
    objective.length
      ? `> **Objetivo de aprendizagem**\n>\n> ${objective.join(' ')}`
      : '',
    'Esta unidade foi preparada para estudo autônomo: avance do modelo mental para as regras, aplique o procedimento e finalize recuperando a síntese sem consulta.',
    methodBeforeContent ? buildSuvecaConnectionMarkdown(methodConnection) : '',
    ...sections,
    methodBeforeContent ? '' : buildSuvecaConnectionMarkdown(methodConnection),
  ].filter(Boolean).join('\n\n---\n\n'));
};

const lessonDirectories = fs.readdirSync(path.join(PORTUGUESE_ROOT, 'Aula Processada'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const lessonDirectory = (number) => {
  const prefix = `Aula ${number} `;
  const match = lessonDirectories.find((name) => name.startsWith(prefix));
  assert(match, `Pasta da Aula ${number} não encontrada.`);
  return path.join(PORTUGUESE_ROOT, 'Aula Processada', match);
};

const lessonSources = [];
const units = [];
const flashcardCandidates = [];
const decisionCandidates = [];

for (const number of EXPECTED_INTEGRATED_LESSONS) {
  const directory = lessonDirectory(number);
  const integrationV2 = path.join(directory, 'Integracao_Pedagogica', 'v2');
  const integrationV1 = path.join(directory, 'Integracao_Pedagogica');
  const useV2 = isV2 && fs.existsSync(path.join(integrationV2, 'manifest.json'));
  const integration = useV2 ? integrationV2 : integrationV1;
  const manifestPath = path.join(integration, 'manifest.json');
  const coveragePath = useV2 ? path.join(integration, 'qa', 'migration_retention.json') : path.join(integration, 'coverage.json');
  const unitsPath = useV2 ? path.join(integration, 'canonical', 'units.jsonl') : path.join(integration, 'canonical', 'pedagogical_units.jsonl');
  const flashcardsPath = path.join(directory, 'Integracao_Pedagogica', 'suveca', 'flashcard_candidates.jsonl');
  const decisionsPath = path.join(directory, 'Integracao_Pedagogica', 'suveca', 'decision_tree_candidates.jsonl');
  const questionsPath = path.join(directory, 'corpus_apostila', 'questions.jsonl');
  const answersPath = path.join(directory, 'corpus_apostila', 'answers.jsonl');
  const lessonManifest = readJson(manifestPath);
  
  let lessonUnits = readJsonl(unitsPath);
  if (useV2) {
    assert(lessonManifest.structuralStatus === 'valid' && lessonManifest.publicationStatus === 'publishable', `A${number}: integração v2 incompleta.`);
    assert(lessonUnits.length === lessonManifest.counts?.units, `A${number}: unidades divergentes da contagem.`);
    lessonUnits = lessonUnits.map((u) => {
      const ai = aiKnowledgeByUnitId.get(u.unitId) || {};
      const pedagogical_sections = {};
      for (const fragment of ai.coreExplanation || []) {
        const role = fragment.role || 'knowledge';
        const text = renderFragment(fragment, tablesById);
        if (text) {
          pedagogical_sections[role] = pedagogical_sections[role]
            ? `${pedagogical_sections[role]}\n\n${text}`
            : text;
        }
      }
      return {
        ...u,
        unit_id: u.unitId,
        lesson_id: u.lessonId,
        group_id: u.groupId,
        canonical_topic_id: u.canonicalTopicId,
        lesson_identity: `Aula ${number}`,
        media_independent: true,
        authority: { normative: 'corpus_apostila', editorial: 'Integracao_Pedagogica_v2' },
        learning_objectives: (ai.learningObjectives || []).map((o) => o.text || o.title || o),
        pedagogical_sections,
        canonical_rules: ai.canonicalRules || [],
        decision_procedures: ai.decisionProcedures || [],
        contrasts: ai.contrasts || [],
        exam_traps: ai.examTraps || [],
        worked_examples: ai.workedExamples || [],
        core_explanation: ai.coreExplanation || [],
        source_refs: { corpus: u.sourceRefs || [] },
      };
    });
  } else {
    const coverage = readJson(coveragePath);
    assert(coverage.status === 'complete' && coverage.pending_groups === 0, `A${number}: integração incompleta.`);
    assert(lessonUnits.length === coverage.integrated_groups, `A${number}: unidades divergentes da cobertura.`);
  }
  
  units.push(...lessonUnits);
  if (fs.existsSync(flashcardsPath)) flashcardCandidates.push(...readJsonl(flashcardsPath));
  if (fs.existsSync(decisionsPath)) decisionCandidates.push(...readJsonl(decisionsPath));
  lessonSources.push({
    lessonId: `A${number}`,
    directory,
    integration,
    manifest: lessonManifest,
    questionsPath,
    answersPath,
    files: [manifestPath, unitsPath, questionsPath, answersPath].filter((f) => fs.existsSync(f)),
  });
}

assert(units.length === EXPECTED_INTEGRATED_UNITS, `Unidades pedagógicas: ${units.length}/${EXPECTED_INTEGRATED_UNITS}.`);
assert(new Set(units.map((unit) => unit.unit_id)).size === units.length, 'Há unit_id pedagógico duplicado.');
assert(units.every((unit) => unit.media_independent === true), 'Há unidade dependente de mídia.');
const expectedSuvecaGroupKeys = units.map((unit) => `${unit.lesson_id}/${unit.group_id}`).sort();
const actualSuvecaGroupKeys = Object.keys(suvecaGroupConnections.connections || {}).sort();
const actualEditorialConnectionKeys = Object.keys(suvecaEditorialConnections.connections || {}).sort();
assert(actualSuvecaGroupKeys.length === EXPECTED_INTEGRATED_UNITS, `Conexões SuVeCA: ${actualSuvecaGroupKeys.length}/${EXPECTED_INTEGRATED_UNITS}.`);
assert(
  JSON.stringify(actualSuvecaGroupKeys) === JSON.stringify(expectedSuvecaGroupKeys),
  'As conexões SuVeCA não correspondem exatamente aos 102 grupos integrados.',
);
assert(
  JSON.stringify(actualEditorialConnectionKeys) === JSON.stringify(expectedSuvecaGroupKeys),
  'A projeção editorial não corresponde exatamente aos 102 grupos integrados.',
);
for (const [key, connection] of Object.entries(suvecaGroupConnections.connections)) {
  assert(SUVECA_GROUP_LEVELS.includes(connection.level), `${key}: nível SuVeCA inválido (${connection.level}).`);
  const editorial = suvecaEditorialConnections.connections[key];
  assert(editorial?.editorialLevel === connection.level, `${key}: reconciliação editorial diverge da taxonomia humana.`);
  assert(editorial?.publicationStatus?.startsWith('approved'), `${key}: conexão sem aprovação editorial.`);
  materializeSuvecaConnection(connection, editorial);
}
const publishedGroupConnections = Object.fromEntries(
  Object.entries(suvecaGroupConnections.connections).map(([key, connection]) => [
    key,
    compactIndexedSuvecaConnection(
      materializeSuvecaConnection(connection, suvecaEditorialConnections.connections[key]),
    ),
  ]),
);
const publishedSuvecaMethod = {
  ...suvecaMethod,
  groupTaxonomy: suvecaGroupConnections.taxonomy,
  groupConnections: publishedGroupConnections,
  editorialConnectionSource: {
    schemaVersion: suvecaEditorialConnections.schemaVersion,
    sourceDigest: suvecaEditorialConnections.sourceDigest,
    policy: suvecaEditorialConnections.editorialPolicy,
    totals: suvecaEditorialConnections.totals,
  },
};
const methodologyGroupDistribution = Object.values(suvecaGroupConnections.connections).reduce((counts, connection) => ({
  ...counts,
  [connection.level]: (counts[connection.level] || 0) + 1,
}), {});

const a14Directory = lessonDirectory('14');
const a14Corpus = path.join(a14Directory, 'corpus_apostila');
const a14ManifestPath = path.join(a14Corpus, 'manifest.json');
const a14Manifest = readJson(a14ManifestPath);
const a14SectionsPath = path.join(a14Corpus, 'sections.jsonl');
const a14ConceptsPath = path.join(a14Corpus, 'concepts.jsonl');
const a14RulesPath = path.join(a14Corpus, 'rules.jsonl');
const a14ExamplesPath = path.join(a14Corpus, 'examples.jsonl');
const a14ChunksPath = path.join(a14Corpus, 'rag_chunks.jsonl');
const a14Sections = readJsonl(a14SectionsPath);
const a14Concepts = readJsonl(a14ConceptsPath);
const a14Rules = readJsonl(a14RulesPath);
const a14Examples = readJsonl(a14ExamplesPath);
const a14Chunks = readJsonl(a14ChunksPath);
assert(a14Manifest.validation_summary?.schema_errors === 0, 'A14 possui erros de schema no corpus.');
assert(a14Manifest.validation_summary?.broken_references === 0, 'A14 possui referências quebradas no corpus.');

const sourceFiles = [
  SUVECA_METHOD_PATH,
  SUVECA_GROUP_CONNECTIONS_PATH,
  SUVECA_EDITORIAL_CONNECTIONS_PATH,
  globalManifestPath,
  ...lessonSources.flatMap((lesson) => lesson.files),
  a14ManifestPath,
  a14SectionsPath,
  a14ConceptsPath,
  a14RulesPath,
  a14ExamplesPath,
  a14ChunksPath,
];
const sourceDigest = sha256(sourceFiles.map((file) => `${relative(file)}:${sha256File(file)}`).join('\n'));
const buildId = sha256(`${SCHEMA_VERSION}:${COMPILER_VERSION}:${sourceDigest}`).slice(0, 16);

if (fs.existsSync(PUBLIC_ROOT)) {
  const resolvedPublic = path.resolve(PUBLIC_ROOT);
  const expectedPublic = path.resolve(ROOT, 'public', 'knowledge', 'pedagogical');
  assert(resolvedPublic === expectedPublic && resolvedPublic.startsWith(path.resolve(ROOT) + path.sep), 'Destino público inseguro.');
  fs.rmSync(resolvedPublic, { recursive: true, force: true });
}
fs.mkdirSync(UNIT_OUTPUT_ROOT, { recursive: true });

const lessonTitles = new Map();
const unitById = new Map(units.map((unit) => [unit.unit_id, unit]));
const runtimeSections = [];
const knowledgeRecords = [];

for (const unit of units.sort((a, b) => a.unit_id.localeCompare(b.unit_id))) {
  const lessonNumber = unit.lesson_id.slice(1);
  const methodConnection = suvecaConnectionForUnit(unit.lesson_id, unit.group_id);
  const runtimeMethodConnection = compactRuntimeSuvecaConnection(methodConnection);
  lessonTitles.set(unit.lesson_id, unit.lesson_identity.replace(/^Aula \d{2}\s+[—–-]\s*/, '').trim());
  const fileName = `${unit.lesson_id}-${unit.group_id}-${slug(unit.title)}.md`;
  const outputFile = path.join(UNIT_OUTPUT_ROOT, fileName);
  const markdown = buildUnitMarkdown(unit, methodConnection);
  write(outputFile, markdown);
  const objective = cleanLearnerMarkdown((unit.learning_objectives || []).join(' ')).trim();
  const searchable = routingTerms(
    unit.title,
    objective,
    methodConnection.summary,
    methodConnection.steps.join(' '),
    unit.pedagogical_sections?.semantic_index,
    unit.pedagogical_sections?.retrieval_essentials,
    unit.pedagogical_sections?.canonical_rules,
  );
  const wordCount = plainText(markdown).split(/\s+/).filter(Boolean).length;
  const sourceConceptIds = [
    unit.canonical_topic_id,
    ...(unit.source_refs?.corpus || []).filter((id) => !String(id).includes(':rag.')).slice(0, 24),
  ];
  const section = {
    title: unit.title,
    contentMarkdown: `**Objetivo:** ${objective || `Dominar ${unit.title}.`}\n\nAbra o aprofundamento para estudar o modelo mental, as regras, os procedimentos, os exemplos, as exceções e as pegadinhas desta unidade.`,
    contentUrl: `/knowledge/pedagogical/units/${fileName}`,
    summary: clip(objective, 420),
    lessonId: unit.lesson_id,
    groupId: unit.group_id,
    canonicalTopicId: unit.canonical_topic_id,
    estimatedMinutes: Math.max(20, Math.min(120, Math.ceil(wordCount / 170))),
    searchTerms: searchable,
    sourceConceptIds,
    suvecaMethod: {
      methodId: suvecaMethod.methodId,
      equation: suvecaMethod.equation,
      definition: suvecaMethod.definition,
      authorityNote: suvecaMethod.authorityNote,
      ...runtimeMethodConnection,
    },
    editorial: {
      reviewVersion: `integracao-pedagogica-${globalManifest.content_version}`,
      changeType: 'replace_from_pedagogical_source',
      integrationUnitId: unit.unit_id,
      authority: unit.authority,
      sourceProvider: unit.authority?.didactic || 'integracao_pedagogica',
      evidenceRefs: [],
    },
  };
  runtimeSections.push(section);
  knowledgeRecords.push({
    id: unit.canonical_topic_id,
    unitId: unit.unit_id,
    lessonId: unit.lesson_id,
    groupId: unit.group_id,
    moduleId: `mod${lessonNumber}`,
    title: unit.title,
    routingTerms: searchable,
    objective: clip(objective, 1200),
    sections: [
      ['Regras decisivas', unit.pedagogical_sections?.canonical_rules],
      ['Roteiro de resolução', unit.pedagogical_sections?.decision_procedures],
      ['Contrastes', unit.pedagogical_sections?.critical_contrasts],
      ['Erros e pegadinhas', unit.pedagogical_sections?.misconceptions_and_traps],
      ['Síntese', unit.pedagogical_sections?.retrieval_essentials || unit.pedagogical_sections?.pedagogical_synthesis],
    ].flatMap(([title, content]) => {
      const clean = cleanLearnerMarkdown(content).trim();
      return clean ? [{ title, content: clip(clean, 4200) }] : [];
    }),
    sourceRefs: [`EDITORIAL:${unit.unit_id}`, `CORPUS:${unit.lesson_id}`],
    authority: unit.authority,
    methodology: {
      methodId: suvecaMethod.methodId,
      equation: suvecaMethod.equation,
      definition: suvecaMethod.definition,
      ...runtimeMethodConnection,
    },
  });
}

const a14TopSections = A14_SECTION_IDS.map((sectionId) => {
  const section = a14Sections.find((item) => item.section_id === sectionId);
  assert(section, `Seção ${sectionId} ausente da Aula 14.`);
  return section;
});

const belongsToA14Section = (record, sectionId) => {
  const values = [
    ...(record.context_section_ids || []),
    ...(record.evidence_unit_ids || []),
    ...(record.source?.unit_ids || []),
    ...(record.unit_ids || []),
  ].map(String);
  return values.some((value) => value === sectionId || value.startsWith(`${sectionId}.`));
};

for (const [index, section] of a14TopSections.entries()) {
  const sectionId = section.section_id;
  const sequence = String(index + 1).padStart(2, '0');
  const concepts = a14Concepts.filter((item) => belongsToA14Section(item, sectionId));
  const rules = a14Rules.filter((item) => belongsToA14Section(item, sectionId));
  const examples = a14Examples.filter((item) => belongsToA14Section(item, sectionId));
  const chunks = a14Chunks.filter((item) => belongsToA14Section(item, sectionId));
  const prioritizedRules = [...rules].sort((a, b) => {
    const priority = (item) => item.annotation_state === 'observed_highlight' ? 0 : 1;
    return priority(a) - priority(b) || (b.confidence || 0) - (a.confidence || 0);
  });
  const prioritizedExamples = [...examples].sort((a, b) => {
    const priority = (item) => item.annotation_state === 'observed_highlight' ? 0 : 1;
    return priority(a) - priority(b) || (b.extraction_confidence || 0) - (a.extraction_confidence || 0);
  });
  const conceptLabels = [...new Set(concepts.map((item) => compactWhitespace(item.label)).filter(Boolean))];
  const prioritizedRuleLabels = prioritizedRules
    .map((item) => cleanLearnerMarkdown(item.label).trim())
    .filter(Boolean);
  const rulesMarkdown = prioritizedRuleLabels.length
    ? prioritizedRuleLabels.map((label) => `- ${label}`).join('\n')
    : '- Recupere as regras do tema pelas unidades aprofundadas correspondentes.';
  const prioritizedExampleLines = prioritizedExamples
    .map((item) => {
      const statement = cleanLearnerMarkdown(item.statement).trim();
      const explanation = cleanLearnerMarkdown(item.explanation).trim();
      if (!statement) return explanation ? `- ${explanation}` : '';
      return `- **${statement}**${explanation ? ` — ${explanation}` : ''}`;
    })
    .filter(Boolean);
  const examplesMarkdown = prioritizedExampleLines.length
    ? prioritizedExampleLines.join('\n')
    : '- Resolva questões misturadas do tema e justifique cada alternativa.';
  const chunkMarkdown = chunks.map((chunk) => {
    const text = cleanLearnerMarkdown(chunk.text).trim();
    return text ? `### ${cleanLearnerMarkdown(chunk.title).trim() || section.title}\n\n${text}` : '';
  }).filter(Boolean).join('\n\n');
  const markdown = normalizePedagogicalMarkdown([
    `# Revisão cumulativa · ${section.title}`,
    '> **Objetivo de revisão**\n>\n> Recuperar as decisões centrais do tema, localizar rapidamente lacunas e voltar ao aprofundamento correspondente sempre que a justificativa não puder ser reconstruída de memória.',
    buildSuvecaConnectionMarkdown(suvecaConnectionForLesson('A14')),
    conceptLabels.length ? `## Mapa de conceitos\n\n${conceptLabels.map((label) => `- ${label}`).join('\n')}` : '',
    `## Regras priorizadas\n\n${rulesMarkdown}`,
    chunkMarkdown ? `## Síntese estruturada\n\n${chunkMarkdown}` : '',
    `## Exemplos para recuperação\n\n${examplesMarkdown}`,
    '## Protocolo de revisão ativa\n\n1. Cubra a explicação e formule a regra de memória.\n2. Crie um exemplo positivo e um caso contrastivo.\n3. Explique qual pista decide a classificação.\n4. Se houver hesitação, retorne à unidade aprofundada do tema antes de avançar.',
  ].filter(Boolean).join('\n\n---\n\n'));
  const fileName = `A14-S${sequence}-${slug(section.title)}.md`;
  write(path.join(UNIT_OUTPUT_ROOT, fileName), markdown);
  const canonicalTopicId = `pt:a14:revisao:${slug(section.title)}`;
  const searchable = routingTerms(
    section.title,
    conceptLabels.join(' '),
    rulesMarkdown,
    chunkMarkdown,
    suvecaConnectionForLesson('A14').summary,
  );
  const unitId = `IP-A14-S${sequence}`;
  runtimeSections.push({
    title: section.title,
    contentMarkdown: `**Revisão cumulativa:** recupere conceitos, regras priorizadas e exemplos de ${section.title}; use as unidades aprofundadas das aulas anteriores para sanar qualquer lacuna.`,
    contentUrl: `/knowledge/pedagogical/units/${fileName}`,
    summary: `Revisão cumulativa de ${section.title}, orientada pelos grifos especializados da apostila da Aula 14.`,
    lessonId: 'A14',
    groupId: `R${sequence}`,
    canonicalTopicId,
    estimatedMinutes: Math.max(15, Math.min(80, Math.ceil(plainText(markdown).split(/\s+/).length / 180))),
    searchTerms: searchable,
    sourceConceptIds: [canonicalTopicId, ...concepts.map((item) => item.concept_id).slice(0, 24)],
    suvecaMethod: {
      methodId: suvecaMethod.methodId,
      equation: suvecaMethod.equation,
      definition: suvecaMethod.definition,
      authorityNote: suvecaMethod.authorityNote,
      ...suvecaConnectionForLesson('A14'),
    },
    editorial: {
      reviewVersion: 'corpus-apostila-a14-expert-highlights',
      changeType: 'replace_from_pedagogical_source',
      integrationUnitId: unitId,
      authority: { normative: 'corpus_apostila', editorial: 'Aula 14 — revisão cumulativa' },
      sourceProvider: 'corpus_apostila_expert_curated',
      evidenceRefs: [],
    },
  });
  knowledgeRecords.push({
    id: canonicalTopicId,
    unitId,
    lessonId: 'A14',
    groupId: `R${sequence}`,
    moduleId: 'mod14',
    title: `Revisão · ${section.title}`,
    routingTerms: searchable,
    objective: `Recuperar e conectar as decisões centrais de ${section.title}.`,
    sections: [
      { title: 'Regras priorizadas', content: clip(rulesMarkdown, 5000) },
      { title: 'Conceitos', content: clip(conceptLabels.join('; '), 2500) },
      { title: 'Exemplos', content: clip(examplesMarkdown, 3500) },
    ],
    sourceRefs: [`EDITORIAL:${unitId}`, `CORPUS:A14:${sectionId}`],
    authority: { normative: 'corpus_apostila', editorial: 'Aula 14 — revisão cumulativa' },
    methodology: {
      methodId: suvecaMethod.methodId,
      equation: suvecaMethod.equation,
      definition: suvecaMethod.definition,
      ...suvecaConnectionForLesson('A14'),
    },
  });
}

const sectionByLesson = new Map();
for (const section of runtimeSections) {
  if (!sectionByLesson.has(section.lessonId)) sectionByLesson.set(section.lessonId, []);
  sectionByLesson.get(section.lessonId).push(section);
}

const lessonDescriptions = {
  A00: 'Forma gráfica, estrutura sonora, sílaba, acentuação, hífen e emprego dos porquês.',
  A01: 'Classes variáveis e invariáveis analisadas em contexto e em funções sintáticas reais.',
  A02: 'Preposições, conjunções e relações lógico-semânticas que organizam orações e textos.',
  A03: 'Pronomes, referenciação, relativos e colocação pronominal orientados por critérios de prova.',
  A04: 'Tempos, modos, formas nominais, conjugação e valores dos verbos.',
  A05: 'Transitividade, correlação, vozes verbais, partícula se e estruturas de predicação.',
  A06: 'Reconstrução morfossintática e identificação segura dos termos da oração.',
  A07: 'Coordenação, subordinação, funções de que e se e relações no período composto.',
  A08: 'Pontuação decidida pela sintaxe, pelo deslocamento, pelo escopo e pelo efeito de sentido.',
  A09: 'Concordância verbal e nominal com procedimentos, casos especiais e armadilhas recorrentes.',
  A10: 'Regência verbal e nominal e crase analisadas por acepção, estrutura e contexto.',
  A11: 'Coesão sequencial e referencial, coerência e reescrita com preservação de relações.',
  A12: 'Sentido, relações lexicais, ambiguidade, polissemia e figuras de linguagem.',
  A13: 'Recorrência, inferência, tipologias textuais, argumentação e funções da linguagem.',
  A14: 'Revisão geral cumulativa priorizada pelos grifos especializados da apostila canônica.',
};

const lessonTitleOverrides = {
  A13: 'Compreensão, Interpretação e Tipologia Textual',
};

const moduleSources = (lessonId, sections) => sections.slice(0, 6).map((section, index) => ({
  id: section.editorial.integrationUnitId,
  title: section.title.replace(/^[GR]\d{2}\s*·\s*/, ''),
  type: lessonId === 'A14' ? 'corpus_apostila_expert_curated' : 'integracao_pedagogica',
  url: null,
  score: Math.max(1, 100 - index * 5),
}));

const modules = Array.from({ length: 15 }, (_, index) => {
  const number = String(index).padStart(2, '0');
  const lessonId = `A${number}`;
  const sections = sectionByLesson.get(lessonId) || [];
  assert(sections.length > 0, `${lessonId}: nenhum conteúdo curricular gerado.`);
  const title = lessonId === 'A14'
    ? 'Revisão Geral de Língua Portuguesa'
    : lessonTitleOverrides[lessonId] || lessonTitles.get(lessonId);
  const methodConnection = suvecaConnectionForLesson(lessonId);
  return {
    id: `mod${index}`,
    num: index,
    title,
    subtitle: `Aula ${number} · ${sections.length} ${sections.length === 1 ? 'unidade pedagógica' : 'unidades pedagógicas'}`,
    description: lessonDescriptions[lessonId],
    estimatedMinutes: sections.reduce((total, section) => total + section.estimatedMinutes, 0),
    sections,
    questions: [],
    suvecaMethod: {
      methodId: suvecaMethod.methodId,
      equation: suvecaMethod.equation,
      definition: suvecaMethod.definition,
      authorityNote: suvecaMethod.authorityNote,
      ...methodConnection,
    },
    knowledge: {
      kbVersion: globalManifest.content_version,
      buildId,
      editorialStatus: 'approved_ai_reviewed',
      reviewVersion: lessonId === 'A14' ? 'corpus-a14-expert-curated' : 'integracao-pedagogica-1.1',
      reviewedAt: '2026-08-17',
      reviewerType: 'ai',
      reviewConfidence: null,
      sourceCount: sections.length,
      sources: moduleSources(lessonId, sections),
    },
  };
});

const cleanEditorialQuestionText = (value) => String(value || '')
  .replace(/==[0-9a-f]{6,}==/gi, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

const normalizeQuestionText = (value) => cleanEditorialQuestionText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

const answerLetter = (value) => /^(?:letter_|option_)?([a-e])$/.exec(normalizeQuestionText(value))?.[1]?.toUpperCase();
const binaryAnswer = (value) => {
  const normalized = normalizeQuestionText(value);
  if (['correct', 'correta', 'correto', 'certo', 'true', 'c'].includes(normalized)) return 'C';
  if (['incorrect', 'incorreta', 'incorreto', 'errado', 'false', 'e'].includes(normalized)) return 'E';
  return null;
};
const occurrenceKind = (question) => normalizeQuestionText(
  question.occurrence
  || question.occurrence_type
  || question.occurrence_kind
  || question.occurrence_section,
);
const occurrenceRank = (question) => {
  const kind = occurrenceKind(question);
  if (kind.includes('comment')) return 3;
  if (kind.includes('practice') || kind.includes('theory')) return 2;
  return 1;
};
const questionFingerprint = (question) => [
  normalizeQuestionText(question.support_text),
  normalizeQuestionText(question.prompt),
  (question.options || []).map((option) => `${normalizeQuestionText(option.label)}:${normalizeQuestionText(option.text)}`).join('|'),
].join('|#|');
const questionGroupingFields = [
  'duplicate_group_id',
  'question_group_id',
  'conceptual_question_id',
  'conceptual_question_key',
  'question_family_id',
  'question_group',
];
const quarantinedQuestionIds = new Map([
  ['A01:aula01.q0001', 'O comentário incorpora uma segunda questão completa.'],
  ['A13:aula13.q0001', 'As alternativas foram divididas incorretamente entre support_text e prompt.'],
]);

const corpusQuestionOccurrences = lessonSources.flatMap((lesson) => {
  assert(fs.existsSync(lesson.questionsPath), `${lesson.lessonId}: questions.jsonl ausente.`);
  assert(fs.existsSync(lesson.answersPath), `${lesson.lessonId}: answers.jsonl ausente.`);
  const questions = readJsonl(lesson.questionsPath);
  const answers = readJsonl(lesson.answersPath);
  const answerByQuestionId = new Map(answers.map((answer) => [answer.question_id, answer]));
  assert(answerByQuestionId.size === answers.length, `${lesson.lessonId}: answer.question_id duplicado.`);
  return questions.map((question) => ({
    lessonId: lesson.lessonId,
    question,
    answer: answerByQuestionId.get(question.question_id),
  }));
});

const occurrenceKey = (occurrence) => `${occurrence.lessonId}:${occurrence.question.question_id}`;
const parentByOccurrence = new Map(corpusQuestionOccurrences.map((occurrence) => {
  const key = occurrenceKey(occurrence);
  return [key, key];
}));
const findOccurrenceRoot = (key) => {
  const parent = parentByOccurrence.get(key);
  if (parent === key) return key;
  const root = findOccurrenceRoot(parent);
  parentByOccurrence.set(key, root);
  return root;
};
const unionOccurrences = (left, right) => {
  if (!parentByOccurrence.has(left) || !parentByOccurrence.has(right)) return;
  const leftRoot = findOccurrenceRoot(left);
  const rightRoot = findOccurrenceRoot(right);
  if (leftRoot !== rightRoot) parentByOccurrence.set(rightRoot, leftRoot);
};

for (const occurrence of corpusQuestionOccurrences) {
  if (occurrence.question.duplicate_of) {
    unionOccurrences(occurrenceKey(occurrence), `${occurrence.lessonId}:${occurrence.question.duplicate_of}`);
  }
}
for (const field of questionGroupingFields) {
  const firstByGroup = new Map();
  for (const occurrence of corpusQuestionOccurrences) {
    const group = occurrence.question[field];
    if (!group) continue;
    const groupKey = `${occurrence.lessonId}:${field}:${group}`;
    if (firstByGroup.has(groupKey)) unionOccurrences(occurrenceKey(occurrence), firstByGroup.get(groupKey));
    else firstByGroup.set(groupKey, occurrenceKey(occurrence));
  }
}
const firstByFingerprint = new Map();
for (const occurrence of corpusQuestionOccurrences) {
  const fingerprint = questionFingerprint(occurrence.question);
  if (fingerprint.replaceAll('|#|', '').length < 20) continue;
  if (firstByFingerprint.has(fingerprint)) unionOccurrences(occurrenceKey(occurrence), firstByFingerprint.get(fingerprint));
  else firstByFingerprint.set(fingerprint, occurrenceKey(occurrence));
}

const normalizeEligibleQuestion = (occurrence) => {
  const { lessonId, question, answer } = occurrence;
  const sourceKey = occurrenceKey(occurrence);
  if (quarantinedQuestionIds.has(sourceKey)) return null;
  const cleanedPrompt = cleanEditorialQuestionText(question?.prompt);
  const cleanedSupportText = cleanEditorialQuestionText(question?.support_text);
  const cleanedCommentary = cleanEditorialQuestionText(answer?.commentary);
  if (!question?.question_id || cleanedPrompt.length < 10) return null;
  if (!question.source || !answer?.source || answer.question_id !== question.question_id) return null;
  if (!Number.isFinite(question.extraction_confidence) || question.extraction_confidence < 0.9) return null;
  if (!Number.isFinite(answer.confidence) || answer.confidence < 0.9) return null;
  if (!String(answer.answer || '').trim() || !cleanedCommentary) return null;

  const options = (question.options || [])
    .filter((option) => String(option?.text || '').trim())
    .map((option) => ({
      letter: answerLetter(option.label) || String(option.label || '').trim().toUpperCase(),
      label: String(option.label || '').trim(),
       text: cleanEditorialQuestionText(option.text),
    }));
  const multipleChoiceAnswer = answerLetter(answer.answer);
  let questionType;
  let correctAnswer;
  let normalizedOptions = [];
  if (options.length >= 2 && multipleChoiceAnswer && options.some((option) => option.letter === multipleChoiceAnswer)) {
    questionType = 'MULTIPLA_ESCOLHA';
    correctAnswer = multipleChoiceAnswer;
    normalizedOptions = options;
  } else if (question.question_type !== 'multiple_choice' && binaryAnswer(answer.answer)) {
    questionType = 'CERTO_ERRADO';
    correctAnswer = binaryAnswer(answer.answer);
  } else {
    return null;
  }

  return {
    ...occurrence,
    sourceKey,
    questionType,
    correctAnswer,
    options: normalizedOptions,
    cleanedPrompt,
    cleanedSupportText,
    cleanedCommentary,
  };
};

const eligibleOccurrences = corpusQuestionOccurrences.map(normalizeEligibleQuestion).filter(Boolean);
const eligibleByGroup = new Map();
for (const occurrence of eligibleOccurrences) {
  const root = findOccurrenceRoot(occurrence.sourceKey);
  if (!eligibleByGroup.has(root)) eligibleByGroup.set(root, []);
  eligibleByGroup.get(root).push(occurrence);
}
const compareQuestionCandidates = (left, right) => (
  occurrenceRank(right.question) - occurrenceRank(left.question)
  || String(right.answer.commentary).length - String(left.answer.commentary).length
  || right.answer.confidence - left.answer.confidence
  || right.question.extraction_confidence - left.question.extraction_confidence
  || left.sourceKey.localeCompare(right.sourceKey, 'en')
);

const editorialQuestionRecords = [...eligibleByGroup.values()].map((group) => {
  const occurrences = [...group].sort(compareQuestionCandidates);
  const primary = occurrences[0];
  const editorialQuestionId = `${primary.lessonId}:${primary.question.question_id}`;
  const lessonIds = [...new Set(occurrences.map((item) => item.lessonId))].sort();
  const moduleIds = lessonIds.map((lessonId) => `mod${Number(lessonId.slice(1))}`);
  const rawConceptIds = [...new Set(occurrences.flatMap((item) => item.question.tests_concept_ids || []))].sort();
  const conceptIds = [...new Set([
    ...rawConceptIds,
    ...lessonIds.flatMap((lessonId) => rawConceptIds.map((conceptId) => `corpus:${lessonId.toLocaleLowerCase('pt-BR')}:${conceptId}`)),
  ])];
  const banks = [...new Set(occurrences.map((item) => item.question.exam_board).filter(Boolean))].sort();
  const organizations = [...new Set(occurrences.map((item) => item.question.organization).filter(Boolean))].sort();
  const years = [...new Set(occurrences.map((item) => item.question.year).filter(Number.isFinite))].sort((a, b) => a - b);
  const sourceRefs = occurrences.map((item) => `CORPUS:${item.lessonId}:${item.question.question_id}`);
  const normalized = {
    id: editorialQuestionId,
    primaryLessonId: primary.lessonId,
    lessonIds,
    moduleIds,
    originalQuestionId: primary.question.question_id,
    questionType: primary.questionType,
    supportText: primary.cleanedSupportText,
    prompt: primary.cleanedPrompt,
    options: primary.options,
    correctAnswer: primary.correctAnswer,
    commentary: primary.cleanedCommentary,
    bank: primary.question.exam_board || null,
    organization: primary.question.organization || null,
    position: primary.question.position || null,
    year: Number.isFinite(primary.question.year) ? primary.question.year : null,
    sourceLabel: primary.question.source_label || primary.question.source_header || primary.question.attribution_raw || null,
    conceptIds,
    ruleIds: [...new Set(occurrences.flatMap((item) => item.question.tests_rule_ids || []))].sort(),
    sourceRefs,
    source: primary.question.source,
    extractionConfidence: primary.question.extraction_confidence,
    answerConfidence: primary.answer.confidence,
  };
  const raw = {
    id: editorialQuestionId,
    primaryLessonId: primary.lessonId,
    lessonIds,
    selectedOccurrence: {
      lessonId: primary.lessonId,
      question: primary.question,
      answer: primary.answer,
    },
    sourceOccurrences: occurrences.map((item) => ({
      lessonId: item.lessonId,
      question: item.question,
      answer: item.answer,
    })),
  };
  const index = {
    questionId: editorialQuestionId,
    editorialHashSha256: sha256(JSON.stringify(raw)),
    editorialProjection: {
      primaryLessonId: primary.lessonId,
      lessonIds,
      difficulty: 'UNSPECIFIED',
      answerType: primary.questionType,
      correctAnswer: primary.correctAnswer,
      topicNames: lessonIds.map((lessonId) => lessonTitles.get(lessonId) || lessonId),
      banks,
      organizations,
      years,
      hasCommentary: true,
      extractionConfidence: primary.question.extraction_confidence,
      answerConfidence: primary.answer.confidence,
    },
    suvecaDerived: { moduleIds, conceptIds },
  };
  return { raw, normalized, index };
}).sort((left, right) => left.normalized.id.localeCompare(right.normalized.id, 'en'));

assert(editorialQuestionRecords.length >= 1000, `Banco editorial insuficiente: ${editorialQuestionRecords.length}.`);
const editorialQuestionCountByLesson = Object.fromEntries(
  Array.from({ length: 14 }, (_, index) => {
    const lessonId = `A${String(index).padStart(2, '0')}`;
    return [lessonId, editorialQuestionRecords.filter((record) => record.normalized.lessonIds.includes(lessonId)).length];
  }),
);
assert(Object.values(editorialQuestionCountByLesson).every((count) => count > 0), 'Uma ou mais aulas A00–A13 ficaram sem questões editoriais.');
const editorialCorpusVersion = `editorial-corpus-${buildId}`;
const editorialSimuladoVersion = `editorial-simulado-${buildId}`;

const candidatesByLesson = new Map(EXPECTED_INTEGRATED_LESSONS.map((number) => {
  const lessonId = `A${number}`;
  const candidates = editorialQuestionRecords
    .filter((record) => record.normalized.lessonIds.includes(lessonId))
    .sort((left, right) => {
      const leftLength = left.normalized.supportText.length + left.normalized.prompt.length;
      const rightLength = right.normalized.supportText.length + right.normalized.prompt.length;
      return leftLength - rightLength || left.normalized.id.localeCompare(right.normalized.id, 'en');
    });
  return [lessonId, candidates];
}));
const selectedQuestions = [];
const selectedQuestionIds = new Set();
const selectQuestionForLesson = (lessonId) => {
  const candidate = candidatesByLesson.get(lessonId)?.find((record) => !selectedQuestionIds.has(record.normalized.id));
  if (!candidate) return false;
  selectedQuestionIds.add(candidate.normalized.id);
  selectedQuestions.push(candidate);
  return true;
};
for (const number of EXPECTED_INTEGRATED_LESSONS) {
  assert(selectQuestionForLesson(`A${number}`), `Simulado editorial sem questão para A${number}.`);
}
for (const lessonIndex of [1, 3, 5, 8, 10, 12]) {
  assert(selectQuestionForLesson(`A${String(lessonIndex).padStart(2, '0')}`), 'Falha ao balancear o simulado editorial.');
}
assert(selectedQuestions.length === 20, `Simulado editorial: ${selectedQuestions.length}/20 questões.`);

const simuladoQuestions = selectedQuestions.map(({ normalized }, index) => ({
  id: `editorial-sim-${String(index + 1).padStart(2, '0')}`,
  type: normalized.questionType,
  ...(normalized.bank ? { bank: normalized.bank } : {}),
  topic: lessonTitles.get(normalized.primaryLessonId) || normalized.primaryLessonId,
  ...(normalized.supportText ? { supportText: normalized.supportText } : {}),
  questionText: normalized.prompt,
  ...(normalized.questionType === 'MULTIPLA_ESCOLHA' ? { options: normalized.options } : {}),
  correctAnswer: normalized.correctAnswer,
  commentary: normalized.commentary,
  origin: 'official',
  officialQuestionId: normalized.id,
  questionSetVersion: editorialSimuladoVersion,
  moduleId: normalized.moduleIds[0],
  conceptIds: normalized.conceptIds,
  sourceRefs: [`QUESTION:${normalized.id}`, ...normalized.sourceRefs],
  resolution: {
    decisiveRule: normalized.commentary,
    whyCorrect: normalized.commentary,
  },
}));

modules.push({
  id: 'simulado',
  num: 'SIM',
  title: 'Simulado editorial cumulativo',
  subtitle: '20 questões editoriais preservadas dos corpora das aulas 00–13',
  description: 'Prática cumulativa baseada exclusivamente nas questões e nos comentários presentes nas novas fontes editoriais.',
  estimatedMinutes: 40,
  sections: [{
    title: 'Orientações do simulado',
    contentMarkdown: 'Resolva sem consultar o material. Em seguida, justifique cada item e transforme os erros em revisões ativas. Os enunciados e comentários da apostila foram preservados; a interface apenas os organiza para prática.',
    summary: 'Questões selecionadas da fonte editorial das aulas 00–13.',
    searchTerms: ['simulado', 'revisao', 'questoes', 'pratica'],
    sourceConceptIds: [],
  }],
  questions: simuladoQuestions,
  knowledge: {
    kbVersion: globalManifest.content_version,
    buildId,
    editorialStatus: 'approved_ai_reviewed',
    reviewVersion: 'corpus-apostila-questions',
    reviewedAt: '2026-08-17',
    reviewerType: 'ai',
    reviewConfidence: null,
    sourceCount: 20,
    sources: selectedQuestions.slice(0, 6).map(({ normalized }, index) => ({
      id: normalized.id,
      title: normalized.sourceLabel || `Questão editorial da ${normalized.primaryLessonId}`,
      type: 'editorial_question',
      url: null,
      score: 100 - index * 5,
    })),
  },
});

const candidatePriority = { error: 0, procedure: 1, contrast: 2, concept: 3 };
const genericBack = /^(?:definição ou ideia central|explicação consolidada|regra canônica|conceito|critérios? de)/i;
const selectedFlashcards = [];
for (const unit of units) {
  const candidates = flashcardCandidates
    .filter((candidate) => candidate.unit_id === unit.unit_id)
    .map((candidate) => ({
      ...candidate,
      front: cleanLearnerMarkdown(candidate.front).trim(),
      back: cleanLearnerMarkdown(candidate.back).trim(),
    }))
    .filter((candidate) => candidate.front.length >= 18 && candidate.back.length >= 80 && !genericBack.test(candidate.back))
    .sort((a, b) => (candidatePriority[a.type] ?? 9) - (candidatePriority[b.type] ?? 9) || b.back.length - a.back.length)
    .slice(0, 2);
  if (!candidates.length) {
    const fallbackBack = cleanLearnerMarkdown(
      (unit.learning_objectives || []).join(' ')
      || unit.pedagogical_sections?.pedagogical_synthesis
      || unit.pedagogical_sections?.retrieval_essentials
      || unit.pedagogical_sections?.knowledge,
    ).trim();
    candidates.push({
      flashcard_id: `flash:${unit.unit_id}:objective`,
      unit_id: unit.unit_id,
      type: 'concept',
      front: `Qual é o objetivo central de ${unit.title}?`,
      back: clip(fallbackBack || `Reconstruir os critérios decisivos de ${unit.title} e aplicá-los em contexto.`, 900),
    });
  }
  for (const candidate of candidates) {
    selectedFlashcards.push({
      id: `editorial-${slug(candidate.flashcard_id)}`,
      source: 'suveca',
      topic: unit.title,
      front: candidate.front,
      back: candidate.back,
      hint: candidate.type === 'error'
        ? 'Nomeie primeiro o erro; depois reconstrua a regra corretiva.'
        : 'Recupere o critério decisivo antes de consultar a resposta.',
      explanation: candidate.back,
      sourceRefs: [`EDITORIAL:${unit.unit_id}`],
      moduleId: `mod${Number(unit.lesson_id.slice(1))}`,
      createdAt: '2026-08-17T00:00:00.000Z',
      correctCount: 0,
      incorrectCount: 0,
    });
  }
}
for (const [index, section] of a14TopSections.entries()) {
  const sectionId = section.section_id;
  const rule = a14Rules
    .filter((item) => belongsToA14Section(item, sectionId))
    .filter((item) => cleanLearnerMarkdown(item.label).trim().length >= 30 && !/^Regra:\s*$/i.test(cleanLearnerMarkdown(item.label).trim()))
    .sort((a, b) => (a.annotation_state === 'observed_highlight' ? -1 : 0) - (b.annotation_state === 'observed_highlight' ? -1 : 0))[0];
  if (!rule) continue;
  selectedFlashcards.push({
    id: `editorial-a14-${String(index + 1).padStart(2, '0')}`,
    source: 'suveca',
    topic: `Revisão · ${section.title}`,
    front: `Qual regra deve ser recuperada na revisão de ${section.title}?`,
    back: cleanLearnerMarkdown(rule.label).trim(),
    hint: 'Formule a regra e produza um exemplo próprio antes de virar o cartão.',
    explanation: cleanLearnerMarkdown(rule.label).trim(),
    sourceRefs: [`CORPUS:A14:${sectionId}`],
    moduleId: 'mod14',
    createdAt: '2026-08-17T00:00:00.000Z',
    correctCount: 0,
    incorrectCount: 0,
  });
}
assert(selectedFlashcards.length >= EXPECTED_INTEGRATED_UNITS, 'Poucos flashcards editoriais foram selecionados.');

const procedures = decisionCandidates.map((candidate) => {
  const unit = unitById.get(candidate.unit_id);
  return {
    id: candidate.decision_candidate_id,
    unitId: candidate.unit_id,
    lessonId: unit?.lesson_id,
    groupId: unit?.group_id,
    moduleId: unit ? `mod${Number(unit.lesson_id.slice(1))}` : undefined,
    topic: unit?.title || candidate.canonical_topic_id,
    canonicalTopicId: candidate.canonical_topic_id,
    title: cleanLearnerMarkdown(candidate.title).trim(),
    markdown: cleanLearnerMarkdown(candidate.procedure_markdown).trim(),
    sourceRefs: unit ? [`EDITORIAL:${unit.unit_id}`] : [],
  };
}).filter((item) => item.lessonId && item.title && item.markdown.length >= 80);
assert(procedures.length >= 350, `Roteiros de decisão insuficientes: ${procedures.length}.`);

const duelCandidates = simuladoQuestions
  .filter((question) => question.type === 'CERTO_ERRADO' && ['C', 'E'].includes(question.correctAnswer))
  .filter((question) => (question.supportText || '').length <= 280 && question.questionText.length <= 320)
  .slice(0, 12);
assert(duelCandidates.length === 12, `Duelo editorial: ${duelCandidates.length}/12 questões.`);
const duelQuestions = duelCandidates.map((question, index) => ({
  id: `editorial-duel-${String(index + 1).padStart(2, '0')}`,
  prompt: [question.supportText ? `Texto: “${question.supportText}”` : '', question.questionText].filter(Boolean).join('\n\n'),
  options: [{ id: 'C', text: 'Certo' }, { id: 'E', text: 'Errado' }],
  correctOptionId: question.correctAnswer,
  explanation: question.commentary,
  sourceRefs: question.sourceRefs,
}));

const dailyTips = modules
  .filter((module) => /^mod\d+$/.test(module.id))
  .map((module) => {
    const card = selectedFlashcards.find((item) => item.moduleId === module.id);
    assert(card, `${module.id}: sem flashcard para dica diária.`);
    const explanation = plainText(card.back);
    return {
      id: `tip-${module.id}-${slug(card.topic)}`,
      category: card.topic,
      rule: clip(plainText(card.front), 190),
      explanation: clip(explanation, 480),
      example: `Estratégia de recuperação: ${plainText(card.hint)}`,
      moduleId: module.id,
    };
  });

const curriculumArtifact = {
  schemaVersion: SCHEMA_VERSION,
  kind: 'suveca_pedagogical_curriculum',
  buildId,
  contentVersion: globalManifest.content_version,
  compilerVersion: COMPILER_VERSION,
  policy: 'As aulas 00–14 substituem o conteúdo curricular legado. O método SuVeCA permanece como camada transversal de aplicação e não altera a autoridade normativa das fontes.',
  authority: {
    normative: 'corpus_apostila',
    didactic: 'Integracao_Pedagogica',
    methodology: 'Método SuVeCA — mapa relacional do aplicativo',
    cumulativeReview: 'Aula 14 — corpus e grifos especializados',
  },
  totals: {
    modules: 15,
    integratedUnits: EXPECTED_INTEGRATED_UNITS,
    cumulativeReviewUnits: A14_SECTION_IDS.length,
    studyUnits: runtimeSections.length,
    flashcards: selectedFlashcards.length,
    decisionProcedures: procedures.length,
    simuladoQuestions: simuladoQuestions.length,
    editorialQuestions: editorialQuestionRecords.length,
    editorialQuestionEligibleOccurrences: eligibleOccurrences.length,
    editorialQuestionQuarantined: quarantinedQuestionIds.size,
    duelQuestions: duelQuestions.length,
    methodologyConnections: runtimeSections.length,
    methodologyLessonOverviews: Object.keys(suvecaMethod.lessonConnections).length,
    methodologyGroupConnections: Object.keys(suvecaGroupConnections.connections).length,
    methodologyStudyConnections: runtimeSections.length,
    methodologyGroupDistribution,
    mediaDependencies: 0,
  },
  methodology: publishedSuvecaMethod,
  modules,
};

const modulesSource = `/* AUTO-GENERATED by scripts/build-pedagogical-curriculum.mjs. */\nimport type { ModuleData } from '../types/suveca';\n\nexport const MODULES_DATA = ${JSON.stringify(modules, null, 2)} as ModuleData[];\n`;
const knowledgeSource = `/* AUTO-GENERATED by scripts/build-pedagogical-curriculum.mjs. */\nexport const PEDAGOGICAL_KNOWLEDGE_BUILD = ${JSON.stringify({
  schemaVersion: SCHEMA_VERSION,
  buildId,
  contentVersion: globalManifest.content_version,
  sourceCount: 15,
  unitCount: knowledgeRecords.length,
  semanticStatus: 'passed',
  mediaDependencies: 0,
}, null, 2)} as const;\n`;
const knowledgeShards = Array.from(
  { length: Math.ceil(knowledgeRecords.length / KNOWLEDGE_SHARD_SIZE) },
  (_, index) => {
    const number = String(index + 1).padStart(3, '0');
    const exportName = `PEDAGOGICAL_KNOWLEDGE_PART_${number}`;
    const records = knowledgeRecords.slice(
      index * KNOWLEDGE_SHARD_SIZE,
      (index + 1) * KNOWLEDGE_SHARD_SIZE,
    );
    return {
      number,
      exportName,
      file: path.join(ROOT, 'src', 'data', `pedagogicalKnowledge.part-${number}.generated.ts`),
      source: `/* AUTO-GENERATED by scripts/build-pedagogical-curriculum.mjs. */\nexport const ${exportName} = ${JSON.stringify(records, null, 2)} as const;\n`,
    };
  },
);
const knowledgeIndexSource = `/* AUTO-GENERATED by scripts/build-pedagogical-curriculum.mjs. */\n${knowledgeShards
  .map(({ number, exportName }) => `import { ${exportName} } from './pedagogicalKnowledge.part-${number}.generated';`)
  .join('\n')}\n\nexport const PEDAGOGICAL_KNOWLEDGE_INDEX = [\n${knowledgeShards
  .map(({ exportName }) => `  ...${exportName},`)
  .join('\n')}\n] as const;\n`;
const suvecaMethodSource = `/* AUTO-GENERATED by scripts/build-pedagogical-curriculum.mjs. */\nexport const SUVECA_METHOD = ${JSON.stringify(publishedSuvecaMethod, null, 2)} as const;\n`;
const flashcardSource = `/* AUTO-GENERATED by scripts/build-pedagogical-curriculum.mjs. */\nexport const EDITORIAL_FLASHCARDS = ${JSON.stringify(selectedFlashcards, null, 2)} as const;\n`;
const dailyTipsSource = `/* AUTO-GENERATED by scripts/build-pedagogical-curriculum.mjs. */\nimport type { DailyTip } from './dailyTips';\n\nexport const EDITORIAL_DAILY_TIPS = ${JSON.stringify(dailyTips, null, 2)} as DailyTip[];\n`;
const duelSource = `/* AUTO-GENERATED by scripts/build-pedagogical-curriculum.mjs. */\nexport const EDITORIAL_DUEL_QUESTIONS = ${JSON.stringify(duelQuestions, null, 2)} as const;\nexport const EDITORIAL_DUEL_QUESTION_SET_VERSION = 'editorial-duel-${buildId}';\n`;
const duelAnswerKey = Object.fromEntries(duelQuestions.map((question) => [question.id, question.correctOptionId]));
const duelFunctionsSource = `/* AUTO-GENERATED by scripts/build-pedagogical-curriculum.mjs. */\nexport const EDITORIAL_DUEL_ANSWER_KEY = ${JSON.stringify(duelAnswerKey, null, 2)} as const;\nexport const EDITORIAL_DUEL_QUESTION_SET_VERSION = 'editorial-duel-${buildId}';\n`;
const simuladoAnswerKey = Object.fromEntries(simuladoQuestions.map((question) => [question.id, question.correctAnswer]));
const simuladoFunctionsSource = `/* AUTO-GENERATED by scripts/build-pedagogical-curriculum.mjs. */\nexport const OFFICIAL_SIMULADO_ANSWER_KEY = ${JSON.stringify(simuladoAnswerKey, null, 2)} as const;\nexport const OFFICIAL_SIMULADO_VERSION = '${editorialSimuladoVersion}';\n`;

const editorialQuestionRaw = editorialQuestionRecords.map((record) => record.raw);
const editorialQuestionNormalized = editorialQuestionRecords.map((record) => record.normalized);
const editorialQuestionIndex = {
  schemaVersion: '3.0.0',
  kind: 'suveca-editorial-question-query-index',
  buildId,
  questionSetVersion: editorialCorpusVersion,
  expectedTotal: editorialQuestionRecords.length,
  items: editorialQuestionRecords.map((record) => record.index),
};
const editorialQuestionQuality = {
  schemaVersion: '1.0.0',
  kind: 'suveca-editorial-question-quality',
  buildId,
  questionSetVersion: editorialCorpusVersion,
  sourceLessons: EXPECTED_INTEGRATED_LESSONS.map((number) => `A${number}`),
  filteringPolicy: {
    minimumQuestionConfidence: 0.9,
    minimumAnswerConfidence: 0.9,
    requiresPairedAnswer: true,
    requiresPrompt: true,
    requiresCommentary: true,
    requiresInterpretableAnswer: true,
    deduplication: [
      'duplicate_of',
      ...questionGroupingFields,
      'normalized_support_prompt_options_fingerprint',
    ],
  },
  totals: {
    sourceQuestionOccurrences: corpusQuestionOccurrences.length,
    pairedSourceOccurrences: corpusQuestionOccurrences.filter((occurrence) => occurrence.answer).length,
    eligibleOccurrences: eligibleOccurrences.length,
    uniquePublishedQuestions: editorialQuestionRecords.length,
    deduplicatedEligibleOccurrences: eligibleOccurrences.length - editorialQuestionRecords.length,
    quarantinedOccurrences: quarantinedQuestionIds.size,
  },
  perLesson: editorialQuestionCountByLesson,
  quarantine: [...quarantinedQuestionIds].map(([sourceKey, reason]) => ({ sourceKey, reason })),
};
const editorialQuestionSummary = {
  source: 'corpus_apostila_A00_A13',
  buildId,
  questionSetVersion: editorialCorpusVersion,
  total: editorialQuestionRecords.length,
  lessons: editorialQuestionCountByLesson,
  answerTypes: editorialQuestionNormalized.reduce((counts, question) => ({
    ...counts,
    [question.questionType]: (counts[question.questionType] || 0) + 1,
  }), {}),
  withCommentary: editorialQuestionNormalized.filter((question) => question.commentary).length,
  minimumQuestionConfidence: 0.9,
  minimumAnswerConfidence: 0.9,
};

for (const obsoleteQuestionArtifact of ['official-question-badges.json', 'official-question-topics.json']) {
  fs.rmSync(path.join(ROOT, 'public', 'knowledge', obsoleteQuestionArtifact), { force: true });
}
for (const obsoleteKnowledgeShard of fs.readdirSync(path.join(ROOT, 'src', 'data'))
  .filter((name) => /^pedagogicalKnowledge\.part-\d+\.generated\.ts$/.test(name))) {
  fs.rmSync(path.join(ROOT, 'src', 'data', obsoleteKnowledgeShard), { force: true });
}

const generatedFiles = [
  [path.join(ROOT, 'knowledge', 'canonical', 'pedagogical-curriculum.json'), stableJson(curriculumArtifact)],
  [path.join(ROOT, 'knowledge', 'canonical', 'modules.json'), stableJson({
    schemaVersion: SCHEMA_VERSION,
    kind: 'suveca-canonical-modules',
    buildId,
    editorialPolicy: curriculumArtifact.policy,
    modules,
  })],
  [path.join(ROOT, 'knowledge', 'canonical', 'modules-v3-consolidated.json'), stableJson({
    schemaVersion: SCHEMA_VERSION,
    kind: 'suveca_pedagogical_curriculum_compatibility',
    buildId,
    policy: curriculumArtifact.policy,
    generatedAt: 'deterministic',
    modules,
  })],
  [path.join(ROOT, 'src', 'data', 'modules.generated.ts'), modulesSource],
  [path.join(ROOT, 'src', 'data', 'pedagogicalKnowledge.generated.ts'), knowledgeSource],
  [path.join(ROOT, 'src', 'data', 'pedagogicalKnowledgeIndex.generated.ts'), knowledgeIndexSource],
  ...knowledgeShards.map(({ file, source }) => [file, source]),
  [path.join(ROOT, 'src', 'data', 'suvecaMethod.generated.ts'), suvecaMethodSource],
  [path.join(ROOT, 'src', 'data', 'editorialFlashcards.generated.ts'), flashcardSource],
  [path.join(ROOT, 'src', 'data', 'editorialDailyTips.generated.ts'), dailyTipsSource],
  [path.join(ROOT, 'src', 'data', 'editorialDuelQuestions.generated.ts'), duelSource],
  [path.join(ROOT, 'functions', 'src', 'editorialDuel.generated.ts'), duelFunctionsSource],
  [path.join(ROOT, 'functions', 'src', 'officialQuestions.ts'), simuladoFunctionsSource],
  [path.join(ROOT, 'public', 'knowledge', 'official-questions.raw.json'), stableJson(editorialQuestionRaw)],
  [path.join(ROOT, 'public', 'knowledge', 'official-questions.normalized.json'), stableJson(editorialQuestionNormalized)],
  // Keep the query index below the AI Studio per-file import ceiling. Raw and
  // normalized projections are deployed as verified shards.
  [path.join(ROOT, 'public', 'knowledge', 'official-question-index.json'), compactJson(editorialQuestionIndex)],
  [path.join(ROOT, 'public', 'knowledge', 'official-question-summary.json'), stableJson(editorialQuestionSummary)],
  [path.join(ROOT, 'public', 'knowledge', 'editorial-question-quality.json'), stableJson(editorialQuestionQuality)],
  [path.join(PUBLIC_ROOT, 'suveca-method.json'), stableJson({ ...publishedSuvecaMethod, buildId })],
  [path.join(PUBLIC_ROOT, 'decision-procedures.json'), stableJson({
    schemaVersion: SCHEMA_VERSION,
    buildId,
    count: procedures.length,
    procedures,
  })],
];
for (const [file, content] of generatedFiles) write(file, content);

const artifacts = [
  ...generatedFiles
    .map(([file]) => file)
    .filter((file) => ![
      path.join(ROOT, 'public', 'knowledge', 'official-questions.raw.json'),
      path.join(ROOT, 'public', 'knowledge', 'official-questions.normalized.json'),
    ].includes(file)),
  ...fs.readdirSync(UNIT_OUTPUT_ROOT).map((name) => path.join(UNIT_OUTPUT_ROOT, name)),
].sort((a, b) => relative(a).localeCompare(relative(b), 'en'));

const publicManifest = {
  schemaVersion: SCHEMA_VERSION,
  kind: 'suveca_pedagogical_public_manifest',
  buildId,
  contentVersion: globalManifest.content_version,
  sourceDigest,
  totals: curriculumArtifact.totals,
  modules: modules.filter((module) => /^mod\d+$/.test(module.id)).map((module) => ({
    id: module.id,
    lessonId: `A${String(module.num).padStart(2, '0')}`,
    title: module.title,
    sections: module.sections.length,
  })),
  artifacts: artifacts.map((file) => ({
    path: relative(file),
    bytes: fs.statSync(file).size,
    sha256: sha256File(file),
  })),
  sourceFiles: sourceFiles.map((file) => ({
    path: file.startsWith(path.resolve(PORTUGUESE_ROOT) + path.sep)
      ? path.relative(PORTUGUESE_ROOT, file).replaceAll(path.sep, '/')
      : relative(file),
    bytes: fs.statSync(file).size,
    sha256: sha256File(file),
  })),
};
write(path.join(PUBLIC_ROOT, 'manifest.json'), stableJson(publicManifest));
write(path.join(ROOT, 'knowledge', 'canonical', 'pedagogical-source-manifest.json'), stableJson(publicManifest));

console.log(JSON.stringify({
  status: 'ok',
  buildId,
  source: PORTUGUESE_ROOT,
  modules: 15,
  integratedUnits: EXPECTED_INTEGRATED_UNITS,
  cumulativeReviewUnits: A14_SECTION_IDS.length,
  studyUnits: runtimeSections.length,
  flashcards: selectedFlashcards.length,
  decisionProcedures: procedures.length,
  simuladoQuestions: simuladoQuestions.length,
  editorialQuestions: editorialQuestionRecords.length,
  editorialQuestionEligibleOccurrences: eligibleOccurrences.length,
  editorialQuestionCountByLesson,
  duelQuestions: duelQuestions.length,
}, null, 2));
