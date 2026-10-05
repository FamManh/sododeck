import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createEditor, fromJSON, loadDeck, observeDeck, serializeDeck, toJSON } from '../src';
import { toY } from '../src/convert';
import { NODE_GRID } from '../src/geometry';
import { collectionMap } from '../src/layout';
import { freeAnchoredStickies, legacyStickyPoint } from '../src/legacy-stickies';

/** A file written before pinning was removed (ADR 0041): one note of each legacy kind. */
const legacy: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'n0', type: 'service', title: 'Placed', position: { x: 300, y: 40 } },
    { id: 'n1', type: 'service', title: 'Grid slot 1' },
  ],
  edges: [{ id: 'e0', from: 'n0', to: 'n1' }],
  flows: [{ id: 'f0', title: 'Flow', steps: [{ id: 's0', edge: 'e0' }] }],
  stickies: [
    { id: 'offset', text: 'On n0', anchor: 'n0', position: { x: 5, y: -5 }, collapsed: true },
    { id: 'default', text: 'On n0, no offset', anchor: 'n0' },
    { id: 'grid', text: 'On a grid card', anchor: 'n1', position: { x: 12, y: -4 } },
    { id: 'edge', text: 'On a connector', anchor: 'e0', position: { x: 1, y: 2 } },
    { id: 'step', text: 'On a step', anchor: 's0' },
    { id: 'missing', text: 'On nothing', anchor: 'gone', position: { x: 7, y: 8 } },
    { id: 'free', text: 'Free', position: { x: 50, y: 60 } },
  ],
};

/** The same notes, free, at the point each was shown at. */
const freed: SododeckFile['stickies'] = [
  { id: 'offset', text: 'On n0', position: { x: 305, y: 35 }, collapsed: true },
  { id: 'default', text: 'On n0, no offset', position: { x: 324, y: -56 } },
  { id: 'grid', text: 'On a grid card', position: { x: NODE_GRID.dx + 12, y: -4 } },
  { id: 'edge', text: 'On a connector', position: { x: 1, y: 2 } },
  { id: 'step', text: 'On a step', position: { x: 0, y: 0 } },
  { id: 'missing', text: 'On nothing', position: { x: 7, y: 8 } },
  { id: 'free', text: 'Free', position: { x: 50, y: 60 } },
];

describe('legacyStickyPoint (ADR 0041)', () => {
  it('is the card point plus the offset, or the old default offset', () => {
    const [offset, byDefault, grid] = legacy.stickies;
    expect(offset && legacyStickyPoint(legacy, offset)).toEqual({ x: 305, y: 35 });
    expect(byDefault && legacyStickyPoint(legacy, byDefault)).toEqual({ x: 324, y: -56 });
    expect(grid && legacyStickyPoint(legacy, grid)).toEqual({ x: NODE_GRID.dx + 12, y: -4 });
  });

  it('is the note’s own position for any other anchor, the origin without one', () => {
    const others = legacy.stickies.slice(3);
    expect(others.map((sticky) => legacyStickyPoint(legacy, sticky))).toEqual([
      { x: 1, y: 2 },
      { x: 0, y: 0 },
      { x: 7, y: 8 },
      { x: 50, y: 60 },
    ]);
  });
});

describe('freeAnchoredStickies', () => {
  it('drops every anchor and stores the absolute point', () => {
    expect(freeAnchoredStickies(legacy).stickies).toEqual(freed);
  });

  it('returns a file without anchors unchanged (same object)', () => {
    const current = { ...legacy, stickies: freed };
    expect(freeAnchoredStickies(current)).toBe(current);
  });
});

describe('loading a legacy file', () => {
  it('fromJSON and loadDeck turn anchored notes into free notes', () => {
    expect(toJSON(fromJSON(legacy)).stickies).toEqual(freed);
    expect(toJSON(loadDeck(legacy).doc).stickies).toEqual(freed);
  });

  it('writes no anchor on save, and the saved file round-trips losslessly', () => {
    const saved = toJSON(fromJSON(legacy));
    expect(serializeDeck(saved)).not.toContain('"anchor"');
    expect(toJSON(fromJSON(saved))).toEqual(saved);
  });

  it('keeps connectors that end on a legacy note', () => {
    const file: SododeckFile = {
      ...legacy,
      edges: [...legacy.edges, { id: 'to-note', from: 'n0', to: 'offset' }],
    };
    expect(toJSON(fromJSON(file)).edges.map((edge) => edge.id)).toEqual(['e0', 'to-note']);
  });
});

describe('editor.freeLegacyStickies (a deck stored before ADR 0041)', () => {
  /** A stored deck: loaded, then anchors written straight into the Yjs maps, as an old build did. */
  function storedDeck() {
    const doc = fromJSON({ ...legacy, stickies: freed });
    const list = collectionMap(doc, 'stickies');
    doc.transact(() => {
      for (const sticky of legacy.stickies) {
        const map = list.get(sticky.id);
        if (map === undefined) throw new Error(`missing ${sticky.id}`);
        if (sticky.anchor !== undefined) map.set('anchor', sticky.anchor);
        if (sticky.position === undefined) map.delete('position');
        else map.set('position', toY(sticky.position));
      }
    });
    expect(toJSON(doc).stickies).toEqual(legacy.stickies);
    return doc;
  }

  it('frees every anchored note at the point it was shown at, untracked', () => {
    const doc = storedDeck();
    const editor = createEditor(doc);
    const origins: string[] = [];
    observeDeck(doc, (change) => origins.push(change.origin));
    expect(editor.freeLegacyStickies()).toEqual([
      'offset',
      'default',
      'grid',
      'edge',
      'step',
      'missing',
    ]);
    expect(toJSON(doc).stickies).toEqual(freed);
    expect(origins).toEqual(['local']);
    expect(editor.canUndo()).toBe(false);
  });

  it('writes nothing when no note has an anchor', () => {
    const doc = fromJSON(legacy);
    const before = Y.encodeStateVector(doc);
    expect(createEditor(doc).freeLegacyStickies()).toEqual([]);
    expect(Y.encodeStateVector(doc)).toEqual(before);
  });
});
