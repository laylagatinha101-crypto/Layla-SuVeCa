import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const resolve = (...segments) => path.resolve(ROOT, ...segments);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readJson = async (...segments) => JSON.parse(await readFile(resolve(...segments), 'utf8'));
const getId = (record) => String(record?.id ?? record?.question_id ?? '');
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

const auditFile = async (baseDirectory, descriptor) => {
  const file = resolve(baseDirectory, descriptor.file);
  const base = resolve(baseDirectory);
  check(file.startsWith(`${base}${path.sep}`), `${descriptor.file}: caminho fora da base.`);
  const buffer = await readFile(file);
  check(buffer.length === descriptor.bytes, `${descriptor.file}: bytes divergentes.`);
  check(sha256(buffer) === descriptor.sha256, `${descriptor.file}: SHA-256 divergente.`);
  return buffer;
};

const base = path.join('public', 'knowledge');
const manifest = await readJson(base, 'official-questions.manifest.json');
const indexPayload = await readJson(base, 'official-question-index.json');
const expectedTotal = Number(indexPayload.expectedTotal);
const raw = [];
const normalized = [];
const manifestIds = [];

check(Number.isInteger(expectedTotal) && expectedTotal >= 1000, `Total editorial inválido: ${expectedTotal}.`);
check(manifest.kind === 'suveca-editorial-question-shards', `Tipo de manifesto inesperado: ${manifest.kind}.`);
check(manifest.expectedTotal === expectedTotal, 'Total esperado diverge entre índice e manifesto.');
check(manifest.buildId === indexPayload.buildId, 'Build diverge entre índice e manifesto.');
check(manifest.questionSetVersion === indexPayload.questionSetVersion, 'Versão diverge entre índice e manifesto.');
check(indexPayload.questionSetVersion === `editorial-corpus-${indexPayload.buildId}`, 'Versão editorial não deriva do build.');
check(Array.isArray(manifest.shards) && manifest.shards.length === manifest.totals?.shards, 'Quantidade de shards divergente no manifesto.');

for (const shard of manifest.shards || []) {
  const [rawBuffer, normalizedBuffer] = await Promise.all([
    auditFile(base, shard.raw),
    auditFile(base, shard.normalized),
  ]);
  const rawItems = JSON.parse(rawBuffer.toString('utf8'));
  const normalizedItems = JSON.parse(normalizedBuffer.toString('utf8'));
  check(rawItems.length === shard.count, `Shard ${shard.part}: contagem bruta divergente.`);
  check(normalizedItems.length === shard.count, `Shard ${shard.part}: contagem normalizada divergente.`);
  check(JSON.stringify(rawItems.map(getId)) === JSON.stringify(shard.questionIds), `Shard ${shard.part}: IDs brutos divergentes.`);
  check(JSON.stringify(normalizedItems.map(getId)) === JSON.stringify(shard.questionIds), `Shard ${shard.part}: IDs normalizados divergentes.`);
  raw.push(...rawItems);
  normalized.push(...normalizedItems);
  manifestIds.push(...shard.questionIds);
}

const indexIds = (indexPayload.items || []).map((item) => String(item.questionId));
check(raw.length === expectedTotal, `Banco bruto particionado: ${raw.length}/${expectedTotal}.`);
check(normalized.length === expectedTotal, `Banco normalizado particionado: ${normalized.length}/${expectedTotal}.`);
check(indexIds.length === expectedTotal, `Índice editorial: ${indexIds.length}/${expectedTotal}.`);
check(new Set(manifestIds).size === expectedTotal, `IDs únicos particionados: ${new Set(manifestIds).size}/${expectedTotal}.`);
check(manifestIds.every((id) => /^A(?:0\d|1[0-3]):/.test(id)), 'Partições contêm ID fora do namespace A00–A13.');
check(JSON.stringify(raw.map(getId)) === JSON.stringify(normalized.map(getId)), 'Ordem entre bruto e normalizado divergente.');
check(JSON.stringify(indexIds) === JSON.stringify(manifestIds), 'A ordem do índice diverge das partições editoriais.');

await auditFile(base, manifest.sources.index);
const rawSourcePath = resolve(base, manifest.sources.raw.file);
const normalizedSourcePath = resolve(base, manifest.sources.normalized.file);
if (existsSync(rawSourcePath)) {
  await auditFile(base, manifest.sources.raw);
  const rawSource = await readFile(rawSourcePath);
  check(JSON.stringify(JSON.parse(rawSource.toString('utf8'))) === JSON.stringify(raw), 'As partições brutas não equivalem ao monólito.');
}
if (existsSync(normalizedSourcePath)) {
  await auditFile(base, manifest.sources.normalized);
  const normalizedSource = await readFile(normalizedSourcePath);
  check(JSON.stringify(JSON.parse(normalizedSource.toString('utf8'))) === JSON.stringify(normalized), 'As partições normalizadas não equivalem ao monólito.');
}

const generatedKeySource = await readFile(resolve('functions', 'src', 'officialCorpus.generated.ts'), 'utf8');
const generatedKey = JSON.parse(/export const OFFICIAL_CORPUS_ANSWER_KEY = ([\s\S]*?) as const;/.exec(generatedKeySource)?.[1] || '{}');
const generatedVersion = /export const OFFICIAL_CORPUS_VERSION = '([^']+)';/.exec(generatedKeySource)?.[1];
const expectedKey = Object.fromEntries(indexPayload.items.map((item) => [String(item.questionId), item.editorialProjection.correctAnswer]));
check(JSON.stringify(generatedKey) === JSON.stringify(expectedKey), 'Gabarito server-side do banco editorial diverge do índice.');
check(generatedVersion === indexPayload.questionSetVersion, 'Versão server-side do banco editorial diverge do índice.');

for (const stalePath of [
  ['public', 'knowledge', 'semantic-profiles-v3.json'],
  ['public', 'knowledge', 'semantic-profiles-v3.manifest.json'],
  ['public', 'knowledge', 'semantic-profile-parts'],
  ['src', 'data', 'knowledgeIndex.generated.ts'],
  ['src', 'data', 'knowledge-index'],
  ['src', 'data', 'decisionTrees.generated.ts'],
  ['src', 'data', 'decisionTrees.ts'],
]) {
  check(!existsSync(resolve(...stalePath)), `${stalePath.join('/')}: projeção curricular legada ainda presente.`);
}

if (errors.length) {
  console.error(JSON.stringify({ status: 'error', errors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: 'ok',
    editorialQuestions: {
      raw: raw.length,
      normalized: normalized.length,
      indexed: indexIds.length,
      uniqueIds: new Set(manifestIds).size,
      serverAnswerKey: Object.keys(generatedKey).length,
      shards: manifest.shards.length,
    },
  }, null, 2));
}
