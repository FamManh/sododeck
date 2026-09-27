import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createDeck, DeckValidationError, fromJSON, serializeDeck, toJSON } from '../src';
import { readExample } from './helpers';

const example = await readExample('minimal.sododeck.json');
const flowAndRule = await readExample('flow-and-rule.sododeck.json');
/** Uses every object type and every field of format v1. */
const full = await readExample('full.sododeck.json');

/** Exercises nested objects, nested arrays, maps, numbers (negative, fractional) and every collection. */
const rich: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    {
      id: 'a',
      type: 'service',
      title: 'A',
      tags: ['x', 'y'],
      links: [{ label: 'Repo', url: 'https://example.com/a' }],
      rules: ['R-1'],
      position: { x: 1.5, y: -10 },
    },
  ],
  groups: [{ id: 'g', title: 'Group' }],
  edges: [{ id: 'e', from: 'a', to: 'a', protocol: 'http' }],
  views: [{ id: 'v', type: 'custom', title: 'View', positions: { a: { x: 0, y: -10 } } }],
  features: [{ id: 'f', title: 'Feature' }],
  flows: [
    {
      id: 'fl',
      title: 'Flow',
      steps: [
        { id: 's1', edge: 'e', rules: ['R-1'], ruleInputs: { 'R-1': { in1: '3' } } },
        { id: 's2', edge: 'e' },
      ],
    },
  ],
  rules: {
    'R-1': {
      title: 'Rule',
      hitPolicy: 'first',
      inputs: [{ id: 'in1', label: 'Attempt' }],
      outputs: [{ id: 'out1', label: 'Action' }],
      rows: [{ id: 'r1', when: ['> 1'], then: ['Return'] }],
    },
  },
  stickies: [{ id: 's', text: 'Note', anchor: 'a' }],
};

/** Optional deck metadata must survive the round-trip too. */
const { $schema, version, ...collections } = emptySododeckFile();
const withMeta: SododeckFile = {
  $schema,
  version,
  name: 'Delivery',
  description: 'Last-mile **delivery**.',
  tags: ['logistics', 'v1'],
  ...collections,
};

describe('deck model', () => {
  it('createDeck() produces an empty valid file', () => {
    expect(toJSON(createDeck())).toEqual(emptySododeckFile());
  });

  it.each([
    ['example', example],
    ['rich', rich],
    ['with metadata', withMeta],
    ['flow-and-rule example', flowAndRule],
    ['full example', full],
  ])('round-trips the %s deck losslessly', (_name, file) => {
    expect(toJSON(fromJSON(file))).toEqual(file);
    expect(serializeDeck(toJSON(fromJSON(file)))).toBe(serializeDeck(file));
  });

  it.each([
    ['rich', rich],
    ['full example', full],
  ])('survives Yjs update encoding of the %s deck (persistence / sync path)', (_name, file) => {
    const replica = new Y.Doc();
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(fromJSON(file)));
    expect(toJSON(replica)).toEqual(file);
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
