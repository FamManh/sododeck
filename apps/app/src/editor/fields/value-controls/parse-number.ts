/** Reads a typed number ("1,5" and "1.5" both work); NaN when it is not one. */
export function parseNumber(text: string): number {
  const trimmed = text.trim().replace(',', '.');
  return trimmed === '' ? Number.NaN : Number(trimmed);
}
