import { readFile } from 'node:fs/promises';

const token = process.env.SUVECA_EVAL_ID_TOKEN;
const baseUrl = (process.env.SUVECA_EVAL_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
if (!token) {
  console.error('Defina SUVECA_EVAL_ID_TOKEN com um Firebase ID Token de uma conta de avaliação.');
  process.exit(2);
}

const suite = JSON.parse(await readFile(new URL('../tests/evals/professor-suveca.eval.json', import.meta.url), 'utf8'));
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const technicalRef = /\b(?:PASSAGE|QUESTION|KB):/i;
const results = [];

for (const item of suite.cases) {
  const response = await fetch(`${baseUrl}/api/gemini/explain`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: item.question, context: item.context, history: [] }),
  });
  const data = await response.json().catch(() => ({}));
  const answer = String(data.answerMarkdown || '');
  const comparable = normalize(answer);
  const checks = {
    http: response.ok,
    grounded: Array.isArray(data.sourceRefs) && data.sourceRefs.length > 0,
    learnerSafe: !technicalRef.test(answer),
    expectedCoverage: item.expectedAny.every((term) => comparable.includes(normalize(term))),
    noKnownContradiction: item.forbidden.every((claim) => !comparable.includes(normalize(claim))),
  };
  results.push({ id: item.id, checks, passed: Object.values(checks).every(Boolean) });
}

console.log(JSON.stringify({ schemaVersion: suite.schemaVersion, baseUrl, total: results.length, passed: results.filter((item) => item.passed).length, results }, null, 2));
if (results.some((item) => !item.passed)) process.exit(1);
