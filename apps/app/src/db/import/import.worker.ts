/**
 * The import worker (044 research R5): parsing and mapping off the main thread. Parsers load on
 * first need and stay for the worker's life.
 */
import { createParsers } from './load-parsers';
import { runImport } from './pipeline';
import type { ImportRequest } from './import-client';

const parsers = createParsers();

self.onmessage = async (event: MessageEvent<{ id: number; request: ImportRequest }>) => {
  const { id, request } = event.data;
  try {
    const { plan, preview } = await runImport(request.source, request.target, parsers);
    self.postMessage({ id, ok: true, result: request.kind === 'plan' ? plan : preview });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
