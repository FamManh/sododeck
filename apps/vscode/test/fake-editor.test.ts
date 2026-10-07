import { parseEditorMessage, parseHostMessage } from '@sododeck/host-protocol';
import { describe, expect, it } from 'vitest';

import { FakeEditor, settle } from './fake-editor';

describe('FakeEditor', () => {
  it('only sends messages the real schemas accept', () => {
    const editor = new FakeEditor();
    editor.ready();
    editor.sendChange('{}');
    editor.answerFlush('r1');
    editor.putPicture('a'.repeat(64), 'image/png', 'x.png', new Uint8Array([1]));
    editor.getPicture('b'.repeat(64));
    editor.openLink('https://example.com');
    editor.exportFile('x.png', 'image/png', new Uint8Array([2]));
    expect(editor.sent).toHaveLength(7);
    for (const message of editor.sent) expect(parseEditorMessage(message)).not.toBeNull();
  });

  it('records what the host sends, and answers flush automatically', async () => {
    const editor = new FakeEditor();
    const received: string[] = [];
    editor.host.listen((m) => received.push(m.type));
    editor.host.send({ type: 'flush', requestId: 'q' });
    editor.host.send({ type: 'theme', scheme: 'dark' });
    await settle();
    expect(editor.recorded().map((m) => m.type)).toEqual(['flush', 'theme']);
    expect(received).toContain('flushed');
    for (const m of editor.recorded()) expect(parseHostMessage(m)).not.toBeNull();
  });
});
