import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf } from '../test/render-canvas';
import { connectComponents } from './canvas-actions';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 300, y: 0 } },
    { id: 'c', type: 'service', title: 'C', position: { x: 600, y: 0 } },
  ],
});

function setup() {
  const doc = fromJSON(deck);
  return { doc, editor: createEditor(doc) };
}

beforeEach(() => {
  useUiStore.getState().resetForDeck();
  useUiStore.getState().setLastLineShape('curved');
});

describe('connectComponents line type (029 T045)', () => {
  it('draws a curved connector, with no stored style, on a fresh store', () => {
    const { doc, editor } = setup();
    const id = connectComponents(editor, 'a', 'b');
    expect(toJSON(doc).edges.find((e) => e.id === id)).not.toHaveProperty('style');
  });

  it('gives the new connector the last picked line type, in one undo step', () => {
    const { doc, editor } = setup();
    useUiStore.getState().setLastLineShape('elbow');
    const id = connectComponents(editor, 'a', 'b');
    expect(toJSON(doc).edges.find((e) => e.id === id)?.style).toEqual({ shape: 'elbow' });
    editor.undo();
    expect(toJSON(doc).edges).toEqual([]);
  });

  it('keeps lastLineShape across undo and opening another deck', () => {
    const { editor } = setup();
    useUiStore.getState().setLastLineShape('straight');
    connectComponents(editor, 'a', 'b');
    editor.undo();
    useUiStore.getState().resetForDeck('other');
    expect(useUiStore.getState().lastLineShape).toBe('straight');
  });
});
