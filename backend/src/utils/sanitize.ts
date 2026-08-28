import sanitizeHtml from 'sanitize-html';

// All flashcard/deck text fields are plain text, never rich HTML — so the
// safest policy is to strip all tags/attributes entirely. This is the main
// defense against stored XSS via card content (typed manually or imported).
export function stripHtml(value: string | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  const clean = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
  return clean.length ? clean : undefined;
}
