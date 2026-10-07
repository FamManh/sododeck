import { describe, expect, it } from 'vitest';

import {
  createFakeHost,
  memoryTransportPair,
  type EditorMessage,
  type FakeHostOptions,
} from '../src/index';

const HEX = 'b'.repeat(64);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function setup(options: FakeHostOptions = {}) {
  const { editor, host } = memoryTransportPair();
  const fake = createFakeHost(host, options);
  const received: unknown[] = [];
  editor.listen((m) => received.push(m));
  const send = async (m: EditorMessage) => {
    editor.send(m);
    await tick();
  };
  return { fake, received, send };
}

describe('createFakeHost', () => {
  it('answers ready with init and logs both directions', async () => {
    const { fake, received, send } = setup({ text: 'T', theme: 'dark' });
    await send({ type: 'ready', protocolVersion: 1, editorVersion: 'x' });
    expect(received[0]).toEqual({
      type: 'init',
      protocolVersion: 1,
      text: 'T',
      theme: 'dark',
      capabilities: { openLinks: false, exportFiles: false, pictures: false },
    });
    expect(fake.log.map((e) => [e.dir, e.message.type])).toEqual([
      ['in', 'ready'],
      ['out', 'init'],
    ]);
  });

  it('answers changes, refuses once, or stays silent', async () => {
    const a = setup();
    await a.send({ type: 'change', seq: 1, text: 'one' });
    a.fake.refuseNextChange('Disk full');
    await a.send({ type: 'change', seq: 2, text: 'two' });
    await a.send({ type: 'change', seq: 3, text: 'three' });
    expect(a.received).toEqual([
      { type: 'change-result', seq: 1, ok: true },
      { type: 'change-result', seq: 2, ok: false, reason: 'Disk full' },
      { type: 'change-result', seq: 3, ok: true },
    ]);
    expect(a.fake.lastText()).toBe('three');
    const b = setup({ answerChanges: false });
    await b.send({ type: 'change', seq: 1, text: 'x' });
    expect(b.received).toEqual([]);
  });

  it('does not answer ready with init when autoInit is false, until sendInit', async () => {
    const { fake, received, send } = setup({ autoInit: false });
    await send({ type: 'ready', protocolVersion: 1, editorVersion: '0' });
    expect(received).toEqual([]);
    fake.sendInit();
    await tick();
    expect((received as { type: string }[]).map((m) => m.type)).toEqual(['init']);
  });

  it('flush resolves on flushed; sendExternal and setTheme post', async () => {
    const { fake, received, send } = setup();
    const done = fake.flush();
    await tick();
    const req = received[0] as { requestId: string };
    expect(received[0]).toMatchObject({ type: 'flush' });
    await send({ type: 'flushed', requestId: req.requestId });
    await done;
    fake.sendExternal('ext');
    fake.setTheme('dark');
    await tick();
    expect(received.slice(1)).toEqual([
      { type: 'external-change', text: 'ext' },
      { type: 'theme', scheme: 'dark' },
    ]);
  });

  it('serves pictures', async () => {
    const bytes = new Uint8Array([1, 2]);
    const { received, send } = setup({ pictures: new Map([[HEX, { mime: 'image/png', bytes }]]) });
    await send({ type: 'picture-get', id: HEX });
    await send({ type: 'picture-get', id: 'c'.repeat(64) });
    await send({ type: 'picture-put', id: HEX, mime: 'image/png', name: 'a b.png', bytes });
    expect(received[0]).toMatchObject({ type: 'picture', id: HEX });
    expect(received[1]).toMatchObject({ type: 'picture-missing' });
    expect(received[2]).toEqual({ type: 'picture-stored', id: HEX, path: 'assets/a b.png' });
    const r = setup({ refusePictures: true });
    await r.send({ type: 'picture-put', id: HEX, mime: 'x', name: 'n', bytes });
    expect(r.received[0]).toMatchObject({ type: 'picture-store-failed', id: HEX });
  });
});
