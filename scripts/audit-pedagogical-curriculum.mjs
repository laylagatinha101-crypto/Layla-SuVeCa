import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const manifestPath = path.join(ROOT, 'public', 'knowledge', 'pedagogical', 'manifest.json');
const curriculumPath = path.join(ROOT, 'knowledge', 'canonical', 'pedagogical-curriculum.json');
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha256File = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readQuestionProjection = (kind) => {
  const knowledgeRoot = path.join(ROOT, 'public', 'knowledge');
  const monolith = path.join(knowledgeRoot, `official-questions.${kind}.json`);
  if (fs.existsSync(monolith)) return readJson(monolith);
  const shardManifest = readJson(path.join(knowledgeRoot, 'official-questions.manifest.json'));
  return shardManifest.shards.flatMap((shard) => readJson(path.join(knowledgeRoot, shard[kind].file)));
};

check(fs.existsSync(manifestPath), 'Manifesto público da integração pedagógica ausente.');
check(fs.existsSync(curriculumPath), 'Currículo pedagógico canônico ausente.');

if (!errors.length) {
  const manifest = readJson(manifestPath);
  const curriculum = readJson(curriculumPath);
  const methodPath = path.join(ROOT, 'public', 'knowledge', 'pedagogical', 'suveca-method.json');
  const method = readJson(methodPath);
  const coreModules = curriculum.modules.filter((module) => /^mod\d+$/.test(module.id));
  const simulado = curriculum.modules.find((module) => module.id === 'simulado');
  const studySections = coreModules.flatMap((module) => module.sections);
  const expectedCoreIds = Array.from({ length: 15 }, (_, index) => `mod${index}`);

  check(curriculum.schemaVersion === '4.2.0', `Schema curricular inesperado: ${curriculum.schemaVersion}.`);
  check(curriculum.buildId === manifest.buildId, 'Build ID diverge entre currículo e manifesto.');
  check(JSON.stringify(coreModules.map((module) => module.id)) === JSON.stringify(expectedCoreIds), 'Módulos curriculares não correspondem às aulas 00–14.');
  check(studySections.length === 115, `Unidades de estudo: ${studySections.length}/115.`);
  check(studySections.filter((section) => section.lessonId !== 'A14').length === 102, 'Aulas 00–13 não totalizam 102 unidades.');
  check(studySections.filter((section) => section.lessonId === 'A14').length === 13, 'Aula 14 não totaliza 13 revisões cumulativas.');
  check(new Set(studySections.map((section) => `${section.lessonId}:${section.groupId}`)).size === studySections.length, 'Há unidade curricular duplicada.');
  check(studySections.every((section) => !/^[GR]\d{2}\s*[·—-]/.test(section.title)), 'Há identificador interno exposto no título de unidade.');
  check(simulado?.questions?.length === 20, 'Simulado editorial não contém 20 questões.');
  check(simulado?.questions?.every((question) => question.origin === 'official'), 'Simulado contém questão sem origem oficial explícita.');
  check(new Set(simulado?.questions?.map((question) => question.id)).size === 20, 'Simulado editorial contém ID de execução duplicado.');
  check(new Set(simulado?.questions?.map((question) => question.officialQuestionId)).size === 20, 'Simulado editorial reutiliza questão-fonte.');
  check(
    JSON.stringify([...new Set(simulado?.questions?.map((question) => question.moduleId))].sort())
      === JSON.stringify(Array.from({ length: 14 }, (_, index) => `mod${index}`).sort()),
    'Simulado editorial não cobre exatamente as aulas 00–13.',
  );
  check(
    simulado?.questions?.every((question) => question.questionSetVersion === `editorial-simulado-${curriculum.buildId}`),
    'Simulado editorial não está versionado pelo build.',
  );
  check(curriculum.totals?.mediaDependencies === 0, 'Currículo declara dependência audiovisual.');
  check(curriculum.policy?.includes('substituem o conteúdo curricular legado'), 'Política de substituição editorial não está declarada.');
  check(
    curriculum.methodology?.equation === 'Sujeito + Verbo + Complemento + Adjunto + Predicativo',
    'Equação do método SuVeCA ausente ou divergente.',
  );
  check(
    curriculum.methodology?.definition?.includes('mapa de análise para reconstruir as relações sintáticas'),
    'Natureza relacional do método SuVeCA não está declarada.',
  );
  check(coreModules.every((module) => module.suvecaMethod?.methodId === 'suveca-analysis-map-v1'), 'Há aula sem conexão metodológica SuVeCA.');
  check(coreModules.every((module) => module.suvecaMethod?.methodId === method.methodId), 'Há panorama de aula sem método SuVeCA válido.');

  const integratedSections = studySections.filter((section) => section.lessonId !== 'A14');
  const expectedGroupKeys = integratedSections.map((section) => `${section.lessonId}/${section.groupId}`).sort();
  const methodGroupKeys = Object.keys(method.groupConnections || {}).sort();
  const validGroupLevels = new Set(['central', 'strong', 'support', 'indirect', 'outside_core']);
  check(methodGroupKeys.length === 102, `Conexões temáticas SuVeCA: ${methodGroupKeys.length}/102.`);
  check(JSON.stringify(methodGroupKeys) === JSON.stringify(expectedGroupKeys), 'Conexões SuVeCA não correspondem exatamente aos grupos curriculares.');
  check(Object.values(method.groupConnections || {}).every((connection) => validGroupLevels.has(connection.level)), 'Há nível temático SuVeCA inválido.');
  check(Object.values(method.groupConnections || {}).every((connection) => connection.publicationStatus?.startsWith('approved')), 'Há conexão temática sem aprovação editorial.');
  check(Object.values(method.groupConnections || {}).every((connection) => connection.editorialSourceId), 'Há conexão temática sem vínculo com o detalhamento editorial Gemini aprovado.');
  check(method.editorialConnectionSource?.sourceDigest?.length === 64, 'Digest da revisão editorial das conexões ausente.');
  check(method.editorialConnectionSource?.totals?.connections === 102, 'Revisão editorial não cobre 102 conexões.');
  check(method.editorialConnectionSource?.totals?.conflictsReviewed === 79, 'Revisão editorial não adjudicou os 79 conflitos referenciados.');
  check(integratedSections.every((section) => section.suvecaMethod?.methodId === method.methodId), 'Há grupo sem conexão SuVeCA materializada.');
  check(integratedSections.every((section) => {
    const source = method.groupConnections?.[`${section.lessonId}/${section.groupId}`];
    return source && section.suvecaMethod?.level === source.level && section.suvecaMethod?.summary === source.summary;
  }), 'A conexão SuVeCA publicada em uma unidade diverge da fonte editorial do grupo.');
  check(studySections.filter((section) => section.lessonId === 'A14').every((section) => section.suvecaMethod?.level === 'review'), 'Revisão A14 sem nível transversal SuVeCA.');
  check(!integratedSections.some((section) => ['core', 'contextual'].includes(section.suvecaMethod?.level)), 'Currículo ainda expõe níveis SuVeCA legados.');

  const expectedRepresentativeLevels = {
    'A00/G01': 'outside_core',
    'A00/G07': 'strong',
    'A01/G03': 'strong',
    'A04/G01': 'central',
    'A04/G05': 'indirect',
    'A06/G02': 'central',
    'A08/G05': 'support',
    'A10/G06': 'central',
    'A12/G02': 'indirect',
    'A12/G04': 'strong',
    'A13/G07': 'indirect',
  };
  for (const [key, level] of Object.entries(expectedRepresentativeLevels)) {
    check(method.groupConnections?.[key]?.level === level, `${key}: nível SuVeCA deveria ser ${level}.`);
  }

  for (const descriptor of manifest.artifacts || []) {
    const file = path.resolve(ROOT, ...descriptor.path.split('/'));
    check(file.startsWith(path.resolve(ROOT) + path.sep), `${descriptor.path}: caminho fora do repositório.`);
    if (!fs.existsSync(file)) {
      errors.push(`${descriptor.path}: artefato ausente.`);
      continue;
    }
    check(fs.statSync(file).size === descriptor.bytes, `${descriptor.path}: bytes divergentes.`);
    check(sha256File(file) === descriptor.sha256, `${descriptor.path}: SHA-256 divergente.`);
  }

  const learnerFiles = studySections.map((section) => {
    check(typeof section.contentUrl === 'string' && section.contentUrl.startsWith('/knowledge/pedagogical/units/'), `${section.lessonId}/${section.groupId}: URL de aprofundamento inválida.`);
    return path.join(ROOT, 'public', section.contentUrl?.replace(/^\//, '') || '__missing__');
  });
  const forbiddenMedia = /\b(?:vídeos?|videoaulas?|transcrições?|timestamps?|\.mp4|\.srt)\b/i;
  const forbiddenTechnicalId = /\b(?:CANON|MARK|ORAL|QUOTE|TERM|VIS|KB|PROC|EX|WARN|TIP|UNCERTAIN|REL|CARD)-[A-Z0-9_-]+\b/;
  const forbiddenEditorialResidue = /==[0-9a-f]{6,}==|\b(?:proveniência|rastreabilidade):\s|\b\d{3}\s+-[^\n]+-\s+720p\.md\b/i;
  for (const file of learnerFiles) {
    if (!fs.existsSync(file)) {
      errors.push(`${path.relative(ROOT, file)}: aprofundamento ausente.`);
      continue;
    }
    const markdown = fs.readFileSync(file, 'utf8');
    check(markdown.trim().length >= 500, `${path.relative(ROOT, file)}: conteúdo superficial ou vazio.`);
    check(!forbiddenMedia.test(markdown), `${path.relative(ROOT, file)}: dependência audiovisual em conteúdo do aluno.`);
    check(!forbiddenTechnicalId.test(markdown), `${path.relative(ROOT, file)}: ID técnico exposto ao aluno.`);
    check(!forbiddenEditorialResidue.test(markdown), `${path.relative(ROOT, file)}: resíduo técnico/editorial exposto ao aluno.`);
    check(!/\bmaterial de origem\b/i.test(markdown), `${path.relative(ROOT, file)}: linguagem de processamento exposta.`);
    check(markdown.includes('## Conexão com o método SuVeCA'), `${path.relative(ROOT, file)}: conexão SuVeCA ausente.`);
    const section = studySections.find((item) => path.join(ROOT, 'public', item.contentUrl?.replace(/^\//, '') || '__missing__') === file);
    if (section?.lessonId !== 'A14') {
      check(markdown.includes('### Testes decisivos'), `${path.relative(ROOT, file)}: testes editoriais SuVeCA ausentes.`);
    }
    if (section?.suvecaMethod?.level === 'outside_core') {
      check(
        markdown.indexOf('## Conexão com o método SuVeCA') > markdown.indexOf('## Pré-requisitos e modelo mental'),
        `${path.relative(ROOT, file)}: SuVeCA foi anteposta à regra própria de um tema fora do núcleo.`,
      );
    }
  }

  check(method.buildId === curriculum.buildId, 'Método SuVeCA público diverge do build curricular.');
  check(method.methodId === 'suveca-analysis-map-v1', 'Método SuVeCA público possui identidade inválida.');
  check(Object.keys(method.lessonConnections || {}).length === 15, 'Método SuVeCA não cobre as quinze aulas.');
  check(Object.keys(method.groupTaxonomy || {}).length === 6, 'Taxonomia SuVeCA pública incompleta.');
  check(manifest.totals?.methodologyLessonOverviews === 15, 'Manifesto não registra os panoramas SuVeCA das aulas.');
  check(manifest.totals?.methodologyGroupConnections === 102, 'Manifesto não registra as conexões SuVeCA dos grupos.');
  check(manifest.totals?.methodologyStudyConnections === 115, 'Manifesto não registra todas as conexões SuVeCA de estudo.');

  const flashcardPath = path.join(ROOT, 'src', 'data', 'editorialFlashcards.generated.ts');
  const flashcardSource = fs.readFileSync(flashcardPath, 'utf8');
  const flashcards = JSON.parse(/export const EDITORIAL_FLASHCARDS = ([\s\S]*?) as const;/.exec(flashcardSource)?.[1] || '[]');
  check(flashcards.length === manifest.totals.flashcards, 'Contagem de flashcards divergente.');
  check(flashcards.length >= 115, 'Cobertura de flashcards insuficiente.');
  check(new Set(flashcards.map((card) => card.id)).size === flashcards.length, 'IDs de flashcards duplicados.');
  check(flashcards.every((card) => card.front?.length >= 18 && card.back?.length >= 20), 'Há flashcard vazio ou pouco informativo.');
  check(flashcards.every((card) => !forbiddenMedia.test(`${card.front} ${card.back}`)), 'Há flashcard dependente de mídia.');
  check(flashcards.every((card) => !forbiddenEditorialResidue.test(`${card.front} ${card.back}`)), 'Há flashcard com resíduo técnico/editorial.');
  const integratedCardUnits = new Set(flashcards.flatMap((card) => card.sourceRefs || []).filter((ref) => ref.startsWith('EDITORIAL:')));
  check(integratedCardUnits.size === 102, `Cobertura das unidades integradas por flashcards: ${integratedCardUnits.size}/102.`);

  const procedures = readJson(path.join(ROOT, 'public', 'knowledge', 'pedagogical', 'decision-procedures.json'));
  check(procedures.count === procedures.procedures?.length, 'Contagem de roteiros decisórios divergente.');
  check(procedures.count === manifest.totals.decisionProcedures, 'Manifesto diverge dos roteiros decisórios.');
  check(new Set(procedures.procedures.map((item) => item.id)).size === procedures.count, 'IDs de roteiros decisórios duplicados.');
  check(procedures.procedures.every((item) => !forbiddenMedia.test(`${item.title} ${item.markdown}`)), 'Há roteiro decisório dependente de mídia.');
  check(procedures.procedures.every((item) => !forbiddenEditorialResidue.test(`${item.title} ${item.markdown}`)), 'Há roteiro decisório com resíduo técnico/editorial.');

  const knowledgeShardFiles = fs.readdirSync(path.join(ROOT, 'src', 'data'))
    .filter((name) => /^pedagogicalKnowledge\.part-\d+\.generated\.ts$/.test(name))
    .sort();
  const records = knowledgeShardFiles.flatMap((name) => {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'data', name), 'utf8');
    return JSON.parse(/export const PEDAGOGICAL_KNOWLEDGE_PART_\d+ = ([\s\S]*?) as const;/.exec(source)?.[1] || '[]');
  });
  check(knowledgeShardFiles.length > 1, 'Índice do Professor SuVeCA não foi particionado para implantação.');
  check(knowledgeShardFiles.every((name) => fs.statSync(path.join(ROOT, 'src', 'data', name)).size < 900_000), 'Partição do Professor SuVeCA excede 900 KB.');
  check(records.length === 115, `Índice do Professor SuVeCA: ${records.length}/115.`);
  check(new Set(records.map((record) => record.unitId)).size === records.length, 'Índice pedagógico contém unitId duplicado.');
  check(records.every((record) => record.sections?.length && record.routingTerms?.length), 'Índice pedagógico contém registro sem contexto ou roteamento.');
  check(records.every((record) => record.methodology?.level && record.methodology?.label && record.methodology?.limits?.length), 'Índice pedagógico contém metodologia incompleta.');
  check(records.every((record) => {
    if (record.lessonId === 'A14') return record.methodology.level === 'review';
    const source = method.groupConnections?.[`${record.lessonId}/${record.groupId}`];
    return source && source.level === record.methodology.level && source.summary === record.methodology.summary;
  }), 'Índice do Professor não preserva a conexão SuVeCA exata do grupo.');
  check(records.every((record) => !forbiddenEditorialResidue.test(`${record.title} ${record.objective} ${record.sections.map((section) => section.content).join(' ')}`)), 'Índice do Professor contém resíduo técnico/editorial.');

  const duelSource = fs.readFileSync(path.join(ROOT, 'src', 'data', 'editorialDuelQuestions.generated.ts'), 'utf8');
  const duelQuestions = JSON.parse(/export const EDITORIAL_DUEL_QUESTIONS = ([\s\S]*?) as const;/.exec(duelSource)?.[1] || '[]');
  check(duelQuestions.length === 12, `Questões editoriais do duelo: ${duelQuestions.length}/12.`);
  check(new Set(duelQuestions.map((question) => question.id)).size === duelQuestions.length, 'Duelo contém ID duplicado.');
  check(duelQuestions.every((question) => !forbiddenEditorialResidue.test(`${question.prompt} ${question.explanation}`)), 'Duelo contém resíduo técnico/editorial.');
  check(duelQuestions.every((question) => question.options.some((option) => option.id === question.correctOptionId)), 'Duelo contém gabarito fora das opções.');
  const duelFunctionsSource = fs.readFileSync(path.join(ROOT, 'functions', 'src', 'editorialDuel.generated.ts'), 'utf8');
  const duelFunctionsKey = JSON.parse(/export const EDITORIAL_DUEL_ANSWER_KEY = ([\s\S]*?) as const;/.exec(duelFunctionsSource)?.[1] || '{}');
  const duelFunctionsVersion = /export const EDITORIAL_DUEL_QUESTION_SET_VERSION = '([^']+)';/.exec(duelFunctionsSource)?.[1];
  const expectedDuelKey = Object.fromEntries(duelQuestions.map((question) => [question.id, question.correctOptionId]));
  check(JSON.stringify(duelFunctionsKey) === JSON.stringify(expectedDuelKey), 'Gabarito confiável do Duelo diverge da projeção do app.');
  check(duelFunctionsVersion === `editorial-duel-${curriculum.buildId}`, 'Versão confiável do Duelo diverge do build.');
  check(simulado.questions.every((question) => !forbiddenEditorialResidue.test(`${question.supportText || ''} ${question.questionText} ${question.commentary}`)), 'Simulado contém resíduo técnico/editorial.');

  const rawQuestions = readQuestionProjection('raw');
  const normalizedQuestions = readQuestionProjection('normalized');
  const questionIndex = readJson(path.join(ROOT, 'public', 'knowledge', 'official-question-index.json'));
  const questionQuality = readJson(path.join(ROOT, 'public', 'knowledge', 'editorial-question-quality.json'));
  const questionIds = normalizedQuestions.map((question) => question.id);
  check(rawQuestions.length === curriculum.totals.editorialQuestions, 'Contagem do banco editorial bruto divergente.');
  check(normalizedQuestions.length === curriculum.totals.editorialQuestions, 'Contagem do banco editorial normalizado divergente.');
  check(questionIndex.items?.length === curriculum.totals.editorialQuestions, 'Contagem do índice editorial divergente.');
  check(questionIndex.expectedTotal === curriculum.totals.editorialQuestions, 'Total esperado do índice editorial divergente.');
  check(questionQuality.totals?.uniquePublishedQuestions === curriculum.totals.editorialQuestions, 'Relatório de qualidade diverge do banco editorial.');
  check(questionIndex.buildId === curriculum.buildId, 'Build do índice editorial diverge do currículo.');
  check(questionIndex.questionSetVersion === `editorial-corpus-${curriculum.buildId}`, 'Versão do banco editorial não deriva do build.');
  check(new Set(questionIds).size === questionIds.length, 'Banco editorial contém IDs duplicados.');
  check(questionIds.every((id) => /^A(?:0\d|1[0-3]):/.test(id)), 'Banco editorial contém ID fora do namespace A00–A13.');
  check(JSON.stringify(rawQuestions.map((question) => question.id)) === JSON.stringify(questionIds), 'Ordem/IDs do bruto e normalizado divergem.');
  check(JSON.stringify(questionIndex.items.map((item) => item.questionId)) === JSON.stringify(questionIds), 'Ordem/IDs do índice editorial divergem.');
  check(simulado.questions.every((question) => questionIds.includes(question.officialQuestionId)), 'Simulado referencia questão ausente do banco editorial.');
  check(normalizedQuestions.every((question) => question.prompt?.trim().length >= 10), 'Banco editorial contém enunciado inválido.');
  check(normalizedQuestions.every((question) => question.commentary?.trim()), 'Banco editorial contém comentário vazio.');
  check(normalizedQuestions.every((question) => question.extractionConfidence >= 0.9 && question.answerConfidence >= 0.9), 'Banco editorial viola a confiança mínima de 0,9.');
  check(normalizedQuestions.every((question) => ['CERTO_ERRADO', 'MULTIPLA_ESCOLHA'].includes(question.questionType)), 'Banco editorial contém tipo não suportado.');
  check(normalizedQuestions.every((question) => question.questionType === 'CERTO_ERRADO'
    ? ['C', 'E'].includes(question.correctAnswer)
    : question.options?.length >= 2 && question.options.some((option) => option.letter === question.correctAnswer)), 'Banco editorial contém gabarito não interpretável.');
  check(
    normalizedQuestions.every((question) => !forbiddenEditorialResidue.test(
      `${question.supportText || ''} ${question.prompt} ${question.commentary} ${(question.options || []).map((option) => option.text).join(' ')}`,
    )),
    'Banco editorial normalizado contém resíduo técnico/editorial.',
  );
  check(Object.keys(questionQuality.perLesson || {}).length === 14 && Object.values(questionQuality.perLesson).every((count) => count > 0), 'Banco editorial não cobre todas as aulas A00–A13.');
  check(questionQuality.quarantine?.some((item) => item.sourceKey === 'A01:aula01.q0001'), 'Quarentena da questão A01 não registrada.');
  check(questionQuality.quarantine?.some((item) => item.sourceKey === 'A13:aula13.q0001'), 'Quarentena da questão A13 não registrada.');
  check(!fs.existsSync(path.join(ROOT, 'public', 'knowledge', 'official-question-badges.json')), 'Artefato de badges do banco legado ainda existe.');
  check(!fs.existsSync(path.join(ROOT, 'public', 'knowledge', 'official-question-topics.json')), 'Artefato de tópicos do banco legado ainda existe.');

  const simuladoKeySource = fs.readFileSync(path.join(ROOT, 'functions', 'src', 'officialQuestions.ts'), 'utf8');
  const simuladoKey = JSON.parse(/export const OFFICIAL_SIMULADO_ANSWER_KEY = ([\s\S]*?) as const;/.exec(simuladoKeySource)?.[1] || '{}');
  const simuladoVersion = /export const OFFICIAL_SIMULADO_VERSION = '([^']+)';/.exec(simuladoKeySource)?.[1];
  const expectedSimuladoKey = Object.fromEntries(simulado.questions.map((question) => [question.id, question.correctAnswer]));
  check(JSON.stringify(simuladoKey) === JSON.stringify(expectedSimuladoKey), 'Gabarito confiável do simulado diverge do currículo.');
  check(simuladoVersion === `editorial-simulado-${curriculum.buildId}`, 'Versão confiável do simulado diverge do build.');

  const sourceManifest = readJson(path.join(ROOT, 'knowledge', 'canonical', 'pedagogical-source-manifest.json'));
  check(sourceManifest.sourceDigest === manifest.sourceDigest, 'Manifesto canônico diverge do manifesto público.');
  check(
    sourceManifest.sourceFiles.some((source) => source.path === 'knowledge/editorial/suveca-method.json'),
    'Definição do método SuVeCA não participa do digest editorial.',
  );
  const questionSourceFiles = sourceManifest.sourceFiles.filter((source) => /corpus_apostila\/(?:questions|answers)\.jsonl$/.test(source.path));
  check(questionSourceFiles.length === 28, `Digest editorial cobre ${questionSourceFiles.length}/28 arquivos de questões e respostas.`);
}

if (errors.length) {
  console.error(JSON.stringify({ status: 'error', errors }, null, 2));
  process.exitCode = 1;
} else {
  const manifest = readJson(manifestPath);
  console.log(JSON.stringify({
    status: 'ok',
    buildId: manifest.buildId,
    modules: manifest.totals.modules,
    studyUnits: manifest.totals.studyUnits,
    flashcards: manifest.totals.flashcards,
    decisionProcedures: manifest.totals.decisionProcedures,
    simuladoQuestions: manifest.totals.simuladoQuestions,
    editorialQuestions: manifest.totals.editorialQuestions,
    mediaDependencies: manifest.totals.mediaDependencies,
  }, null, 2));
}
