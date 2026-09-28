import type { LayoutRequest, LayoutResult } from './elk-layout';

type WorkerResponse =
  { id: number; ok: true; result: LayoutResult } | { id: number; ok: false; error: string };

/** Rejection of a layout stopped by `cancel()` (011 FR-032): the caller changes nothing. */
export class LayoutCancelled extends Error {
  constructor() {
    super('Layout cancelled');
    this.name = 'LayoutCancelled';
  }
}

export interface LayoutClient {
  layout(request: LayoutRequest): Promise<LayoutResult>;
  /** Stops the running layout: terminates the worker; the next `layout()` starts a new one. */
  cancel(): void;
  terminate(): void;
}

/**
 * Main-thread handle to the ELK layout worker (constitution V). The worker, and with it `elkjs`,
 * is loaded on the first `layout()` call only, so it never slows editor start-up.
 */
export function createLayoutClient(
  makeWorker: () => Worker = () =>
    new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' }),
): LayoutClient {
  let worker: Worker | null = null;
  const pending = new Map<
    number,
    { resolve: (r: LayoutResult) => void; reject: (e: Error) => void }
  >();
  let nextId = 0;

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
    // A worker that fails (to load or at run time) must not leave a run waiting forever.
    created.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      stop(() => new Error(`Layout worker failed: ${event.message}`));
    };
    worker = created;
    return created;
  };

  function stop(reason: () => Error): void {
    worker?.terminate();
    worker = null;
    for (const entry of pending.values()) entry.reject(reason());
    pending.clear();
  }

  return {
    layout(request) {
      const id = nextId++;
      const target = start();
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        target.postMessage({ id, request });
      });
    },
    cancel() {
      stop(() => new LayoutCancelled());
    },
    terminate() {
      stop(() => new Error('Layout worker terminated'));
    },
  };
}
