import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  frameTransport,
  memoryTransportPair,
  parentWindowTransport,
  type EditorMessage,
  type HostMessage,
} from '../src/index';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const init: HostMessage = {
  type: 'init',
  protocolVersion: 1,
  text: '',
  theme: 'light',
  capabilities: { openLinks: false, exportFiles: false, pictures: false },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('memoryTransportPair', () => {
  it('delivers asynchronously, as a copy', async () => {
    const { editor, host } = memoryTransportPair();
    const got: EditorMessage[] = [];
    host.listen((m) => got.push(m));
    const msg: EditorMessage = { type: 'change', seq: 1, text: 'a' };
    editor.send(msg);
    expect(got).toHaveLength(0);
    msg.text = 'mutated';
    await flush();
    expect(got).toEqual([{ type: 'change', seq: 1, text: 'a' }]);
  });

  it('stops delivery after unlisten', async () => {
    const { editor, host } = memoryTransportPair();
    const got: HostMessage[] = [];
    const off = editor.listen((m) => got.push(m));
    host.send({ type: 'theme', scheme: 'dark' });
    await flush();
    off();
    host.send({ type: 'theme', scheme: 'light' });
    await flush();
    expect(got).toHaveLength(1);
  });
});

function fakeParent() {
  const postMessage = vi.fn();
  return { win: { postMessage } as unknown as Window, postMessage };
}

function post(win: Window, data: unknown, source: unknown, origin: string) {
  win.dispatchEvent(
    new MessageEvent('message', { data, source: source as MessageEventSource, origin }),
  );
}

describe('parentWindowTransport', () => {
  it('ignores other sources and invalid messages, pins origin at init', () => {
    const { win: parent, postMessage } = fakeParent();
    const self = new EventTarget() as unknown as Window;
    Object.defineProperty(self, 'parent', { value: parent });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const t = parentWindowTransport(self);
    const got: HostMessage[] = [];
    t.listen((m) => got.push(m));

    t.send({ type: 'ready', protocolVersion: 1, editorVersion: 'x' });
    expect(postMessage).toHaveBeenLastCalledWith(expect.anything(), '*');

    post(self, init, {}, 'https://evil.test');
    expect(got).toHaveLength(0);
    post(self, { type: 'bogus' }, parent, 'https://host.test');
    expect(got).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);

    // Other messages before init are dropped with a warning.
    t.send({ type: 'change', seq: 1, text: '' });
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(2);

    post(self, init, parent, 'https://host.test');
    expect(got).toHaveLength(1);
    t.send({ type: 'change', seq: 1, text: '' });
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'change', seq: 1, text: '' },
      'https://host.test',
    );
  });
});

describe('frameTransport', () => {
  it('accepts only the frame window and posts with origin', () => {
    const { win: contentWindow, postMessage } = fakeParent();
    const frame = { contentWindow } as unknown as HTMLIFrameElement;
    const t = frameTransport(frame, 'https://app.test');
    const got: EditorMessage[] = [];
    t.listen((m) => got.push(m));
    const msg = { type: 'flushed', requestId: 'r' };
    post(window, msg, window, 'https://app.test');
    expect(got).toHaveLength(0);
    post(window, msg, contentWindow, 'https://app.test');
    expect(got).toHaveLength(1);
    t.send(init);
    expect(postMessage).toHaveBeenCalledWith(init, 'https://app.test');
  });
});
