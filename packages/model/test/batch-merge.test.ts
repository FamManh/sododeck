import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import type * as Y from 'yjs';

import { createEditor, fromJSON, getObject } from '../src';
import { seqIds } from './helpers';

// lib0 reads Date.now at import time, so fake timers cannot drive the capture window: a short
// window plus a real wait is "3 s apart" for the editor (see undo.test.ts).
const WINDOW = 5;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const GAP = WINDOW * 6;

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: ['a', 'b'].map((id, i) => ({
    id,
    type: 'service' as const,
    title: id.toUpperCase(),
    position: { x: i * 10, y: 0 },
  })),
};

function setup() {
  const doc = fromJSON(deck);
  return { doc, editor: createEditor(doc, { newId: seqIds(), captureTimeout: WINDOW }) };
}

const title = (doc: Y.Doc, id: string) => getObject(doc, 'nodes', id)?.title;

describe('batch merge key (046)', () => {
  it('merges two batches with one key into one undo step, however far apart', async () => {
    const { doc, editor } = setup();
    editor.batch(
      () => {
        editor.update('nodes', 'a', { title: 'A1' });
      },
      { merge: 'k' },
    );
    await sleep(GAP);
    editor.batch(
      () => {
        editor.update('nodes', 'b', { title: 'B1' });
      },
      { merge: 'k' },
    );
    editor.undo();
    expect([title(doc, 'a'), title(doc, 'b')]).toEqual(['A', 'B']);
    expect(editor.canUndo()).toBe(false);
  });

  it('keeps a plain batch in a step of its own', async () => {
    const { doc, editor } = setup();
    editor.batch(
      () => {
        editor.update('nodes', 'a', { title: 'A1' });
      },
      { merge: 'k' },
    );
    await sleep(GAP);
    editor.batch(() => {
      editor.update('nodes', 'b', { title: 'B1' });
    });
    editor.undo();
    expect([title(doc, 'a'), title(doc, 'b')]).toEqual(['A1', 'B']);
  });

  it('splits on another merge key', async () => {
    const { doc, editor } = setup();
    editor.batch(
      () => {
        editor.update('nodes', 'a', { title: 'A1' });
      },
      { merge: 'k1' },
    );
    await sleep(GAP);
    editor.batch(
      () => {
        editor.update('nodes', 'b', { title: 'B1' });
      },
      { merge: 'k2' },
    );
    editor.undo();
    expect([title(doc, 'a'), title(doc, 'b')]).toEqual(['A1', 'B']);
  });

  it('splits when an update with another key wrote in between', async () => {
    const { doc, editor } = setup();
    editor.batch(
      () => {
        editor.update('nodes', 'a', { title: 'A1' });
      },
      { merge: 'k' },
    );
    await sleep(GAP);
    editor.update('nodes', 'b', { title: 'B1' });
    await sleep(GAP);
    editor.batch(
      () => {
        editor.update('nodes', 'a', { title: 'A2' });
      },
      { merge: 'k' },
    );
    editor.undo();
    expect(title(doc, 'a')).toBe('A1');
    editor.undo();
    expect(title(doc, 'b')).toBe('B');
    editor.undo();
    expect(title(doc, 'a')).toBe('A');
  });

  it('splits after undo, redo and stopCapturing', async () => {
    const { doc, editor } = setup();
    editor.batch(
      () => {
        editor.update('nodes', 'a', { title: 'A1' });
      },
      { merge: 'k' },
    );
    editor.undo();
    editor.redo();
    editor.batch(
      () => {
        editor.update('nodes', 'b', { title: 'B1' });
      },
      { merge: 'k' },
    );
    editor.undo();
    expect([title(doc, 'a'), title(doc, 'b')]).toEqual(['A1', 'B']);
    editor.undo();
    expect(title(doc, 'a')).toBe('A');

    editor.batch(
      () => {
        editor.update('nodes', 'a', { title: 'A2' });
      },
      { merge: 'j' },
    );
    editor.stopCapturing();
    await sleep(GAP);
    editor.batch(
      () => {
        editor.update('nodes', 'b', { title: 'B2' });
      },
      { merge: 'j' },
    );
    editor.undo();
    expect([title(doc, 'a'), title(doc, 'b')]).toEqual(['A2', 'B']);
  });

  it('restores the whole merged step on redo', async () => {
    const { doc, editor } = setup();
    editor.batch(
      () => {
        editor.update('nodes', 'a', { title: 'A1' });
      },
      { merge: 'k' },
    );
    await sleep(GAP);
    editor.batch(
      () => {
        editor.update('nodes', 'b', { title: 'B1' });
      },
      { merge: 'k' },
    );
    editor.undo();
    editor.redo();
    expect([title(doc, 'a'), title(doc, 'b')]).toEqual(['A1', 'B1']);
  });

  it('is not split by untracked (remote) transactions between the batches', async () => {
    const { doc, editor } = setup();
    editor.batch(
      () => {
        editor.update('nodes', 'a', { title: 'A1' });
      },
      { merge: 'k' },
    );
    await sleep(GAP);
    doc.transact(() => {
      getNodeMap(doc, 'b').set('title', 'B-remote');
    }, 'remote');
    editor.batch(
      () => {
        editor.update('nodes', 'a', { title: 'A2' });
      },
      { merge: 'k' },
    );
    editor.undo();
    expect(title(doc, 'a')).toBe('A');
    expect(title(doc, 'b')).toBe('B-remote');
    expect(editor.canUndo()).toBe(false);
  });
});

function getNodeMap(doc: Y.Doc, id: string): Y.Map<unknown> {
  const node = doc.getMap<Y.Map<unknown>>('nodes').get(id);
  if (node === undefined) throw new Error(`no node ${id}`);
  return node;
}
