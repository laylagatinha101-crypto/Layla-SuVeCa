const technicalReferencePatterns = [
  /\[(?:PASSAGE|QUESTION|KB|EDITORIAL|CORPUS):[^\]]+\]/gi,
  /\b(?:PASSAGE|QUESTION|KB|EDITORIAL|CORPUS):[a-z0-9._:#/-]+\b/gi,
];

/**
 * Final safety boundary for learner-facing AI content. Prompts and structured
 * responses keep provenance out of prose; this also protects the UI if a
 * provider returns an internal identifier despite that contract.
 */
export const toLearnerFacingContent = (value: unknown) => {
  let content = typeof value === 'string' ? value : '';
  for (const pattern of technicalReferencePatterns) {
    content = content.replace(pattern, '');
  }
  return content
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
};

export const containsTechnicalReference = (value: unknown) =>
  /\[(?:PASSAGE|QUESTION|KB|EDITORIAL|CORPUS):|\b(?:PASSAGE|QUESTION|KB|EDITORIAL|CORPUS):/i.test(
    typeof value === 'string' ? value : '',
  );
