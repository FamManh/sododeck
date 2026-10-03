import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, DeckEditError, fromJSON, getObject, toJSON } from '../src';
import { expectConverged, expectValid, sync, twoDocs } from './helpers';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'a', to: 'b', route: { offset: 40 } },
    { id: 'e3', from: 'a', to: 'b', route: { offset: 40 }, style: { shape: 'straight' } },
  ],
};

function setup() {
  const doc = fromJSON(deck);
  return { doc, editor: createEditor(doc, { captureTimeout: 0 }) };
}

const route = (doc: ReturnType<typeof fromJSON>, id: string) => getObject(doc, 'edges', id)?.route;
const bends = [
  { x: 0.5, dy: -20 },
  { dx: 6, y: 1 },
];

describe('setEdgeRoute anchors and bends (022)', () => {
  it('merges fromAt, toAt and waypoints and removes them with null', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e1', { fromSide: 'right', toSide: 'left' });
    editor.setEdgeRoute('e1', { fromAt: 0.25, toAt: 0.75, waypoints: bends });
    expect(route(doc, 'e1')).toEqual({
      fromSide: 'right',
      toSide: 'left',
      fromAt: 0.25,
      toAt: 0.75,
      waypoints: bends,
    });
    editor.setEdgeRoute('e1', { fromAt: null, waypoints: null });
    expect(route(doc, 'e1')).toEqual({ fromSide: 'right', toSide: 'left', toAt: 0.75 });
    expectValid(doc);
  });

  it('a null patch clears side, position, offset and waypoints in one step', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e1', { fromSide: 'right', fromAt: 0.2, waypoints: bends });
    editor.setEdgeRoute('e1', null);
    expect(getObject(doc, 'edges', 'e1')).not.toHaveProperty('route');
    editor.undo();
    expect(route(doc, 'e1')).toEqual({ fromSide: 'right', fromAt: 0.2, waypoints: bends });
  });

  it('validates S9–S11 before writing anything', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    const bad = [
      { fromAt: 0.2 },
      { toAt: 0.2 },
      { fromSide: 'left', fromAt: 1.2 },
      { waypoints: [{ x: 0.5, dx: 1, y: 0.5 }] },
      { waypoints: [{ x: 0.5 }] },
    ] as const;
    for (const patch of bad) {
      expect(() => {
        editor.setEdgeRoute('e1', patch);
      }).toThrow(DeckEditError);
    }
    expect(() => {
      editor.setEdgeRoute('e2', { waypoints: bends, offset: 8 });
    }).toThrow(DeckEditError);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('drops fromAt / toAt of 0.5 (the default) and an empty waypoint list', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e1', { fromSide: 'right', fromAt: 0.5, waypoints: [] });
    expect(route(doc, 'e1')).toEqual({ fromSide: 'right' });
  });

  it('clearing a side removes its position in the same step', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e1', { fromSide: 'right', fromAt: 0.2, toSide: 'left', toAt: 0.9 });
    editor.setEdgeRoute('e1', { fromSide: null });
    expect(route(doc, 'e1')).toEqual({ toSide: 'left', toAt: 0.9 });
    editor.undo();
    expect(route(doc, 'e1')).toEqual({
      fromSide: 'right',
      fromAt: 0.2,
      toSide: 'left',
      toAt: 0.9,
    });
  });

  it('waypoints on a route with an offset remove the offset and pin elbow (R3)', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e2', { waypoints: bends });
    expect(route(doc, 'e2')).toEqual({ waypoints: bends });
    expect(getObject(doc, 'edges', 'e2')?.style).toEqual({ shape: 'elbow' });
    editor.undo();
    expect(route(doc, 'e2')).toEqual({ offset: 40 });
    expect(getObject(doc, 'edges', 'e2')).not.toHaveProperty('style');
  });

  it('keeps a stored shape when waypoints replace the offset', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e3', { waypoints: bends });
    expect(getObject(doc, 'edges', 'e3')?.style).toEqual({ shape: 'straight' });
    expect(route(doc, 'e3')).toEqual({ waypoints: bends });
  });

  it('replaces the waypoint list whole, in one undo step', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e1', { waypoints: bends });
    editor.setEdgeRoute('e1', { waypoints: [{ x: 0.1, y: 0.9 }] });
    expect(route(doc, 'e1')).toEqual({ waypoints: [{ x: 0.1, y: 0.9 }] });
    editor.undo();
    expect(route(doc, 'e1')).toEqual({ waypoints: bends });
  });

  it('joins an open gesture: a bend drag is one undo step', () => {
    const { doc, editor } = setup();
    editor.beginGesture();
    editor.setEdgeRoute('e1', { waypoints: [{ x: 0.2, y: 0.2 }] });
    editor.setEdgeRoute('e1', { waypoints: [{ x: 0.3, y: 0.3 }] });
    editor.endGesture();
    editor.undo();
    expect(getObject(doc, 'edges', 'e1')).not.toHaveProperty('route');
  });

  it('two tabs changing waypoints: the last write wins as one list', () => {
    for (const order of ['ab', 'ba'] as const) {
      const { a, b } = twoDocs(deck);
      a.editor.setEdgeRoute('e1', { waypoints: [{ x: 0.2, y: 0.2 }] });
      b.editor.setEdgeRoute('e1', {
        waypoints: [
          { x: 0.7, y: 0.7 },
          { x: 0.8, y: 0.1 },
        ],
      });
      sync(a, b, order);
      expectConverged(a, b);
      const list = getObject(a.doc, 'edges', 'e1')?.route?.waypoints;
      expect([1, 2]).toContain(list?.length);
    }
  });
});

describe('setEdgeLabelAt (022)', () => {
  it('stores a fraction, replaces it, and undoes in one step', () => {
    const { doc, editor } = setup();
    editor.setEdgeLabelAt('e1', 0.2);
    expect(getObject(doc, 'edges', 'e1')?.labelAt).toBe(0.2);
    editor.setEdgeLabelAt('e1', 1);
    expect(getObject(doc, 'edges', 'e1')?.labelAt).toBe(1);
    editor.undo();
    expect(getObject(doc, 'edges', 'e1')?.labelAt).toBe(0.2);
    expectValid(doc);
  });

  it('null and 0.5 remove the key', () => {
    const { doc, editor } = setup();
    editor.setEdgeLabelAt('e1', 0.2);
    editor.setEdgeLabelAt('e1', 0.5);
    expect(getObject(doc, 'edges', 'e1')).not.toHaveProperty('labelAt');
    editor.setEdgeLabelAt('e1', 0);
    editor.setEdgeLabelAt('e1', null);
    expect(getObject(doc, 'edges', 'e1')).not.toHaveProperty('labelAt');
  });

  it('rejects values outside 0–1 and unknown ids, writing nothing', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    expect(() => {
      editor.setEdgeLabelAt('e1', 1.1);
    }).toThrow(DeckEditError);
    expect(() => {
      editor.setEdgeLabelAt('e1', -0.1);
    }).toThrow(DeckEditError);
    expect(() => {
      editor.setEdgeLabelAt('nope', 0.3);
    }).toThrow(DeckEditError);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('writes labelAt after label in the canonical order', () => {
    const { doc, editor } = setup();
    editor.update('edges', 'e1', { label: 'call' });
    editor.setEdgeLabelAt('e1', 0.3);
    expect(Object.keys(toJSON(doc).edges[0] ?? {})).toEqual([
      'id',
      'from',
      'to',
      'label',
      'labelAt',
    ]);
  });
});
