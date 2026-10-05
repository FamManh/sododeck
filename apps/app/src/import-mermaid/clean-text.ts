/**
 * Label text from Mermaid source (FR-019): plain text only. Line breaks become newlines, other
 * tags are dropped, common entities decoded. Nothing here ever produces markup.
 */
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]+));/gi, (match, dec, hex, name) => {
    if (typeof name === 'string') return ENTITIES[name.toLowerCase()] ?? match;
    const code = typeof dec === 'string' ? Number(dec) : Number.parseInt(String(hex), 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

export function cleanLabel(raw: string): string {
  let text = raw.trim();
  const quoted = /^"([\s\S]*)"$/.exec(text);
  if (quoted) text = quoted[1] ?? '';
  text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[a-z][^>]*>/gi, '');
  // Entities last: `&lt;script&gt;` must stay the visible text "<script>", not be stripped.
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}
