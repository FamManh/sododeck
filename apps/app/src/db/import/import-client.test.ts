import { describe, expect, it } from 'vitest';

import { createImportClient, createInlineImportClient, ImportCancelled } from './import-client';
import type { ImportSource, ImportTarget } from './types';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: { id: number; request: { kind: string } }[] = [];
  terminated = false;
  postMessage(message: { id: number; request: { kind: string } }) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(id: number, result: unknown) {
    this.onmessage?.({ data: { id, ok: true, result } } as MessageEvent);
  }
}

const source: ImportSource = {
  text: 'CREATE TABLE t (id int);',
  format: 'auto',
  dialect: 'auto',
  detectFk: true,
};
const target: ImportTarget = {
  kind: 'deck',
  deckDialect: 'generic',
  deckHasTables: false,
  deckHasDescription: false,
  tableNames: [],
  enumNames: [],
};

function setup() {
  const workers: FakeWorker[] = [];
  const client = createImportClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  });
  return { client, workers };
}

describe('createImportClient', () => {
  it('starts the worker on first use and pairs responses with requests by id', async () => {
    const { client, workers } = setup();
    expect(workers).toHaveLength(0);
    const preview = client.preview(source, target);
    const plan = client.plan(source, target);
    expect(workers[0]?.posted.map((m) => [m.id, m.request.kind])).toEqual([
      [0, 'preview'],
      [1, 'plan'],
    ]);
    workers[0]?.reply(1, 'the plan');
    workers[0]?.reply(0, 'the preview');
    await expect(preview).resolves.toBe('the preview');
    await expect(plan).resolves.toBe('the plan');
  });

  it('cancel rejects pending calls and ignores their late results; the worker stays', async () => {
    const { client, workers } = setup();
    const pending = client.preview(source, target);
    client.cancel();
    await expect(pending).rejects.toBeInstanceOf(ImportCancelled);
    workers[0]?.reply(0, 'late');
    const next = client.preview(source, target);
    expect(workers).toHaveLength(1);
    workers[0]?.reply(1, 'fresh');
    await expect(next).resolves.toBe('fresh');
  });

  it('rejects pending calls when the worker fails', async () => {
    const { client, workers } = setup();
    const pending = client.plan(source, target);
    workers[0]?.onerror?.({ message: 'boom', preventDefault: () => undefined } as ErrorEvent);
    await expect(pending).rejects.toThrow('Import worker failed: boom');
    expect(workers[0]?.terminated).toBe(true);
  });
});

describe('createInlineImportClient', () => {
  it('runs the same pipeline on the main thread', async () => {
    const client = createInlineImportClient();
    const preview = await client.preview(source, target);
    expect(preview).toMatchObject({ format: 'sql', counts: { tables: 1 } });
  });

  it('rejects a call cancelled while running', async () => {
    const client = createInlineImportClient();
    const pending = client.plan(source, target);
    client.cancel();
    await expect(pending).rejects.toBeInstanceOf(ImportCancelled);
  });
});
