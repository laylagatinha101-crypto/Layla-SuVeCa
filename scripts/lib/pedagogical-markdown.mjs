const separator = /^\s*---\s*$/;
const heading = /^(#{1,6})\s+(.+?)\s*$/;

const mapOutsideFences = (markdown, transform) => {
  let fenced = false;
  return String(markdown || '').split(/\r?\n/).flatMap((line, index) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      return [line];
    }
    return fenced ? [line] : transform(line, index);
  });
};

const splitGluedAlternatives = (line) => {
  const matches = [...line.matchAll(/(?<![\p{L}\p{N}])[A-E]\)\s*/gu)];
  if (matches.length < 2) return [line];
  let expanded = line;
  for (const match of matches.reverse()) {
    const index = match.index || 0;
    if (index === 0) continue;
    expanded = `${expanded.slice(0, index).trimEnd()}\n${expanded.slice(index)}`;
  }
  return expanded.split('\n');
};

export const normalizePedagogicalMarkdown = (value) => {
  const expanded = mapOutsideFences(value, (line) => splitGluedAlternatives(line));
  const normalized = [];
  let previousSignificantWasSeparator = false;
  let lastHeadingLevel = 0;
  let seenH1 = false;
  let fenced = false;

  for (let line of expanded) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      normalized.push(line);
      previousSignificantWasSeparator = false;
      continue;
    }
    if (fenced) {
      normalized.push(line);
      continue;
    }

    line = line
      .replace(/^(\s*)(\d+)\.\s+\d+\.\s+/, '$1$2. ')
      .replace(/^( {1,7})([-*+]\s+)/, (match, spaces, marker) => `${' '.repeat(Math.max(2, Math.round(spaces.length / 2) * 2))}${marker}`)
      .replace(/[ \t]+$/g, '');

    const headingMatch = heading.exec(line);
    if (headingMatch) {
      let level = headingMatch[1].length;
      if (level === 1 && seenH1) level = 2;
      if (level === 1) seenH1 = true;
      if (lastHeadingLevel && level > lastHeadingLevel + 1) level = lastHeadingLevel + 1;
      line = `${'#'.repeat(level)} ${headingMatch[2]}`;
      lastHeadingLevel = level;
    }

    if (separator.test(line)) {
      if (previousSignificantWasSeparator) continue;
      previousSignificantWasSeparator = true;
      normalized.push('---');
      continue;
    }
    if (line.trim()) previousSignificantWasSeparator = false;
    normalized.push(line);
  }

  return `${normalized.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
};

export const auditPedagogicalMarkdown = (value) => {
  const errors = [];
  const lines = String(value || '').split(/\r?\n/);
  let fenced = false;
  let lastHeadingLevel = 0;
  let h1Count = 0;
  let previousSignificantSeparatorLine = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      previousSignificantSeparatorLine = null;
      continue;
    }
    if (fenced) continue;

    if ((line.match(/(?<![\p{L}\p{N}])[A-E]\)\s*/gu) || []).length >= 2) {
      errors.push({ line: lineNumber, rule: 'glued-alternative', message: 'Alternativa A–E colada ao texto anterior.' });
    }
    if (/^\s*\d+\.\s+\d+\.\s+/.test(line)) {
      errors.push({ line: lineNumber, rule: 'duplicate-numbering', message: 'Numeração duplicada no início da linha.' });
    }

    const headingMatch = heading.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      if (level === 1) h1Count += 1;
      if (lastHeadingLevel && level > lastHeadingLevel + 1) {
        errors.push({ line: lineNumber, rule: 'heading-hierarchy', message: `Salto de H${lastHeadingLevel} para H${level}.` });
      }
      lastHeadingLevel = level;
    }

    if (separator.test(line)) {
      if (previousSignificantSeparatorLine !== null) {
        errors.push({ line: lineNumber, rule: 'repeated-separator', message: `Separador repetido após a linha ${previousSignificantSeparatorLine}.` });
      }
      previousSignificantSeparatorLine = lineNumber;
    } else if (line.trim()) {
      previousSignificantSeparatorLine = null;
    }
  }

  if (fenced) errors.push({ line: lines.length, rule: 'unclosed-fence', message: 'Bloco de código sem fechamento.' });
  if (h1Count !== 1) errors.push({ line: 1, rule: 'heading-hierarchy', message: `Documento deve conter exatamente um H1; encontrados ${h1Count}.` });
  return errors;
};
