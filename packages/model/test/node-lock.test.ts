import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, fromJSON, getObject, isLocked, toJSON } from '../src';
import { expectValid, seqIds } from './helpers';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'svc', type: 'service', title: 'Svc' },
    { id: 'dia', type: 'diamond', title: 'Diamond' },
    {
      id: 'tbl',
      type: 'db-table',
      title: 'orders',
      columns: [{ id: 'o-id', name: 'id', type: 'bigint', pk: true }],
    },
  ],
};

function setup(file: SododeckFile = deck) {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

describe('setLocked (043, R11)', () => {
  it('writes locked: true on every listed node, keeping every other key', () => {
    const { doc, editor } = setup();
    editor.setLocked(['svc', 'dia', 'tbl'], true);
    expect(getObject(doc, 'nodes', 'svc')).toEqual({ ...deck.nodes[0], locked: true });
    expect(getObject(doc, 'nodes', 'dia')).toEqual({ ...deck.nodes[1], locked: true });
    expect(getObject(doc, 'nodes', 'tbl')).toEqual({ ...deck.nodes[2], locked: true });
    expectValid(doc);
  });

  it('removes the key on unlock, never writing locked: false', () => {
    const { doc, editor } = setup();
    editor.setLocked(['svc', 'tbl'], true);
    editor.setLocked(['svc', 'tbl'], false);
    expect(toJSON(doc)).toEqual(toJSON(fromJSON(deck)));
    expect(getObject(doc, 'nodes', 'svc')).not.toHaveProperty('locked');
  });

  it('ignores unknown ids', () => {
    const { doc, editor } = setup();
    editor.setLocked(['nope', 'svc'], true);
    expect(getObject(doc, 'nodes', 'svc')?.locked).toBe(true);
    const { editor: other } = setup();
    other.setLocked(['nope'], true);
    expect(other.canUndo()).toBe(false);
  });

  it('is one undo step, and writes nothing when nothing changes', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    editor.setLocked(['svc', 'dia'], true);
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
    editor.setLocked(['svc'], false);
    expect(editor.canUndo()).toBe(false);
    editor.setLocked(['svc'], true);
    editor.setLocked(['svc'], true);
    expect(editor.undo()).toBe(true);
    expect(editor.canUndo()).toBe(false);
  });
});

describe('isLocked (043)', () => {
  it('is true only for locked: true', () => {
    expect(isLocked({ locked: true })).toBe(true);
    expect(isLocked({})).toBe(false);
  });
});
