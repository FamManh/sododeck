import type { PngScale } from './types';

export const MAX_CANVAS_SIDE = 16_384;
export const MAX_CANVAS_AREA = 16_777_216;

export function pngSize(bounds: { width: number; height: number }, scale: PngScale) {
  return { width: Math.ceil(bounds.width) * scale, height: Math.ceil(bounds.height) * scale };
}

export function scaleAllowed(bounds: { width: number; height: number }, scale: PngScale): boolean {
  const { width, height } = pngSize(bounds, scale);
  return (
    width > 0 &&
    height > 0 &&
    width <= MAX_CANVAS_SIDE &&
    height <= MAX_CANVAS_SIDE &&
    width * height <= MAX_CANVAS_AREA
  );
}

export function largestScale(bounds: { width: number; height: number }): PngScale | null {
  for (const scale of [3, 2, 1] as const) if (scaleAllowed(bounds, scale)) return scale;
  return null;
}
