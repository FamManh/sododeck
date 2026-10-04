import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, DeckEditError, fromJSON, getObject, toJSON } from '../src';
import { expectConverged, expectValid, seqIds, sync, twoDocs } from './helpers';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A' },
    { id: 'b', type: 'database', title: 'B', icon: 'lucide:server' },
    { id: 'c', type: 'decision', title: 'C' },
  ],
};

function setup() {
  const doc = fromJSON(deck);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (error) {
    return error instanceof DeckEditError ? error.code : 'other';
  }
  return null;
};

describe('setNodeIcon (038, R5)', () => {
  it('sets several nodes in one undo step and restores each previous value', () => {
    const { doc, editor } = setup();
    editor.setNodeIcon(['a', 'b'], 'lucide:search');
    expect(getObject(doc, 'nodes', 'a')).toMatchObject({ icon: 'lucide:search' });
    expect(getObject(doc, 'nodes', 'b')).toMatchObject({ icon: 'lucide:search' });
    editor.undo();
    expect(getObject(doc, 'nodes', 'a')).toEqual(deck.nodes[0]);
    expect(getObject(doc, 'nodes', 'b')).toEqual(deck.nodes[1]);
    expect(editor.canUndo()).toBe(false);
    expectValid(doc);
  });

  it('null deletes the key', () => {
    const { doc, editor } = setup();
    editor.setNodeIcon(['b'], null);
    expect(getObject(doc, 'nodes', 'b')).toEqual({ id: 'b', type: 'database', title: 'B' });
    editor.undo();
    expect(getObject(doc, 'nodes', 'b')).toEqual(deck.nodes[1]);
  });

  it('skips nodes already at the value and writes nothing when none change', () => {
    const { editor } = setup();
    editor.setNodeIcon(['b'], 'lucide:server');
    editor.setNodeIcon(['a', 'c'], null);
    expect(editor.canUndo()).toBe(false);
  });

  it('rejects an unknown id or an empty icon without writing', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    expect(
      codeOf(() => {
        editor.setNodeIcon(['a', 'nope'], 'lucide:search');
      }),
    ).toBe('not-found');
    expect(
      codeOf(() => {
        editor.setNodeIcon(['a'], '');
      }),
    ).toBe('invalid');
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('accepts any non-empty text, as written', () => {
    const { doc, editor } = setup();
    editor.setNodeIcon(['a'], 'simple:kafka');
    expect(getObject(doc, 'nodes', 'a')).toMatchObject({ icon: 'simple:kafka' });
    editor.setNodeIcon(['a'], 'Server');
    expect(getObject(doc, 'nodes', 'a')).toMatchObject({ icon: 'Server' });
  });

  it('syncs to a second document', () => {
    const { a, b } = twoDocs(deck);
    a.editor.setNodeIcon(['a'], 'lucide:zap');
    sync(a, b);
    expectConverged(a, b);
    expect(toJSON(b.doc).nodes[0]).toMatchObject({ icon: 'lucide:zap' });
  });
});
