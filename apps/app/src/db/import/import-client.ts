/**
 * Main-thread handle to the import worker (044 research R5), same `{id, request}` protocol as
 * `layout-client.ts`. The worker, and the parsers it loads, start on the first call. `cancel()`
 * rejects the pending calls with `ImportCancelled`; their late results are ignored by id. The
 * worker is kept, so the next preview reuses the loaded parser.
 */
import type { Parsers } from './load-parsers';
import type { ImportPlan, ImportPreview, ImportSource, ImportTarget } from './types';

export interface ImportRequest {
  kind: 'preview' | 'plan';
  source: ImportSource;
  target: ImportTarget;
}

type WorkerResponse =
  { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };

/** Rejection of a call stopped by `cancel()`: the caller changes nothing. */
export class ImportCancelled extends Error {
  constructor() {
    super('Import cancelled');
    this.name = 'ImportCancelled';
  }
}

export interface ImportClient {
  preview(source: ImportSource, target: ImportTarget): Promise<ImportPreview>;
  plan(source: ImportSource, target: ImportTarget): Promise<ImportPlan>;
  cancel(): void;
  terminate(): void;
}

export function createImportClient(
  makeWorker: () => Worker = () =>
    new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' }),
): ImportClient {
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
      rejectAll(() => new Error(`Import worker failed: ${event.message}`));
    };
    worker = created;
    return created;
  };

  const call = <T>(request: ImportRequest) => {
    const id = nextId++;
    const target = start();
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
      target.postMessage({ id, request });
    });
  };

  return {
    preview: (source, target) => call<ImportPreview>({ kind: 'preview', source, target }),
    plan: (source, target) => call<ImportPlan>({ kind: 'plan', source, target }),
    cancel: () => {
      rejectAll(() => new ImportCancelled());
    },
    terminate: () => {
      worker?.terminate();
      worker = null;
      rejectAll(() => new Error('Import worker terminated'));
    },
  };
}

/** Same contract on the main thread: for tests and browsers without module workers. */
export function createInlineImportClient(): ImportClient {
  let generation = 0;
  let parsers: Promise<Parsers> | null = null;
  const run = async (source: ImportSource, target: ImportTarget) => {
    const mine = generation;
    parsers ??= import('./load-parsers').then((m) => m.createParsers());
    const [{ runImport }, loaded] = await Promise.all([import('./pipeline'), parsers]);
    const result = await runImport(source, target, loaded);
    if (mine !== generation) throw new ImportCancelled();
    return result;
  };
  return {
    preview: async (source, target) => (await run(source, target)).preview,
    plan: async (source, target) => (await run(source, target)).plan,
    cancel: () => {
      generation++;
    },
    terminate: () => {
      generation++;
    },
  };
}
