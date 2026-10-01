import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createEditor, DeckEditError, fromJSON, getObject, toJSON } from '../src';
import { expectValid, seqIds } from './helpers';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'client', title: 'A' },
    { id: 'b', type: 'client', title: 'B', style: { fill: 'red' } },
  ],
  groups: [{ id: 'g', title: 'G' }],
};

function setup(file: SododeckFile = deck) {
  const doc = fromJSON(file);
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

describe('setStyle (020, R2)', () => {
  it('sets a named fill on a node and a hex stroke on a group, as one undo step', () => {
    const { doc, editor } = setup();
    editor.setStyle({ nodes: ['a'], groups: ['g'] }, 'fill', 'blue');
    editor.undo();
    expect(getObject(doc, 'nodes', 'a')).toEqual({ id: 'a', type: 'client', title: 'A' });
    expect(getObject(doc, 'groups', 'g')).toEqual({ id: 'g', title: 'G' });

    editor.setStyle({ nodes: ['a'], groups: ['g'] }, 'fill', 'blue');
    expect(getObject(doc, 'nodes', 'a')).toEqual({
      id: 'a',
      type: 'client',
      title: 'A',
      style: { fill: 'blue' },
    });
    expect(getObject(doc, 'groups', 'g')).toEqual({ id: 'g', title: 'G', style: { fill: 'blue' } });
    expect(editor.canUndo()).toBe(true);
    editor.undo();
    expect(getObject(doc, 'nodes', 'a')).toEqual({ id: 'a', type: 'client', title: 'A' });
    expectValid(doc);
  });

  it('writes both nodes and one group across two targets in a single transaction', () => {
    const { doc, editor } = setup({
      ...emptySododeckFile(),
      nodes: [
        { id: 'a', type: 'client', title: 'A' },
        { id: 'b', type: 'client', title: 'B' },
      ],
      groups: [{ id: 'g', title: 'G' }],
    });
    editor.setStyle({ nodes: ['a', 'b'], groups: ['g'] }, 'stroke', '#1f2a44');
    expect(getObject(doc, 'nodes', 'a')).toMatchObject({ style: { stroke: '#1f2a44' } });
    expect(getObject(doc, 'nodes', 'b')).toMatchObject({ style: { stroke: '#1f2a44' } });
    expect(getObject(doc, 'groups', 'g')).toMatchObject({ style: { stroke: '#1f2a44' } });
    editor.undo();
    expect(getObject(doc, 'nodes', 'a')).not.toHaveProperty('style');
    expect(getObject(doc, 'nodes', 'b')).not.toHaveProperty('style');
    expect(getObject(doc, 'groups', 'g')).not.toHaveProperty('style');
    expect(editor.canUndo()).toBe(false);
  });

  it('clears a channel with null, deleting style entirely once both channels are cleared', () => {
    const { doc, editor } = setup();
    editor.setStyle({ nodes: ['b'], groups: [] }, 'stroke', 'amber');
    expect(getObject(doc, 'nodes', 'b')).toMatchObject({ style: { fill: 'red', stroke: 'amber' } });
    editor.setStyle({ nodes: ['b'], groups: [] }, 'fill', null);
    expect(getObject(doc, 'nodes', 'b')).toMatchObject({ style: { stroke: 'amber' } });
    editor.setStyle({ nodes: ['b'], groups: [] }, 'stroke', null);
    expect(getObject(doc, 'nodes', 'b')).not.toHaveProperty('style');
    expectValid(doc);
  });

  it('throws invalid before writing anything for a bad CardColor name or hex', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    expect(
      codeOf(() => {
        editor.setStyle({ nodes: ['a'], groups: [] }, 'fill', 'Red');
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.setStyle({ nodes: ['a'], groups: [] }, 'fill', '#abc');
      }),
    ).toBe('invalid');
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('skips unknown ids without throwing', () => {
    const { doc, editor } = setup();
    editor.setStyle({ nodes: ['a', 'nope'], groups: ['also-nope'] }, 'fill', 'blue');
    expect(getObject(doc, 'nodes', 'a')).toMatchObject({ style: { fill: 'blue' } });
    expectValid(doc);
  });

  it('does nothing when both target lists are empty', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    editor.setStyle({ nodes: [], groups: [] }, 'fill', 'blue');
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('merges concurrent fill and stroke edits from two synced docs on the same node', () => {
    const { doc, editor } = setup();
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    const otherEditor = createEditor(other, { newId: seqIds() });

    editor.setStyle({ nodes: ['b'], groups: [] }, 'stroke', 'amber');
    otherEditor.setStyle({ nodes: ['b'], groups: [] }, 'fill', 'blue');

    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc, Y.encodeStateVector(other)));
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));

    expect(getObject(doc, 'nodes', 'b')).toMatchObject({
      style: { fill: 'blue', stroke: 'amber' },
    });
    expect(toJSON(doc)).toEqual(toJSON(other));
  });
});
