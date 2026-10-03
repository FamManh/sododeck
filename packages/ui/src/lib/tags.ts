/** Tags are trimmed, lower-cased and single-spaced, so "PII" and " pii " are one tag. */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  return tag === '' ? null : tag;
}

/**
 * Adds a tag unless it is empty, already present, or `max` tags are already there. Returns the
 * same array when unchanged.
 */
export function addTag(tags: readonly string[], raw: string, max = Infinity): readonly string[] {
  const tag = normalizeTag(raw);
  if (tag === null || tags.includes(tag) || tags.length >= max) return tags;
  return [...tags, tag];
}

/** Removes one tag, keeping the order of the rest. Returns the same array when absent. */
export function removeTag(tags: readonly string[], tag: string): readonly string[] {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : tags;
}
