import { describe, expect, it, vi } from 'vitest';

import { createLayoutClient, LayoutCancelled } from './layout-client';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  posted: { id: number }[] = [];
  terminated = false;
  postMessage(message: { id: number }) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(id: number) {
    this.onmessage?.({ data: { id, ok: true, result: { a: { x: 1, y: 2 } } } } as MessageEvent);
  }
}

const request = { nodes: [], groups: [], edges: [], pinned: {} };

describe('createLayoutClient (011 FR-032)', () => {
  it('starts the worker on first use and resolves results', async () => {
    const workers: FakeWorker[] = [];
    const make = vi.fn(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    });
    const client = createLayoutClient(make);
    expect(make).not.toHaveBeenCalled();
    const result = client.layout(request);
    workers[0]?.reply(0);
    await expect(result).resolves.toEqual({ a: { x: 1, y: 2 } });
  });

  it('cancel terminates the worker, rejects with LayoutCancelled, and the next run restarts', async () => {
    const workers: FakeWorker[] = [];
    const client = createLayoutClient(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    });
    const running = client.layout(request);
    client.cancel();
    await expect(running).rejects.toBeInstanceOf(LayoutCancelled);
    expect(workers[0]?.terminated).toBe(true);
    const again = client.layout(request);
    expect(workers).toHaveLength(2);
    workers[1]?.reply(1);
    await expect(again).resolves.toBeDefined();
  });
});
