import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, fromJSON, getObject, toFragment, toJSON } from '../src';
import { expectValid, seqIds } from './helpers';

const source: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    {
      id: 'a',
      type: 'service',
      title: 'A',
      group: 'inner',
      position: { x: 0, y: 0 },
      rules: ['R', 'Gone'],
    },
    { id: 'b', type: 'service', title: 'B', group: 'inner', position: { x: 200, y: 0 } },
    {
      id: 'c',
      type: 'database',
      title: 'C',
      group: 'outer',
      parent: 'b',
      position: { x: 0, y: 200 },
    },
  ],
  groups: [
    {
      id: 'outer',
      title: 'Outer',
      position: { x: -48, y: -48 },
      size: { width: 500, height: 400 },
    },
    {
      id: 'inner',
      title: 'Inner',
      parent: 'outer',
      position: { x: -24, y: -24 },
      size: { width: 420, height: 152 },
    },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b', label: 'call' },
    { id: 'bc', from: 'b', to: 'c' },
  ],
  rules: { R: { title: 'R', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } },
};

const whole = toFragment(source, { nodes: ['a', 'b', 'c'], groups: ['outer', 'inner'] });
const offset = { x: 100, y: 50 };

function setup(file: SododeckFile = source) {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

describe('pasteFragment (016 R10)', () => {
  it('adds copies with new ids that collide with nothing, and returns them', () => {
    const { doc, editor } = setup();
    const ids = editor.pasteFragment(whole, { offset });
    const deck = toJSON(doc);
    expect(deck.nodes).toHaveLength(6);
    expect(deck.edges).toHaveLength(4);
    expect(deck.groups).toHaveLength(4);
    const all = [...deck.nodes, ...deck.edges, ...deck.groups].map((o) => o.id);
    expect(new Set(all).size).toBe(all.length);
    expect(ids.nodes).toHaveLength(3);
    expect(ids.edges).toHaveLength(2);
    expect(ids.groups).toHaveLength(2);
    for (const id of [...ids.nodes, ...ids.edges, ...ids.groups]) {
      expect(['a', 'b', 'c', 'ab', 'bc', 'outer', 'inner']).not.toContain(id);
    }
    expectValid(doc);
  });

  it('remaps edges, groups, parents and nested groups inside the set', () => {
    const { doc, editor } = setup();
    const ids = editor.pasteFragment(whole, { offset });
    const [a, b, c] = ids.nodes.map((id) => getObject(doc, 'nodes', id));
    const [outer, inner] = ids.groups.map((id) => getObject(doc, 'groups', id));
    const [ab, bc] = ids.edges.map((id) => getObject(doc, 'edges', id));
    expect(ab).toMatchObject({ from: a?.id, to: b?.id, label: 'call' });
    expect(bc).toMatchObject({ from: b?.id, to: c?.id });
    expect(a?.group).toBe(inner?.id);
    expect(c?.group).toBe(outer?.id);
    expect(c?.parent).toBe(b?.id);
    expect(inner?.parent).toBe(outer?.id);
    expect(outer).not.toHaveProperty('parent');
  });

  it('puts what came from outside the set into options.parent', () => {
    const { doc, editor } = setup();
    const partial = toFragment(source, { nodes: ['a', 'b'], groups: [] });
    const ids = editor.pasteFragment(partial, { offset, parent: 'outer' });
    for (const id of ids.nodes) expect(getObject(doc, 'nodes', id)?.group).toBe('outer');
    const nested = toFragment(source, { nodes: ['a', 'b'], groups: ['inner'] });
    const again = editor.pasteFragment(nested, { offset, parent: 'outer' });
    expect(getObject(doc, 'groups', again.groups[0] ?? '')?.parent).toBe('outer');
    const top = editor.pasteFragment(nested, { offset });
    expect(getObject(doc, 'groups', top.groups[0] ?? '')).not.toHaveProperty('parent');
  });

  it('drops rule ids the deck does not have', () => {
    const { doc, editor } = setup();
    const ids = editor.pasteFragment(whole, { offset });
    expect(getObject(doc, 'nodes', ids.nodes[0] ?? '')?.rules).toEqual(['R']);
    const other = setup({ ...emptySododeckFile() });
    const pasted = other.editor.pasteFragment(whole, { offset });
    expect(getObject(other.doc, 'nodes', pasted.nodes[0] ?? '')).not.toHaveProperty('rules');
    expectValid(other.doc);
  });

  it('offsets positions and frames', () => {
    const { doc, editor } = setup();
    const ids = editor.pasteFragment(whole, { offset });
    expect(getObject(doc, 'nodes', ids.nodes[1] ?? '')?.position).toEqual({ x: 300, y: 50 });
    expect(getObject(doc, 'groups', ids.groups[0] ?? '')).toMatchObject({
      position: { x: 52, y: 2 },
      size: { width: 500, height: 400 },
    });
  });

  it('writes view positions and frames as well in a non-base view', () => {
    const { doc, editor } = setup({
      ...source,
      views: [
        { id: 'v1', type: 'system', title: 'One' },
        { id: 'v2', type: 'infra', title: 'Two', positions: { a: { x: 9, y: 9 } } },
      ],
    });
    const ids = editor.pasteFragment(whole, { offset, viewId: 'v2' });
    const view = getObject(doc, 'views', 'v2');
    const node = ids.nodes[1] ?? '';
    const group = ids.groups[0] ?? '';
    expect(view?.positions?.[node]).toEqual({ x: 300, y: 50 });
    expect(getObject(doc, 'nodes', node)?.position).toEqual({ x: 300, y: 50 });
    expect(view?.groupFrames?.[group]).toEqual({
      position: { x: 52, y: 2 },
      size: { width: 500, height: 400 },
    });
    expectValid(doc);
  });

  it('is one undo step', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    editor.pasteFragment(whole, { offset });
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('refuses an unknown parent without writing', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    expect(() => editor.pasteFragment(whole, { offset, parent: 'nope' })).toThrow();
    expect(toJSON(doc)).toEqual(before);
  });

  it('pastes an empty fragment as nothing', () => {
    const { editor } = setup();
    const empty = toFragment(source, { nodes: [], groups: [] });
    expect(editor.pasteFragment(empty, { offset })).toEqual({ nodes: [], edges: [], groups: [] });
    expect(editor.canUndo()).toBe(false);
  });
});

describe('connector style on copy and create (022 FR-005a)', () => {
  const styled: SododeckFile = {
    ...source,
    edges: [
      {
        id: 'ab',
        from: 'a',
        to: 'b',
        style: { dash: 'dashed', width: 3, color: 'blue', animated: true },
        route: { fromSide: 'right', fromAt: 0.25, waypoints: [{ x: 0.5, dy: -20 }] },
        labelAt: 0.2,
      },
    ],
  };

  it('a pasted connector keeps its style, bends, anchors and label position', () => {
    const doc = fromJSON(styled);
    const editor = createEditor(doc, { newId: seqIds() });
    const fragment = toFragment(styled, { nodes: ['a', 'b'], groups: [] });
    editor.pasteFragment(fragment, { offset: { x: 50, y: 50 } });
    const copy = toJSON(doc).edges.find((edge) => edge.id !== 'ab');
    expect(copy?.style).toEqual(styled.edges[0]?.style);
    expect(copy?.route).toEqual(styled.edges[0]?.route);
    expect(copy?.labelAt).toBe(0.2);
    expectValid(doc);
  });

  it('a newly created connector has no style', () => {
    const doc = fromJSON(styled);
    const editor = createEditor(doc, { newId: seqIds() });
    const id = editor.add('edges', { from: 'b', to: 'c' });
    expect(getObject(doc, 'edges', id)).not.toHaveProperty('style');
  });
});
