import { PROTOCOL_VERSION } from '@sododeck/host-protocol';
import { describe, expect, it } from 'vitest';

import { DeckDocument } from '../src/deck-document';
import { emptyDeckText, FLUSH_TIMEOUT_MS, HostSession } from '../src/host-session';
import { deckWithPathPicture, PNG_ID } from './deck-fixtures';
import { FakeEditor, settle } from './fake-editor';
import { makeFakes } from './fakes';

const DECK = 'file:///ws/docs/arch.sododeck';

function setup(diskText = emptyDeckText(), over: Parameters<typeof makeFakes>[0] = {}) {
  const fakes = makeFakes(over);
  const editor = new FakeEditor();
  const doc = DeckDocument.fromDisk(DECK, diskText);
  const changes: number[] = [];
  const session = new HostSession({
    doc,
    transport: editor.host,
    ports: fakes,
    onContentChange: () => changes.push(fakes.clock.now),
  });
  return { fakes, editor, doc, session, changes };
}

describe('open', () => {
  it('answers ready with init: the file text, theme, capabilities and the protocol version', async () => {
    const text = emptyDeckText();
    const { editor, fakes } = setup(text, { scheme: 'dark' });
    editor.ready();
    await settle();
    const [init] = editor.of('init');
    expect(init).toEqual({
      type: 'init',
      protocolVersion: PROTOCOL_VERSION,
      text,
      theme: 'dark',
      capabilities: { openLinks: true, exportFiles: true, pictures: false },
    });
    expect(fakes.files.writes).toEqual([]);
  });

  it.each(['', '  \n\t'])(
    'opens an empty file (%j) as an empty deck, not changed',
    async (disk) => {
      const { editor, doc, changes } = setup(disk);
      editor.ready();
      await settle();
      expect(editor.of('init')[0]?.text).toBe(emptyDeckText());
      expect(doc.dirty).toBe(false);
      expect(changes).toEqual([]);
    },
  );

  it('sends init for an invalid file so the canvas shows the problems, offers "Open as text" once, never writes', async () => {
    const { editor, fakes, doc } = setup('{broken');
    editor.ready();
    await settle();
    expect(editor.of('init')[0]?.text).toBe('{broken');
    editor.ready(); // a reloaded webview
    await settle();
    expect(fakes.ui.openAsText).toEqual([DECK]);
    expect(fakes.files.writes).toEqual([]);
    expect(doc.text).toBe('{broken');
  });

  it('gives a reloaded webview the document as it stands, unsaved edits included, and restarts seq', async () => {
    const { editor, doc } = setup();
    editor.ready();
    await settle();
    editor.sendChange('EDITED');
    await settle();
    editor.clear();
    editor.ready();
    await settle();
    expect(editor.of('init')[0]?.text).toBe('EDITED');
    expect(doc.lastSeq).toBe(-1);
  });
});

describe('version mismatch (FR-004)', () => {
  it('gives the editor no deck content and writes nothing, even if it keeps talking', async () => {
    const { editor, fakes, doc, changes } = setup(deckWithPathPicture(PNG_ID, 'a.assets/p.png'));
    editor.ready(PROTOCOL_VERSION + 1);
    await settle();
    const [init] = editor.of('init');
    expect(init?.text).toBe('');
    expect(init?.protocolVersion).toBe(PROTOCOL_VERSION);
    editor.sendChange('SOMETHING');
    editor.getPicture(PNG_ID);
    await settle();
    expect(editor.of('change-result')).toEqual([]);
    expect(editor.of('picture-missing')).toEqual([]);
    expect(fakes.files.writes).toEqual([]);
    expect(doc.dirty).toBe(false);
    expect(changes).toEqual([]);
  });
});

describe('change', () => {
  it('marks the tab changed at once and answers change-result ok', async () => {
    const { editor, changes } = setup();
    editor.ready();
    await settle();
    const seq = editor.sendChange('NEW');
    await settle();
    expect(editor.of('change-result')).toEqual([{ type: 'change-result', seq, ok: true }]);
    expect(changes).toHaveLength(1);
  });

  it('does not mark the tab when the text equals the saved text', async () => {
    const disk = emptyDeckText();
    const { editor, changes } = setup(disk);
    editor.ready();
    await settle();
    editor.sendChange(disk);
    await settle();
    expect(changes).toEqual([]);
    expect(editor.of('change-result')).toHaveLength(1);
  });

  it('keeps the text byte for byte and ignores a repeated seq', async () => {
    const { editor, doc } = setup();
    editor.ready();
    await settle();
    editor.sendChange('{"a" :1}\r\n');
    await settle();
    expect(doc.text).toBe('{"a" :1}\r\n');
    editor.raw({ type: 'change', seq: 0, text: 'STALE' });
    await settle();
    expect(doc.text).toBe('{"a" :1}\r\n');
  });

  it('drops malformed, unknown and pre-ready messages without effect (FR-025)', async () => {
    const { editor, doc, fakes } = setup();
    editor.raw({ type: 'change', seq: 0, text: 'BEFORE READY' });
    await settle();
    expect(doc.text).not.toBe('BEFORE READY');
    editor.ready();
    await settle();
    for (const bad of [
      { type: 'nope' },
      { type: 'change', seq: 'x', text: 1 },
      { type: 'change' },
      null,
      'text',
      { type: 'picture-put', id: 'short' },
    ]) {
      editor.raw(bad);
    }
    await settle();
    expect(doc.lastSeq).toBe(-1);
    expect(editor.of('change-result')).toEqual([]);
    expect(fakes.files.writes).toEqual([]);
  });
});

describe('flush', () => {
  it('resolves when the canvas answers', async () => {
    const { editor, session } = setup();
    editor.ready();
    await settle();
    await session.flush();
    expect(editor.of('flush')).toHaveLength(1);
  });

  it('resolves with a warning when the canvas does not answer within 2 s', async () => {
    const { editor, session, fakes } = setup();
    editor.autoFlush = false;
    editor.ready();
    await settle();
    let done = false;
    void session.flush().then(() => {
      done = true;
    });
    await settle();
    expect(done).toBe(false);
    fakes.clock.advance(FLUSH_TIMEOUT_MS);
    await settle();
    expect(done).toBe(true);
    expect(fakes.ui.warnings).toHaveLength(1);
  });

  it('resolves at once when no canvas is connected', async () => {
    const { session } = setup();
    await session.flush();
  });
});

describe('theme and capabilities', () => {
  it('sends theme on a change, nothing when the scheme is the same', async () => {
    const { editor, fakes } = setup();
    editor.ready();
    await settle();
    fakes.control.fireTheme();
    await settle();
    expect(editor.of('theme')).toEqual([]);
    fakes.control.scheme = 'dark';
    fakes.control.fireTheme();
    await settle();
    expect(editor.of('theme')).toEqual([{ type: 'theme', scheme: 'dark' }]);
  });

  it('sends a second init with the unchanged text when the setting or trust changes, not marking the tab', async () => {
    const { editor, fakes, doc, changes } = setup(emptyDeckText(), {
      storage: 'file',
      trusted: false,
    });
    editor.ready();
    await settle();
    expect(editor.of('init')[0]?.capabilities.pictures).toBe(false);
    fakes.control.trusted = true;
    fakes.control.fireGrant();
    await settle();
    const inits = editor.of('init');
    expect(inits).toHaveLength(2);
    expect(inits[1]?.capabilities.pictures).toBe(true);
    expect(inits[1]?.text).toBe(doc.text);
    expect(changes).toEqual([]);
    fakes.control.fireSettings(); // nothing changed: no third init
    await settle();
    expect(editor.of('init')).toHaveLength(2);
  });

  it('serves pictures only when declared, through the picture host', async () => {
    const text = deckWithPathPicture(PNG_ID, 'arch.assets/pic.png');
    const { editor, fakes } = setup(text, { storage: 'file' });
    fakes.files.set('file:///ws/docs/arch.assets/pic.png', 'x');
    editor.ready();
    await settle();
    editor.getPicture(PNG_ID);
    await settle();
    expect(editor.of('picture-missing')).toHaveLength(1);
  });
});

describe('links and exports go through the session', () => {
  it('opens a web link and saves an export', async () => {
    const { editor, fakes } = setup();
    fakes.ui.saveChoice = 'file:///ws/out/x.png';
    editor.ready();
    await settle();
    editor.openLink('https://example.com');
    editor.exportFile('x.png', 'image/png', new Uint8Array([1]));
    await settle();
    expect(fakes.ui.external).toEqual(['https://example.com']);
    expect(fakes.files.get('file:///ws/out/x.png')).toBe('\u0001');
  });
});

describe('dispose', () => {
  it('stops listening and sending', async () => {
    const { editor, session } = setup();
    editor.ready();
    await settle();
    session.dispose();
    editor.clear();
    editor.sendChange('X');
    await settle();
    expect(editor.recorded()).toEqual([]);
  });
});
