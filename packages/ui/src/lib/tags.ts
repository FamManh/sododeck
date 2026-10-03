/**
 * The identity of a tag (033, ADR 0022): trimmed, single-spaced and lower-cased, so "PCI", "pci"
 * and " Pci " are one tag. The same one-line rule as `tagKey` in `@sododeck/model` (this package
 * cannot import it); a parity test in the app keeps the two equal.
 */
export function tagKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Tags are trimmed and single-spaced, and keep the case typed ("PCI" stays "PCI", 033). */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().replace(/\s+/g, ' ');
  return tag === '' ? null : tag;
}

/**
 * Adds a tag unless it is empty, one with the same key is already there ("pci" next to "PCI"; the
 * first spelling stays), or `max` tags are already there. Returns the same array when unchanged.
 */
export function addTag(tags: readonly string[], raw: string, max = Infinity): readonly string[] {
  const tag = normalizeTag(raw);
  if (tag === null || tags.length >= max) return tags;
  const key = tagKey(tag);
  if (tags.some((t) => tagKey(t) === key)) return tags;
  return [...tags, tag];
}

/** Removes the tag with this key, keeping the order of the rest. Returns the same array when absent. */
export function removeTag(tags: readonly string[], tag: string): readonly string[] {
  const key = tagKey(tag);
  return tags.some((t) => tagKey(t) === key) ? tags.filter((t) => tagKey(t) !== key) : tags;
}
