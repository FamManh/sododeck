/**
 * Main-thread handle to the picture worker (055 R5), same `{id, request}` protocol and lifecycle
 * as `db/import/import-client.ts`. It implements the ingest ports, so `ingestImage(input, client)`
 * runs the pipeline with the heavy steps in the worker. `cancel()` rejects the pending calls with
 * `ImageCancelled`; late replies are dropped by id. Without workers, `OffscreenCanvas`,
 * `createImageBitmap` or `crypto.subtle`, `createImageClient()` returns the inline client, which
 * runs the same operations on the main thread.
 */
import {
  supportsCreateImageBitmap,
  supportsCryptoSubtle,
  supportsOffscreenCanvas,
  supportsWorkers,
} from '../lib/features';
import type { PixelSize } from './fit-within';
import { createBrowserOps } from './image-ops';
import type { IngestPorts } from './ingest';
import type { ImageType } from './limits';

export type ImageRequest =
  | { kind: 'decode'; bytes: Uint8Array; type: ImageType }
  | { kind: 'encode'; bytes: Uint8Array; type: ImageType; size: PixelSize; outputType?: ImageType }
  | { kind: 'digest'; bytes: Uint8Array };

type WorkerResponse =
  { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };

/** Rejection of a call stopped by `cancel()`: the caller adds nothing. */
export class ImageCancelled extends Error {
  constructor() {
    super('Image processing cancelled');
    this.name = 'ImageCancelled';
  }
}

export interface ImageClient extends IngestPorts {
  cancel: () => void;
  terminate: () => void;
}

export function createWorkerImageClient(
  makeWorker: () => Worker = () =>
    new Worker(new URL('./image-worker.ts', import.meta.url), { type: 'module' }),
): ImageClient {
  let worker: Worker | null = null;
  const pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
  let nextId = 0;

  const rejectAll = (reason: () => Error) => {
    for (const entry of pending.values()) entry.reject(reason());
    pending.clear();
  };

  const start = (): Worker => {
    if (worker !== null) return worker;
    const created = makeWorker();
    created.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return;
      pending.delete(response.id);
      if (response.ok) entry.resolve(response.result);
      else entry.reject(new Error(response.error));
    };
    created.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      worker?.terminate();
      worker = null;
      rejectAll(() => new Error(`Image worker failed: ${event.message}`));
    };
    worker = created;
    return created;
  };

  const call = <T>(request: ImageRequest) => {
    const id = nextId++;
    const target = start();
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
      target.postMessage({ id, request });
    });
  };

  return {
    decode: (bytes, type) => call({ kind: 'decode', bytes, type }),
    encode: (bytes, type, size, outputType) =>
      call({ kind: 'encode', bytes, type, size, ...(outputType ? { outputType } : {}) }),
    digest: (bytes) => call({ kind: 'digest', bytes }),
    cancel: () => {
      rejectAll(() => new ImageCancelled());
    },
    terminate: () => {
      worker?.terminate();
      worker = null;
      rejectAll(() => new Error('Image worker terminated'));
    },
  };
}

/** Same contract on the main thread: for browsers without module workers, and for tests. */
export function createInlineImageClient(ops: IngestPorts = createBrowserOps()): ImageClient {
  let generation = 0;
  const guard =
    <A extends unknown[], R>(run: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const mine = generation;
      const result = await run(...args);
      if (mine !== generation) throw new ImageCancelled();
      return result;
    };
  return {
    decode: guard(ops.decode),
    encode: guard(ops.encode),
    digest: guard(ops.digest),
    cancel: () => {
      generation++;
    },
    terminate: () => {
      generation++;
    },
  };
}

/** The worker client where the browser can run it, else the inline one. */
export function createImageClient(): ImageClient {
  const canUseWorker =
    supportsWorkers() &&
    supportsOffscreenCanvas() &&
    supportsCreateImageBitmap() &&
    supportsCryptoSubtle();
  return canUseWorker ? createWorkerImageClient() : createInlineImageClient();
}
