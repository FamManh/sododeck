import {
  create,
  duplicate,
  exportDeck,
  importFile,
  importMermaid,
  LibraryOpError,
  rename,
} from './library-ops';
import type {
  LibraryRequest,
  LibraryResult,
  LibraryWorkerResponse,
} from './library-worker-protocol';

function run(request: LibraryRequest): LibraryResult {
  switch (request.op) {
    case 'create':
      return { op: 'create', ...create(request.name) };
    case 'import':
      return { op: 'import', ...importFile(request.text) };
    case 'importMermaid':
      return { op: 'importMermaid', ...importMermaid(request.text) };
    case 'export':
      return { op: 'export', ...exportDeck(request.updates, request.pictures) };
    case 'rename':
      return { op: 'rename', ...rename(request.updates, request.name) };
    case 'duplicate':
      return { op: 'duplicate', ...duplicate(request.updates, request.name) };
  }
}

self.onmessage = (event: MessageEvent<{ id: number; request: LibraryRequest }>) => {
  const { id, request } = event.data;
  let response: LibraryWorkerResponse;
  try {
    response = { id, ok: true, result: run(request) };
  } catch (error) {
    response = {
      id,
      ok: false,
      error:
        error instanceof LibraryOpError
          ? { code: error.code, message: error.message }
          : { code: 'failed', message: String(error) },
    };
  }
  const result = response.ok ? response.result : undefined;
  const bytes =
    result && 'bytes' in result
      ? result.bytes
      : result && 'delta' in result
        ? result.delta
        : undefined;
  self.postMessage(response, { transfer: bytes ? [bytes.buffer] : [] });
};
