import type { MermaidImport } from '../import-mermaid/import-mermaid';
import type { DeckSummary } from './deck-summary';
import type { ImportedDeck } from './library-ops';
import { LibraryClientError } from './library-client-error';
import type {
  LibraryRequest,
  LibraryResult,
  LibraryWorkerResponse,
} from './library-worker-protocol';

export { LibraryClientError };

export interface LibraryClient {
  create(name: string): Promise<{ bytes: Uint8Array; summary: DeckSummary }>;
  /** `name` is the file name the problem reports carry (062). */
  importFile(text: string, name?: string): Promise<ImportedDeck>;
  /** Mermaid text → deck file and report (056); flowcharts still need a layout. */
  importMermaid(text: string): Promise<MermaidImport>;
  exportDeck(
    updates: Uint8Array[],
    pictures?: Map<string, Uint8Array>,
    format?: 'json' | 'markdown',
  ): Promise<{ json: string; name: string }>;
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
    else {
      const { code, message, report } = response.error;
      entry.reject(new LibraryClientError(code, message, report));
    }
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
    importFile: (text, name) =>
      send({ op: 'import', text, ...(name === undefined ? {} : { name }) }),
    importMermaid: (text) => send({ op: 'importMermaid', text }),
    exportDeck: (updates, pictures, format) =>
      send({ op: 'export', updates, pictures, ...(format === undefined ? {} : { format }) }),
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
