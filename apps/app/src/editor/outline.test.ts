import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import { buildNotesOutline, buildOutline, visibleItems } from './outline';

const deck = deckOf({
  nodes: [
    { id: 'loose', type: 'external', title: 'Loose' },
    { id: 'a', type: 'service', title: 'A', group: 'inner' },
    { id: 'b', type: 'client', title: 'B', group: 'outer' },
    { id: 'c', type: 'queue', title: 'C', group: 'x1' },
  ],
  groups: [
    { id: 'outer', title: 'Outer' },
    { id: 'inner', title: 'Inner', parent: 'outer' },
    { id: 'orphan', title: 'Orphan', parent: 'missing' },
    { id: 'x1', title: 'X1', parent: 'x2' },
    { id: 'x2', title: 'X2', parent: 'x1' },
  ],
});

describe('buildOutline', () => {
  const tree = buildOutline(deck);

  it('nests groups by parent, nodes by group, loose nodes last, in document order', () => {
    expect(tree.map((i) => i.id)).toEqual(['outer', 'orphan', 'x1', 'x2', 'loose']);
    const outer = tree[0];
    expect(outer?.children.map((i) => i.id)).toEqual(['inner', 'b']);
    expect(outer?.children[0]?.children.map((i) => i.id)).toEqual(['a']);
    expect(tree.at(-1)).toEqual({
      type: 'node',
      id: 'loose',
      title: 'Loose',
      kind: 'external',
      children: [],
    });
  });

  it('counts nodes recursively', () => {
    expect(tree[0]).toMatchObject({ type: 'group', count: 2 });
    expect(tree[0]?.children[0]).toMatchObject({ count: 1 });
    expect(tree[1]).toMatchObject({ count: 0 });
  });

  it('puts groups with a missing or cyclic parent at the root', () => {
    expect(tree[1]?.id).toBe('orphan');
    expect(tree[2]).toMatchObject({ id: 'x1', count: 1 });
  });

  it('limits the tree to the current scope and prepends an up row', () => {
    expect(
      buildOutline(deck, { node: null, group: 'outer' }).map((item) => [item.type, item.id]),
    ).toEqual([
      ['up', 'up'],
      ['group', 'inner'],
      ['node', 'b'],
    ]);
    expect(
      buildOutline(
        deckOf({
          nodes: [
            { id: 'parent', type: 'service', title: 'Parent' },
            { id: 'child', type: 'service', title: 'Child', parent: 'parent' },
          ],
        }),
        { node: 'parent', group: null },
      ).map((item) => [item.type, item.id]),
    ).toEqual([
      ['up', 'up'],
      ['node', 'child'],
    ]);
  });
});

describe('visibleItems', () => {
  it('hides the children of collapsed groups and gives levels', () => {
    const tree = buildOutline(deck);
    const all = visibleItems(tree, new Set());
    expect(all.slice(0, 4).map((v) => [v.item.id, v.level, v.parentId])).toEqual([
      ['outer', 1, null],
      ['inner', 2, 'outer'],
      ['a', 3, 'inner'],
      ['b', 2, 'outer'],
    ]);
    expect(
      visibleItems(tree, new Set(['outer']))
        .map((v) => v.item.id)
        .slice(0, 2),
    ).toEqual(['outer', 'orphan']);
  });
});

describe('buildNotesOutline', () => {
  it('uses sticky labels in file order, with "Empty note" for blanks', () => {
    const deck = deckOf({
      stickies: [
        { id: 'a', text: 'First line\n\nMore', position: { x: 12, y: 24 } },
        { id: 'b', text: '   ', position: { x: 36, y: 48 } },
        { id: 'c', text: '**Bold** line', position: { x: 60, y: 72 } },
      ],
    });

    expect(buildNotesOutline(deck)).toEqual([
      { id: 'a', label: 'First line' },
      { id: 'b', label: 'Empty note' },
      { id: 'c', label: 'Bold line' },
    ]);
  });
});

describe('buildOutline colour (020 T055)', () => {
  it("carries each node and group's look", () => {
    const coloured = deckOf({
      nodes: [{ id: 'a', type: 'service', title: 'A', style: { fill: 'green' } }],
      groups: [{ id: 'g', title: 'G', style: { stroke: 'red' } }],
    });
    const tree = buildOutline(coloured);
    const node = tree.find((i) => i.id === 'a' && i.type === 'node');
    const group = tree.find((i) => i.id === 'g' && i.type === 'group');
    expect(node?.type === 'node' ? node.look?.fillRef : undefined).toBe('green');
    expect(group?.type === 'group' ? group.look?.strokeRef : undefined).toBe('red');
  });

  it('omits `look` for plain items', () => {
    const plain = deckOf({ nodes: [{ id: 'a', type: 'service', title: 'A' }] });
    const node = buildOutline(plain).find((i) => i.id === 'a' && i.type === 'node');
    expect(node?.type === 'node' ? node.look : undefined).toBeUndefined();
  });
});
