import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createImageClient,
  createInlineImageClient,
  createWorkerImageClient,
  ImageCancelled,
  type ImageRequest,
} from './image-client';
import type { IngestPorts } from './ingest';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: { id: number; request: ImageRequest }[] = [];
  terminated = false;
  postMessage(message: { id: number; request: ImageRequest }) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(id: number, result: unknown) {
    this.onmessage?.({ data: { id, ok: true, result } } as MessageEvent);
  }
  fail(id: number, error: string) {
    this.onmessage?.({ data: { id, ok: false, error } } as MessageEvent);
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const client = createWorkerImageClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  });
  return { client, workers };
}

const bytes = new Uint8Array([1, 2, 3]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createWorkerImageClient', () => {
  it('starts the worker on the first call and resolves each call by id', async () => {
    const { client, workers } = setup();
    expect(workers).toHaveLength(0);
    const decoded = client.decode(bytes, 'image/png');
    const hashed = client.digest(bytes);
    expect(workers).toHaveLength(1);
    const worker = workers[0];
    expect(worker?.posted.map((m) => m.request.kind)).toEqual(['decode', 'digest']);
    worker?.reply(1, 'abc');
    worker?.reply(0, { width: 3, height: 2 });
    expect(await decoded).toEqual({ width: 3, height: 2 });
    expect(await hashed).toBe('abc');
  });

  it('sends the output type only when it is set', () => {
    const { client, workers } = setup();
    void client.encode(bytes, 'image/png', { width: 1, height: 1 });
    void client.encode(bytes, 'image/avif', { width: 1, height: 1 }, 'image/webp');
    const requests = workers[0]?.posted.map((m) => m.request);
    expect(requests?.[0]).not.toHaveProperty('outputType');
    expect(requests?.[1]).toMatchObject({ outputType: 'image/webp' });
  });

  it('rejects a call the worker answers with an error', async () => {
    const { client, workers } = setup();
    const call = client.digest(bytes);
    workers[0]?.fail(0, 'boom');
    await expect(call).rejects.toThrow('boom');
  });

  it('rejects every pending call when the worker errors and starts a new one next time', async () => {
    const { client, workers } = setup();
    const a = client.digest(bytes);
    const b = client.decode(bytes, 'image/png');
    workers[0]?.onerror?.({ message: 'crash', preventDefault: vi.fn() } as unknown as ErrorEvent);
    await expect(a).rejects.toThrow('Image worker failed: crash');
    await expect(b).rejects.toThrow('Image worker failed');
    expect(workers[0]?.terminated).toBe(true);
    void client.digest(bytes);
    expect(workers).toHaveLength(2);
  });

  it('cancel rejects pending calls and ignores their late replies', async () => {
    const { client, workers } = setup();
    const call = client.digest(bytes);
    client.cancel();
    await expect(call).rejects.toBeInstanceOf(ImageCancelled);
    expect(() => workers[0]?.reply(0, 'late')).not.toThrow();
    const next = client.digest(bytes);
    workers[0]?.reply(1, 'fresh');
    expect(await next).toBe('fresh');
  });

  it('terminate stops the worker and rejects what is pending', async () => {
    const { client, workers } = setup();
    const call = client.digest(bytes);
    client.terminate();
    await expect(call).rejects.toThrow('Image worker terminated');
    expect(workers[0]?.terminated).toBe(true);
  });
});

describe('createInlineImageClient', () => {
  const ops: IngestPorts = {
    decode: () => Promise.resolve({ width: 4, height: 3 }),
    encode: (b, type) => Promise.resolve({ bytes: b, type }),
    digest: () => Promise.resolve('inline-hash'),
  };

  it('runs the operations on the calling thread', async () => {
    const client = createInlineImageClient(ops);
    expect(await client.decode(bytes, 'image/png')).toEqual({ width: 4, height: 3 });
    expect(await client.digest(bytes)).toBe('inline-hash');
    expect(await client.encode(bytes, 'image/png', { width: 1, height: 1 })).toEqual({
      bytes,
      type: 'image/png',
    });
  });

  it('cancel drops the result of a call still running', async () => {
    let finish: (hash: string) => void = () => undefined;
    const slow: IngestPorts = {
      ...ops,
      digest: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    };
    const client = createInlineImageClient(slow);
    const call = client.digest(bytes);
    client.cancel();
    finish('late');
    await expect(call).rejects.toBeInstanceOf(ImageCancelled);
    expect(await createInlineImageClient(ops).digest(bytes)).toBe('inline-hash');
  });
});

describe('createImageClient', () => {
  it('falls back to the inline client when the browser cannot run the worker path', () => {
    // jsdom has no OffscreenCanvas or Worker: the inline client is returned and never throws.
    vi.stubGlobal('Worker', undefined);
    const client = createImageClient();
    expect(typeof client.decode).toBe('function');
    expect(() => {
      client.cancel();
    }).not.toThrow();
  });
});
