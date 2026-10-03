/**
 * The identity of a tag (033, ADR 0022): a tag is its text, matched with case and spacing
 * ignored, so "PCI", "pci" and " Pci " are one tag while the text keeps the case it was typed in.
 * `@sododeck/ui` carries the same one-line rule (it cannot import this package); a parity test in
 * the app keeps the two equal. Accents are left alone on purpose: "café" and "cafe" are two tags.
 */
export function tagKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** True when both texts are the same tag. */
export function sameTag(a: string, b: string): boolean {
  return tagKey(a) === tagKey(b);
}

/**
 * A fixed order over tag texts: by key, then by spelling (code units, not locale, so every
 * replica and every machine sorts alike). Equal keys cannot both be stored (S8); the spelling
 * only keeps the order total.
 */
export function compareTags(a: string, b: string): number {
  const keyA = tagKey(a);
  const keyB = tagKey(b);
  if (keyA !== keyB) return keyA < keyB ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}
