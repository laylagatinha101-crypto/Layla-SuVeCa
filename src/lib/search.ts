import type { ModuleData } from '../types/suveca';

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export interface SearchSnippet {
  text: string;
  matched: boolean;
}

interface NormalizedText {
  value: string;
  positions: Array<{ start: number; end: number }>;
}

/**
 * Normalizes Portuguese text without losing the original indexes used to render
 * the highlighted result. This lets "concordancia" find "concordância".
 */
const normalizeWithPositions = (value: string): NormalizedText => {
  let normalized = '';
  const positions: NormalizedText['positions'] = [];

  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) break;

    const character = String.fromCodePoint(codePoint);
    const compact = character
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');

    for (const normalizedCharacter of compact) {
      normalized += normalizedCharacter;
      positions.push({ start: index, end: index + character.length });
    }
    index += character.length;
  }

  return { value: normalized, positions };
};

export const normalizeSearchText = (value: string) => normalizeWithPositions(value).value;

export const hasSearchMatch = (value: string, query: string) => {
  const normalizedQuery = normalizeSearchText(query.trim());
  return normalizedQuery.length === 0 || normalizeSearchText(value).includes(normalizedQuery);
};

export const getHighlightedSegments = (value: string, query: string): HighlightSegment[] => {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return [{ text: value, matched: false }];

  const normalizedValue = normalizeWithPositions(value);
  const ranges: Array<{ start: number; end: number }> = [];
  let searchFrom = 0;

  while (searchFrom < normalizedValue.value.length) {
    const normalizedIndex = normalizedValue.value.indexOf(normalizedQuery, searchFrom);
    if (normalizedIndex === -1) break;

    const first = normalizedValue.positions[normalizedIndex];
    const last = normalizedValue.positions[normalizedIndex + normalizedQuery.length - 1];
    if (!first || !last) break;

    ranges.push({ start: first.start, end: last.end });
    searchFrom = normalizedIndex + normalizedQuery.length;
  }

  if (!ranges.length) return [{ text: value, matched: false }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  ranges.forEach((range) => {
    if (range.start > cursor) {
      segments.push({ text: value.slice(cursor, range.start), matched: false });
    }
    segments.push({ text: value.slice(range.start, range.end), matched: true });
    cursor = range.end;
  });
  if (cursor < value.length) segments.push({ text: value.slice(cursor), matched: false });

  return segments;
};

const toPlainText = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?(?:\[([^\]]*)\])\([^)]*\)/g, '$1')
    .replace(/[*_~>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clipAroundMatch = (text: string, query: string, maxLength: number): SearchSnippet => {
  const segments = getHighlightedSegments(text, query);
  let offset = 0;
  let firstMatchOffset: number | null = null;
  for (const segment of segments) {
    if (segment.matched) {
      firstMatchOffset = offset;
      break;
    }
    offset += segment.text.length;
  }

  if (firstMatchOffset === null || text.length <= maxLength) {
    return { text, matched: firstMatchOffset !== null };
  }

  const leftRoom = Math.floor(maxLength * 0.38);
  let start = Math.max(0, firstMatchOffset - leftRoom);
  let end = Math.min(text.length, start + maxLength);
  if (end - start < maxLength) start = Math.max(0, end - maxLength);

  // Prefer complete words at each clipping boundary.
  if (start > 0) {
    const nextSpace = text.indexOf(' ', start);
    start = nextSpace === -1 ? start : nextSpace + 1;
  }
  if (end < text.length) {
    const previousSpace = text.lastIndexOf(' ', end);
    end = previousSpace > start ? previousSpace : end;
  }

  return {
    text: `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`,
    matched: true,
  };
};

export const moduleMatchesSearch = (module: ModuleData, query: string) => {
  if (!query.trim()) return true;
  const searchableText = [
    module.title,
    module.subtitle,
    module.description,
    ...module.sections.flatMap((section) => [
      section.title,
      section.contentMarkdown,
      ...(section.searchTerms || []),
      ...(section.sourceConceptIds || []),
      ...(section.limitsAndExceptions || []),
      ...(section.contrasts || []),
      ...(section.examTraps || []),
    ]),
  ];
  return searchableText.some((text) => hasSearchMatch(text, query));
};

export const getModuleSearchSnippet = (
  module: ModuleData,
  query: string,
  maxLength = 180
): SearchSnippet => {
  const candidates = [
    module.subtitle,
    module.description,
    ...module.sections.flatMap((section) => [
      section.title,
      section.summary || '',
      toPlainText(section.contentMarkdown),
      ...(section.searchTerms || []),
    ]),
  ];
  const matchingCandidate = candidates.find((candidate) => hasSearchMatch(candidate, query));

  if (matchingCandidate) return clipAroundMatch(matchingCandidate, query, maxLength);

  return clipAroundMatch(module.description || module.subtitle, query, maxLength);
};
