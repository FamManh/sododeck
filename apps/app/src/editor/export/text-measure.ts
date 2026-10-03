export type TextMeasurer = (text: string, font: string) => number;

export function graphemes(text: string): string[] {
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(
    (part) => part.segment,
  );
}

export function fixedWidthMeasurer(emRatio = 0.6): TextMeasurer {
  return (text, font) => {
    const size = Number.parseFloat(font.match(/\d+(?:\.\d+)?px/)?.[0] ?? '12');
    return graphemes(text).length * size * emRatio;
  };
}

export function canvasMeasurer(): TextMeasurer | null {
  if (typeof document === 'undefined') return null;
  const context = document.createElement('canvas').getContext('2d');
  if (context === null) return null;
  const cache = new Map<string, number>();
  return (text, font) => {
    const key = `${font}\u0000${text}`;
    const previous = cache.get(key);
    if (previous !== undefined) return previous;
    context.font = font;
    const width = context.measureText(text).width;
    cache.set(key, width);
    return width;
  };
}

export function truncate(
  text: string,
  font: string,
  maxWidth: number,
  measure: TextMeasurer,
): string {
  if (measure(text, font) <= maxWidth) return text;
  const parts = graphemes(text);
  if (parts.length === 0) return '';
  let low = 0;
  let high = parts.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measure(`${parts.slice(0, middle).join('')}…`, font) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${parts.slice(0, low).join('')}…`;
}
