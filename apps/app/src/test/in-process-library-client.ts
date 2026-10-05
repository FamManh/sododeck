import type { LibraryClient } from '../storage/library-client';
import { LibraryClientError } from '../storage/library-client-error';
import * as ops from '../storage/library-ops';

function run<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (error) {
    return Promise.reject(
      error instanceof ops.LibraryOpError
        ? new LibraryClientError(error.code, error.message)
        : (error as Error),
    );
  }
}

/** The library worker's operations, run in the test's thread (jsdom has no Worker). */
export function inProcessLibraryClient(): LibraryClient {
  return {
    create: (name) => run(() => ops.create(name)),
    importFile: (text) => run(() => ops.importFile(text)),
    importMermaid: (text) => run(() => ops.importMermaid(text)),
    exportDeck: (updates) => run(() => ops.exportDeck(updates)),
    rename: (updates, name) => run(() => ops.rename(updates, name)),
    duplicate: (updates, name) => run(() => ops.duplicate(updates, name)),
    terminate: () => undefined,
  };
}
