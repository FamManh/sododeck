import type { DeckSummary } from './deck-summary';
import type { MermaidImport } from '../import-mermaid/import-mermaid';
import type { LibraryOpErrorCode } from './library-ops';

/** Messages between `library-client.ts` and `library.worker.ts` (contracts/storage-api.md). */
export type LibraryRequest =
  | { op: 'create'; name: string }
  | { op: 'import'; text: string }
  | { op: 'importMermaid'; text: string }
  | { op: 'export'; updates: Uint8Array[] }
  | { op: 'rename'; updates: Uint8Array[]; name: string }
  | { op: 'duplicate'; updates: Uint8Array[]; name: string };

export type LibraryResult =
  | { op: 'create' | 'import' | 'duplicate'; bytes: Uint8Array; summary: DeckSummary }
  | { op: 'rename'; delta: Uint8Array; summary: DeckSummary }
  | { op: 'export'; json: string; name: string }
  | ({ op: 'importMermaid' } & MermaidImport);

export type LibraryWorkerResponse =
  | { id: number; ok: true; result: LibraryResult }
  | { id: number; ok: false; error: { code: LibraryOpErrorCode | 'failed'; message: string } };
