import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const QUESTION_TARGET_BYTES = 650 * 1024;
const resolve = (...segments) => path.resolve(ROOT, ...segments);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value)}\n`, 'utf8');
const getId = (record) => String(record?.id ?? record?.question_id ?? '');
const readJson = async (...segments) => JSON.parse(await readFile(resolve(...segments), 'utf8'));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const validateQuestionSources = (raw, normalized, indexPayload) => {
  assert(Array.isArray(raw), 'O banco bruto não é um array.');
  assert(Array.isArray(normalized), 'O banco normalizado não é um array.');
  assert(Array.isArray(indexPayload?.items), 'O índice editorial não contém items.');
  const expectedTotal = Number(indexPayload.expectedTotal);
  assert(Number.isInteger(expectedTotal) && expectedTotal >= 1000, `Total editorial inválido: ${indexPayload.expectedTotal}.`);
  assert(indexPayload.questionSetVersion === `editorial-corpus-${indexPayload.buildId}`, 'Versão editorial incompatível com o build.');
  assert(raw.length === expectedTotal, `Banco bruto: esperado ${expectedTotal}, recebido ${raw.length}.`);
  assert(normalized.length === expectedTotal, `Banco normalizado: esperado ${expectedTotal}, recebido ${normalized.length}.`);
  assert(indexPayload.items.length === expectedTotal, `Índice: esperado ${expectedTotal}, recebido ${indexPayload.items.length}.`);

  const rawIds = raw.map(getId);
  const normalizedIds = normalized.map(getId);
  const indexIds = indexPayload.items.map((item) => String(item.questionId || ''));
  for (const [label, ids] of [['bruto', rawIds], ['normalizado', normalizedIds], ['índice', indexIds]]) {
    assert(ids.every(Boolean), `O conjunto ${label} contém ID vazio.`);
    assert(new Set(ids).size === expectedTotal, `O conjunto ${label} contém IDs duplicados.`);
    assert(ids.every((id) => /^A(?:0\d|1[0-3]):/.test(id)), `O conjunto ${label} contém ID fora do namespace A00–A13.`);
  }
  assert(JSON.stringify(rawIds) === JSON.stringify(normalizedIds), 'A ordem/IDs do bruto e do normalizado divergem.');
  assert(JSON.stringify(rawIds) === JSON.stringify(indexIds), 'A ordem/IDs do índice diverge do banco editorial.');
  return expectedTotal;
};

const writeBuffer = async (filePath, buffer) => {
  await writeFile(filePath, buffer);
  return { bytes: buffer.length, sha256: sha256(buffer) };
};

const buildQuestionShards = async () => {
  const base = resolve('public', 'knowledge');
  const rawPath = path.join(base, 'official-questions.raw.json');
  const normalizedPath = path.join(base, 'official-questions.normalized.json');
  const indexPath = path.join(base, 'official-question-index.json');
  const [rawSource, normalizedSource, indexSource] = await Promise.all([
    readFile(rawPath),
    readFile(normalizedPath),
    readFile(indexPath),
  ]);
  const raw = JSON.parse(rawSource.toString('utf8'));
  const normalized = JSON.parse(normalizedSource.toString('utf8'));
  const indexPayload = JSON.parse(indexSource.toString('utf8'));
  const expectedTotal = validateQuestionSources(raw, normalized, indexPayload);

  const groups = [];
  let rawGroup = [];
  let normalizedGroup = [];
  const flush = () => {
    if (!rawGroup.length) return;
    groups.push({ raw: rawGroup, normalized: normalizedGroup });
    rawGroup = [];
    normalizedGroup = [];
  };
  for (let index = 0; index < raw.length; index += 1) {
    const exceedsTarget =
      jsonBytes([...rawGroup, raw[index]]).length > QUESTION_TARGET_BYTES
      || jsonBytes([...normalizedGroup, normalized[index]]).length > QUESTION_TARGET_BYTES;
    if (exceedsTarget && rawGroup.length) flush();
    rawGroup.push(raw[index]);
    normalizedGroup.push(normalized[index]);
    assert(jsonBytes(rawGroup).length <= QUESTION_TARGET_BYTES, `A questão ${getId(raw[index])} excede o limite individual bruto.`);
    assert(jsonBytes(normalizedGroup).length <= QUESTION_TARGET_BYTES, `A questão ${getId(normalized[index])} excede o limite individual normalizado.`);
  }
  flush();

  const outputDir = path.join(base, 'official-question-parts');
  assert(outputDir.startsWith(`${base}${path.sep}`), `Diretório de saída inseguro: ${outputDir}`);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const shards = [];
  for (let index = 0; index < groups.length; index += 1) {
    const part = String(index + 1).padStart(3, '0');
    const rawFile = `official-questions.raw.part-${part}.json`;
    const normalizedFile = `official-questions.normalized.part-${part}.json`;
    const rawBuffer = jsonBytes(groups[index].raw);
    const normalizedBuffer = jsonBytes(groups[index].normalized);
    const [rawMeta, normalizedMeta] = await Promise.all([
      writeBuffer(path.join(outputDir, rawFile), rawBuffer),
      writeBuffer(path.join(outputDir, normalizedFile), normalizedBuffer),
    ]);
    shards.push({
      part: index + 1,
      count: groups[index].raw.length,
      questionIds: groups[index].raw.map(getId),
      raw: { file: `official-question-parts/${rawFile}`, ...rawMeta },
      normalized: { file: `official-question-parts/${normalizedFile}`, ...normalizedMeta },
    });
  }

  const manifest = {
    schemaVersion: '2.0.0',
    kind: 'suveca-editorial-question-shards',
    buildId: indexPayload.buildId,
    questionSetVersion: indexPayload.questionSetVersion,
    expectedTotal,
    partitionPolicy: {
      ordering: 'editorial-id-order',
      targetBytesPerFile: QUESTION_TARGET_BYTES,
      equivalence: 'deep-json-with-stable-question-id-order',
    },
    sources: {
      raw: { file: 'official-questions.raw.json', bytes: rawSource.length, sha256: sha256(rawSource) },
      normalized: { file: 'official-questions.normalized.json', bytes: normalizedSource.length, sha256: sha256(normalizedSource) },
      index: { file: 'official-question-index.json', bytes: indexSource.length, sha256: sha256(indexSource) },
    },
    totals: {
      raw: raw.length,
      normalized: normalized.length,
      indexed: indexPayload.items.length,
      uniqueQuestionIds: new Set(raw.map(getId)).size,
      shards: shards.length,
    },
    shards,
  };
  await writeFile(path.join(base, 'official-questions.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
};

const buildEditorialCorpusAnswerKey = async () => {
  const index = await readJson('public', 'knowledge', 'official-question-index.json');
  assert(Array.isArray(index.items) && index.items.length === index.expectedTotal && index.expectedTotal >= 1000, 'O índice editorial está incompleto.');
  const entries = index.items.map((item) => [item.questionId, item.editorialProjection?.correctAnswer]);
  assert(entries.every(([id, answer]) => typeof id === 'string' && typeof answer === 'string'), 'Gabarito editorial incompleto.');
  assert(new Set(entries.map(([id]) => id)).size === entries.length, 'IDs editoriais duplicados no gabarito.');
  const source = `/* AUTO-GENERATED by scripts/build-deployment-shards.mjs. Do not edit. */\nexport const OFFICIAL_CORPUS_ANSWER_KEY = ${JSON.stringify(Object.fromEntries(entries), null, 2)} as const;\n\nexport const OFFICIAL_CORPUS_VERSION = '${index.questionSetVersion}';\nexport const OFFICIAL_CORPUS_SAMPLE_SIZE = 10;\n`;
  await writeFile(resolve('functions', 'src', 'officialCorpus.generated.ts'), source);
  return entries.length;
};

const [questions, answerCount] = await Promise.all([
  buildQuestionShards(),
  buildEditorialCorpusAnswerKey(),
]);
console.log(JSON.stringify({
  status: 'ok',
  questionShards: questions.totals.shards,
  editorialQuestions: questions.totals.uniqueQuestionIds,
  editorialCorpusAnswers: answerCount,
}, null, 2));
