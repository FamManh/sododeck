/** Parses #rgb or #rrggbb into 0–255 channels. */
function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  const digits = match?.[1];
  if (digits === undefined) throw new Error(`Not a hex color: ${hex}`);
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2.1 relative luminance (0 black to 1 white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two hex colors (1 to 21, order does not matter). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

const CARD_TEXT_DARK = '#1c1c1a';
const CARD_TEXT_LIGHT = '#ffffff';

/**
 * Picks whichever of dark or light text gives the higher contrast against a custom card fill
 * (R6, FR-033): the switch happens near relative luminance 0.204. `readable` is false for the
 * ≈ 0.183–0.227 band where neither choice reaches WCAG AA (4.5:1); the colour is still allowed
 * there (FR-026), but the caller should show a warning.
 */
export function readableText(hex: string): {
  text: 'dark' | 'light';
  ratio: number;
  readable: boolean;
} {
  const darkRatio = contrastRatio(hex, CARD_TEXT_DARK);
  const lightRatio = contrastRatio(hex, CARD_TEXT_LIGHT);
  const text = darkRatio >= lightRatio ? 'dark' : 'light';
  const ratio = Math.max(darkRatio, lightRatio);
  return { text, ratio, readable: ratio >= 4.5 };
}
