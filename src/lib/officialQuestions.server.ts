import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { formatOfficialContent } from './officialContent';

type JsonRecord = Record<string, unknown>;

export interface OfficialQuestionIndexItem {
  questionId: string;
  editorialHashSha256: string;
  editorialProjection: {
    primaryLessonId: string;
    lessonIds: string[];
    difficulty: 'UNSPECIFIED';
    answerType: 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';
    correctAnswer: string;
    topicNames: string[];
    banks: string[];
    organizations: string[];
    years: number[];
    hasCommentary: boolean;
    extractionConfidence: number;
    answerConfidence: number;
  };
  suvecaDerived: {
    moduleIds: string[];
    conceptIds: string[];
  };
}

export interface OfficialQuestionFilters {
  moduleId?: string;
  conceptId?: string;
  topic?: string;
  bank?: string;
  year?: number;
  difficulty?: string;
  query?: string;
}

interface QuestionIndexPayload {
  buildId: string;
  questionSetVersion: string;
  expectedTotal: number;
  items: OfficialQuestionIndexItem[];
}

interface QuestionStore {
  rawById: Map<string, JsonRecord>;
  normalizedById: Map<string, JsonRecord>;
  index: OfficialQuestionIndexItem[];
  indexById: Map<string, OfficialQuestionIndexItem>;
  buildId: string;
  questionSetVersion: string;
  expectedTotal: number;
  source: 'monolithic' | 'sharded';
  sourceLocation: string;
  ensureQuestionLoaded: (questionId: string) => Promise<void>;
  ensureAllLoaded: () => Promise<void>;
}

interface ShardDescriptor {
  part: number;
  count: number;
  questionIds: string[];
  raw: { file: string; bytes: number; sha256: string };
  normalized: { file: string; bytes: number; sha256: string };
}

interface OfficialQuestionManifest {
  buildId: string;
  questionSetVersion: string;
  expectedTotal: number;
  totals: { raw: number; normalized: number; indexed: number; uniqueQuestionIds: number; shards: number };
  shards: ShardDescriptor[];
}

const normalize = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

const sha256 = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const fileExists = async (filePath: string) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const knowledgeCandidates = () => {
  const cwd = process.cwd();
  const executableDirectory = path.dirname(path.resolve(process.argv[1] || '.'));
  const entries = [
    ...(process.env.SUVECA_KNOWLEDGE_DIR
      ? [{ directory: path.resolve(process.env.SUVECA_KNOWLEDGE_DIR), label: 'configured/knowledge' }]
      : []),
    { directory: path.join(cwd, 'public', 'knowledge'), label: 'public/knowledge' },
    { directory: path.join(cwd, 'dist', 'knowledge'), label: 'dist/knowledge' },
    { directory: path.join(cwd, 'applet', 'public', 'knowledge'), label: 'applet/public/knowledge' },
    { directory: path.join(cwd, 'applet', 'dist', 'knowledge'), label: 'applet/dist/knowledge' },
    { directory: path.join(executableDirectory, 'knowledge'), label: 'runtime/knowledge' },
    { directory: path.resolve(executableDirectory, '..', 'public', 'knowledge'), label: 'runtime/../public/knowledge' },
    { directory: path.resolve(executableDirectory, '..', 'dist', 'knowledge'), label: 'runtime/../dist/knowledge' },
  ];
  return entries.filter((entry, index) => entries.findIndex((candidate) => candidate.directory === entry.directory) === index);
};

const resolveKnowledgeSource = async () => {
  const checked: string[] = [];
  for (const candidate of knowledgeCandidates()) {
    checked.push(candidate.label);
    if (!await fileExists(path.join(candidate.directory, 'official-question-index.json'))) continue;
    const [manifestExists, rawExists, normalizedExists] = await Promise.all([
      fileExists(path.join(candidate.directory, 'official-questions.manifest.json')),
      fileExists(path.join(candidate.directory, 'official-questions.raw.json')),
      fileExists(path.join(candidate.directory, 'official-questions.normalized.json')),
    ]);
    if (manifestExists) return { ...candidate, mode: 'sharded' as const };
    if (rawExists && normalizedExists) return { ...candidate, mode: 'monolithic' as const };
  }
  throw new Error(`Banco editorial indisponível. Locais verificados: ${checked.join(', ')}.`);
};

const safeShardPath = (directory: string, relativeFile: string) => {
  const resolved = path.resolve(directory, relativeFile);
  if (!resolved.startsWith(`${path.resolve(directory)}${path.sep}`)) {
    throw new Error(`Caminho de shard inválido: ${relativeFile}`);
  }
  return resolved;
};

const readVerifiedShard = async (directory: string, descriptor: { file: string; bytes: number; sha256: string }) => {
  const buffer = await readFile(safeShardPath(directory, descriptor.file));
  if (buffer.length !== descriptor.bytes) throw new Error(`Tamanho divergente em ${descriptor.file}.`);
  if (sha256(buffer) !== descriptor.sha256) throw new Error(`SHA-256 divergente em ${descriptor.file}.`);
  const parsed = JSON.parse(buffer.toString('utf8')) as JsonRecord[];
  if (!Array.isArray(parsed)) throw new Error(`Shard inválido: ${descriptor.file}.`);
  return parsed;
};

const validateIndex = (payload: QuestionIndexPayload) => {
  const expected = Number(payload.expectedTotal);
  if (!Number.isInteger(expected) || expected < 1000) throw new Error(`Total editorial inválido: ${payload.expectedTotal}.`);
  if (!payload.buildId || payload.questionSetVersion !== `editorial-corpus-${payload.buildId}`) {
    throw new Error('Versão do banco editorial incompatível com o build.');
  }
  if (!Array.isArray(payload.items) || payload.items.length !== expected) {
    throw new Error(`Índice editorial incompleto: ${payload.items?.length || 0}/${expected}.`);
  }
  const ids = payload.items.map((item) => String(item.questionId || ''));
  if (ids.some((id) => !/^A(?:0\d|1[0-3]):/.test(id)) || new Set(ids).size !== expected) {
    throw new Error('Índice editorial contém IDs inválidos ou duplicados.');
  }
  return expected;
};

const validateMonolithicInputs = (
  raw: JsonRecord[],
  normalized: JsonRecord[],
  indexPayload: QuestionIndexPayload,
) => {
  const expected = validateIndex(indexPayload);
  if (!Array.isArray(raw) || raw.length !== expected) throw new Error(`Corpus bruto incompleto: ${raw?.length || 0}/${expected}.`);
  if (!Array.isArray(normalized) || normalized.length !== expected) throw new Error(`Corpus normalizado incompleto: ${normalized?.length || 0}/${expected}.`);
  const rawIds = raw.map((question) => String(question.id || ''));
  const normalizedIds = normalized.map((question) => String(question.id || ''));
  const indexIds = indexPayload.items.map((item) => item.questionId);
  if (JSON.stringify(rawIds) !== JSON.stringify(normalizedIds) || JSON.stringify(rawIds) !== JSON.stringify(indexIds)) {
    throw new Error('A ordem dos IDs bruto, normalizado e índice diverge.');
  }
};

let storePromise: Promise<QuestionStore> | null = null;
export const resetOfficialQuestionStoreForTests = () => {
  storePromise = null;
};

const loadStore = async (): Promise<QuestionStore> => {
  if (storePromise) return storePromise;
  storePromise = (async () => {
    const source = await resolveKnowledgeSource();
    const indexPayload = JSON.parse(
      await readFile(path.join(source.directory, 'official-question-index.json'), 'utf8'),
    ) as QuestionIndexPayload;
    const expectedTotal = validateIndex(indexPayload);
    const rawById = new Map<string, JsonRecord>();
    const normalizedById = new Map<string, JsonRecord>();
    let ensureQuestionLoaded: (questionId: string) => Promise<void>;
    let ensureAllLoaded: () => Promise<void>;

    if (source.mode === 'monolithic') {
      const [raw, normalized] = await Promise.all([
        readFile(path.join(source.directory, 'official-questions.raw.json'), 'utf8').then((value) => JSON.parse(value) as JsonRecord[]),
        readFile(path.join(source.directory, 'official-questions.normalized.json'), 'utf8').then((value) => JSON.parse(value) as JsonRecord[]),
      ]);
      validateMonolithicInputs(raw, normalized, indexPayload);
      raw.forEach((question) => rawById.set(String(question.id), question));
      normalized.forEach((question) => normalizedById.set(String(question.id), question));
      ensureQuestionLoaded = async () => undefined;
      ensureAllLoaded = async () => undefined;
    } else {
      const manifest = JSON.parse(
        await readFile(path.join(source.directory, 'official-questions.manifest.json'), 'utf8'),
      ) as OfficialQuestionManifest;
      const declaredTotals = [
        manifest.totals?.raw,
        manifest.totals?.normalized,
        manifest.totals?.indexed,
        manifest.totals?.uniqueQuestionIds,
      ];
      if (
        manifest.buildId !== indexPayload.buildId
        || manifest.questionSetVersion !== indexPayload.questionSetVersion
        || manifest.expectedTotal !== expectedTotal
        || declaredTotals.some((total) => total !== expectedTotal)
      ) {
        throw new Error('Manifesto editorial incompatível com o índice versionado.');
      }
      if (!Array.isArray(manifest.shards) || manifest.shards.length !== manifest.totals.shards) {
        throw new Error('Manifesto editorial possui shards inconsistentes.');
      }

      const questionToShard = new Map<string, ShardDescriptor>();
      for (const shard of manifest.shards) {
        if (shard.questionIds.length !== shard.count) throw new Error(`Contagem de IDs divergente no shard ${shard.part}.`);
        for (const questionId of shard.questionIds) {
          if (questionToShard.has(questionId)) throw new Error(`ID duplicado no manifesto: ${questionId}.`);
          questionToShard.set(questionId, shard);
        }
      }
      if (
        questionToShard.size !== expectedTotal
        || indexPayload.items.some((item) => !questionToShard.has(item.questionId))
      ) {
        throw new Error('Manifesto e índice editorial possuem conjuntos de IDs divergentes.');
      }

      const shardPromises = new Map<number, Promise<void>>();
      const loadShard = (shard: ShardDescriptor) => {
        const existing = shardPromises.get(shard.part);
        if (existing) return existing;
        const loading = Promise.all([
          readVerifiedShard(source.directory, shard.raw),
          readVerifiedShard(source.directory, shard.normalized),
        ]).then(([rawPart, normalizedPart]) => {
          if (rawPart.length !== shard.count || normalizedPart.length !== shard.count) {
            throw new Error(`Contagem divergente no shard ${shard.part}.`);
          }
          if (JSON.stringify(rawPart.map((item) => String(item.id))) !== JSON.stringify(shard.questionIds)) {
            throw new Error(`IDs brutos divergentes no shard ${shard.part}.`);
          }
          if (JSON.stringify(normalizedPart.map((item) => String(item.id))) !== JSON.stringify(shard.questionIds)) {
            throw new Error(`IDs normalizados divergentes no shard ${shard.part}.`);
          }
          rawPart.forEach((question) => rawById.set(String(question.id), question));
          normalizedPart.forEach((question) => normalizedById.set(String(question.id), question));
        }).catch((error) => {
          shardPromises.delete(shard.part);
          throw error;
        });
        shardPromises.set(shard.part, loading);
        return loading;
      };
      ensureQuestionLoaded = async (questionId) => {
        if (rawById.has(questionId) && normalizedById.has(questionId)) return;
        const shard = questionToShard.get(questionId);
        if (shard) await loadShard(shard);
      };
      ensureAllLoaded = async () => {
        await Promise.all(manifest.shards.map(loadShard));
      };
    }

    return {
      rawById,
      normalizedById,
      index: indexPayload.items,
      indexById: new Map(indexPayload.items.map((item) => [item.questionId, item])),
      buildId: indexPayload.buildId,
      questionSetVersion: indexPayload.questionSetVersion,
      expectedTotal,
      source: source.mode,
      sourceLocation: source.label,
      ensureQuestionLoaded,
      ensureAllLoaded,
    };
  })().catch((error) => {
    storePromise = null;
    throw error;
  });
  return storePromise;
};

export async function getOfficialQuestionStoreHealth() {
  const store = await loadStore();
  return {
    expected: store.expectedTotal,
    raw: store.expectedTotal,
    normalized: store.expectedTotal,
    indexed: store.index.length,
    uniqueIds: store.indexById.size,
    buildId: store.buildId,
    questionSetVersion: store.questionSetVersion,
    source: store.source,
    location: store.sourceLocation,
  };
}

const matchesFilters = (item: OfficialQuestionIndexItem, filters: OfficialQuestionFilters) => {
  const projection = item.editorialProjection;
  if (filters.moduleId && !item.suvecaDerived.moduleIds.includes(filters.moduleId)) return false;
  if (filters.conceptId && !item.suvecaDerived.conceptIds.includes(filters.conceptId)) return false;
  if (filters.year && !projection.years.includes(filters.year)) return false;
  if (filters.difficulty && normalize(projection.difficulty) !== normalize(filters.difficulty)) return false;
  if (filters.topic && !projection.topicNames.some((topic) => normalize(topic).includes(normalize(filters.topic)))) return false;
  if (
    filters.bank
    && ![...projection.banks, ...projection.organizations].some((bank) => normalize(bank).includes(normalize(filters.bank)))
  ) return false;
  return true;
};

const textualScore = (normalizedQuestion: JsonRecord | undefined, item: OfficialQuestionIndexItem, query = '') => {
  const terms = normalize(query).split(/\s+/).filter((term) => term.length > 2);
  if (!terms.length) return 0;
  const options = Array.isArray(normalizedQuestion?.options)
    ? (normalizedQuestion.options as JsonRecord[]).map((option) => option.text)
    : [];
  const haystack = normalize([
    normalizedQuestion?.supportText,
    normalizedQuestion?.prompt,
    normalizedQuestion?.commentary,
    ...options,
    ...item.editorialProjection.topicNames,
    ...item.editorialProjection.banks,
    ...item.editorialProjection.organizations,
  ].join(' '));
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
};

const filteredIndex = async (store: QuestionStore, filters: OfficialQuestionFilters) => {
  if (filters.query) await store.ensureAllLoaded();
  return store.index
    .filter((item) => matchesFilters(item, filters))
    .map((item) => ({
      item,
      score: filters.query ? textualScore(store.normalizedById.get(item.questionId), item, filters.query) : 0,
    }))
    .filter(({ score }) => !filters.query || score > 0)
    .sort((left, right) => right.score - left.score || left.item.questionId.localeCompare(right.item.questionId, 'en'));
};

export async function queryOfficialQuestions(
  filters: OfficialQuestionFilters,
  options: { offset?: number; limit?: number } = {},
) {
  const store = await loadStore();
  const offset = Math.max(0, options.offset || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const filtered = await filteredIndex(store, filters);
  return {
    buildId: store.buildId,
    questionSetVersion: store.questionSetVersion,
    total: filtered.length,
    offset,
    limit,
    items: filtered.slice(offset, offset + limit).map(({ item }) => item),
  };
}

export async function getOfficialQuestion(questionId: string) {
  const store = await loadStore();
  const id = String(questionId);
  await store.ensureQuestionLoaded(id);
  const raw = store.rawById.get(id);
  const normalized = store.normalizedById.get(id);
  const index = store.indexById.get(id);
  if (!raw || !normalized || !index) return null;
  return {
    questionId: id,
    provenance: {
      kind: 'editorial_question' as const,
      payloadPolicy: 'source_preserved' as const,
      buildId: store.buildId,
      questionSetVersion: store.questionSetVersion,
      editorialHashSha256: index.editorialHashSha256,
    },
    editorial: { raw, normalized },
    editorialProjection: index.editorialProjection,
    suvecaDerived: index.suvecaDerived,
  };
}

export async function sampleOfficialQuestions(filters: OfficialQuestionFilters, count = 10) {
  const store = await loadStore();
  const filtered = await filteredIndex(store, filters);
  const pool = filtered.map(({ item }) => item);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  const selected = pool.slice(0, Math.min(50, Math.max(1, count)));
  return Promise.all(selected.map((item) => getOfficialQuestion(item.questionId)));
}

export async function formatOfficialQuestionContext(query: string, limit = 2) {
  const store = await loadStore();
  const result = await queryOfficialQuestions({ query }, { limit });
  const blocks = await Promise.all(result.items.map(async (item) => {
    await store.ensureQuestionLoaded(item.questionId);
    const question = store.normalizedById.get(item.questionId);
    const statement = formatOfficialContent([
      question?.supportText,
      question?.prompt,
    ].filter(Boolean).join('\n\n'));
    const commentary = formatOfficialContent(question?.commentary);
    return [
      `[QUESTION:${item.questionId}]`,
      `Aulas/temas: ${item.editorialProjection.topicNames.join(' > ')}`,
      `Banca/ano: ${item.editorialProjection.banks.join(', ') || 'não identificado'} / ${item.editorialProjection.years.join(', ') || 'não identificado'}`,
      `Enunciado — trecho preservado: ${statement.slice(0, 1400)}${statement.length > 1400 ? ' […]' : ''}`,
      `Comentário — trecho preservado: ${commentary.slice(0, 1800)}${commentary.length > 1800 ? ' […]' : ''}`,
    ].join('\n');
  }));
  if (!blocks.length) return '';
  return `QUESTÕES EDITORIAIS RELACIONADAS DA APOSTILA (conteúdo preservado; não corrigir nem atribuir à SuVeCA):\n\n${blocks.join('\n\n')}`;
}
