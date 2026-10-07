import { describe, expect, it } from 'vitest';

import { parseEditorMessage, parseHostMessage, PROTOCOL_VERSION } from '../src/index';

const HEX = 'a'.repeat(64);
const caps = { openLinks: true, exportFiles: false, pictures: true };

describe('parseHostMessage', () => {
  const valid: unknown[] = [
    { type: 'init', protocolVersion: 1, text: '', theme: 'dark', capabilities: caps },
    { type: 'external-change', text: '{}' },
    { type: 'change-result', seq: 1, ok: false, reason: 'Disk full' },
    { type: 'flush', requestId: 'r1' },
    { type: 'theme', scheme: 'light' },
    { type: 'picture-stored', id: HEX, path: 'assets/a.png' },
    { type: 'picture-store-failed', id: HEX, reason: 'no' },
    { type: 'picture', id: HEX, mime: 'image/png', bytes: new Uint8Array([1]) },
    { type: 'picture-missing', id: HEX, reason: 'gone' },
  ];
  it.each(valid)('accepts %j', (m) => {
    expect(parseHostMessage(m)).not.toBeNull();
  });

  it('rejects unknown type and bad fields', () => {
    expect(parseHostMessage({ type: 'nope' })).toBeNull();
    expect(parseHostMessage(null)).toBeNull();
    expect(parseHostMessage({ type: 'external-change', text: 3 })).toBeNull();
    expect(parseHostMessage({ type: 'change-result', seq: -1, ok: true })).toBeNull();
    expect(parseHostMessage({ type: 'flush', requestId: '' })).toBeNull();
    expect(parseHostMessage({ type: 'picture-stored', id: 'ABC', path: 'x' })).toBeNull();
    expect(parseHostMessage({ type: 'picture', id: HEX, mime: 'x', bytes: [1, 2] })).toBeNull();
  });

  it('strips unknown keys and normalises capabilities', () => {
    const m = parseHostMessage({
      type: 'init',
      protocolVersion: 1,
      text: 'x',
      theme: 'dark',
      extra: 1,
      capabilities: { openLinks: true, other: true },
    });
    expect(m).toEqual({
      type: 'init',
      protocolVersion: 1,
      text: 'x',
      theme: 'dark',
      capabilities: { openLinks: true, exportFiles: false, pictures: false },
    });
  });

  it('reads any integer protocol version, and a missing one as 0, so a mismatch is reported', () => {
    const base = { type: 'init', text: '', theme: 'light', capabilities: caps };
    expect(parseHostMessage({ ...base, protocolVersion: 2 })).toMatchObject({ protocolVersion: 2 });
    expect(parseHostMessage({ ...base, protocolVersion: 0 })).toMatchObject({ protocolVersion: 0 });
    expect(parseHostMessage(base)).toMatchObject({ protocolVersion: 0 });
    expect(parseHostMessage({ ...base, protocolVersion: 1.5 })).toBeNull();
  });

  it('accepts an unknown theme string', () => {
    const m = parseHostMessage({
      type: 'init',
      protocolVersion: 1,
      text: '',
      theme: 'sepia',
      capabilities: caps,
    });
    expect(m?.type).toBe('init');
  });

  it('truncates reason to 300 characters', () => {
    const m = parseHostMessage({ type: 'picture-missing', id: HEX, reason: 'x'.repeat(500) });
    expect(m?.type === 'picture-missing' && m.reason.length).toBe(300);
  });
});

describe('parseEditorMessage', () => {
  it('accepts every editor message', () => {
    const valid: unknown[] = [
      { type: 'ready', protocolVersion: PROTOCOL_VERSION, editorVersion: '0.0.0' },
      { type: 'change', seq: 1, text: '{}' },
      { type: 'flushed', requestId: 'r' },
      { type: 'picture-put', id: HEX, mime: 'x', name: 'n', bytes: new Uint8Array() },
      { type: 'picture-get', id: HEX },
      { type: 'open-link', href: 'https://x.test' },
      { type: 'export-file', name: 'a.png', mime: 'image/png', bytes: new Uint8Array() },
      { type: 'fatal', code: 'protocol-version', editorVersion: '1', protocolVersion: 1 },
    ];
    for (const m of valid) expect(parseEditorMessage(m)).not.toBeNull();
  });

  it('rejects bytes that are not a Uint8Array', () => {
    expect(
      parseEditorMessage({ type: 'export-file', name: 'a', mime: 'b', bytes: [1] }),
    ).toBeNull();
  });
});
