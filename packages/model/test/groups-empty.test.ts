import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, fitGroupFrames, fromJSON, toJSON } from '../src';
import { expectValid, seqIds } from './helpers';

/** A frame drawn first (031 US2): a group with a stored frame and nothing in it yet. */
const file: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } }],
  groups: [
    {
      id: 'empty',
      title: 'Payments',
      position: { x: 400, y: 0 },
      size: { width: 320, height: 200 },
    },
  ],
};

function setup(input: SododeckFile = file) {
  const doc = fromJSON(input);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

describe('empty groups (031 FR-010)', () => {
  it('round-trip unchanged', () => {
    const { doc } = setup();
    expect(toJSON(doc)).toEqual(file);
    expectValid(doc);
  });

  it('groupSelection makes one with no members, in one undo step', () => {
    const { doc, editor } = setup({ ...file, groups: [] });
    const id = editor.groupSelection({
      nodes: [],
      groups: [],
      title: 'New group',
      frame: { position: { x: 0, y: 300 }, size: { width: 320, height: 200 } },
    });
    expect(toJSON(doc).groups).toEqual([
      { id, title: 'New group', position: { x: 0, y: 300 }, size: { width: 320, height: 200 } },
    ]);
    editor.undo();
    expect(toJSON(doc).groups).toEqual([]);
  });

  it('stays when its last member leaves or is deleted', () => {
    const { doc, editor } = setup();
    editor.update('nodes', 'a', { group: 'empty' });
    editor.update('nodes', 'a', { group: null });
    expect(toJSON(doc).groups.map((g) => g.id)).toEqual(['empty']);
    editor.update('nodes', 'a', { group: 'empty' });
    editor.remove('nodes', 'a');
    expect(toJSON(doc).groups.map((g) => g.id)).toEqual(['empty']);
  });

  it('is never fitted or dropped by fitGroupFrames', () => {
    const frames = fitGroupFrames(file, {
      cardSize: { width: 184, height: 76 },
      padding: 24,
    });
    expect(frames.has('empty')).toBe(false);
  });
});
