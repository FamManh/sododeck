import { emptySododeckFile, type Frame, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, DeckEditError, fromJSON, getObject, toJSON } from '../src';
import { expectValid, seqIds } from './helpers';

const frame = (x: number, y: number, width: number, height: number): Frame => ({
  position: { x, y },
  size: { width, height },
});

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', group: 'shop', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', group: 'shop', position: { x: 200, y: 0 } },
    { id: 'c', type: 'service', title: 'C', position: { x: 400, y: 0 } },
    { id: 'm', type: 'service', title: 'M', group: 'inner', position: { x: 0, y: 300 } },
  ],
  groups: [
    { id: 'shop', title: 'Shop', ...frame(-100, -100, 900, 600) },
    { id: 'inner', title: 'Inner', parent: 'shop', ...frame(-24, 276, 212, 152) },
  ],
  views: [
    { id: 'v1', type: 'system', title: 'One' },
    { id: 'v2', type: 'infra', title: 'Two', positions: { a: { x: 5, y: 5 } } },
  ],
};

function setup(file: SododeckFile = deck) {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

describe('groupSelection (016 R11)', () => {
  it('adds the group with its title, parent and frame, and returns its id', () => {
    const { doc, editor } = setup();
    const id = editor.groupSelection({
      nodes: ['a', 'b'],
      groups: [],
      title: 'New group',
      parent: 'shop',
      frame: frame(-24, -24, 412, 152),
    });
    expect(getObject(doc, 'groups', id)).toEqual({
      id,
      title: 'New group',
      parent: 'shop',
      ...frame(-24, -24, 412, 152),
    });
    expectValid(doc);
  });

  it('repoints the members and the selected groups', () => {
    const { doc, editor } = setup();
    const id = editor.groupSelection({
      nodes: ['a', 'c'],
      groups: ['inner'],
      title: 'G',
      frame: frame(0, 0, 600, 500),
    });
    const file = toJSON(doc);
    expect(file.nodes.find((n) => n.id === 'a')?.group).toBe(id);
    expect(file.nodes.find((n) => n.id === 'c')?.group).toBe(id);
    expect(file.nodes.find((n) => n.id === 'b')?.group).toBe('shop');
    // Members of a selected group stay in it.
    expect(file.nodes.find((n) => n.id === 'm')?.group).toBe('inner');
    expect(file.groups.find((g) => g.id === 'inner')?.parent).toBe(id);
    expect(file.groups.find((g) => g.id === id)).not.toHaveProperty('parent');
  });

  it('writes per-view frames', () => {
    const { doc, editor } = setup();
    const id = editor.groupSelection({
      nodes: ['a'],
      groups: [],
      title: 'G',
      frame: frame(0, 0, 212, 152),
      viewFrames: { v2: frame(5, 5, 212, 152) },
    });
    expect(getObject(doc, 'views', 'v2')?.groupFrames?.[id]).toEqual(frame(5, 5, 212, 152));
    expectValid(doc);
  });

  it('is one undo step', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    editor.groupSelection({
      nodes: ['a', 'b'],
      groups: [],
      title: 'G',
      frame: frame(0, 0, 400, 200),
    });
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('refuses unknown ids, a parent inside the selection and a blank title, writing nothing', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    const codeOf = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return error instanceof DeckEditError ? error.code : 'other';
      }
      return null;
    };
    const base = { groups: [], title: 'G', frame: frame(0, 0, 400, 200) };
    expect(codeOf(() => editor.groupSelection({ ...base, nodes: ['nope'] }))).toBe(
      'missing-reference',
    );
    expect(codeOf(() => editor.groupSelection({ ...base, nodes: ['a'], parent: 'nope' }))).toBe(
      'missing-reference',
    );
    expect(
      codeOf(() =>
        editor.groupSelection({ ...base, nodes: [], groups: ['shop'], parent: 'inner' }),
      ),
    ).toBe('invalid');
    expect(codeOf(() => editor.groupSelection({ ...base, nodes: ['a'], title: ' ' }))).toBe(
      'invalid',
    );
    expect(toJSON(doc)).toEqual(before);
  });
});
