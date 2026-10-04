import { describe, expect, it } from 'vitest';

import {
  createImportClient,
  createInlineImportClient,
  ImportCancelled,
  StaleRead,
} from './import-client';
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

describe('readDbml', () => {
  it('posts a read-dbml request with the text', async () => {
    const { client, workers } = setup();
    const read = client.readDbml('Table a { id int }');
    expect(workers[0]?.posted[0]).toMatchObject({
      request: { kind: 'read-dbml', text: 'Table a { id int }' },
    });
    workers[0]?.reply(0, { schema: 'raw', problems: [] });
    await expect(read).resolves.toEqual({ schema: 'raw', problems: [] });
  });

  it('drops a reply older than the newest request by rejecting it as stale', async () => {
    const { client, workers } = setup();
    const first = client.readDbml('a');
    const second = client.readDbml('b');
    await expect(first).rejects.toBeInstanceOf(StaleRead);
    workers[0]?.reply(0, { schema: 'old', problems: [] });
    workers[0]?.reply(1, { schema: 'new', problems: [] });
    await expect(second).resolves.toEqual({ schema: 'new', problems: [] });
  });

  it('does not make a pending preview stale', async () => {
    const { client, workers } = setup();
    const preview = client.preview(source, target);
    void client.readDbml('b');
    workers[0]?.reply(0, 'the preview');
    await expect(preview).resolves.toBe('the preview');
  });
});

describe('createInlineImportClient', () => {
  it('reads DBML with every problem, and latest wins', async () => {
    const client = createInlineImportClient();
    const first = client.readDbml('Table a { id int [not nul] }');
    const second = client.readDbml('Table a { id int }');
    await expect(first).rejects.toBeInstanceOf(StaleRead);
    const result = await second;
    expect(result.problems).toEqual([]);
    expect(result.schema.tables).toHaveLength(1);
    const bad = await client.readDbml('Table a { id int [not nul] }');
    expect(bad.problems[0]).toMatchObject({ code: 'unknown-setting', suggestion: 'not null' });
  });

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
