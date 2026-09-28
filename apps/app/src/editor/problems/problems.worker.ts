import { checkDeck } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

export interface ProblemsWorkerRequest {
  id: number;
  file: SododeckFile;
}

// The deck-wide check (015, ADR 0013), off the main thread (constitution V).
self.onmessage = (event: MessageEvent<ProblemsWorkerRequest>) => {
  const { id, file } = event.data;
  try {
    self.postMessage({ id, ok: true, result: checkDeck(file) });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
