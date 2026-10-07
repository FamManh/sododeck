import type { EditorMessage } from '@sododeck/host-protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hostPictureStore, type HostPictureStore } from './host-picture-store';

const ID = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const BYTES = new Uint8Array([1, 2, 3]);

function setup(on = true) {
  const sent: EditorMessage[] = [];
  const stored: [string, string][] = [];
  const failed: [string, string][] = [];
  const store: HostPictureStore = hostPictureStore(
    (message) => {
      sent.push(message);
    },
    {
      isOn: () => on,
      onStored: (id, path) => {
        stored.push([id, path]);
      },
      onFailed: (id, reason) => {
        failed.push([id, reason]);
      },
    },
  );
  return { store, sent, stored, failed };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('hostPictureStore without the pictures ability (067 US4)', () => {
  it('keeps the bytes in memory and sends nothing', async () => {
    const { store, sent } = setup(false);
    await store.put(ID, { type: 'image/png', bytes: BYTES, name: 'a.png' });
    expect(sent).toEqual([]);
    expect(await store.getBytes(ID)).toEqual({ type: 'image/png', bytes: BYTES, name: 'a.png' });
    expect(await store.ids()).toEqual([ID]);
    // Nothing to ask for an unknown picture either.
    expect(await store.get(OTHER)).toBeNull();
    expect(sent).toEqual([]);
  });
});

describe('hostPictureStore with the pictures ability (067 US4)', () => {
  it('sends picture-put for a new picture once, with its name and bytes', async () => {
    const { store, sent } = setup();
    await store.put(ID, { type: 'image/png', bytes: BYTES, name: 'a.png' });
    await store.put(ID, { type: 'image/png', bytes: BYTES, name: 'a.png' });
    expect(sent).toEqual([
      { type: 'picture-put', id: ID, mime: 'image/png', name: 'a.png', bytes: BYTES },
    ]);
  });

  it('names a picture from its id when it has no name', async () => {
    const { store, sent } = setup();
    await store.put(ID, { type: 'image/svg+xml', bytes: BYTES });
    expect(sent[0]).toMatchObject({ type: 'picture-put', name: `${'a'.repeat(8)}.svg` });
  });

  it('reports the path the host stored it at, and a refusal with its reason', async () => {
    const { store, stored, failed } = setup();
    await store.put(ID, { type: 'image/png', bytes: BYTES, name: 'a.png' });
    store.receive({ type: 'picture-stored', id: ID, path: 'assets/a.png' });
    store.receive({ type: 'picture-store-failed', id: OTHER, reason: 'Folder is read-only' });
    expect(stored).toEqual([[ID, 'assets/a.png']]);
    expect(failed).toEqual([[OTHER, 'Folder is read-only']]);
    // The bytes stay, so the picture can still be shown and embedded in the file.
    expect((await store.getBytes(ID))?.bytes).toEqual(BYTES);
  });

  it('asks the host once for a picture it does not have, and answers with a Blob', async () => {
    const { store, sent } = setup();
    const first = store.get(ID);
    const second = store.get(ID);
    expect(sent).toEqual([{ type: 'picture-get', id: ID }]);
    store.receive({ type: 'picture', id: ID, mime: 'image/png', bytes: BYTES });
    const [a, b] = await Promise.all([first, second]);
    expect(a).toBeInstanceOf(Blob);
    expect(a?.type).toBe('image/png');
    expect(b).toBe(a === null ? null : b);
    // Now it is in memory: no second ask.
    await store.get(ID);
    expect(sent).toHaveLength(1);
  });

  it('answers null with the host’s reason for a missing picture', async () => {
    const { store } = setup();
    const answer = store.get(ID);
    store.receive({ type: 'picture-missing', id: ID, reason: 'No such file' });
    expect(await answer).toBeNull();
    expect(store.missingReason(ID)).toBe('No such file');
  });

  it('gives up on a picture the host never answers after 10 seconds', async () => {
    const { store } = setup();
    const answer = store.get(ID);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await answer).toBeNull();
    expect(store.missingReason(ID)).toBe('The program hosting this editor did not answer.');
  });

  it('reads pictures that are files next to the deck', () => {
    expect(setup().store.readsFilePaths).toBe(true);
  });
});

describe('hostPictureStore.remember (067 US4)', () => {
  it('keeps bytes a file carried without sending them to the host', async () => {
    const { store, sent } = setup();
    store.remember(ID, { type: 'image/png', bytes: BYTES });
    expect((await store.getBytes(ID))?.bytes).toEqual(BYTES);
    await store.put(ID, { type: 'image/png', bytes: BYTES, name: 'a.png' });
    expect(sent).toEqual([]);
  });
});
