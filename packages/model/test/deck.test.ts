import { readFile } from 'node:fs/promises';

import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createDeck, DeckValidationError, fromJSON, serializeDeck, toJSON } from '../src';

const example = JSON.parse(
  await readFile(
    new URL(import.meta.resolve('@sododeck/schema/examples/minimal.sododeck.json')),
    'utf8',
  ),
) as SododeckFile;

/** Exercises nested objects, nested arrays, all primitive types and every collection. */
const rich: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [{ id: 'a', title: 'A', tags: ['x', 'y'], meta: { n: 1.5, ok: true, none: null } }],
  groups: [{ id: 'g', children: ['a'] }],
  edges: [{ id: 'e', from: 'a', to: 'a' }],
  views: [{ id: 'v', positions: { a: { x: 0, y: -10 } } }],
  features: [{ id: 'f' }],
  flows: [{ id: 'fl', steps: [{ edge: 'e', rules: ['R-1'] }, { edge: 'e' }] }],
  rules: { 'R-1': { title: 'Rule', table: [{ when: 'a > 1', then: 'b' }] } },
  stickies: [{ id: 's', text: 'Note', anchor: 'a' }],
};

describe('deck model', () => {
  it('createDeck() produces an empty valid file', () => {
    expect(toJSON(createDeck())).toEqual(emptySododeckFile());
  });

  it.each([
    ['example', example],
    ['rich', rich],
  ])('round-trips the %s deck losslessly', (_name, file) => {
    expect(toJSON(fromJSON(file))).toEqual(file);
    expect(serializeDeck(toJSON(fromJSON(file)))).toBe(serializeDeck(file));
  });

  it('survives Yjs update encoding (persistence / sync path)', () => {
    const replica = new Y.Doc();
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(fromJSON(rich)));
    expect(toJSON(replica)).toEqual(rich);
  });

  it('keeps ids stable when an object is renamed', () => {
    const doc = fromJSON(example);
    const node = doc.getArray<Y.Map<unknown>>('nodes').get(1);
    node.set('title', 'Orders API');

    const out = toJSON(doc);
    expect(out.nodes[1]).toEqual({ id: 'order-svc', type: 'service', title: 'Orders API' });
    expect(out.edges.map((e) => [e.from, e.to])).toEqual([
      ['web-app', 'order-svc'],
      ['order-svc', 'orders-db'],
    ]);
  });

  it('writes top-level keys in canonical order', () => {
    expect(Object.keys(toJSON(fromJSON(rich)))).toEqual(Object.keys(emptySododeckFile()));
  });

  it('rejects invalid input with a DeckValidationError', () => {
    expect(() => fromJSON({ version: 1 })).toThrow(DeckValidationError);
  });
});
