import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it, vi } from 'vitest';

import { createInlineProblemsClient, createProblemsClient } from './problems-client';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: { id: number }[] = [];
  terminated = false;
  postMessage(message: { id: number }) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(id: number, ok = true) {
    this.onmessage?.({
      data: ok
        ? { id, ok, result: { list: [], total: 0, byObject: new Map() } }
        : { id, ok, error: 'bad' },
    } as MessageEvent);
  }
}

function fakes() {
  const workers: FakeWorker[] = [];
  const make = vi.fn(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  });
  return { workers, make };
}

const file = emptySododeckFile();

describe('createProblemsClient (015 R4)', () => {
  it('starts the worker on the first check and pairs replies by id', async () => {
    const { workers, make } = fakes();
    const client = createProblemsClient(make);
    expect(make).not.toHaveBeenCalled();
    const first = client.check(file);
    const second = client.check(file);
    expect(make).toHaveBeenCalledTimes(1);
    workers[0]?.reply(1);
    workers[0]?.reply(0, false);
    await expect(second).resolves.toMatchObject({ total: 0 });
    await expect(first).rejects.toThrow('bad');
  });

  it('rejects pending checks when the worker fails, then restarts', async () => {
    const { workers, make } = fakes();
    const client = createProblemsClient(make);
    const running = client.check(file);
    workers[0]?.onerror?.({ message: 'boom', preventDefault: () => undefined } as ErrorEvent);
    await expect(running).rejects.toThrow('Problems worker failed: boom');
    expect(workers[0]?.terminated).toBe(true);
    const again = client.check(file);
    workers[1]?.reply(1);
    await expect(again).resolves.toBeDefined();
  });

  it('terminate stops the worker and rejects pending checks', async () => {
    const { workers, make } = fakes();
    const client = createProblemsClient(make);
    const running = client.check(file);
    client.terminate();
    await expect(running).rejects.toThrow('terminated');
    expect(workers[0]?.terminated).toBe(true);
  });

  it('the inline client checks in-process', async () => {
    await expect(createInlineProblemsClient().check(file)).resolves.toMatchObject({ total: 0 });
  });
});
