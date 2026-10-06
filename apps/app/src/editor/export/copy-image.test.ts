import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { copyImage } from './copy-image';
import { rasterize } from './rasterize';

vi.mock('./rasterize', () => ({ rasterize: vi.fn() }));

const IMAGE = { svg: '<svg>x</svg>', bounds: { width: 10, height: 5 } };

class FakeItem {
  static supports?: (type: string) => boolean;
  constructor(readonly items: Record<string, Promise<Blob>>) {}
}

function stub(supportsSvg: boolean | undefined) {
  const write = vi.fn().mockResolvedValue(undefined);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { write, writeText },
    configurable: true,
  });
  FakeItem.supports =
    supportsSvg === undefined ? undefined : (type) => type !== 'image/svg+xml' || supportsSvg;
  vi.stubGlobal('ClipboardItem', FakeItem);
  return { write, writeText };
}

const written = (write: ReturnType<typeof vi.fn>) => {
  const [items] = write.mock.calls[0] as [FakeItem[]];
  return items[0]?.items ?? {};
};

beforeEach(() => {
  vi.mocked(rasterize).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('copyImage', () => {
  it('writes a PNG item rasterised at the scale', async () => {
    const { write } = stub(true);
    await expect(copyImage('png', Promise.resolve(IMAGE), 3)).resolves.toBe(true);
    const items = written(write);
    expect(Object.keys(items)).toEqual(['image/png']);
    expect((await items['image/png'])?.type).toBe('image/png');
    expect(rasterize).toHaveBeenCalledWith(IMAGE.svg, IMAGE.bounds, 3);
  });

  it('writes SVG as text/plain and image/svg+xml in one item where supported', async () => {
    const { write } = stub(true);
    await expect(copyImage('svg', Promise.resolve(IMAGE))).resolves.toBe(true);
    const items = written(write);
    expect(Object.keys(items)).toEqual(['text/plain', 'image/svg+xml']);
    expect(await (await items['image/svg+xml'])?.text()).toBe(IMAGE.svg);
  });

  it('writes SVG as text/plain only when image/svg+xml is not supported', async () => {
    const { write } = stub(false);
    await copyImage('svg', Promise.resolve(IMAGE));
    expect(Object.keys(written(write))).toEqual(['text/plain']);
  });

  it('falls back to plain text without clipboard items', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(copyImage('svg', Promise.resolve(IMAGE))).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(IMAGE.svg);
  });

  it('resolves false when the PNG cannot be copied', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await expect(copyImage('png', Promise.resolve(IMAGE))).resolves.toBe(false);
    const { write } = stub(true);
    write.mockRejectedValueOnce(new Error('denied'));
    await expect(copyImage('png', Promise.reject(new Error('empty')))).resolves.toBe(false);
  });
});
