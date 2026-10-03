/**
 * The identity of a tag (033, ADR 0022): trimmed, single-spaced and lower-cased, so "PCI", "pci"
 * and " Pci " are one tag. The same one-line rule as `tagKey` in `@sododeck/model` (this package
 * cannot import it); a parity test in the app keeps the two equal.
 */
export function tagKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

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
