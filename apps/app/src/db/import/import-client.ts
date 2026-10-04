/**
 * Main-thread handle to the import worker (044 research R5), same `{id, request}` protocol as
 * `layout-client.ts`. The worker, and the parsers it loads, start on the first call. `cancel()`
 * rejects the pending calls with `ImportCancelled`; their late results are ignored by id. The
 * worker is kept, so the next preview reuses the loaded parser.
 */
import type { Parsers } from './load-parsers';
import type { TextProblem } from '../sync/types';
import type { DbmlModule } from './read-dbml';
import type { ImportPlan, ImportPreview, ImportSource, ImportTarget, RawSchema } from './types';

export type ImportRequest =
  | { kind: 'preview' | 'plan'; source: ImportSource; target: ImportTarget }
  /** 046: reads DBML text only (loads `@dbml/parse`, never the SQL parsers). */
  | { kind: 'read-dbml'; text: string };

/** What the code panel gets back for a DBML text (046). */
export interface ReadDbmlResult {
  /** Empty when there are syntax errors. */
  schema: RawSchema;
  /** Every compiler diagnostic with a range. */
  problems: TextProblem[];
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

/**
 * Rejection of a `readDbml` call that a newer `readDbml` call overtook (046, latest wins): the
 * caller ignores it. Its late worker reply is dropped by id.
 */
export class StaleRead extends Error {
  constructor() {
    super('Superseded by a newer read');
    this.name = 'StaleRead';
  }
}

export interface ImportClient {
  readDbml(text: string): Promise<ReadDbmlResult>;
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
  let pendingRead: number | null = null;

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
      if (pendingRead === response.id) pendingRead = null;
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
    if (request.kind === 'read-dbml') {
      // Latest wins: an older read still waiting is stale now.
      if (pendingRead !== null) {
        pending.get(pendingRead)?.reject(new StaleRead());
        pending.delete(pendingRead);
      }
      pendingRead = id;
    }
    const target = start();
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
      target.postMessage({ id, request });
    });
  };

  return {
    readDbml: (text) => call<ReadDbmlResult>({ kind: 'read-dbml', text }),
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
  let readSeq = 0;
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
    readDbml: async (text) => {
      const mine = ++readSeq;
      const gen = generation;
      parsers ??= import('./load-parsers').then((m) => m.createParsers());
      const [{ readDbml }, loaded] = await Promise.all([import('./read-dbml'), parsers]);
      const dbml: DbmlModule = await loaded.dbml();
      const { raw, problems } = readDbml(text, dbml);
      if (mine !== readSeq) throw new StaleRead();
      if (gen !== generation) throw new ImportCancelled();
      return { schema: raw, problems };
    },
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
