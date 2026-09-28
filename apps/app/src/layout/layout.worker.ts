import ELK from 'elkjs/lib/elk-api.js';
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';

import { computeLayout, type LayoutRequest } from './elk-layout';

export interface LayoutWorkerRequest {
  id: number;
  request: LayoutRequest;
}

/*
 * ELK runs in its own worker script, started from this one (elkjs' intended set-up). Its bundled
 * build cannot run inside a Web Worker: there it takes over `self.onmessage` instead of providing
 * its in-process worker, so `new ELK()` fails. Terminating this worker stops the nested one too.
 */
const elk = new ELK({ workerFactory: () => new Worker(elkWorkerUrl) });

self.onmessage = async (event: MessageEvent<LayoutWorkerRequest>) => {
  const { id, request } = event.data;
  try {
    self.postMessage({ id, ok: true, result: await computeLayout(request, elk) });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
