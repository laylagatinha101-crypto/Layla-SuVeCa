import fs from 'node:fs';
import path from 'node:path';
import { auditPedagogicalMarkdown } from './lib/pedagogical-markdown.mjs';

const root = process.cwd();
const unitsRoot = path.join(root, 'public', 'knowledge', 'pedagogical', 'units');

if (!fs.existsSync(unitsRoot)) {
  console.error('Diretório de unidades pedagógicas ausente.');
  process.exit(1);
}

const files = fs.readdirSync(unitsRoot).filter((name) => name.endsWith('.md')).sort();
const failures = files.flatMap((name) => {
  const markdown = fs.readFileSync(path.join(unitsRoot, name), 'utf8').replace(/^\uFEFF/, '');
  return auditPedagogicalMarkdown(markdown).map((error) => ({ file: `public/knowledge/pedagogical/units/${name}`, ...error }));
});

if (failures.length) {
  console.error(JSON.stringify({ status: 'error', checkedFiles: files.length, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'ok',
  checkedFiles: files.length,
  blockedRules: ['glued-alternative', 'duplicate-numbering', 'heading-hierarchy', 'repeated-separator', 'unclosed-fence'],
}, null, 2));
