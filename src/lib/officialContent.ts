const BLOCK_TAG = /<\/?(?:address|article|aside|blockquote|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;
const BREAK_TAG = /<br\s*\/?>/gi;
const UNSAFE_CONTENT = /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_TAG = /<[^>]+>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

const decodeEntity = (entity: string, body: string) => {
  if (body.startsWith('#x') || body.startsWith('#X')) {
    const codePoint = Number.parseInt(body.slice(2), 16);
    return Number.isFinite(codePoint) && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;
  }
  if (body.startsWith('#')) {
    const codePoint = Number.parseInt(body.slice(1), 10);
    return Number.isFinite(codePoint) && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;
  }
  return NAMED_ENTITIES[body.toLocaleLowerCase()] ?? entity;
};

/**
 * Produces safe, readable text from the official corpus' HTML fields.
 * The immutable payload remains untouched; this is only a view projection.
 */
export function formatOfficialContent(value: unknown): string {
  return String(value ?? '')
    .replace(UNSAFE_CONTENT, '')
    .replace(BREAK_TAG, '\n')
    .replace(BLOCK_TAG, '\n')
    .replace(HTML_TAG, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, decodeEntity)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

