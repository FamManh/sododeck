import { afterEach, describe, expect, it, vi } from 'vitest';

import { canvasToBlob, sourceSize } from './image-ops';

// A worker has no DOM classes: `instanceof HTMLImageElement` would throw there (ReferenceError).
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('image-ops without DOM globals (worker)', () => {
  it('sourceSize reads an ImageBitmap-like source', () => {
    vi.stubGlobal('HTMLImageElement', undefined);
    expect(sourceSize({ width: 30, height: 20, close: () => undefined })).toEqual({
      width: 30,
      height: 20,
    });
  });

  it('sourceSize reads the natural size of an image element', () => {
    expect(sourceSize({ naturalWidth: 7, naturalHeight: 5 } as HTMLImageElement)).toEqual({
      width: 7,
      height: 5,
    });
  });

  it('canvasToBlob encodes an OffscreenCanvas-like canvas', async () => {
    vi.stubGlobal('HTMLCanvasElement', undefined);
    const blob = new Blob(['x'], { type: 'image/webp' });
    const canvas = { convertToBlob: vi.fn().mockResolvedValue(blob) } as unknown as OffscreenCanvas;
    await expect(canvasToBlob(canvas, 'image/webp', 0.9)).resolves.toBe(blob);
  });
});
