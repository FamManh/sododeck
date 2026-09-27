import type { DeckSummary } from './deck-summary';
import type { LibraryOpErrorCode } from './library-ops';
import type {
  LibraryRequest,
  LibraryResult,
  LibraryWorkerResponse,
} from './library-worker-protocol';

/** A failed library operation, with the reason the UI turns into a message. */
export class LibraryClientError extends Error {
  constructor(
    readonly code: LibraryOpErrorCode | 'failed',
    message: string,
  ) {
    super(message);
    this.name = 'LibraryClientError';
  }
}

export interface LibraryClient {
  create(name: string): Promise<{ bytes: Uint8Array; summary: DeckSummary }>;
  importFile(text: string): Promise<{ bytes: Uint8Array; summary: DeckSummary }>;
  exportDeck(updates: Uint8Array[]): Promise<{ json: string; name: string }>;
  rename(updates: Uint8Array[], name: string): Promise<{ delta: Uint8Array; summary: DeckSummary }>;
  duplicate(
    updates: Uint8Array[],
    name: string,
  ): Promise<{ bytes: Uint8Array; summary: DeckSummary }>;
  terminate(): void;
}

type ResultOf<O extends LibraryResult['op']> = Extract<LibraryResult, { op: O }>;

/**
 * Main-thread handle to the library worker (research R7), same request/response pattern as the
 * layout client. Imports, exports, renames and duplicates run off the main thread.
 */
export function createLibraryClient(): LibraryClient {
  const worker = new Worker(new URL('./library.worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<
    number,
    { resolve: (r: LibraryResult) => void; reject: (e: Error) => void }
  >();
  let nextId = 0;

  worker.onmessage = (event: MessageEvent<LibraryWorkerResponse>) => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) entry.resolve(response.result);
    else entry.reject(new LibraryClientError(response.error.code, response.error.message));
  };

  const send = <O extends LibraryResult['op']>(
    request: LibraryRequest & { op: O },
  ): Promise<ResultOf<O>> => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve: resolve as (r: LibraryResult) => void, reject });
      worker.postMessage({ id, request });
    });
  };

  return {
    create: (name) => send({ op: 'create', name }),
    importFile: (text) => send({ op: 'import', text }),
    exportDeck: (updates) => send({ op: 'export', updates }),
    rename: (updates, name) => send({ op: 'rename', updates, name }),
    duplicate: (updates, name) => send({ op: 'duplicate', updates, name }),
    terminate() {
      worker.terminate();
      for (const entry of pending.values()) {
        entry.reject(new LibraryClientError('failed', 'Library worker terminated'));
      }
      pending.clear();
    },
  };
}

let shared: LibraryClient | undefined;

/** The page's one library worker, started on first use. */
export function getLibraryClient(): LibraryClient {
  shared ??= createLibraryClient();
  return shared;
}
