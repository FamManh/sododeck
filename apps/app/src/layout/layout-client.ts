import type { LayoutRequest, LayoutResult } from './elk-layout';

type WorkerResponse =
  { id: number; ok: true; result: LayoutResult } | { id: number; ok: false; error: string };

/** Main-thread handle to the ELK layout worker. Create once, reuse, terminate on unmount. */
export function createLayoutClient() {
  const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<
    number,
    { resolve: (r: LayoutResult) => void; reject: (e: Error) => void }
  >();
  let nextId = 0;

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) entry.resolve(response.result);
    else entry.reject(new Error(response.error));
  };

  return {
    layout(request: LayoutRequest): Promise<LayoutResult> {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, request });
      });
    },
    terminate() {
      worker.terminate();
      for (const entry of pending.values()) entry.reject(new Error('Layout worker terminated'));
      pending.clear();
    },
  };
}
