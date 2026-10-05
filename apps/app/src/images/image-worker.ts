/**
 * The picture worker (055 R5, constitution V): decode, scale, encode and hash off the main thread.
 * Same `{id, request}` protocol as the import worker.
 */
import { createBrowserOps } from './image-ops';
import type { ImageRequest } from './image-client';

const ops = createBrowserOps();

self.onmessage = async (event: MessageEvent<{ id: number; request: ImageRequest }>) => {
  const { id, request } = event.data;
  try {
    switch (request.kind) {
      case 'decode':
        self.postMessage({ id, ok: true, result: await ops.decode(request.bytes, request.type) });
        return;
      case 'encode': {
        const result = await ops.encode(
          request.bytes,
          request.type,
          request.size,
          request.outputType,
        );
        self.postMessage({ id, ok: true, result }, { transfer: [result.bytes.buffer] });
        return;
      }
      case 'digest':
        self.postMessage({ id, ok: true, result: await ops.digest(request.bytes) });
        return;
    }
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
