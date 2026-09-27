import { computeLayout, type LayoutRequest } from './elk-layout';

export interface LayoutWorkerRequest {
  id: number;
  request: LayoutRequest;
}

self.onmessage = async (event: MessageEvent<LayoutWorkerRequest>) => {
  const { id, request } = event.data;
  try {
    self.postMessage({ id, ok: true, result: await computeLayout(request) });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
