import {
  PEDAGOGICAL_KNOWLEDGE_INDEX,
} from '../data/pedagogicalKnowledgeIndex.generated';
import { PEDAGOGICAL_KNOWLEDGE_BUILD } from '../data/pedagogicalKnowledge.generated';

export type KnowledgeRecord = (typeof PEDAGOGICAL_KNOWLEDGE_INDEX)[number];

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e',
  'em', 'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'por', 'que', 'se',
  'um', 'uma', 'isso', 'essa', 'esse', 'esta', 'este', 'qual', 'quais',
]);

const tokens = (value: string) =>
  [...new Set(
    normalize(value)
      .split(' ')
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  )];

const recordSearchFields = (record: KnowledgeRecord) => ({
  title: normalize(record.title),
  routing: normalize(record.routingTerms.join(' ')),
  objective: normalize(record.objective),
  methodology: normalize([
    record.methodology.equation,
    record.methodology.level,
    record.methodology.label,
    record.methodology.summary,
    ...record.methodology.steps,
    ...record.methodology.limits,
  ].join(' ')),
  sections: normalize(
    record.sections.map((section) => `${section.title} ${section.content}`).join(' '),
  ),
});

/**
 * Recupera unidades da fonte editorial nova. A busca privilegia o tópico e os
 * termos de roteamento; o corpo didático funciona como recall complementar.
 */
export const retrieveKnowledge = (query: string, limit = 3): KnowledgeRecord[] => {
  const normalizedQuery = normalize(query);
  const queryTokens = tokens(query);
  const safeLimit = Math.max(1, limit);

  const ranked = PEDAGOGICAL_KNOWLEDGE_INDEX.map((record) => {
    const fields = recordSearchFields(record);
    let score = 0;

    if (normalizedQuery.length > 3 && fields.title.includes(normalizedQuery)) score += 48;
    if (normalizedQuery.length > 3 && fields.routing.includes(normalizedQuery)) score += 36;
    if (normalizedQuery.length > 3 && fields.objective.includes(normalizedQuery)) score += 18;

    for (const token of queryTokens) {
      if (fields.title.includes(token)) score += 12;
      if (fields.routing.includes(token)) score += 9;
      if (fields.objective.includes(token)) score += 5;
      if (fields.methodology.includes(token)) score += 4;
      if (fields.sections.includes(token)) score += 2;
    }

    return { record, score };
  }).sort((first, second) => second.score - first.score || first.record.id.localeCompare(second.record.id));

  const matches = ranked.filter((item) => item.score > 0).slice(0, safeLimit);
  if (matches.length) return matches.map((item) => item.record);

  // Revisão cumulativa é a melhor porta de entrada quando a pergunta não contém
  // termos suficientes para apontar um subtópico específico.
  return PEDAGOGICAL_KNOWLEDGE_INDEX
    .filter((record) => record.lessonId === 'A14')
    .slice(0, safeLimit);
};

const compact = (value: string, maxLength: number) => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}…`;
};

/** Produz contexto limitado, didático e com proveniência para Professor/RAG. */
export const formatKnowledgeContext = (records: readonly KnowledgeRecord[]) => {
  const body = records.map((record) => {
    const sections = record.sections
      .slice(0, 5)
      .map((section) => `- ${section.title}: ${compact(section.content, 1_050)}`)
      .join('\n');
    const sourceRefs = record.sourceRefs
      .slice(0, 8)
      .map((reference) => `- [${reference}]`)
      .join('\n');
    const methodologyDirective = record.methodology.level === 'outside_core'
      ? '- Diretriz: este conteúdo possui método próprio. Não force uma decomposição SuVeCA nem a apresente como fonte da regra.'
      : record.methodology.level === 'indirect'
        ? '- Diretriz: use a SuVeCA somente como observação auxiliar depois de aplicar a regra própria do tema.'
        : '- Diretriz: aplique a SuVeCA na intensidade indicada, em conjunto com as demais camadas mencionadas.';

    return [
      `UNIDADE EDITORIAL — ${record.title}`,
      `Aula: ${record.lessonId}; grupo: ${record.groupId}; módulo do app: ${record.moduleId}.`,
      `Objetivo didático: ${compact(record.objective, 900)}`,
      'CAMADA METODOLÓGICA DO APLICATIVO (não atribua esta formulação à fonte normativa):',
      `- SuVeCA = ${record.methodology.equation}.`,
      `- ${compact(record.methodology.definition, 500)}`,
      `- Grau de integração neste grupo: ${record.methodology.level} — ${record.methodology.label}.`,
      `- Aplicação neste grupo: ${compact(record.methodology.summary, 700)}`,
      `- Limite: ${compact(record.methodology.limits.join(' '), 500)}`,
      methodologyDirective,
      'CONTEÚDO PEDAGÓGICO VALIDADO:',
      sections,
      'AUTORIDADE: corpus_apostila para a base normativa; Integracao_Pedagogica para explicação, progressão cognitiva e aplicação.',
      'REFERÊNCIAS INTERNAS (cite somente no campo técnico sourceRefs; não mostre ao estudante):',
      sourceRefs,
    ].join('\n');
  }).join('\n\n');

  return `BASE EDITORIAL SuVeCa ${PEDAGOGICAL_KNOWLEDGE_BUILD.schemaVersion} (build ${PEDAGOGICAL_KNOWLEDGE_BUILD.buildId})\n${body}`;
};

export const KNOWLEDGE_BUILD = PEDAGOGICAL_KNOWLEDGE_BUILD;
