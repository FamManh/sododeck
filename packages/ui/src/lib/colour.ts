/** An HSV colour: hue in [0, 360), saturation and value in [0, 1]. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const HEX_6 = /^#?([0-9a-f]{6})$/i;

/**
 * Normalizes a hex colour: accepts a leading `#` or not, requires exactly 6 hex digits, and
 * lower-cases the result. Returns `null` for anything else (3-digit shorthand, invalid text,
 * empty string) — see T016.
 */
export function normalizeHex(value: string): string | null {
  const match = HEX_6.exec(value.trim());
  const digits = match?.[1];
  return digits === undefined ? null : `#${digits.toLowerCase()}`;
}

/** Converts a normalized 6-digit hex colour to HSV. */
export function hexToHsv(hex: string): Hsv {
  const digits = normalizeHex(hex);
  if (digits === null) throw new Error(`Not a hex color: ${hex}`);
  const r = parseInt(digits.slice(1, 3), 16) / 255;
  const g = parseInt(digits.slice(3, 5), 16) / 255;
  const b = parseInt(digits.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
}

/** Converts HSV back to a normalized 6-digit hex colour. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  const segment = Math.floor(h / 60) % 6;
  const rgbBySegment: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = rgbBySegment[segment] ?? [0, 0, 0];

  const toByte = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}
