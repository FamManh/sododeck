// @vitest-environment jsdom
import { PROTOCOL_VERSION, type EditorMessage } from '@sododeck/host-protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFrame } from '../src/frame';

afterEach(() => {
  document.body.innerHTML = '';
});

function post(source: unknown, data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data, source: source as Window }));
}

describe('createFrame', () => {
  it('builds a sandboxed srcdoc iframe that fills its container', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const frame = createFrame(container, '<p>page</p>');
    expect(frame.element.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.element.srcdoc).toBe('<p>page</p>');
    expect(frame.element.title).toBe('Sododeck canvas');
    expect(container.contains(frame.element)).toBe(true);
  });

  it('accepts only valid messages from its own window', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const frame = createFrame(container, '');
    const seen: EditorMessage[] = [];
    frame.transport.listen((m) => seen.push(m));
    const ready = { type: 'ready', protocolVersion: PROTOCOL_VERSION, editorVersion: '1' };
    post(frame.element.contentWindow, ready);
    post(window, ready);
    post(null, ready);
    post(frame.element.contentWindow, { type: 'nonsense' });
    post(frame.element.contentWindow, 'text');
    expect(seen).toEqual([ready]);
  });

  it('posts to the frame window with the wildcard origin', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const frame = createFrame(container, '');
    const target = frame.element.contentWindow;
    if (target === null) throw new Error('no window');
    const spy = vi.spyOn(target, 'postMessage').mockImplementation(() => undefined);
    frame.transport.send({ type: 'theme', scheme: 'dark' });
    expect(spy).toHaveBeenCalledWith({ type: 'theme', scheme: 'dark' }, '*');
  });

  it('destroy removes the iframe and the listeners', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const frame = createFrame(container, '');
    const seen: EditorMessage[] = [];
    frame.transport.listen((m) => seen.push(m));
    const win = frame.element.contentWindow;
    frame.destroy();
    expect(container.querySelector('iframe')).toBeNull();
    post(win, { type: 'ready', protocolVersion: 1, editorVersion: '1' });
    expect(seen).toEqual([]);
  });
});
