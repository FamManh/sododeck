import { MAX_LONG_EDGE } from './limits';

export interface PixelSize {
  width: number;
  height: number;
}

/**
 * The size a picture is stored at: the long edge scaled to `max`, aspect ratio kept (rounded,
 * never below 1 px), never upscaled. `scaled` tells whether a re-encode is needed.
 */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_LONG_EDGE,
): PixelSize & { scaled: boolean } {
  const longEdge = Math.max(width, height);
  if (longEdge <= max) return { width, height, scaled: false };
  const ratio = max / longEdge;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true,
  };
}

/** Keeps the original when re-encoding did not make it smaller. */
export function chooseSmaller<T extends { bytes: Uint8Array }>(original: T, candidate: T): T {
  return candidate.bytes.length < original.bytes.length ? candidate : original;
}
