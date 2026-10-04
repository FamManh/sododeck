import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  createEditor,
  fragmentOrigin,
  fromJSON,
  parseFragment,
  serializeFragment,
  toFragment,
  toJSON,
} from '../src';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  name: 'Shop',
  nodes: [
    {
      id: 'a',
      type: 'service',
      title: 'A',
      group: 'inner',
      position: { x: 10, y: 20 },
      rules: ['R'],
    },
    { id: 'b', type: 'service', title: 'B', group: 'inner', position: { x: 200, y: 20 } },
    { id: 'c', type: 'database', title: 'C', group: 'outer', parent: 'b' },
    { id: 'out', type: 'client', title: 'Outside', position: { x: -500, y: 0 } },
  ],
  groups: [
    {
      id: 'outer',
      title: 'Outer',
      position: { x: -20, y: -20 },
      size: { width: 600, height: 400 },
    },
    {
      id: 'inner',
      title: 'Inner',
      parent: 'outer',
      position: { x: -14, y: -4 },
      size: { width: 400, height: 160 },
    },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b', label: 'call' },
    { id: 'bc', from: 'b', to: 'c' },
    { id: 'ao', from: 'a', to: 'out' },
  ],
  flows: [{ id: 'f', title: 'F', steps: [{ id: 's', edge: 'ab' }] }],
  stickies: [{ id: 'note', text: 'Hi', anchor: 'a' }],
  rules: { R: { title: 'R', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } },
};

describe('toFragment (016 R9, R10)', () => {
  it('takes the selected nodes and the edges with both ends selected', () => {
    const { deck: out } = toFragment(deck, { nodes: ['a', 'b'], groups: [] });
    expect(out.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(out.edges.map((e) => e.id)).toEqual(['ab']);
    expect(out.flows).toEqual([]);
    expect(out.stickies).toEqual([]);
    expect(out.rules).toEqual({});
    expect(out.views).toEqual([]);
  });

  it('keeps only groups whose whole subtree is selected, with their frames', () => {
    const inner = toFragment(deck, { nodes: ['a', 'b'], groups: ['inner'] }).deck;
    expect(inner.groups).toEqual([
      {
        id: 'inner',
        title: 'Inner',
        position: { x: -14, y: -4 },
        size: { width: 400, height: 160 },
      },
    ]);
    expect(inner.nodes.map((n) => n.group)).toEqual(['inner', 'inner']);

    // Outer is named, but c (a member) is not selected: outer is left out, inner stays.
    const partial = toFragment(deck, { nodes: ['a', 'b'], groups: ['outer', 'inner'] }).deck;
    expect(partial.groups.map((g) => g.id)).toEqual(['inner']);

    const whole = toFragment(deck, { nodes: ['a', 'b', 'c'], groups: ['outer', 'inner'] }).deck;
    expect(whole.groups.map((g) => g.id)).toEqual(['outer', 'inner']);
    expect(whole.groups[1]?.parent).toBe('outer');
  });

  it('drops references that leave the fragment, and places nodes without a position', () => {
    const { deck: out } = toFragment(deck, { nodes: ['a', 'c'], groups: [] });
    const [a, c] = out.nodes;
    expect(a).not.toHaveProperty('group');
    expect(a?.rules).toEqual(['R']); // resolved against the target deck on paste
    expect(c).not.toHaveProperty('parent');
    expect(c?.position).toEqual({ x: 440, y: 0 }); // its grid slot (index 2)
  });

  it('uses the positions and frames a view draws', () => {
    const viewed: SododeckFile = {
      ...deck,
      views: [
        { id: 'v1', type: 'system', title: 'One' },
        {
          id: 'v2',
          type: 'infra',
          title: 'Two',
          positions: { a: { x: 1, y: 2 } },
          groupFrames: {
            inner: { position: { x: 0, y: 0 }, size: { width: 300, height: 300 } },
          },
        },
      ],
    };
    const out = toFragment(viewed, { nodes: ['a', 'b'], groups: ['inner'] }, 'v2').deck;
    expect(out.nodes[0]?.position).toEqual({ x: 1, y: 2 });
    expect(out.groups[0]?.size).toEqual({ width: 300, height: 300 });
  });
});

describe('serializeFragment / parseFragment', () => {
  it('round-trips, and the text is a valid envelope', () => {
    const fragment = toFragment(deck, { nodes: ['a', 'b', 'c'], groups: ['outer', 'inner'] });
    const text = serializeFragment(fragment);
    expect(JSON.parse(text)).toMatchObject({ sododeckFragment: 1 });
    expect(parseFragment(text)).toEqual(fragment);
    expect(serializeFragment(parseFragment(text) ?? fragment)).toBe(text);
  });

  it('returns null for anything that is not a valid fragment', () => {
    const valid = JSON.parse(serializeFragment(toFragment(deck, { nodes: ['a'], groups: [] }))) as {
      deck: SododeckFile;
    };
    expect(parseFragment('Hello world')).toBeNull();
    expect(parseFragment('')).toBeNull();
    expect(parseFragment('{"a":1}')).toBeNull();
    expect(parseFragment(JSON.stringify(deck))).toBeNull();
    expect(parseFragment(JSON.stringify({ sododeckFragment: 2, deck: valid.deck }))).toBeNull();
    expect(
      parseFragment(
        JSON.stringify({ sododeckFragment: 1, deck: { ...valid.deck, nodes: [{ id: 'x' }] } }),
      ),
    ).toBeNull();
    const dup = { ...valid.deck, nodes: [...valid.deck.nodes, ...valid.deck.nodes] };
    expect(parseFragment(JSON.stringify({ sododeckFragment: 1, deck: dup }))).toBeNull();
  });

  it('computes the top-left origin of nodes and frames', () => {
    const fragment = toFragment(deck, { nodes: ['a', 'b'], groups: ['inner'] });
    expect(fragmentOrigin(fragment)).toEqual({ x: -14, y: -4 });
    expect(fragmentOrigin(toFragment(deck, { nodes: ['b'], groups: [] }))).toEqual({
      x: 200,
      y: 20,
    });
  });
});

describe('paste a hex fill (020 T049, R12)', () => {
  it('pastes the hex colour as-is into a deck that has no such swatch, leaving swatches unchanged', () => {
    const colored: SododeckFile = {
      ...emptySododeckFile(),
      nodes: [
        {
          id: 'src',
          type: 'service',
          title: 'Source',
          position: { x: 0, y: 0 },
          style: { fill: '#7a3cff' },
        },
      ],
    };
    const fragment = toFragment(colored, { nodes: ['src'], groups: [] });

    const target: SododeckFile = { ...emptySododeckFile(), swatches: ['#111111'] };
    const doc = fromJSON(target);
    const editor = createEditor(doc);
    const ids = editor.pasteFragment(fragment, { offset: { x: 0, y: 0 } });

    const pasted = toJSON(doc).nodes.find((n) => n.id === ids.nodes[0]);
    expect(pasted?.style).toEqual({ fill: '#7a3cff' });
    expect(toJSON(doc).swatches).toEqual(['#111111']);
  });
});

describe('group-ended edges on the clipboard (050)', () => {
  const grouped: SododeckFile = {
    ...deck,
    edges: [
      ...deck.edges,
      { id: 'a-inner', from: 'a', to: 'inner', route: { toSide: 'top' } },
      { id: 'inner-outer', from: 'inner', to: 'outer' },
      { id: 'inner-out', from: 'inner', to: 'out' },
    ],
  };

  it('keeps an edge whose ends (cards or groups) are all in the fragment', () => {
    const out = toFragment(grouped, { nodes: ['a', 'b'], groups: ['inner'] }).deck;
    expect(out.edges.map((e) => e.id)).toEqual(['ab', 'a-inner']);
    expect(out.edges[1]).toEqual({
      id: 'a-inner',
      from: 'a',
      to: 'inner',
      route: { toSide: 'top' },
    });
  });

  it('keeps a group → group edge when both groups are whole in the fragment', () => {
    const out = toFragment(grouped, { nodes: ['a', 'b', 'c'], groups: ['outer', 'inner'] }).deck;
    expect(out.edges.map((e) => e.id)).toEqual(['ab', 'bc', 'a-inner', 'inner-outer']);
  });

  it('drops an edge to a group that is not whole in the fragment', () => {
    // Outer is named, but c is not selected, so outer is left out with its edge.
    const out = toFragment(grouped, { nodes: ['a', 'b'], groups: ['outer', 'inner'] }).deck;
    expect(out.edges.map((e) => e.id)).toEqual(['ab', 'a-inner']);
  });
});
