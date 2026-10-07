import { applyDeckText, createDeck, createEditor, serializeDeck, toJSON } from '@sododeck/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { storageOrigin } from '../storage/origins';
import { hostOrigin } from './host-origin';
import { attachHostPersistence, type HostPersistence } from './host-persistence';

interface Sent {
  type: 'change';
  seq: number;
  text: string;
}

function setup(options: Partial<Parameters<typeof attachHostPersistence>[2]> = {}) {
  const doc = createDeck();
  const editor = createEditor(doc);
  const sent: Sent[] = [];
  const errors: (string | null)[] = [];
  const persistence = attachHostPersistence(
    doc,
    (message) => {
      sent.push(message);
    },
    {
      onError: (reason) => {
        errors.push(reason);
      },
      ...options,
    },
  );
  return { doc, editor, sent, errors, persistence };
}

/** A deck file as the host would hold it after the user edited the title of the deck. */
function fileNamed(name: string): string {
  const other = createDeck();
  createEditor(other).updateMeta({ name });
  return serializeDeck(other);
}

let current: HostPersistence | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  current?.destroy();
  current = undefined;
  vi.useRealTimers();
});

describe('sending edits (067 US2)', () => {
  it('sends one complete canonical file 100 ms after an own edit', async () => {
    const { editor, doc, sent, persistence } = setup();
    current = persistence;
    editor.updateMeta({ name: 'Shop' });
    await vi.advanceTimersByTimeAsync(99);
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toEqual([{ type: 'change', seq: 1, text: serializeDeck(doc) }]);
    expect(toJSON(doc).name).toBe('Shop');
  });

  it('sends one message per 100 ms window, with the latest state', async () => {
    const { editor, doc, sent, persistence } = setup();
    current = persistence;
    for (const [at, name] of [
      [0, 'A'],
      [30, 'AB'],
      [60, 'ABC'],
      [90, 'ABCD'],
    ] as const) {
      await vi.advanceTimersByTimeAsync(at === 0 ? 0 : 30);
      editor.updateMeta({ name });
    }
    await vi.advanceTimersByTimeAsync(10);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toBe(serializeDeck(doc));
    expect(JSON.parse(sent[0]?.text ?? '{}')).toMatchObject({ name: 'ABCD' });
    await vi.advanceTimersByTimeAsync(20);
    editor.updateMeta({ name: 'Later' });
    await vi.advanceTimersByTimeAsync(100);
    expect(sent.map((m) => m.seq)).toEqual([1, 2]);
    expect(JSON.parse(sent[1]?.text ?? '{}')).toMatchObject({ name: 'Later' });
  });

  it('sends nothing for updates that came from storage or the host', async () => {
    const { doc, sent, persistence } = setup();
    current = persistence;
    const other = createDeck();
    createEditor(other).updateMeta({ name: 'Elsewhere' });
    const { applyUpdate, encodeStateAsUpdate } = await import('yjs');
    applyUpdate(doc, encodeStateAsUpdate(other), storageOrigin);
    applyDeckText(doc, fileNamed('From the host'), hostOrigin);
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toHaveLength(0);
  });

  it('flush sends a pending edit at once and resolves; with nothing pending it resolves at once', async () => {
    const { editor, sent, persistence } = setup();
    current = persistence;
    await persistence.flush();
    expect(sent).toHaveLength(0);
    editor.updateMeta({ name: 'Now' });
    await persistence.flush();
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toHaveLength(1);
  });

  it('reports a refusal with the host reason and clears it on the next ok', async () => {
    const { editor, sent, errors, persistence } = setup();
    current = persistence;
    editor.updateMeta({ name: 'One' });
    await vi.advanceTimersByTimeAsync(100);
    persistence.handleResult({ seq: sent[0]?.seq ?? 0, ok: false, reason: 'Disk full' });
    expect(errors).toEqual(['Disk full']);
    editor.updateMeta({ name: 'Two' });
    await vi.advanceTimersByTimeAsync(100);
    persistence.handleResult({ seq: sent[1]?.seq ?? 0, ok: true });
    expect(errors).toEqual(['Disk full', null]);
  });

  it('reports a change the host never answered after 5 seconds', async () => {
    const { editor, errors, persistence } = setup();
    current = persistence;
    editor.updateMeta({ name: 'Lost' });
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(errors).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(errors).toEqual(['The program hosting this editor did not take the last change.']);
  });

  it('sends the file without an edit that was undone', async () => {
    const { editor, sent, persistence } = setup({});
    current = persistence;
    editor.updateMeta({ name: 'Oops' });
    await vi.advanceTimersByTimeAsync(100);
    editor.undo();
    await vi.advanceTimersByTimeAsync(100);
    expect(sent).toHaveLength(2);
    expect(JSON.parse(sent[1]?.text ?? '{}')).not.toHaveProperty('name');
  });

  it('sends nothing while blocked, and again after unblocking and a new edit', async () => {
    const { editor, sent, persistence } = setup();
    current = persistence;
    editor.updateMeta({ name: 'Pending' });
    persistence.setBlocked(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toHaveLength(0);
    await persistence.flush();
    expect(sent).toHaveLength(0);
    editor.updateMeta({ name: 'Ignored while blocked' });
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toHaveLength(0);
    persistence.setBlocked(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toHaveLength(0);
    editor.updateMeta({ name: 'Fresh' });
    await vi.advanceTimersByTimeAsync(100);
    expect(sent).toHaveLength(1);
  });

  it('waits for the picture bytes it was given before it sends', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pictureBytes = vi.fn(async () => {
      await gate;
      return new Map<string, Uint8Array>();
    });
    const { editor, sent, persistence } = setup({ pictureBytes });
    current = persistence;
    editor.updateMeta({ name: 'Slow pictures' });
    await vi.advanceTimersByTimeAsync(100);
    expect(pictureBytes).toHaveBeenCalledOnce();
    expect(sent).toHaveLength(0);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);
  });
});

describe('outside changes (067 US3)', () => {
  it('ignores a text that equals one of the last 8 it sent', async () => {
    const { editor, doc, sent, persistence } = setup();
    current = persistence;
    editor.updateMeta({ name: 'V1' });
    await vi.advanceTimersByTimeAsync(100);
    editor.updateMeta({ name: 'V2' });
    await vi.advanceTimersByTimeAsync(100);
    const before = serializeDeck(doc);
    expect(persistence.applyExternal(sent[0]?.text ?? '')).toBe('echo');
    expect(persistence.applyExternal(sent[1]?.text ?? '')).toBe('echo');
    expect(serializeDeck(doc)).toBe(before);
  });

  it('stops treating older sent texts as echoes once an outside change was applied', async () => {
    const { editor, doc, sent, persistence } = setup();
    current = persistence;
    editor.updateMeta({ name: 'V1' });
    await vi.advanceTimersByTimeAsync(100);
    const v1 = sent[0]?.text ?? '';
    const result = persistence.applyExternal(fileNamed('Outside'));
    expect(result).toMatchObject({ status: 'applied', changed: true });
    expect(toJSON(doc).name).toBe('Outside');
    // The old echo is now an ordinary outside file.
    expect(persistence.applyExternal(v1)).toMatchObject({ status: 'applied', changed: true });
    expect(toJSON(doc).name).toBe('V1');
  });

  it('keeps only the last 8 sent texts for the echo check', async () => {
    const { editor, sent, persistence } = setup();
    current = persistence;
    for (let i = 1; i <= 9; i++) {
      editor.updateMeta({ name: `N${String(i)}` });
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(persistence.applyExternal(sent[8]?.text ?? '')).toBe('echo');
    expect(persistence.applyExternal(sent[1]?.text ?? '')).toBe('echo');
    expect(persistence.applyExternal(sent[0]?.text ?? '')).not.toBe('echo');
  });

  it('applies a valid different text as a remote change and sends nothing back', async () => {
    const { doc, sent, persistence } = setup();
    current = persistence;
    const origins: unknown[] = [];
    doc.on('update', (_update: Uint8Array, origin: unknown) => {
      origins.push(origin);
    });
    const result = persistence.applyExternal(fileNamed('Renamed outside'));
    expect(result).toMatchObject({ status: 'applied', changed: true });
    expect(origins).toContain(hostOrigin);
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toHaveLength(0);
  });

  it('lets the outside file win over a pending own edit (066 has no three-way merge)', async () => {
    const { editor, doc, sent, persistence } = setup();
    current = persistence;
    editor.updateMeta({ description: 'Mine' });
    persistence.applyExternal(fileNamed('Theirs'));
    expect(toJSON(doc)).toMatchObject({ name: 'Theirs' });
    expect(toJSON(doc).description).toBeUndefined();
    // Whatever is sent next is the merged state, never the lost edit.
    await vi.advanceTimersByTimeAsync(100);
    for (const message of sent) expect(JSON.parse(message.text)).not.toHaveProperty('description');
  });

  it('refuses an invalid text and leaves the document alone', () => {
    const { doc, persistence } = setup();
    current = persistence;
    const before = serializeDeck(doc);
    const result = persistence.applyExternal('{ "nodes": 1 }');
    expect(result).toMatchObject({ status: 'refused' });
    expect(serializeDeck(doc)).toBe(before);
  });
});
