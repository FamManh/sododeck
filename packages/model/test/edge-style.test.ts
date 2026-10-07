import { emptySododeckFile, type EdgeShape, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  createEditor,
  DeckEditError,
  edgeLineStyle,
  edgeShape,
  fromJSON,
  getObject,
  toJSON,
} from '../src';
import { expectConverged, expectValid, seqIds, sync, twoDocs } from './helpers';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'a', to: 'b', route: { offset: 40 } },
    { id: 'e3', from: 'b', to: 'a', style: { shape: 'straight' } },
  ],
};

function setup() {
  const doc = fromJSON(deck);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

const edge = (doc: ReturnType<typeof fromJSON>, id: string) => getObject(doc, 'edges', id);

describe('edgeShape (029)', () => {
  it('returns the stored shape, else elbow with an offset, else curved', () => {
    expect(edgeShape({ style: { shape: 'straight' } })).toBe('straight');
    expect(edgeShape({ route: { offset: 4 }, style: { shape: 'curved' } })).toBe('curved');
    expect(edgeShape({ route: { offset: 4 } })).toBe('elbow');
  });

  it('defaults a table relationship to elbow, and a plain connector to curved', () => {
    expect(edgeShape({})).toBe('curved');
    expect(edgeShape({ cardinality: 'n-1' })).toBe('elbow');
    expect(edgeShape({ fromColumns: ['c1'] })).toBe('elbow');
    expect(edgeShape({ cardinality: 'n-1', style: { shape: 'curved' } })).toBe('curved');
    expect(edgeShape({ route: { fromSide: 'left' } })).toBe('curved');
    expect(edgeShape({})).toBe('curved');
  });
});

describe('setEdgeShape (029)', () => {
  it('writes several edges in one undo step', () => {
    const { doc, editor } = setup();
    editor.setEdgeShape(['e1', 'e2', 'e3'], 'elbow');
    for (const id of ['e1', 'e2', 'e3']) expect(edge(doc, id)?.style).toEqual({ shape: 'elbow' });
    editor.undo();
    expect(edge(doc, 'e1')?.style).toBeUndefined();
    expect(edge(doc, 'e3')?.style).toEqual({ shape: 'straight' });
    expect(editor.canUndo()).toBe(false);
    expectValid(doc);
  });

  it('stores curved on an edge with an offset', () => {
    const { doc, editor } = setup();
    editor.setEdgeShape(['e2'], 'curved');
    expect(edge(doc, 'e2')?.style).toEqual({ shape: 'curved' });
    expect(edge(doc, 'e2')?.route).toEqual({ offset: 40 });
  });

  it('curved without an offset deletes shape and the empty style', () => {
    const { doc, editor } = setup();
    editor.setEdgeShape(['e3'], 'curved');
    expect(edge(doc, 'e3')).not.toHaveProperty('style');
    editor.setEdgeShape(['e1'], 'curved');
    expect(edge(doc, 'e1')).not.toHaveProperty('style');
  });

  it('never changes the route: elbow restores the kept offset (Q2)', () => {
    const { doc, editor } = setup();
    editor.setEdgeShape(['e2'], 'straight');
    expect(edge(doc, 'e2')?.route).toEqual({ offset: 40 });
    editor.setEdgeShape(['e2'], 'elbow');
    expect(edge(doc, 'e2')?.route).toEqual({ offset: 40 });
    expect(edgeShape(edge(doc, 'e2') ?? {})).toBe('elbow');
  });

  it('throws and writes nothing for an unknown id or an invalid shape', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    expect(() => {
      editor.setEdgeShape(['e1', 'nope'], 'elbow');
    }).toThrow(DeckEditError);
    expect(() => {
      editor.setEdgeShape(['e1'], 'zigzag' as EdgeShape);
    }).toThrow(DeckEditError);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('does nothing for no ids', () => {
    const { editor } = setup();
    editor.setEdgeShape([], 'elbow');
    expect(editor.canUndo()).toBe(false);
  });

  it('add stores a style given at creation', () => {
    const { doc, editor } = setup();
    editor.add('edges', { from: 'a', to: 'b', style: { shape: 'elbow' } });
    const added = toJSON(doc).edges.at(-1);
    expect(added?.style).toEqual({ shape: 'elbow' });
    expectValid(doc);
  });
});

describe('setEdgeShape on a relationship (064)', () => {
  const tables: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      {
        id: 'u',
        type: 'db-table',
        title: 'users',
        columns: [{ id: 'u1', name: 'id', type: 'int' }],
      },
      {
        id: 'o',
        type: 'db-table',
        title: 'orders',
        columns: [{ id: 'o1', name: 'user_id', type: 'int' }],
      },
    ],
    edges: [{ id: 'r', from: 'o', to: 'u', fromColumns: ['o1'], toColumns: ['u1'] }],
  };

  it('stores curved (absent reads as elbow) and removes elbow, its default', () => {
    const doc = fromJSON(tables);
    const editor = createEditor(doc, { newId: seqIds() });
    editor.setEdgeShape(['r'], 'curved');
    expect(edge(doc, 'r')?.style).toEqual({ shape: 'curved' });
    expect(edgeShape(edge(doc, 'r') ?? {})).toBe('curved');
    editor.setEdgeShape(['r'], 'elbow');
    expect(edge(doc, 'r')).not.toHaveProperty('style');
    expect(edgeShape(edge(doc, 'r') ?? {})).toBe('elbow');
    editor.setEdgeShape(['r'], 'straight');
    expect(edge(doc, 'r')?.style).toEqual({ shape: 'straight' });
    expectValid(doc);
  });

  it('keeps card connectors as they were: elbow stays stored with an offset', () => {
    const { doc, editor } = setup();
    editor.setEdgeShape(['e2'], 'elbow');
    expect(edge(doc, 'e2')?.style).toEqual({ shape: 'elbow' });
    editor.setEdgeShape(['e1'], 'elbow');
    expect(edge(doc, 'e1')?.style).toEqual({ shape: 'elbow' });
  });
});

describe('setEdgeStyle (022)', () => {
  it('writes only the patched keys to every listed edge in one undo step', () => {
    const { doc, editor } = setup();
    editor.setEdgeStyle(['e1', 'e3'], { dash: 'dashed', color: 'blue' });
    expect(edge(doc, 'e1')?.style).toEqual({ dash: 'dashed', color: 'blue' });
    expect(edge(doc, 'e3')?.style).toEqual({ shape: 'straight', dash: 'dashed', color: 'blue' });
    editor.undo();
    expect(edge(doc, 'e1')).not.toHaveProperty('style');
    expect(edge(doc, 'e3')?.style).toEqual({ shape: 'straight' });
    expect(editor.canUndo()).toBe(false);
    expectValid(doc);
  });

  it('stores every key and accepts a custom hex colour', () => {
    const { doc, editor } = setup();
    editor.setEdgeStyle(['e1'], {
      shape: 'elbow',
      dash: 'dotted',
      width: 3,
      color: '#7a3cff',
      animated: true,
    });
    expect(edge(doc, 'e1')?.style).toEqual({
      shape: 'elbow',
      dash: 'dotted',
      width: 3,
      color: '#7a3cff',
      animated: true,
    });
    expectValid(doc);
  });

  it('null and default values remove the key, and an empty style is removed', () => {
    const { doc, editor } = setup();
    editor.setEdgeStyle(['e1'], { dash: 'dashed', width: 3, color: 'red', animated: true });
    editor.setEdgeStyle(['e1'], { dash: 'solid' });
    editor.setEdgeStyle(['e1'], { width: 2 });
    editor.setEdgeStyle(['e1'], { animated: false });
    expect(edge(doc, 'e1')?.style).toEqual({ color: 'red' });
    editor.setEdgeStyle(['e1'], { color: null });
    expect(edge(doc, 'e1')).not.toHaveProperty('style');
  });

  it('a default value on an edge without a style writes nothing', () => {
    const { doc, editor } = setup();
    editor.setEdgeStyle(['e1'], { dash: 'solid', width: 2, animated: false });
    expect(edge(doc, 'e1')).not.toHaveProperty('style');
  });

  it('stores curved on an edge with an offset (029 rule kept)', () => {
    const { doc, editor } = setup();
    editor.setEdgeStyle(['e2'], { shape: 'curved', dash: 'dashed' });
    expect(edge(doc, 'e2')?.style).toEqual({ shape: 'curved', dash: 'dashed' });
    editor.setEdgeStyle(['e1'], { shape: 'curved', dash: 'dashed' });
    expect(edge(doc, 'e1')?.style).toEqual({ dash: 'dashed' });
  });

  it('throws and writes nothing for an invalid value or an unknown id', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    for (const patch of [
      { dash: 'wavy' },
      { width: 2.5 },
      { color: 'teal-ish' },
      { animated: 'yes' },
    ]) {
      expect(() => {
        editor.setEdgeStyle(['e1'], patch as never);
      }).toThrow(DeckEditError);
    }
    expect(() => {
      editor.setEdgeStyle(['e1', 'nope'], { dash: 'dashed' });
    }).toThrow(DeckEditError);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('keeps the route untouched', () => {
    const { doc, editor } = setup();
    editor.setEdgeStyle(['e2'], { shape: 'straight', width: 4 });
    expect(edge(doc, 'e2')?.route).toEqual({ offset: 40 });
  });

  it('two tabs setting dash and colour on an existing style both survive', () => {
    for (const order of ['ab', 'ba'] as const) {
      const { a, b } = twoDocs(deck);
      a.editor.setEdgeStyle(['e3'], { dash: 'dashed' });
      b.editor.setEdgeStyle(['e3'], { color: 'green' });
      sync(a, b, order);
      expectConverged(a, b);
      expect(getObject(a.doc, 'edges', 'e3')?.style).toEqual({
        shape: 'straight',
        dash: 'dashed',
        color: 'green',
      });
    }
  });
});

describe('edgeLineStyle (022)', () => {
  it('applies the defaults', () => {
    expect(edgeLineStyle({})).toEqual({
      shape: 'curved',
      dash: 'solid',
      width: 2,
      color: null,
      animated: false,
    });
    expect(edgeLineStyle({ route: { offset: 4 } }).shape).toBe('elbow');
  });

  it('returns the stored values', () => {
    expect(
      edgeLineStyle({
        style: { shape: 'straight', dash: 'dotted', width: 4, color: 'red', animated: true },
      }),
    ).toEqual({ shape: 'straight', dash: 'dotted', width: 4, color: 'red', animated: true });
  });
});
