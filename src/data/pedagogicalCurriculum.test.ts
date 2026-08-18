import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODULES_DATA } from './modules.generated';
import { EDITORIAL_FLASHCARDS } from './editorialFlashcards.generated';
import {
  EDITORIAL_DUEL_QUESTIONS,
  EDITORIAL_DUEL_QUESTION_SET_VERSION,
} from './editorialDuelQuestions.generated';
import {
  PEDAGOGICAL_KNOWLEDGE_INDEX,
} from './pedagogicalKnowledgeIndex.generated';
import { PEDAGOGICAL_KNOWLEDGE_BUILD } from './pedagogicalKnowledge.generated';
import { SUVECA_METHOD } from './suvecaMethod.generated';
import { formatKnowledgeContext, retrieveKnowledge } from '../lib/knowledgeRetrieval';

describe('currículo editorial das aulas 00–14', () => {
  const coreModules = MODULES_DATA.filter((module) => /^mod\d+$/.test(module.id));
  const sections = coreModules.flatMap((module) => module.sections);

  it('substitui o currículo ativo pelas quinze aulas editoriais', () => {
    expect(coreModules.map((module) => module.id)).toEqual(
      Array.from({ length: 15 }, (_, index) => `mod${index}`),
    );
    expect(sections).toHaveLength(115);
    expect(sections.filter((section) => section.lessonId === 'A14')).toHaveLength(13);
    expect(new Set(sections.map((section) => section.contentUrl)).size).toBe(115);
    expect(sections.every((section) => !/^[GR]\d{2}\s*[·—-]/.test(section.title))).toBe(true);
    expect(coreModules.find((module) => module.id === 'mod13')?.title).toBe(
      'Compreensão, Interpretação e Tipologia Textual',
    );
  });

  it('preserva a SuVeCA como mapa metodológico transversal, sem transformá-la em molde', () => {
    expect(SUVECA_METHOD.equation).toBe(
      'Sujeito + Verbo + Complemento + Adjunto + Predicativo',
    );
    expect(SUVECA_METHOD.definition).toContain(
      'mapa de análise para reconstruir as relações sintáticas',
    );
    expect(SUVECA_METHOD.definition).toContain('não um molde obrigatório');
    expect(Object.keys(SUVECA_METHOD.lessonConnections)).toHaveLength(15);
    expect(Object.keys(SUVECA_METHOD.groupConnections)).toHaveLength(102);
    expect(coreModules.every((module) => module.suvecaMethod?.methodId === SUVECA_METHOD.methodId)).toBe(true);
    expect(sections.every((section) => section.suvecaMethod?.methodId === SUVECA_METHOD.methodId)).toBe(true);
    expect(SUVECA_METHOD.groupConnections['A00/G01'].level).toBe('outside_core');
    expect(SUVECA_METHOD.groupConnections['A00/G07'].level).toBe('strong');
    expect(SUVECA_METHOD.groupConnections['A04/G01'].level).toBe('central');
    expect(SUVECA_METHOD.groupConnections['A04/G05'].level).toBe('indirect');
    expect(SUVECA_METHOD.groupConnections['A08/G05'].level).toBe('support');
    expect(SUVECA_METHOD.groupConnections['A10/G06'].level).toBe('central');
    expect(SUVECA_METHOD.groupConnections['A12/G04'].level).toBe('strong');
    expect(SUVECA_METHOD.groupConnections['A13/G07'].level).toBe('indirect');
    expect(sections.filter((section) => section.lessonId === 'A14').every((section) => section.suvecaMethod?.level === 'review')).toBe(true);
  });

  it('publica somente conteúdos de estudo independentes de mídia e IDs internos', () => {
    const forbiddenTechnical = /==[0-9a-fA-F]{6,}==|\b(?:CANON|MARK|ORAL|QUOTE|TERM|VIS|KB|PROC|EX|WARN|TIP|UNCERTAIN|REL|CARD)-[A-Z0-9_-]+\b/;
    const forbiddenMedia = /\b(?:vídeos?|videoaulas?|timestamps?|\.mp4|\.srt)\b/i;
    for (const section of sections) {
      const file = path.join(process.cwd(), 'public', section.contentUrl!.replace(/^\//, ''));
      expect(fs.existsSync(file), section.contentUrl).toBe(true);
      const markdown = fs.readFileSync(file, 'utf8');
      expect(markdown, section.contentUrl).not.toMatch(forbiddenTechnical);
      expect(markdown, section.contentUrl).not.toMatch(forbiddenMedia);
    }
  });

  it('cobre todas as unidades integradas nos flashcards e usa questões editoriais', () => {
    const coveredUnits = new Set(
      EDITORIAL_FLASHCARDS.flatMap((card) => card.sourceRefs)
        .filter((reference) => reference.startsWith('EDITORIAL:')),
    );
    expect(EDITORIAL_FLASHCARDS.length).toBeGreaterThanOrEqual(115);
    expect(coveredUnits.size).toBe(102);

    const simulado = MODULES_DATA.find((module) => module.id === 'simulado');
    expect(simulado?.questions).toHaveLength(20);
    expect(simulado?.questions?.every((question) => question.origin === 'official')).toBe(true);
    expect(EDITORIAL_DUEL_QUESTIONS).toHaveLength(12);
    expect(EDITORIAL_DUEL_QUESTION_SET_VERSION).toBe(
      `editorial-duel-${PEDAGOGICAL_KNOWLEDGE_BUILD.buildId}`,
    );
  });

  it('roteia o Professor para a base editorial nova', () => {
    expect(PEDAGOGICAL_KNOWLEDGE_INDEX).toHaveLength(115);
    const records = retrieveKnowledge('quando usar crase antes de nome feminino?', 3);
    expect(records.some((record) => record.lessonId === 'A10')).toBe(true);
    const context = formatKnowledgeContext(records);
    expect(context).toContain('BASE EDITORIAL SuVeCa');
    expect(context).toContain('corpus_apostila');
    expect(context).toContain('Integracao_Pedagogica');
    expect(context).toContain('CAMADA METODOLÓGICA DO APLICATIVO');
    expect(context).toContain('Grau de integração neste grupo');
    expect(context).toContain('não atribua esta formulação à fonte normativa');
    expect(context).not.toContain('PERFIL CANÔNICO V3');
  });

  it('não força a SuVeCA em fonologia e a usa fortemente nos porquês', () => {
    const phonetics = retrieveKnowledge('fonemas grafemas dígrafos', 1);
    expect(phonetics[0]?.lessonId).toBe('A00');
    expect(phonetics[0]?.groupId).toBe('G01');
    expect(phonetics[0]?.methodology.level).toBe('outside_core');
    expect(formatKnowledgeContext(phonetics)).toContain('Não force uma decomposição SuVeCA');

    const porques = retrieveKnowledge('emprego dos porquês', 1);
    expect(porques[0]?.lessonId).toBe('A00');
    expect(porques[0]?.groupId).toBe('G07');
    expect(porques[0]?.methodology.level).toBe('strong');
  });
});
