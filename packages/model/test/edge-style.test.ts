import { emptySododeckFile, type EdgeShape, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, DeckEditError, edgeShape, fromJSON, getObject, toJSON } from '../src';
import { expectValid, seqIds } from './helpers';

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
