import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createEditor, fromJSON, getObject, toJSON, type EditorOptions } from '../src';
import { cascadeDeck } from './cascade-deck';
import { seqIds } from './helpers';

// lib0 reads Date.now at import time, so fake timers cannot drive the capture window
// (research R5). Tests use a long window for grouping and short real waits for boundaries.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
    id,
    type: 'service' as const,
    title: id.toUpperCase(),
    position: { x: i * 10, y: 0 },
  })),
  edges: [{ id: 'ab', from: 'a', to: 'b' }],
};

function setup(options: EditorOptions = {}) {
  const doc = fromJSON(deck);
  return { doc, editor: createEditor(doc, { newId: seqIds(), ...options }) };
}

const title = (doc: Y.Doc, id: string) => getObject(doc, 'nodes', id)?.title;

describe('undo grouping (US4, FR-024–029)', () => {
  it('undoes a burst of typing in one step (AS1)', () => {
    const { doc, editor } = setup({ captureTimeout: 10_000 });
    for (const text of [
      'O',
      'Or',
      'Ord',
      'Orde',
      'Order',
      'Orders',
      'Orders ',
      'Orders A',
      'Orders AP',
      'Orders API',
    ]) {
      editor.update('nodes', 'a', { title: text });
    }
    expect(title(doc, 'a')).toBe('Orders API');
    expect(editor.undo()).toBe(true);
    expect(title(doc, 'a')).toBe('A');
    expect(editor.canUndo()).toBe(false);
  });

  it('keeps edits of two different objects in two steps, even inside the window', () => {
    const { doc, editor } = setup({ captureTimeout: 10_000 });
    editor.update('nodes', 'a', { title: 'A1' });
    editor.update('nodes', 'b', { title: 'B1' });
    editor.undo();
    expect([title(doc, 'a'), title(doc, 'b')]).toEqual(['A1', 'B']);
    editor.undo();
    expect([title(doc, 'a'), title(doc, 'b')]).toEqual(['A', 'B']);
  });

  it('starts a new step after a pause longer than the window', async () => {
    const { doc, editor } = setup({ captureTimeout: 20 });
    editor.update('nodes', 'a', { title: 'A1' });
    await sleep(40);
    editor.update('nodes', 'a', { title: 'A2' });
    editor.undo();
    expect(title(doc, 'a')).toBe('A1');
    editor.undo();
    expect(title(doc, 'a')).toBe('A');
  });

  it('never merges a structural edit with typing', () => {
    const { doc, editor } = setup({ captureTimeout: 10_000 });
    editor.update('nodes', 'a', { title: 'A1' });
    const id = editor.add('nodes', { type: 'queue', title: 'Q' });
    editor.update('nodes', 'a', { title: 'A2' });
    editor.undo();
    expect(title(doc, 'a')).toBe('A1');
    expect(getObject(doc, 'nodes', id)).toBeDefined();
    editor.undo();
    expect(getObject(doc, 'nodes', id)).toBeUndefined();
    editor.undo();
    expect(title(doc, 'a')).toBe('A');
  });

  it('undoes a whole drag in one step, whatever its pauses (AS2, FR-027)', async () => {
    const { doc, editor } = setup({ captureTimeout: 20 });
    editor.update('nodes', 'b', { title: 'Before drag' });
    editor.beginGesture();
    for (let i = 1; i <= 50; i++) {
      editor.update('nodes', 'a', { position: { x: i, y: i } });
      if (i === 25) await sleep(40);
    }
    editor.endGesture();
    expect(getObject(doc, 'nodes', 'a')?.position).toEqual({ x: 50, y: 50 });

    editor.undo();
    expect(getObject(doc, 'nodes', 'a')?.position).toEqual({ x: 0, y: 0 });
    expect(title(doc, 'b')).toBe('Before drag');
  });

  it('counts nested gestures and batches inside a gesture', () => {
    const { doc, editor } = setup({ captureTimeout: 0 });
    editor.beginGesture();
    editor.beginGesture();
    editor.batch(() => {
      editor.update('nodes', 'a', { position: { x: 1, y: 1 } });
      editor.update('nodes', 'b', { position: { x: 1, y: 1 } });
    });
    editor.endGesture();
    editor.update('nodes', 'c', { position: { x: 1, y: 1 } });
    editor.endGesture();
    editor.update('nodes', 'd', { title: 'After' });

    editor.undo();
    expect(title(doc, 'd')).toBe('D');
    expect(getObject(doc, 'nodes', 'c')?.position).toEqual({ x: 1, y: 1 });
    editor.undo();
    expect(toJSON(doc)).toEqual(deck);
    expect(() => {
      editor.endGesture();
    }).toThrow(/without beginGesture/);
  });

  it('undoes a multi-object batch and a cascade delete in one step each (AS3)', () => {
    const { doc, editor } = setup({ captureTimeout: 10_000 });
    editor.batch(() => {
      for (const n of deck.nodes) editor.update('nodes', n.id, { position: { x: 99, y: 99 } });
    });
    editor.remove('nodes', 'a');
    editor.undo();
    expect(toJSON(doc).edges).toEqual(deck.edges);
    editor.undo();
    expect(toJSON(doc)).toEqual(deck);
  });

  it('redoes, and clears redo on a new edit (AS4, FR-028)', () => {
    const { doc, editor } = setup();
    editor.update('nodes', 'a', { title: 'A1' });
    editor.undo();
    expect(editor.canRedo()).toBe(true);
    expect(editor.redo()).toBe(true);
    expect(title(doc, 'a')).toBe('A1');
    editor.undo();
    editor.update('nodes', 'b', { title: 'B1' });
    expect(editor.canRedo()).toBe(false);
    expect(editor.redo()).toBe(false);
  });

  it('does not undo into an empty deck after a load (AS5, FR-024)', () => {
    const { doc, editor } = setup();
    expect(editor.undo()).toBe(false);
    expect(toJSON(doc)).toEqual(deck);
  });

  it('never undoes a change from another tab (FR-025)', () => {
    const { doc, editor } = setup();
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));

    editor.update('nodes', 'a', { title: 'Mine' });
    other.getArray<Y.Map<unknown>>('nodes').get(1).set('title', 'Theirs');
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));

    expect(editor.undo()).toBe(true);
    expect([title(doc, 'a'), title(doc, 'b')]).toEqual(['A', 'Theirs']);
    expect(editor.canUndo()).toBe(false);
  });

  it('reports history changes (FR-029)', () => {
    const { editor } = setup();
    const states: [boolean, boolean][] = [];
    const stop = editor.onHistoryChange(() => states.push([editor.canUndo(), editor.canRedo()]));
    editor.update('nodes', 'a', { title: 'A1' });
    editor.undo();
    editor.redo();
    stop();
    editor.undo();
    expect(states).toEqual([
      [true, false],
      [false, true],
      [true, false],
    ]);
  });

  it('restores every attachment and sample input with one undo after removeRule (008 SC-006)', () => {
    const doc = fromJSON(cascadeDeck);
    const editor = createEditor(doc, { newId: seqIds() });
    const before = toJSON(doc);
    editor.removeRule('R');
    const after = toJSON(doc);
    expect(after.rules.R).toBeUndefined();
    expect(after.nodes.map((n) => n.rules)).toEqual([undefined, undefined, ['Q']]);
    expect(after.flows[0]?.steps.map((s) => s.ruleInputs)).toEqual([undefined, { Q: {} }]);
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
  });
});
