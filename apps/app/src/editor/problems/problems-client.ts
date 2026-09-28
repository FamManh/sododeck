import { checkDeck, type DeckProblems } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

type WorkerResponse =
  { id: number; ok: true; result: DeckProblems } | { id: number; ok: false; error: string };

export interface ProblemsClient {
  check: (file: SododeckFile) => Promise<DeckProblems>;
  terminate: () => void;
}

/**
 * Main-thread handle to the problems worker (015 research R4). Started on the first check; a
 * failing worker rejects its pending checks and the next check starts a new one.
 */
export function createProblemsClient(
  makeWorker: () => Worker = () =>
    new Worker(new URL('./problems.worker.ts', import.meta.url), { type: 'module' }),
): ProblemsClient {
  let worker: Worker | null = null;
  const pending = new Map<
    number,
    { resolve: (r: DeckProblems) => void; reject: (e: Error) => void }
  >();
  let nextId = 0;

  function stop(reason: () => Error): void {
    worker?.terminate();
    worker = null;
    for (const entry of pending.values()) entry.reject(reason());
    pending.clear();
  }

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
      stop(() => new Error(`Problems worker failed: ${event.message}`));
    };
    worker = created;
    return created;
  };

  return {
    check: (file) => {
      const id = nextId++;
      const target = start();
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        target.postMessage({ id, file });
      });
    },
    terminate: () => {
      stop(() => new Error('Problems worker terminated'));
    },
  };
}

/** Same contract, checked in-process: for tests and environments without workers. */
export function createInlineProblemsClient(): ProblemsClient {
  return {
    check: (file) => Promise.resolve(checkDeck(file)),
    terminate: () => undefined,
  };
}
