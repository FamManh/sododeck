import { describe, expect, it } from 'vitest';

import { describeRefusal, ingestImage, type IngestPorts } from './ingest';
import { MAX_INPUT_BYTES, MAX_STORED_BYTES } from './limits';
import { AVIF_2X2, GIF_1X1, PNG_1X1, SVG_BYTES, SVG_TEXT } from './test-pictures';

const bytesOf = (head: Uint8Array, total: number) => {
  const out = new Uint8Array(total);
  out.set(head);
  return out;
};

function ports(over: Partial<IngestPorts> = {}): IngestPorts {
  return {
    decode: () => Promise.resolve({ width: 100, height: 50 }),
    encode: (_bytes, type, _size, outputType) =>
      Promise.resolve({ bytes: new Uint8Array(10), type: outputType ?? type }),
    digest: (bytes) => Promise.resolve(`hash-${String(bytes.length)}-${String(bytes[0])}`),
    ...over,
  };
}

describe('ingestImage refusals', () => {
  it('refuses a type outside the list', async () => {
    const result = await ingestImage(
      { name: 'a.txt', bytes: new TextEncoder().encode('hello') },
      ports(),
    );
    expect(result).toEqual({ ok: false, refusal: { name: 'a.txt', code: 'unsupported-type' } });
  });

  it('refuses a file above 10 MB before decoding', async () => {
    const big = bytesOf(PNG_1X1, MAX_INPUT_BYTES + 1);
    const result = await ingestImage(
      { name: 'big.png', bytes: big },
      ports({
        decode: () => Promise.reject(new Error('must not decode')),
      }),
    );
    expect(result).toEqual({
      ok: false,
      refusal: { name: 'big.png', code: 'too-large', bytes: MAX_INPUT_BYTES + 1 },
    });
  });

  it('refuses a picture the decoder cannot read', async () => {
    const decode = () => Promise.resolve(null);
    expect(await ingestImage({ name: 'x.png', bytes: PNG_1X1 }, ports({ decode }))).toEqual({
      ok: false,
      refusal: { name: 'x.png', code: 'unreadable' },
    });
    const throws = () => Promise.reject(new Error('bad'));
    expect(await ingestImage({ name: 'x.png', bytes: PNG_1X1 }, ports({ decode: throws }))).toEqual(
      {
        ok: false,
        refusal: { name: 'x.png', code: 'unreadable' },
      },
    );
  });

  it('refuses an unsafe SVG', async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>',
    );
    expect(await ingestImage({ name: 'bad.svg', bytes: svg }, ports())).toEqual({
      ok: false,
      refusal: { name: 'bad.svg', code: 'unsafe-svg' },
    });
  });

  it('refuses a picture still over 5 MB after compression', async () => {
    const big = bytesOf(PNG_1X1, MAX_STORED_BYTES + 100);
    const encode = () =>
      Promise.resolve({ bytes: bytesOf(PNG_1X1, MAX_STORED_BYTES + 50), type: 'image/png' });
    const result = await ingestImage({ name: 'huge.png', bytes: big }, ports({ encode }));
    expect(result).toEqual({
      ok: false,
      refusal: { name: 'huge.png', code: 'still-too-large', bytes: MAX_STORED_BYTES + 50 },
    });
  });
});

describe('ingestImage success', () => {
  it('stores a small picture unchanged with its natural size', async () => {
    const result = await ingestImage({ name: 'a.png', bytes: PNG_1X1 }, ports());
    expect(result).toEqual({
      ok: true,
      picture: {
        id: `hash-${String(PNG_1X1.length)}-${String(PNG_1X1[0])}`,
        type: 'image/png',
        bytes: PNG_1X1,
        width: 100,
        height: 50,
        name: 'a.png',
        animated: false,
      },
    });
  });

  it('scales and re-encodes a large raster to a 2048 long edge', async () => {
    const calls: { width: number; height: number; type: string; outputType?: string }[] = [];
    const big = bytesOf(PNG_1X1, 4000);
    const result = await ingestImage(
      { name: 'shot.png', bytes: big },
      ports({
        decode: () => Promise.resolve({ width: 4096, height: 2048 }),
        encode: (_b, type, size, outputType) => {
          calls.push({ ...size, type, outputType });
          return Promise.resolve({ bytes: new Uint8Array(100), type });
        },
      }),
    );
    expect(calls).toEqual([
      { width: 2048, height: 1024, type: 'image/png', outputType: undefined },
    ]);
    expect(
      result.ok && [result.picture.width, result.picture.height, result.picture.bytes.length],
    ).toEqual([2048, 1024, 100]);
  });

  it('keeps the original when scaling does not make it smaller', async () => {
    const big = bytesOf(PNG_1X1, 200);
    const result = await ingestImage(
      { name: 'a.png', bytes: big },
      ports({
        decode: () => Promise.resolve({ width: 3000, height: 3000 }),
        encode: () => Promise.resolve({ bytes: new Uint8Array(500), type: 'image/png' }),
      }),
    );
    expect(result.ok && [result.picture.bytes, result.picture.width]).toEqual([big, 3000]);
  });

  it('re-encodes AVIF as WebP only when it has to scale', async () => {
    const seen: (string | undefined)[] = [];
    const encode: IngestPorts['encode'] = (_b, _t, _s, outputType) => {
      seen.push(outputType);
      return Promise.resolve({ bytes: new Uint8Array(1), type: outputType ?? 'image/avif' });
    };
    const small = await ingestImage({ name: 'a.avif', bytes: AVIF_2X2 }, ports({ encode }));
    expect(seen).toEqual([]);
    expect(small.ok && small.picture.type).toBe('image/avif');

    const large = await ingestImage(
      { name: 'b.avif', bytes: bytesOf(AVIF_2X2, 400) },
      ports({
        encode,
        decode: () => Promise.resolve({ width: 5000, height: 100 }),
      }),
    );
    expect(seen).toEqual(['image/webp']);
    expect(large.ok && large.picture.type).toBe('image/webp');
  });

  it('stores a GIF unchanged and notes whether it is animated', async () => {
    const still = await ingestImage({ name: 'a.gif', bytes: GIF_1X1 }, ports());
    expect(still.ok && [still.picture.type, still.picture.animated]).toEqual(['image/gif', false]);

    const frame = [0x21, 0xf9, 0x04, 0, 0, 0, 0, 0];
    const animated = new Uint8Array([...GIF_1X1, ...frame, ...frame]);
    const result = await ingestImage(
      { name: 'b.gif', bytes: animated },
      ports({
        decode: () => Promise.resolve({ width: 4096, height: 4096 }),
      }),
    );
    expect(result.ok && [result.picture.bytes, result.picture.animated]).toEqual([animated, true]);
  });

  it('stores the cleaned SVG with the size read from it', async () => {
    const result = await ingestImage(
      { name: 'a.svg', bytes: SVG_BYTES },
      ports({
        decode: () => Promise.reject(new Error('svg is not decoded')),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.picture.type).toBe('image/svg+xml');
    expect([result.picture.width, result.picture.height]).toEqual([40, 20]);
    expect(new TextDecoder().decode(result.picture.bytes)).toContain('<rect');
    expect(SVG_TEXT).toContain('<rect');
  });

  it('gives identical inputs identical ids', async () => {
    const a = await ingestImage({ name: 'a.png', bytes: PNG_1X1 }, ports());
    const b = await ingestImage({ name: 'copy of a.png', bytes: PNG_1X1 }, ports());
    expect(a.ok && b.ok && a.picture.id === b.picture.id).toBe(true);
  });
});

describe('describeRefusal', () => {
  it('writes the messages of contracts/ui.md', () => {
    expect(describeRefusal({ name: 'a.bmp', code: 'unsupported-type' })).toBe(
      'a.bmp: type not supported (use PNG, JPEG, WebP, GIF, SVG or AVIF).',
    );
    expect(describeRefusal({ name: 'a.png', code: 'too-large', bytes: 12.4 * 1024 * 1024 })).toBe(
      'a.png: file is 12.4 MB; the limit is 10 MB.',
    );
    expect(
      describeRefusal({ name: 'a.png', code: 'still-too-large', bytes: 6.1 * 1024 * 1024 }),
    ).toBe('a.png: still 6.1 MB after compression; the limit is 5 MB.');
    expect(describeRefusal({ name: 'a.png', code: 'unreadable' })).toBe(
      'a.png: could not read this image.',
    );
    expect(describeRefusal({ name: 'a.svg', code: 'unsafe-svg' })).toBe(
      'a.svg: SVG contains scripts or outside links and was not added.',
    );
  });
});
